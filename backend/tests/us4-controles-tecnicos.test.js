import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCUDERIAS_DEMO, escucharEventos, idsDemo, iniciarServidor } from './ayudantes.js';

function inspeccionValida(extra = {}) {
  return { fecha: '2026-09-27', tipo: 'PESO', estadoTecnico: 'APROBADO', ...extra };
}

describe('US4 · La FIA guarda y publica los resultados de las inspecciones técnicas', () => {
  let s;
  let tokenFia;
  let ids;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    ids = await idsDemo(s);
  });
  after(() => s.cerrar());

  test('registra la fecha, el tipo de inspección y el estado técnico de un vehículo', async () => {
    const piloto = ids.piloto('F1', 45);
    const r = await s.api('POST', '/api/fia/inspecciones', {
      token: tokenFia,
      body: inspeccionValida({ pilotoId: piloto.id, tipo: 'COMBUSTIBLE' }),
    });
    assert.equal(r.status, 201);
    assert.deepEqual(
      { fecha: r.body.inspeccion.fecha, tipo: r.body.inspeccion.tipo, estado: r.body.inspeccion.estadoTecnico },
      { fecha: '2026-09-27', tipo: 'COMBUSTIBLE', estado: 'APROBADO' },
    );
    assert.equal(r.body.inspeccion.piloto.numero, 45);
    assert.equal(r.body.inspeccion.escuderia.id, ids.andes.id);
  });

  test('valida que estén los datos obligatorios', async () => {
    const r = await s.api('POST', '/api/fia/inspecciones', { token: tokenFia, body: {} });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.detalles).sort(), ['estadoTecnico', 'fecha', 'pilotoId', 'tipo']);
  });

  test('exige observaciones cuando el vehículo no queda aprobado y rechaza fechas futuras', async () => {
    const r = await s.api('POST', '/api/fia/inspecciones', {
      token: tokenFia,
      body: inspeccionValida({ pilotoId: ids.piloto('F1', 7).id, estadoTecnico: 'RECHAZADO', fecha: '2026-10-30' }),
    });
    assert.equal(r.status, 400);
    assert.ok(r.body.detalles.observaciones);
    assert.ok(r.body.detalles.fecha);
  });

  test('modifica una inspección y deja el cambio en la auditoría', async () => {
    const alta = await s.api('POST', '/api/fia/inspecciones', {
      token: tokenFia,
      body: inspeccionValida({ pilotoId: ids.piloto('F1', 7).id }),
    });
    const id = alta.body.inspeccion.id;
    const r = await s.api('PUT', `/api/fia/inspecciones/${id}`, {
      token: tokenFia,
      body: inspeccionValida({
        pilotoId: ids.piloto('F1', 7).id,
        estadoTecnico: 'OBSERVADO',
        observaciones: 'Fondo plano con desgaste en el límite.',
      }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.inspeccion.estadoTecnico, 'OBSERVADO');
    const auditado = s.db.prepare("SELECT detalle FROM auditoria WHERE accion = 'INSPECCION_MODIFICACION'").get();
    assert.deepEqual(JSON.parse(auditado.detalle).cambios.estadoTecnico, { antes: 'APROBADO', despues: 'OBSERVADO' });
  });

  test('elimina una inspección y deja de mostrarse', async () => {
    const alta = await s.api('POST', '/api/fia/inspecciones', {
      token: tokenFia,
      body: inspeccionValida({ pilotoId: ids.piloto('F1', 23).id }),
    });
    const id = alta.body.inspeccion.id;
    assert.equal((await s.api('DELETE', `/api/fia/inspecciones/${id}`, { token: tokenFia })).status, 204);
    const { body } = await s.api('GET', '/api/publico/inspecciones');
    assert.ok(body.inspecciones.every((i) => i.id !== id));
    assert.equal((await s.api('DELETE', `/api/fia/inspecciones/${id}`, { token: tokenFia })).status, 404);
  });

  test('solo la FIA puede cargar, modificar o eliminar inspecciones', async () => {
    const tokenEscuderia = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    const tokenPublico = await s.loginPublico();
    const body = inspeccionValida({ pilotoId: ids.piloto('F1', 12).id });
    assert.equal((await s.api('POST', '/api/fia/inspecciones', { token: tokenEscuderia, body })).status, 403);
    assert.equal((await s.api('POST', '/api/fia/inspecciones', { token: tokenPublico, body })).status, 403);
    const { body: lista } = await s.api('GET', '/api/publico/inspecciones');
    const id = lista.inspecciones[0].id;
    assert.equal((await s.api('DELETE', `/api/fia/inspecciones/${id}`, { token: tokenEscuderia })).status, 403);
  });
});

describe('US4 · Los resultados de las inspecciones son visibles en todos los perfiles', () => {
  let s;
  let inspeccion;
  let aviso;
  before(async () => {
    s = await iniciarServidor();
    const tokenFia = await s.loginFia();
    const ids = await idsDemo(s);
    const escucha = await escucharEventos(s.base);
    const r = await s.api('POST', '/api/fia/inspecciones', {
      token: tokenFia,
      body: inspeccionValida({ pilotoId: ids.piloto('F2', 4).id, tipo: 'SEGURIDAD' }),
    });
    inspeccion = r.body.inspeccion;
    aviso = await escucha.esperar(/event: inspecciones/);
  });
  after(() => s.cerrar());

  test('las ve el público sin iniciar sesión', async () => {
    const { body } = await s.api('GET', '/api/publico/inspecciones');
    assert.ok(body.inspecciones.some((i) => i.id === inspeccion.id));
  });

  test('las ven las escuderías, el público registrado y la FIA', async () => {
    for (const token of [
      await s.loginEscuderia(ESCUDERIAS_DEMO.pampa.email),
      await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email),
      await s.loginPublico(),
      await s.loginFia(),
    ]) {
      const { body } = await s.api('GET', '/api/publico/inspecciones', { token });
      assert.ok(body.inspecciones.some((i) => i.id === inspeccion.id));
    }
  });

  test('las vistas abiertas reciben un aviso en vivo', () => {
    assert.match(aviso, /"accion":"alta"/);
  });
});

describe('US4 · Filtro de las revisiones por escudería', () => {
  let s;
  let ids;
  before(async () => {
    s = await iniciarServidor();
    ids = await idsDemo(s);
  });
  after(() => s.cerrar());

  test('muestra solo las inspecciones de la escudería elegida', async () => {
    const { body } = await s.api('GET', `/api/publico/inspecciones?escuderia=${ids.andes.id}`);
    const total = s.db.prepare('SELECT COUNT(*) AS n FROM inspecciones WHERE escuderia_id = ?').get(ids.andes.id).n;
    assert.ok(total > 0);
    assert.equal(body.inspecciones.length, total);
    assert.ok(body.inspecciones.every((i) => i.escuderia.id === ids.andes.id));
  });

  test('distingue la misma escudería en categorías distintas', async () => {
    const f2 = await s.api('GET', `/api/publico/inspecciones?escuderia=${ids.pampaF2.id}`);
    const f3 = await s.api('GET', `/api/publico/inspecciones?escuderia=${ids.pampaF3.id}`);
    assert.ok(f2.body.inspecciones.every((i) => i.categoria.codigo === 'F2'));
    assert.ok(f3.body.inspecciones.every((i) => i.categoria.codigo === 'F3'));
  });

  test('sin filtro muestra todas y también se puede filtrar por categoría y estado técnico', async () => {
    const todas = await s.api('GET', '/api/publico/inspecciones');
    const total = s.db.prepare('SELECT COUNT(*) AS n FROM inspecciones').get().n;
    assert.equal(todas.body.inspecciones.length, total);
    const rechazadas = await s.api('GET', '/api/publico/inspecciones?estadoTecnico=RECHAZADO');
    assert.ok(rechazadas.body.inspecciones.length > 0);
    assert.ok(rechazadas.body.inspecciones.every((i) => i.estadoTecnico === 'RECHAZADO'));
    const f1 = await s.api('GET', '/api/publico/inspecciones?categoria=F1');
    assert.ok(f1.body.inspecciones.every((i) => i.categoria.codigo === 'F1'));
  });
});
