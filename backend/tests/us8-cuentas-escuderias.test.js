import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCUDERIAS_DEMO, iniciarServidor } from './ayudantes.js';

const altaValida = (extra = {}) => ({
  nombreOficial: 'Patagonia Racing',
  categoria: 'F3',
  pais: 'Argentina',
  sede: 'Neuquén',
  responsable: { nombre: 'Rocío', apellido: 'Luna', email: 'rocio.luna@patagonia.test' },
  ...extra,
});

describe('US8 · Alta de una cuenta de escudería por la FIA', () => {
  let s;
  let tokenFia;
  let respuesta;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    respuesta = await s.api('POST', '/api/admin/escuderias', { token: tokenFia, body: altaValida() });
  });
  after(() => s.cerrar());

  test('la FIA crea la escudería indicando sus datos oficiales y el responsable designado', () => {
    assert.equal(respuesta.status, 201);
    const { escuderia } = respuesta.body;
    assert.equal(escuderia.nombreOficial, 'Patagonia Racing');
    assert.equal(escuderia.categoria, 'F3');
    assert.equal(escuderia.responsables[0].email, 'rocio.luna@patagonia.test');
    assert.equal(escuderia.responsables[0].estado, 'PENDIENTE_ACTIVACION');
  });

  test('el sistema genera las credenciales y se las envía al responsable por correo', () => {
    assert.equal(respuesta.body.correo.enviado, true);
    const correo = s.ultimoCorreoPara('rocio.luna@patagonia.test');
    assert.ok(correo, 'hay un correo para el responsable');
    assert.match(correo.cuerpo, /Usuario: rocio\.luna@patagonia\.test/);
    assert.match(correo.cuerpo, /http:\/\/plataforma\.test\/activar\?token=/);
  });

  test('el correo no contiene ninguna contraseña en texto plano', () => {
    const correo = s.ultimoCorreoPara('rocio.luna@patagonia.test');
    assert.match(correo.cuerpo, /nunca envía contraseñas por correo/);
    const { password_hash: hash } = s.db
      .prepare('SELECT password_hash FROM usuarios WHERE email = ?')
      .get('rocio.luna@patagonia.test');
    assert.equal(hash, null, 'hasta activar la cuenta no existe ninguna contraseña');
  });

  test('el responsable activa la cuenta, inicia sesión y accede solo a la interfaz de escudería', async () => {
    const token = s.enlaceDeActivacion('rocio.luna@patagonia.test');
    const datos = await s.api('GET', `/api/auth/activacion?token=${token}`);
    assert.equal(datos.status, 200);
    assert.equal(datos.body.email, 'rocio.luna@patagonia.test');

    const activar = await s.api('POST', '/api/auth/activar', { body: { token, password: 'Patagonia#2026' } });
    assert.equal(activar.status, 200);

    const sesion = await s.login('rocio.luna@patagonia.test', 'Patagonia#2026');
    const yo = await s.api('GET', '/api/auth/yo', { token: sesion });
    assert.equal(yo.body.usuario.rol, 'ESCUDERIA');
    assert.deepEqual(
      yo.body.usuario.escuderias.map((e) => e.nombreOficial),
      ['Patagonia Racing'],
    );
    assert.equal((await s.api('GET', '/api/escuderia/mis-escuderias', { token: sesion })).status, 200);
    assert.equal((await s.api('GET', '/api/admin/escuderias', { token: sesion })).status, 403);
  });

  test('el enlace de activación es de un solo uso', async () => {
    const token = s.enlaceDeActivacion('rocio.luna@patagonia.test');
    const r = await s.api('POST', '/api/auth/activar', { body: { token, password: 'Otra#Clave2026' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'CUENTA_YA_ACTIVADA');
  });

  test('toda alta queda registrada en la auditoría con usuario, fecha y hora', () => {
    const altas = s.db.prepare("SELECT * FROM auditoria WHERE accion IN ('ESCUDERIA_ALTA', 'USUARIO_ALTA') ORDER BY id").all();
    assert.deepEqual(
      altas.map((a) => a.accion),
      ['USUARIO_ALTA', 'ESCUDERIA_ALTA'],
    );
    for (const alta of altas) {
      assert.equal(alta.usuario_email, 'admin@fia.test');
      assert.match(alta.fecha_hora, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });

  test('la FIA ve el registro de auditoría desde la API', async () => {
    const r = await s.api('GET', '/api/admin/auditoria?accion=ESCUDERIA_ALTA', { token: tokenFia });
    assert.equal(r.status, 200);
    assert.equal(r.body.registros[0].detalle.nombreOficial, 'Patagonia Racing');
  });
});

describe('US8 · Unicidad de nombre oficial y de correo', () => {
  let s;
  let tokenFia;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
  });
  after(() => s.cerrar());

  test('no permite dos escuderías con el mismo nombre oficial en una misma categoría', async () => {
    const r = await s.api('POST', '/api/admin/escuderias', {
      token: tokenFia,
      body: altaValida({ nombreOficial: 'andes  RACING team', categoria: 'F1' }),
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'ESCUDERIA_DUPLICADA');
  });

  test('el control ignora tildes y mayúsculas', async () => {
    const r = await s.api('POST', '/api/admin/escuderias', {
      token: tokenFia,
      body: altaValida({ nombreOficial: 'ATLANTICO GRAND PRIX', categoria: 'F1' }),
    });
    assert.equal(r.status, 409);
  });

  test('sí permite el mismo nombre en otra categoría', async () => {
    const r = await s.api('POST', '/api/admin/escuderias', {
      token: tokenFia,
      body: altaValida({ nombreOficial: 'Andes Racing Team', categoria: 'F2' }),
    });
    assert.equal(r.status, 201);
  });

  test('no permite dos cuentas con el mismo correo electrónico', async () => {
    const r = await s.api('POST', '/api/admin/escuderias', {
      token: tokenFia,
      body: altaValida({
        nombreOficial: 'Otra Escudería',
        responsable: { nombre: 'X', apellido: 'Y', email: 'MARTIN.RIOS@andesracing.test' },
      }),
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'EMAIL_DUPLICADO');
  });

  test('un responsable existente puede quedar asociado a otra escudería (sin duplicar la cuenta)', async () => {
    const r = await s.api('POST', '/api/admin/escuderias', {
      token: tokenFia,
      body: altaValida({
        nombreOficial: 'Andes Junior',
        categoria: 'F3',
        responsable: { email: ESCUDERIAS_DEMO.andes.email, usarCuentaExistente: true },
      }),
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.correo.tipo, 'ASIGNACION');
    const cuentas = s.db.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE email = ?').get(ESCUDERIAS_DEMO.andes.email);
    assert.equal(cuentas.n, 1);
  });

  test('no se puede asociar una cuenta que no es de escudería', async () => {
    const r = await s.api('POST', '/api/admin/escuderias', {
      token: tokenFia,
      body: altaValida({
        nombreOficial: 'Equipo Público',
        responsable: { email: 'publico@demo.test', usarCuentaExistente: true },
      }),
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'EMAIL_DE_OTRO_ROL');
  });

  test('valida los datos obligatorios del alta', async () => {
    const r = await s.api('POST', '/api/admin/escuderias', { token: tokenFia, body: { categoria: 'F5' } });
    assert.equal(r.status, 400);
    for (const campo of [
      'nombreOficial',
      'categoria',
      'pais',
      'responsable.email',
      'responsable.nombre',
      'responsable.apellido',
    ]) {
      assert.ok(r.body.detalles[campo], `falta el error de ${campo}`);
    }
  });
});

describe('US8 · Modificación, baja y gestión de usuarios internos', () => {
  let s;
  let tokenFia;
  let andes;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    const { body } = await s.api('GET', '/api/admin/escuderias?categoria=F1', { token: tokenFia });
    andes = body.escuderias.find((e) => e.nombreOficial === 'Andes Racing Team');
  });
  after(() => s.cerrar());

  test('la FIA modifica los datos de una escudería y queda auditado', async () => {
    const r = await s.api('PATCH', `/api/admin/escuderias/${andes.id}`, { token: tokenFia, body: { sede: 'San Juan' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.escuderia.sede, 'San Juan');
    const ultimo = s.db.prepare("SELECT detalle FROM auditoria WHERE accion = 'ESCUDERIA_MODIFICACION'").get();
    assert.equal(JSON.parse(ultimo.detalle).antes.sede, 'Mendoza');
  });

  test('la categoría de una escudería no se puede cambiar', async () => {
    const r = await s.api('PATCH', `/api/admin/escuderias/${andes.id}`, { token: tokenFia, body: { categoria: 'F2' } });
    assert.equal(r.status, 400);
  });

  test('al dar de baja una escudería desaparece de la vista pública y su responsable ya no la gestiona', async () => {
    assert.equal((await s.api('POST', `/api/admin/escuderias/${andes.id}/baja`, { token: tokenFia })).status, 200);
    const publico = await s.api('GET', '/api/publico/pilotos?categoria=F1');
    assert.ok(publico.body.pilotos.every((p) => p.escuderia.id !== andes.id));
    const tokenEscuderia = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    assert.equal((await s.api('GET', `/api/escuderia/${andes.id}/pilotos`, { token: tokenEscuderia })).status, 403);
    assert.equal((await s.api('POST', `/api/admin/escuderias/${andes.id}/reactivar`, { token: tokenFia })).status, 200);
    assert.equal((await s.api('GET', `/api/escuderia/${andes.id}/pilotos`, { token: tokenEscuderia })).status, 200);
  });

  test('la FIA crea otra cuenta de administrador de la FIA (con enlace de activación)', async () => {
    const r = await s.api('POST', '/api/admin/usuarios-fia', {
      token: tokenFia,
      body: { nombre: 'Pablo', apellido: 'Núñez', email: 'pablo.nunez@fia.test' },
    });
    assert.equal(r.status, 201);
    assert.ok(s.enlaceDeActivacion('pablo.nunez@fia.test'));
  });

  test('reenviar la activación invalida el enlace anterior', async () => {
    const anterior = s.enlaceDeActivacion('pablo.nunez@fia.test');
    const { body } = await s.api('GET', '/api/admin/usuarios?rol=FIA', { token: tokenFia });
    const pablo = body.usuarios.find((u) => u.email === 'pablo.nunez@fia.test');
    assert.equal((await s.api('POST', `/api/admin/usuarios/${pablo.id}/reenviar-activacion`, { token: tokenFia })).status, 200);
    const nuevo = s.enlaceDeActivacion('pablo.nunez@fia.test');
    assert.notEqual(nuevo, anterior);
    assert.equal((await s.api('GET', `/api/auth/activacion?token=${anterior}`)).status, 400);
    assert.equal((await s.api('GET', `/api/auth/activacion?token=${nuevo}`)).status, 200);
  });

  test('el enlace de activación vence', async () => {
    const token = s.enlaceDeActivacion('pablo.nunez@fia.test');
    s.reloj.avanzarMinutos(73 * 60);
    const r = await s.api('GET', `/api/auth/activacion?token=${token}`);
    assert.equal(r.status, 410);
    assert.equal(r.body.error, 'ENLACE_VENCIDO');
  });

  test('dar de baja una cuenta cierra sus sesiones y le impide ingresar', async () => {
    tokenFia = await s.loginFia(); 
    const tokenEscuderia = await s.loginEscuderia(ESCUDERIAS_DEMO.aurora.email);
    const { body } = await s.api('GET', '/api/admin/usuarios?rol=ESCUDERIA', { token: tokenFia });
    const valentina = body.usuarios.find((u) => u.email === ESCUDERIAS_DEMO.aurora.email);
    assert.equal((await s.api('POST', `/api/admin/usuarios/${valentina.id}/baja`, { token: tokenFia })).status, 200);
    assert.equal((await s.api('GET', '/api/auth/yo', { token: tokenEscuderia })).status, 401);
    const r = await s.api('POST', '/api/auth/login', {
      body: { email: ESCUDERIAS_DEMO.aurora.email, password: 'Escuderia#2026' },
    });
    assert.equal(r.status, 403);
    assert.equal(r.body.error, 'CUENTA_DESHABILITADA');
  });

  test('la FIA no puede darse de baja a sí misma', async () => {
    const { body } = await s.api('GET', '/api/auth/yo', { token: tokenFia });
    const r = await s.api('POST', `/api/admin/usuarios/${body.usuario.id}/baja`, { token: tokenFia });
    assert.equal(r.status, 400);
  });
});
