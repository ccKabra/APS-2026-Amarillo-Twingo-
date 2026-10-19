import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCUDERIAS_DEMO, escucharEventos, iniciarServidor } from './ayudantes.js';

function eventoValido(extra = {}) {
  return {
    nombre: 'Gran Premio de Chile',
    tipo: 'CARRERA',
    categoria: 'F1',
    circuito: 'Autódromo de Codegua',
    pais: 'Chile',
    fecha: '2027-04-11',
    hora: '15:00',
    ...extra,
  };
}

describe('US10 · La FIA carga, modifica y elimina las fechas de carreras y eventos', () => {
  let s;
  let tokenFia;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
  });
  after(() => s.cerrar());

  test('guarda una fecha nueva y queda publicada en el calendario', async () => {
    const r = await s.api('POST', '/api/fia/calendario', { token: tokenFia, body: eventoValido() });
    assert.equal(r.status, 201);
    assert.equal(r.body.evento.categoria.codigo, 'F1');
    const { body } = await s.api('GET', '/api/publico/calendario?mes=2027-04');
    assert.ok(body.eventos.some((e) => e.id === r.body.evento.id));
  });

  test('valida los datos obligatorios y el formato de fecha y hora', async () => {
    const vacio = await s.api('POST', '/api/fia/calendario', { token: tokenFia, body: {} });
    assert.equal(vacio.status, 400);
    assert.deepEqual(Object.keys(vacio.body.detalles).sort(), ['categoria', 'circuito', 'fecha', 'nombre', 'pais', 'tipo']);
    const formato = await s.api('POST', '/api/fia/calendario', {
      token: tokenFia,
      body: eventoValido({ fecha: '2027-02-30', hora: '25:00' }),
    });
    assert.equal(formato.status, 400);
    assert.ok(formato.body.detalles.fecha && formato.body.detalles.hora);
  });

  test('modifica un evento', async () => {
    const alta = await s.api('POST', '/api/fia/calendario', { token: tokenFia, body: eventoValido({ categoria: 'F2' }) });
    const r = await s.api('PUT', `/api/fia/calendario/${alta.body.evento.id}`, {
      token: tokenFia,
      body: eventoValido({ categoria: 'F2', nombre: 'Ronda de Chile', hora: null }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.evento.nombre, 'Ronda de Chile');
    assert.equal(r.body.evento.hora, null);
  });

  test('elimina un evento y deja de figurar', async () => {
    const alta = await s.api('POST', '/api/fia/calendario', { token: tokenFia, body: eventoValido({ categoria: 'F3' }) });
    const id = alta.body.evento.id;
    assert.equal((await s.api('DELETE', `/api/fia/calendario/${id}`, { token: tokenFia })).status, 204);
    const { body } = await s.api('GET', '/api/publico/calendario');
    assert.ok(body.eventos.every((e) => e.id !== id));
    const auditado = s.db.prepare("SELECT * FROM auditoria WHERE accion = 'EVENTO_ELIMINADO' AND entidad_id = ?").get(id);
    assert.ok(auditado);
  });

  test('solo la FIA puede cargar, modificar o eliminar fechas', async () => {
    const tokenEscuderia = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    const tokenPublico = await s.loginPublico();
    assert.equal((await s.api('POST', '/api/fia/calendario', { token: tokenEscuderia, body: eventoValido() })).status, 403);
    assert.equal((await s.api('POST', '/api/fia/calendario', { token: tokenPublico, body: eventoValido() })).status, 403);
    const { body } = await s.api('GET', '/api/publico/calendario');
    const id = body.eventos[0].id;
    assert.equal((await s.api('DELETE', `/api/fia/calendario/${id}`, { token: tokenEscuderia })).status, 403);
  });
});

describe('US10 · Las fechas son visibles en todos los perfiles', () => {
  let s;
  let evento;
  let aviso;
  before(async () => {
    s = await iniciarServidor();
    const tokenFia = await s.loginFia();
    const escucha = await escucharEventos(s.base);
    const r = await s.api('POST', '/api/fia/calendario', { token: tokenFia, body: eventoValido() });
    evento = r.body.evento;
    aviso = await escucha.esperar(/event: calendario/);
  });
  after(() => s.cerrar());

  test('las ve el público sin iniciar sesión', async () => {
    const { body } = await s.api('GET', '/api/publico/calendario');
    assert.ok(body.eventos.some((e) => e.id === evento.id));
    assert.ok(!('oficializadoPor' in body.eventos[0]), 'la vista pública no expone quién firmó');
  });

  test('las ven las escuderías, el público registrado y la FIA', async () => {
    for (const token of [await s.loginEscuderia(ESCUDERIAS_DEMO.aurora.email), await s.loginPublico()]) {
      const { body } = await s.api('GET', '/api/publico/calendario', { token });
      assert.ok(body.eventos.some((e) => e.id === evento.id));
    }
    const fia = await s.api('GET', '/api/fia/calendario', { token: await s.loginFia() });
    assert.ok(fia.body.eventos.some((e) => e.id === evento.id));
  });

  test('las vistas abiertas reciben un aviso en vivo', () => {
    assert.match(aviso, /"accion":"alta"/);
  });
});

describe('US10 · Las fechas figuran como especulativas hasta que se confirman como oficiales', () => {
  let s;
  let tokenFia;
  let evento;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    const r = await s.api('POST', '/api/fia/calendario', { token: tokenFia, body: eventoValido() });
    evento = r.body.evento;
  });
  after(() => s.cerrar());

  test('una fecha nueva es especulativa', async () => {
    assert.equal(evento.estado, 'ESPECULATIVA');
    assert.equal(evento.oficializadoEn, null);
    const { body } = await s.api('GET', '/api/publico/calendario');
    assert.equal(body.eventos.find((e) => e.id === evento.id).estado, 'ESPECULATIVA');
  });

  test('la firma de fecha oficial es exclusiva de la FIA', async () => {
    const ruta = `/api/fia/calendario/${evento.id}/oficializar`;
    assert.equal((await s.api('POST', ruta, { token: await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email) })).status, 403);
    assert.equal((await s.api('POST', ruta, { token: await s.loginPublico() })).status, 403);
    assert.equal((await s.api('POST', ruta)).status, 401);
  });

  test('la FIA la firma como oficial y queda registrado quién y cuándo', async () => {
    const r = await s.api('POST', `/api/fia/calendario/${evento.id}/oficializar`, { token: tokenFia });
    assert.equal(r.status, 200);
    assert.equal(r.body.evento.estado, 'OFICIAL');
    assert.ok(r.body.evento.oficializadoEn);
    assert.equal(r.body.evento.oficializadoPor, 'Laura Méndez');
    const { body } = await s.api('GET', '/api/publico/calendario');
    assert.equal(body.eventos.find((e) => e.id === evento.id).estado, 'OFICIAL');
    const auditado = s.db.prepare("SELECT * FROM auditoria WHERE accion = 'EVENTO_OFICIALIZADO' AND entidad_id = ?").get(evento.id);
    assert.equal(auditado.usuario_email, 'admin@fia.test');
  });

  test('no se puede oficializar dos veces', async () => {
    const r = await s.api('POST', `/api/fia/calendario/${evento.id}/oficializar`, { token: tokenFia });
    assert.equal(r.status, 409);
  });

  test('cambiar datos que no son la fecha mantiene la fecha oficial', async () => {
    const r = await s.api('PUT', `/api/fia/calendario/${evento.id}`, {
      token: tokenFia,
      body: eventoValido({ nombre: 'Gran Premio de Chile 2027' }),
    });
    assert.equal(r.body.evento.estado, 'OFICIAL');
    assert.equal(r.body.volvioAEspeculativa, false);
  });

  test('si cambia la fecha o la hora de una fecha oficial, vuelve a ser especulativa', async () => {
    const r = await s.api('PUT', `/api/fia/calendario/${evento.id}`, {
      token: tokenFia,
      body: eventoValido({ fecha: '2027-04-18' }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.evento.estado, 'ESPECULATIVA');
    assert.equal(r.body.evento.oficializadoEn, null);
    assert.equal(r.body.volvioAEspeculativa, true);
  });

  test('se puede filtrar por estado', async () => {
    const oficiales = await s.api('GET', '/api/publico/calendario?estado=OFICIAL');
    assert.ok(oficiales.body.eventos.length > 0);
    assert.ok(oficiales.body.eventos.every((e) => e.estado === 'OFICIAL'));
  });
});

describe('US10 · Filtro de las fechas por mes', () => {
  let s;
  before(async () => {
    s = await iniciarServidor();
  });
  after(() => s.cerrar());

  test('muestra solo los eventos del mes elegido, ordenados por fecha', async () => {
    const { body } = await s.api('GET', '/api/publico/calendario?mes=2026-11');
    const total = s.db.prepare("SELECT COUNT(*) AS n FROM eventos_calendario WHERE fecha LIKE '2026-11-%'").get().n;
    assert.ok(total > 0);
    assert.equal(body.eventos.length, total);
    assert.ok(body.eventos.every((e) => e.fecha.startsWith('2026-11-')));
    const fechas = body.eventos.map((e) => e.fecha);
    assert.deepEqual(fechas, [...fechas].sort());
  });

  test('combina el mes con la categoría', async () => {
    const { body } = await s.api('GET', '/api/publico/calendario?mes=2026-11&categoria=F1');
    assert.ok(body.eventos.length > 0);
    assert.ok(body.eventos.every((e) => e.fecha.startsWith('2026-11-') && e.categoria.codigo === 'F1'));
  });

  test('un mes sin eventos devuelve la lista vacía', async () => {
    const { body } = await s.api('GET', '/api/publico/calendario?mes=2026-02');
    assert.deepEqual(body.eventos, []);
  });

  test('rechaza un mes con formato inválido', async () => {
    const r = await s.api('GET', '/api/publico/calendario?mes=noviembre');
    assert.equal(r.status, 400);
    assert.ok(r.body.detalles.mes);
  });
});
