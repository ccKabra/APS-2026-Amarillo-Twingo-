import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCUDERIAS_DEMO, escucharEventos, idsDemo, iniciarServidor } from './ayudantes.js';

const SECRETO = 'Datos confidenciales del alerón 2027';

describe('US5 · Envío y recepción de mensajes entre escudería y FIA', () => {
  let s;
  let tokenFia;
  let tokenAndes;
  let ids;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    tokenAndes = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    ids = await idsDemo(s);
  });
  after(() => s.cerrar());

  test('la escudería envía un mensaje y la FIA lo recibe', async () => {
    const r = await s.api('POST', `/api/escuderia/${ids.andes.id}/mensajes`, { token: tokenAndes, body: { texto: SECRETO } });
    assert.equal(r.status, 201);
    const { body } = await s.api('GET', `/api/fia/mensajes/${ids.andes.id}`, { token: tokenFia });
    const ultimo = body.mensajes.at(-1);
    assert.equal(ultimo.contenido, SECRETO);
    assert.equal(ultimo.lado, 'ESCUDERIA');
    assert.equal(ultimo.emisor, 'Martín Ríos');
    assert.equal(ultimo.integro, true);
  });

  test('la FIA responde y la escudería lo recibe', async () => {
    await s.api('POST', `/api/fia/mensajes/${ids.andes.id}`, { token: tokenFia, body: { texto: 'Respuesta de la FIA' } });
    const { body } = await s.api('GET', `/api/escuderia/${ids.andes.id}/mensajes`, { token: tokenAndes });
    assert.equal(body.mensajes.at(-1).contenido, 'Respuesta de la FIA');
    assert.equal(body.mensajes.at(-1).lado, 'FIA');
  });

  test('la FIA puede iniciar una conversación nueva', async () => {
    const r = await s.api('POST', `/api/fia/mensajes/${ids.atlantico.id}`, { token: tokenFia, body: { texto: 'Primer contacto' } });
    assert.equal(r.status, 201);
    assert.equal(r.body.mensajes.length, 1);
  });

  test('valida el mensaje vacío o demasiado largo', async () => {
    const ruta = `/api/escuderia/${ids.andes.id}/mensajes`;
    assert.equal((await s.api('POST', ruta, { token: tokenAndes, body: { texto: '   ' } })).status, 400);
    assert.equal((await s.api('POST', ruta, { token: tokenAndes, body: { texto: 'x'.repeat(2001) } })).status, 400);
  });

  test('la FIA ve la bandeja con las escuderías', async () => {
    const { body } = await s.api('GET', '/api/fia/mensajes', { token: tokenFia });
    assert.ok(body.conversaciones.some((c) => c.escuderia.id === ids.andes.id && c.ultimoMensajeEn));
    assert.ok(body.conversaciones.some((c) => c.escuderia.id === ids.aurora.id));
  });

  test('los mensajes no se guardan en caché', async () => {
    const respuesta = await fetch(`${s.base}/api/fia/mensajes/${ids.andes.id}`, {
      headers: { authorization: `Bearer ${tokenFia}` },
    });
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  });
});

describe('US5 · El contenido se guarda cifrado y se detecta cualquier alteración', () => {
  let s;
  let tokenFia;
  let tokenAndes;
  let ids;
  const filas = () => s.db.prepare('SELECT * FROM mensajes ORDER BY id').all();
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    tokenAndes = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    ids = await idsDemo(s);
    const ruta = `/api/escuderia/${ids.andes.id}/mensajes`;
    await s.api('POST', ruta, { token: tokenAndes, body: { texto: SECRETO } });
    await s.api('POST', ruta, { token: tokenAndes, body: { texto: SECRETO } });
  });
  after(() => s.cerrar());

  test('el texto no aparece en la base ni en la auditoría', () => {
    const volcado = JSON.stringify([
      s.db.prepare('SELECT * FROM mensajes').all(),
      s.db.prepare('SELECT * FROM conversaciones').all(),
      s.db.prepare('SELECT * FROM auditoria').all(),
    ]);
    assert.ok(!volcado.includes(SECRETO));
    assert.ok(!volcado.includes(Buffer.from(SECRETO).toString('base64')));
    assert.ok(s.db.prepare("SELECT 1 FROM auditoria WHERE accion = 'MENSAJE_ENVIADO'").get());
  });

  test('el mismo texto produce un contenido cifrado distinto cada vez', () => {
    const [a, b] = filas().slice(-2);
    assert.notEqual(a.contenido_cifrado, b.contenido_cifrado);
  });

  test('cada conversación tiene su propia clave, y ninguna queda en claro', async () => {
    await s.api('POST', `/api/fia/mensajes/${ids.aurora.id}`, { token: tokenFia, body: { texto: 'Hola' } });
    const claves = s.db.prepare('SELECT clave_envuelta FROM conversaciones').all().map((c) => c.clave_envuelta);
    assert.equal(new Set(claves).size, claves.length);
  });

  test('un contenido alterado en la base se detecta y no se muestra', async () => {
    const victima = filas().at(-2);
    const original = victima.contenido_cifrado;
    const partes = original.split('.');
    const bytes = Buffer.from(partes[2], 'base64');
    bytes[0] ^= 0xff;
    partes[2] = bytes.toString('base64');
    s.db.prepare('UPDATE mensajes SET contenido_cifrado = ? WHERE id = ?').run(partes.join('.'), victima.id);
    const { status, body } = await s.api('GET', `/api/fia/mensajes/${ids.andes.id}`, { token: tokenFia });
    s.db.prepare('UPDATE mensajes SET contenido_cifrado = ? WHERE id = ?').run(original, victima.id);
    assert.equal(status, 200);
    const alterado = body.mensajes.find((m) => m.id === victima.id);
    assert.equal(alterado.integro, false);
    assert.equal(alterado.contenido, null);
  });

  test('cambiar el emisor de un mensaje en la base invalida su integridad', async () => {
    const victima = filas().find((m) => m.emisor_lado === 'ESCUDERIA');
    const { id: otro } = s.db.prepare("SELECT id FROM usuarios WHERE email = 'admin@fia.test'").get();
    s.db.prepare('UPDATE mensajes SET emisor_id = ? WHERE id = ?').run(otro, victima.id);
    const { body } = await s.api('GET', `/api/fia/mensajes/${ids.andes.id}`, { token: tokenFia });
    s.db.prepare('UPDATE mensajes SET emisor_id = ? WHERE id = ?').run(victima.emisor_id, victima.id);
    assert.equal(body.mensajes.find((m) => m.id === victima.id).integro, false);
  });

  test('un mensaje copiado a otra conversación no se puede leer', async () => {
    const origen = filas().find((m) => m.emisor_lado === 'ESCUDERIA');
    const { id: destino } = s.db.prepare('SELECT id FROM conversaciones WHERE escuderia_id = ?').get(ids.aurora.id);
    s.db
      .prepare(
        `INSERT INTO mensajes (conversacion_id, numero, emisor_id, emisor_lado, contenido_cifrado, enviado_en)
         VALUES (?, 99, ?, ?, ?, ?)`,
      )
      .run(destino, origen.emisor_id, origen.emisor_lado, origen.contenido_cifrado, origen.enviado_en);
    const { body } = await s.api('GET', `/api/fia/mensajes/${ids.aurora.id}`, { token: tokenFia });
    assert.equal(body.mensajes.at(-1).integro, false);
  });
});

describe('US5 · Solo la escudería y la FIA acceden a la conversación', () => {
  let s;
  let tokenFia;
  let tokenAndes;
  let tokenPampa;
  let tokenPublico;
  let ids;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    tokenAndes = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    tokenPampa = await s.loginEscuderia(ESCUDERIAS_DEMO.pampa.email);
    tokenPublico = await s.loginPublico();
    ids = await idsDemo(s);
  });
  after(() => s.cerrar());

  test('otra escudería no puede leer, escribir ni marcar como leído', async () => {
    const ruta = `/api/escuderia/${ids.andes.id}/mensajes`;
    assert.equal((await s.api('GET', ruta, { token: tokenPampa })).status, 403);
    assert.equal((await s.api('POST', ruta, { token: tokenPampa, body: { texto: 'Intruso' } })).status, 403);
    assert.equal((await s.api('POST', `${ruta}/leer`, { token: tokenPampa })).status, 403);
    assert.ok(s.db.prepare("SELECT 1 FROM auditoria WHERE accion = 'ACCESO_DENEGADO' AND entidad_id = ?").get(ids.andes.id));
  });

  test('el público registrado no accede', async () => {
    assert.equal((await s.api('GET', `/api/escuderia/${ids.andes.id}/mensajes`, { token: tokenPublico })).status, 403);
    assert.equal((await s.api('GET', `/api/fia/mensajes/${ids.andes.id}`, { token: tokenPublico })).status, 403);
    assert.equal((await s.api('GET', '/api/fia/mensajes/no-leidos', { token: tokenPublico })).status, 403);
    assert.equal((await s.api('GET', '/api/escuderia/mensajes/no-leidos', { token: tokenPublico })).status, 403);
  });

  test('sin sesión no se accede', async () => {
    assert.equal((await s.api('GET', `/api/escuderia/${ids.andes.id}/mensajes`)).status, 401);
    assert.equal((await s.api('GET', `/api/fia/mensajes/${ids.andes.id}`)).status, 401);
    assert.equal((await s.api('GET', '/api/fia/mensajes/no-leidos')).status, 401);
  });

  test('una escudería no entra a las rutas de la FIA', async () => {
    assert.equal((await s.api('GET', '/api/fia/mensajes', { token: tokenAndes })).status, 403);
    assert.equal((await s.api('GET', `/api/fia/mensajes/${ids.pampaF2.id}`, { token: tokenAndes })).status, 403);
    assert.equal((await s.api('GET', '/api/fia/mensajes/no-leidos', { token: tokenAndes })).status, 403);
  });

  test('una cuenta con varias escuderías ve cada conversación por separado', async () => {
    await s.api('POST', `/api/fia/mensajes/${ids.pampaF3.id}`, { token: tokenFia, body: { texto: 'Solo para F3' } });
    const f2 = await s.api('GET', `/api/escuderia/${ids.pampaF2.id}/mensajes`, { token: tokenPampa });
    const f3 = await s.api('GET', `/api/escuderia/${ids.pampaF3.id}/mensajes`, { token: tokenPampa });
    assert.ok(f2.body.mensajes.every((m) => m.contenido !== 'Solo para F3'));
    assert.equal(f3.body.mensajes.at(-1).contenido, 'Solo para F3');
  });

  test('el canal público de eventos no anuncia los mensajes', async () => {
    const escucha = await escucharEventos(s.base);
    await s.api('POST', `/api/escuderia/${ids.andes.id}/mensajes`, { token: tokenAndes, body: { texto: 'Sin aviso público' } });
    await s.api('POST', '/api/fia/calendario', {
      token: tokenFia,
      body: { nombre: 'Marca de fin', tipo: 'OTRO', categoria: 'F1', circuito: 'Interlagos', pais: 'Brasil', fecha: '2027-05-01' },
    });
    const recibido = await escucha.esperar(/event: calendario/);
    assert.match(recibido, /event: calendario/);
    assert.doesNotMatch(recibido, /mensaje/i);
  });
});

describe('US5 · Notificación de mensajes nuevos', () => {
  let s;
  let tokenFia;
  let tokenAndes;
  let ids;
  const noLeidosEscuderia = async () => (await s.api('GET', '/api/escuderia/mensajes/no-leidos', { token: tokenAndes })).body;
  const noLeidosFia = async () => (await s.api('GET', '/api/fia/mensajes/no-leidos', { token: tokenFia })).body.total;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    tokenAndes = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    ids = await idsDemo(s);
    await s.api('POST', `/api/fia/mensajes/${ids.andes.id}/leer`, { token: tokenFia });
    await s.api('POST', `/api/escuderia/${ids.andes.id}/mensajes/leer`, { token: tokenAndes });
    await s.api('POST', `/api/fia/mensajes/${ids.pampaF2.id}/leer`, { token: tokenFia });
  });
  after(() => s.cerrar());

  test('el receptor ve el contador de no leídos, y el emisor no', async () => {
    assert.equal((await noLeidosEscuderia()).total, 0);
    await s.api('POST', `/api/fia/mensajes/${ids.andes.id}`, { token: tokenFia, body: { texto: 'Aviso' } });
    const aviso = await noLeidosEscuderia();
    assert.equal(aviso.total, 1);
    assert.equal(aviso.porEscuderia[ids.andes.id], 1);
    assert.equal(await noLeidosFia(), 0);
  });

  test('la FIA recibe el aviso cuando escribe una escudería', async () => {
    await s.api('POST', `/api/escuderia/${ids.andes.id}/mensajes`, { token: tokenAndes, body: { texto: 'Consulta' } });
    assert.equal(await noLeidosFia(), 1);
    const { body } = await s.api('GET', '/api/fia/mensajes', { token: tokenFia });
    assert.equal(body.conversaciones[0].escuderia.id, ids.andes.id);
    assert.equal(body.conversaciones[0].noLeidos, 1);
  });

  test('leer la conversación apaga el aviso y queda registrado cuándo', async () => {
    const r = await s.api('POST', `/api/escuderia/${ids.andes.id}/mensajes/leer`, { token: tokenAndes });
    assert.equal(r.body.leidos, 1);
    assert.equal((await noLeidosEscuderia()).total, 0);
    const { body } = await s.api('GET', `/api/fia/mensajes/${ids.andes.id}`, { token: tokenFia });
    assert.ok(body.mensajes.find((m) => m.lado === 'FIA' && m.contenido === 'Aviso').leidoEn);
  });

  test('consultar los avisos no mantiene viva una sesión inactiva', async () => {
    const token = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    for (let i = 0; i < 3; i += 1) {
      s.reloj.avanzarMinutos(10);
      assert.equal((await s.api('GET', '/api/escuderia/mensajes/no-leidos', { token })).status, 200);
    }
    s.reloj.avanzarMinutos(1);
    const r = await s.api('GET', `/api/escuderia/${ids.andes.id}/mensajes`, { token });
    assert.equal(r.status, 401);
    assert.equal(r.body.error, 'SESION_INACTIVA');
  });
});
