import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCUDERIAS_DEMO, escucharEventos, iniciarServidor } from './ayudantes.js';

function pruebaValida(extra = {}) {
  return {
    fecha: '2028-02-10',
    hora: '09:00',
    circuito: 'Circuito de Jerez',
    pais: 'España',
    cronograma: 'Mañana: secos.\nTarde: lluvia.',
    ...extra,
  };
}

describe('US7 · La FIA carga y fija las fechas de prueba de neumáticos', () => {
  let s;
  let tokenFia;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
  });
  after(() => s.cerrar());

  test('carga una fecha con su cronograma', async () => {
    const r = await s.api('POST', '/api/fia/neumaticos', { token: tokenFia, body: pruebaValida() });
    assert.equal(r.status, 201);
    assert.equal(r.body.prueba.anio, 2028);
    assert.equal(r.body.prueba.numero, 1);
    assert.equal(r.body.prueba.cronograma, 'Mañana: secos.\nTarde: lluvia.');
    assert.ok(s.db.prepare("SELECT 1 FROM auditoria WHERE accion = 'PRUEBA_NEUMATICOS_ALTA'").get());
  });

  test('valida los datos obligatorios', async () => {
    const r = await s.api('POST', '/api/fia/neumaticos', { token: tokenFia, body: {} });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.detalles).sort(), ['circuito', 'fecha', 'pais']);
  });

  test('las dos fechas del año no pueden coincidir', async () => {
    const r = await s.api('POST', '/api/fia/neumaticos', { token: tokenFia, body: pruebaValida() });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'FECHA_REPETIDA');
  });

  test('admite 2 fechas por año y rechaza una tercera', async () => {
    const segunda = await s.api('POST', '/api/fia/neumaticos', { token: tokenFia, body: pruebaValida({ fecha: '2028-07-05' }) });
    assert.equal(segunda.body.prueba.numero, 2);
    const tercera = await s.api('POST', '/api/fia/neumaticos', { token: tokenFia, body: pruebaValida({ fecha: '2028-09-01' }) });
    assert.equal(tercera.status, 409);
    assert.equal(tercera.body.error, 'CUPO_COMPLETO');
  });

  test('otro año tiene su propio cupo', async () => {
    const r = await s.api('POST', '/api/fia/neumaticos', { token: tokenFia, body: pruebaValida({ fecha: '2029-02-10' }) });
    assert.equal(r.status, 201);
    assert.equal(r.body.prueba.numero, 1);
  });

  test('mover una fecha a un año con cupo completo se rechaza', async () => {
    const { body } = await s.api('GET', '/api/fia/neumaticos?anio=2029', { token: tokenFia });
    const r = await s.api('PUT', `/api/fia/neumaticos/${body.pruebas[0].id}`, {
      token: tokenFia,
      body: pruebaValida({ fecha: '2028-10-01' }),
    });
    assert.equal(r.status, 409);
  });

  test('eliminar una fecha libera su lugar', async () => {
    const { body } = await s.api('GET', '/api/fia/neumaticos?anio=2028', { token: tokenFia });
    const primera = body.pruebas[0];
    assert.equal((await s.api('DELETE', `/api/fia/neumaticos/${primera.id}`, { token: tokenFia })).status, 204);
    const r = await s.api('POST', '/api/fia/neumaticos', { token: tokenFia, body: pruebaValida({ fecha: '2028-03-03' }) });
    assert.equal(r.body.prueba.numero, primera.numero);
  });

  test('solo la FIA puede cargar, modificar o eliminar', async () => {
    const tokens = [await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email), await s.loginPublico()];
    for (const token of tokens) {
      assert.equal((await s.api('POST', '/api/fia/neumaticos', { token, body: pruebaValida() })).status, 403);
      assert.equal((await s.api('DELETE', '/api/fia/neumaticos/1', { token })).status, 403);
    }
    assert.equal((await s.api('POST', '/api/fia/neumaticos', { body: pruebaValida() })).status, 401);
  });
});

describe('US7 · Las fechas figuran como no oficiales hasta que se firman', () => {
  let s;
  let tokenFia;
  let prueba;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    prueba = (await s.api('POST', '/api/fia/neumaticos', { token: tokenFia, body: pruebaValida() })).body.prueba;
  });
  after(() => s.cerrar());

  const publica = async () => (await s.api('GET', '/api/publico/neumaticos?anio=2028')).body.pruebas[0];

  test('una fecha cargada es no oficial', async () => {
    assert.equal(prueba.estado, 'NO_OFICIAL');
    assert.equal((await publica()).estado, 'NO_OFICIAL');
  });

  test('la firma es exclusiva de la FIA', async () => {
    const ruta = `/api/fia/neumaticos/${prueba.id}/firmar`;
    assert.equal((await s.api('POST', ruta, { token: await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email) })).status, 403);
    assert.equal((await s.api('POST', ruta, { token: await s.loginPublico() })).status, 403);
    assert.equal((await s.api('POST', ruta)).status, 401);
    assert.equal((await publica()).estado, 'NO_OFICIAL');
  });

  test('la FIA la firma y queda registrado quién y cuándo', async () => {
    const r = await s.api('POST', `/api/fia/neumaticos/${prueba.id}/firmar`, { token: tokenFia });
    assert.equal(r.status, 200);
    assert.equal(r.body.prueba.estado, 'OFICIAL');
    assert.equal(r.body.prueba.firmadaPor, 'Laura Méndez');
    assert.equal((await publica()).estado, 'OFICIAL');
    const auditado = s.db.prepare("SELECT * FROM auditoria WHERE accion = 'PRUEBA_NEUMATICOS_FIRMA'").get();
    assert.equal(auditado.usuario_email, 'admin@fia.test');
  });

  test('no se puede firmar dos veces', async () => {
    assert.equal((await s.api('POST', `/api/fia/neumaticos/${prueba.id}/firmar`, { token: tokenFia })).status, 409);
  });

  test('cambiar el circuito mantiene la firma', async () => {
    const r = await s.api('PUT', `/api/fia/neumaticos/${prueba.id}`, {
      token: tokenFia,
      body: pruebaValida({ circuito: 'Circuito de Montmeló' }),
    });
    assert.equal(r.body.prueba.estado, 'OFICIAL');
    assert.equal(r.body.volvioANoOficial, false);
  });

  test('si cambia la fecha, vuelve a ser no oficial', async () => {
    const r = await s.api('PUT', `/api/fia/neumaticos/${prueba.id}`, {
      token: tokenFia,
      body: pruebaValida({ fecha: '2028-02-17' }),
    });
    assert.equal(r.body.prueba.estado, 'NO_OFICIAL');
    assert.equal(r.body.prueba.firmadaEn, null);
    assert.equal(r.body.volvioANoOficial, true);
  });
});

describe('US7 · Las fechas son visibles para el público y las escuderías', () => {
  let s;
  let aviso;
  before(async () => {
    s = await iniciarServidor();
    const escucha = await escucharEventos(s.base);
    await s.api('POST', '/api/fia/neumaticos', { token: await s.loginFia(), body: pruebaValida() });
    aviso = await escucha.esperar(/event: neumaticos/);
  });
  after(() => s.cerrar());

  test('las ve el público sin iniciar sesión, sin exponer quién firmó', async () => {
    const { status, body } = await s.api('GET', '/api/publico/neumaticos');
    assert.equal(status, 200);
    assert.ok(body.pruebas.some((p) => p.fecha === '2028-02-10'));
    assert.ok(body.pruebas.every((p) => !('firmadaPor' in p)));
  });

  test('las ve una escudería', async () => {
    const token = await s.loginEscuderia(ESCUDERIAS_DEMO.aurora.email);
    const { body } = await s.api('GET', '/api/publico/neumaticos', { token });
    assert.ok(body.pruebas.some((p) => p.fecha === '2028-02-10'));
  });

  test('las vistas abiertas reciben un aviso en vivo', () => {
    assert.match(aviso, /"accion":"alta"/);
  });
});
