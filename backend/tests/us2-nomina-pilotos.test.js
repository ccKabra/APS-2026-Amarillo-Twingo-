import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCUDERIAS_DEMO, iniciarServidor, pilotoValido } from './ayudantes.js';

async function escuderiasDe(s, token) {
  const { body } = await s.api('GET', '/api/escuderia/mis-escuderias', { token });
  return body.escuderias;
}

describe('US2 · La escudería gestiona solo su propia nómina', () => {
  let s;
  let token;
  let andes;
  let atlantico;
  before(async () => {
    s = await iniciarServidor();
    token = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    [andes] = await escuderiasDe(s, token);
    const tokenAtlantico = await s.loginEscuderia('sofia.pereyra@atlanticogp.test');
    [atlantico] = await escuderiasDe(s, tokenAtlantico);
  });
  after(() => s.cerrar());

  test('da de alta un piloto en su escudería', async () => {
    const r = await s.api('POST', `/api/escuderia/${andes.id}/pilotos`, { token, body: pilotoValido() });
    assert.equal(r.status, 201);
    assert.equal(r.body.piloto.escuderia.id, andes.id);
    assert.equal(r.body.piloto.rol, 'SUPLENTE');
  });

  test('no puede crear pilotos en una escudería que no está asociada a su cuenta', async () => {
    const r = await s.api('POST', `/api/escuderia/${atlantico.id}/pilotos`, { token, body: pilotoValido({ numero: 90 }) });
    assert.equal(r.status, 403);
  });

  test('no puede modificar ni dar de baja pilotos de otra escudería', async () => {
    const { body } = await s.api('GET', `/api/publico/pilotos?escuderia=${atlantico.id}`);
    const ajeno = body.pilotos[0];
    const put = await s.api('PUT', `/api/escuderia/${andes.id}/pilotos/${ajeno.id}`, {
      token,
      body: pilotoValido({ numero: 91 }),
    });
    assert.equal(put.status, 404, 'el piloto no pertenece a la escudería seleccionada');
    const del = await s.api('DELETE', `/api/escuderia/${atlantico.id}/pilotos/${ajeno.id}`, { token });
    assert.equal(del.status, 403);
  });

  test('modifica los datos de uno de sus pilotos', async () => {
    const { body } = await s.api('GET', `/api/escuderia/${andes.id}/pilotos`, { token });
    const piloto = body.pilotos.find((p) => p.numero === 45);
    const r = await s.api('PUT', `/api/escuderia/${andes.id}/pilotos/${piloto.id}`, {
      token,
      body: { ...piloto, nacionalidad: 'Chile' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.piloto.nacionalidad, 'Chile');
  });

  test('da de baja un piloto y deja de figurar en la nómina', async () => {
    const { body } = await s.api('GET', `/api/escuderia/${andes.id}/pilotos`, { token });
    const piloto = body.pilotos.find((p) => p.numero === 88);
    assert.equal((await s.api('DELETE', `/api/escuderia/${andes.id}/pilotos/${piloto.id}`, { token })).status, 204);
    const despues = await s.api('GET', `/api/escuderia/${andes.id}/pilotos`, { token });
    assert.ok(despues.body.pilotos.every((p) => p.id !== piloto.id));
  });
});

describe('US2 · Rol del piloto (Titular / Suplente)', () => {
  let s;
  let token;
  let andes;
  before(async () => {
    s = await iniciarServidor();
    token = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    [andes] = await escuderiasDe(s, token);
  });
  after(() => s.cerrar());

  test('permite cambiar explícitamente el rol de un piloto', async () => {
    const { body } = await s.api('GET', `/api/escuderia/${andes.id}/pilotos`, { token });
    const suplente = body.pilotos.find((p) => p.rol === 'SUPLENTE');
    const r = await s.api('PATCH', `/api/escuderia/${andes.id}/pilotos/${suplente.id}/rol`, { token, body: { rol: 'TITULAR' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.piloto.rol, 'TITULAR');
    const auditado = s.db.prepare("SELECT detalle FROM auditoria WHERE accion = 'PILOTO_CAMBIO_ROL'").get();
    assert.deepEqual(
      { de: JSON.parse(auditado.detalle).de, a: JSON.parse(auditado.detalle).a },
      { de: 'SUPLENTE', a: 'TITULAR' },
    );
  });

  test('rechaza un rol que no sea Titular o Suplente', async () => {
    const { body } = await s.api('GET', `/api/escuderia/${andes.id}/pilotos`, { token });
    const r = await s.api('PATCH', `/api/escuderia/${andes.id}/pilotos/${body.pilotos[0].id}/rol`, {
      token,
      body: { rol: 'RESERVA' },
    });
    assert.equal(r.status, 400);
  });
});

describe('US2 · Validaciones del formulario y número único por categoría', () => {
  let s;
  let token;
  let andes;
  before(async () => {
    s = await iniciarServidor();
    token = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    [andes] = await escuderiasDe(s, token);
  });
  after(() => s.cerrar());

  test('valida que estén todos los datos obligatorios antes de guardar', async () => {
    const r = await s.api('POST', `/api/escuderia/${andes.id}/pilotos`, { token, body: {} });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.detalles).sort(), [
      'apellido',
      'fechaNacimiento',
      'nacionalidad',
      'nombre',
      'numero',
      'rol',
    ]);
  });

  test('valida formato de fecha, edad y rango del número', async () => {
    const r = await s.api('POST', `/api/escuderia/${andes.id}/pilotos`, {
      token,
      body: pilotoValido({ fechaNacimiento: '2020-02-30', numero: 150 }),
    });
    assert.equal(r.status, 400);
    assert.ok(r.body.detalles.fechaNacimiento);
    assert.ok(r.body.detalles.numero);
  });

  test('no permite asignar un número que ya usa otro piloto de la misma categoría', async () => {
    const r = await s.api('POST', `/api/escuderia/${andes.id}/pilotos`, { token, body: pilotoValido({ numero: 7 }) });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'NUMERO_EN_USO');
    assert.match(r.body.mensaje, /Olivera/);
  });

  test('el mismo número sí se puede usar en otra categoría', async () => {
    const { body } = await s.api('GET', '/api/publico/pilotos');
    const doce = body.pilotos
      .filter((p) => p.numero === 12)
      .map((p) => p.categoria.codigo)
      .sort();
    assert.deepEqual(doce, ['F1', 'F3']);
  });

  test('al dar de baja un piloto su número queda libre', async () => {
    const { body } = await s.api('GET', `/api/escuderia/${andes.id}/pilotos`, { token });
    const suplente = body.pilotos.find((p) => p.numero === 45);
    await s.api('DELETE', `/api/escuderia/${andes.id}/pilotos/${suplente.id}`, { token });
    const r = await s.api('POST', `/api/escuderia/${andes.id}/pilotos`, { token, body: pilotoValido({ numero: 45 }) });
    assert.equal(r.status, 201);
  });
});

describe('US2 · Cuenta con varias escuderías: se opera sobre la seleccionada', () => {
  let s;
  let token;
  let f2;
  let f3;
  before(async () => {
    s = await iniciarServidor();
    token = await s.loginEscuderia(ESCUDERIAS_DEMO.pampa.email);
    const escuderias = await escuderiasDe(s, token);
    f2 = escuderias.find((e) => e.categoria === 'F2');
    f3 = escuderias.find((e) => e.categoria === 'F3');
  });
  after(() => s.cerrar());

  test('la cuenta tiene asociadas dos escuderías (F2 y F3)', () => {
    assert.ok(f2 && f3);
  });

  test('crea pilotos en la escudería seleccionada', async () => {
    const r = await s.api('POST', `/api/escuderia/${f3.id}/pilotos`, { token, body: pilotoValido({ numero: 77 }) });
    assert.equal(r.status, 201);
    assert.equal(r.body.piloto.categoria.codigo, 'F3');
  });

  test('no puede modificar un piloto de F3 si tiene seleccionada la escudería de F2', async () => {
    const { body } = await s.api('GET', `/api/escuderia/${f3.id}/pilotos`, { token });
    const pilotoF3 = body.pilotos[0];
    const r = await s.api('PUT', `/api/escuderia/${f2.id}/pilotos/${pilotoF3.id}`, { token, body: pilotoValido({ numero: 60 }) });
    assert.equal(r.status, 404);
  });
});

describe('US2 · Los cambios se reflejan de inmediato en las vistas de la FIA, del público y de la app', () => {
  let s;
  let token;
  let andes;
  before(async () => {
    s = await iniciarServidor();
    token = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    [andes] = await escuderiasDe(s, token);
  });
  after(() => s.cerrar());

  test('un alta aparece enseguida en la vista pública y en la de la FIA', async () => {
    const alta = await s.api('POST', `/api/escuderia/${andes.id}/pilotos`, { token, body: pilotoValido({ numero: 99 }) });
    const publico = await s.api('GET', '/api/publico/pilotos?categoria=F1');
    assert.ok(publico.body.pilotos.some((p) => p.id === alta.body.piloto.id));
    assert.ok(!('fechaNacimiento' in publico.body.pilotos[0]), 'la vista pública no expone la fecha de nacimiento');
    const tokenFia = await s.loginFia();
    const fia = await s.api('GET', '/api/fia/pilotos?categoria=F1', { token: tokenFia });
    assert.ok(fia.body.pilotos.some((p) => p.id === alta.body.piloto.id && p.fechaNacimiento === '2003-04-10'));
  });

  test('la FIA puede ver también el historial de bajas', async () => {
    const { body } = await s.api('GET', `/api/escuderia/${andes.id}/pilotos`, { token });
    const piloto = body.pilotos.find((p) => p.numero === 99);
    await s.api('DELETE', `/api/escuderia/${andes.id}/pilotos/${piloto.id}`, { token });
    const tokenFia = await s.loginFia();
    const sinBajas = await s.api('GET', '/api/fia/pilotos?categoria=F1', { token: tokenFia });
    const conBajas = await s.api('GET', '/api/fia/pilotos?categoria=F1&incluirBajas=true', { token: tokenFia });
    assert.ok(!sinBajas.body.pilotos.some((p) => p.id === piloto.id));
    assert.ok(conBajas.body.pilotos.some((p) => p.id === piloto.id && p.activo === false));
  });

  test('las vistas abiertas reciben un aviso en tiempo real (Server-Sent Events)', async () => {
    const controlador = new AbortController();
    const respuesta = await fetch(`${s.base}/api/publico/eventos`, { signal: controlador.signal });
    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();

    await s.api('POST', `/api/escuderia/${andes.id}/pilotos`, { token, body: pilotoValido({ numero: 98 }) });

    let recibido = '';
    const limite = Date.now() + 2000;
    while (!recibido.includes('event: nomina') && Date.now() < limite) {
      const { value, done } = await lector.read();
      if (done) break;
      recibido += decodificador.decode(value);
    }
    controlador.abort();
    assert.match(recibido, /event: nomina/);
    assert.match(recibido, /"accion":"alta"/);
  });
});
