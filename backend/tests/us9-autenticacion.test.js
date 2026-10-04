import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CREDENCIALES_DEMO, ESCUDERIAS_DEMO, iniciarServidor } from './ayudantes.js';

const nuevoPublico = (extra = {}) => ({
  nombre: 'Carla',
  apellido: 'Suárez',
  email: 'carla.suarez@correo.test',
  password: 'Clave#Segura1',
  ...extra,
});

describe('US9 · Registro del público general', () => {
  let s;
  before(async () => {
    s = await iniciarServidor();
  });
  after(() => s.cerrar());

  test('un usuario del público puede registrarse desde la web y queda con rol PUBLICO', async () => {
    const r = await s.api('POST', '/api/auth/registro', { body: nuevoPublico({ plataforma: 'web' }) });
    assert.equal(r.status, 201);
    assert.equal(r.body.usuario.rol, 'PUBLICO');
    assert.ok(r.body.token, 'el registro inicia la sesión');
  });

  test('un usuario del público puede registrarse desde la app móvil', async () => {
    const r = await s.api('POST', '/api/auth/registro', {
      body: nuevoPublico({ email: 'desde.app@correo.test', plataforma: 'movil' }),
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.sesion.plataforma, 'movil');
  });

  test('por el registro no se pueden crear cuentas de escudería ni de la FIA', async () => {
    const r = await s.api('POST', '/api/auth/registro', {
      body: nuevoPublico({ email: 'quiero.ser.fia@correo.test', rol: 'FIA' }),
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.usuario.rol, 'PUBLICO', 'el rol enviado se ignora');
  });

  test('no se permiten dos cuentas con el mismo correo (sin importar mayúsculas)', async () => {
    const r = await s.api('POST', '/api/auth/registro', { body: nuevoPublico({ email: 'CARLA.SUAREZ@correo.test' }) });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'EMAIL_DUPLICADO');
  });

  test('valida los datos obligatorios y devuelve todos los errores juntos', async () => {
    const r = await s.api('POST', '/api/auth/registro', { body: { email: 'sin-arroba', password: 'Clave#Segura1' } });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.detalles).sort(), ['apellido', 'email', 'nombre']);
  });
});

describe('US9 · Política y almacenamiento seguro de contraseñas', () => {
  let s;
  before(async () => {
    s = await iniciarServidor();
  });
  after(() => s.cerrar());

  for (const [caso, password] of [
    ['muy corta', 'Ab#1cd'],
    ['sin mayúscula', 'clave#segura1'],
    ['sin minúscula', 'CLAVE#SEGURA1'],
    ['sin número', 'Clave#Segura'],
    ['sin símbolo', 'ClaveSegura12'],
  ]) {
    test(`rechaza una contraseña ${caso}`, async () => {
      const r = await s.api('POST', '/api/auth/registro', {
        body: nuevoPublico({ email: `x${Math.random()}@correo.test`, password }),
      });
      assert.equal(r.status, 400);
      assert.match(r.body.detalles.password, /no cumple la política/);
    });
  }

  test('la contraseña no se guarda en texto plano y se usa scrypt con sal', async () => {
    await s.api('POST', '/api/auth/registro', { body: nuevoPublico({ email: 'plano@correo.test' }) });
    const { password_hash: hash } = s.db.prepare('SELECT password_hash FROM usuarios WHERE email = ?').get('plano@correo.test');
    assert.ok(!hash.includes('Clave#Segura1'));
    const partes = hash.split('$');
    assert.equal(partes[0], 'scrypt', 'algoritmo diseñado para contraseñas');
    assert.equal(partes.length, 6, 'formato scrypt$N$r$p$sal$clave');
    assert.equal(Buffer.from(partes[4], 'base64').length, 16, 'sal de 16 bytes');
  });

  test('dos usuarios con la misma contraseña quedan con valores almacenados distintos', async () => {
    await s.api('POST', '/api/auth/registro', { body: nuevoPublico({ email: 'uno@correo.test' }) });
    await s.api('POST', '/api/auth/registro', { body: nuevoPublico({ email: 'dos@correo.test' }) });
    const hash = (email) => s.db.prepare('SELECT password_hash FROM usuarios WHERE email = ?').get(email).password_hash;
    assert.notEqual(hash('uno@correo.test'), hash('dos@correo.test'));
  });

  test('ninguna respuesta de la API incluye la contraseña ni su hash', async () => {
    const r = await s.api('POST', '/api/auth/registro', { body: nuevoPublico({ email: 'respuesta@correo.test' }) });
    const texto = JSON.stringify(r.body);
    assert.ok(!texto.includes('Clave#Segura1'));
    assert.ok(!texto.includes('scrypt$'));
  });
});

describe('US9 · Bloqueo por intentos fallidos consecutivos (configurado en 3)', () => {
  let s;
  before(async () => {
    s = await iniciarServidor();
  });
  after(() => s.cerrar());

  const { email } = { email: CREDENCIALES_DEMO.publico.email };
  const intentar = (password) => s.api('POST', '/api/auth/login', { body: { email, password } });

  test('informa los intentos restantes y bloquea al llegar al máximo', async () => {
    let r = await intentar('incorrecta');
    assert.equal(r.status, 401);
    assert.equal(r.body.detalles.intentosRestantes, 2);
    r = await intentar('incorrecta');
    assert.equal(r.body.detalles.intentosRestantes, 1);
    r = await intentar('incorrecta');
    assert.equal(r.status, 423);
    assert.equal(r.body.error, 'CUENTA_BLOQUEADA');
  });

  test('mientras está bloqueada, ni siquiera la contraseña correcta permite entrar', async () => {
    const r = await intentar(CREDENCIALES_DEMO.publico.password);
    assert.equal(r.status, 423);
  });

  test('pasado el tiempo de bloqueo se puede volver a ingresar', async () => {
    s.reloj.avanzarMinutos(16);
    const r = await intentar(CREDENCIALES_DEMO.publico.password);
    assert.equal(r.status, 200);
  });

  test('los intentos deben ser consecutivos: un ingreso correcto reinicia el contador', async () => {
    await intentar('incorrecta');
    await intentar('incorrecta');
    assert.equal((await intentar(CREDENCIALES_DEMO.publico.password)).status, 200);
    const r = await intentar('incorrecta');
    assert.equal(r.body.detalles.intentosRestantes, 2);
  });

  test('la FIA puede desbloquear una cuenta antes de que termine el bloqueo', async () => {
    for (let i = 0; i < 3; i += 1) await intentar('incorrecta');
    assert.equal((await intentar(CREDENCIALES_DEMO.publico.password)).status, 423);
    const tokenFia = await s.loginFia();
    const { body } = await s.api('GET', '/api/admin/usuarios?rol=PUBLICO', { token: tokenFia });
    const usuario = body.usuarios.find((u) => u.email === email);
    assert.equal(usuario.estado, 'BLOQUEADA');
    assert.equal((await s.api('POST', `/api/admin/usuarios/${usuario.id}/desbloquear`, { token: tokenFia })).status, 200);
    assert.equal((await intentar(CREDENCIALES_DEMO.publico.password)).status, 200);
  });

  test('el máximo de intentos es configurable', async () => {
    const otro = await iniciarServidor({ env: { MAX_LOGIN_ATTEMPTS: '5' } });
    try {
      const r = await otro.api('POST', '/api/auth/login', { body: { email, password: 'incorrecta' } });
      assert.equal(r.body.detalles.intentosRestantes, 4);
    } finally {
      await otro.cerrar();
    }
  });
});

describe('US9 · Control de acceso por rol (interfaz y llamada directa a la API)', () => {
  let s;
  let tokens;
  before(async () => {
    s = await iniciarServidor();
    tokens = {
      publico: await s.loginPublico(),
      escuderia: await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email),
      fia: await s.loginFia(),
    };
  });
  after(() => s.cerrar());

  test('sin sesión no se accede a ninguna función interna', async () => {
    for (const ruta of ['/api/admin/escuderias', '/api/fia/pilotos', '/api/escuderia/mis-escuderias', '/api/auth/yo']) {
      assert.equal((await s.api('GET', ruta)).status, 401, ruta);
    }
  });

  test('el público no accede a las funciones de la FIA ni de las escuderías', async () => {
    assert.equal((await s.api('GET', '/api/admin/escuderias', { token: tokens.publico })).status, 403);
    assert.equal((await s.api('GET', '/api/fia/pilotos', { token: tokens.publico })).status, 403);
    assert.equal((await s.api('GET', '/api/escuderia/mis-escuderias', { token: tokens.publico })).status, 403);
  });

  test('una escudería no accede a las funciones de la FIA', async () => {
    const r = await s.api('POST', '/api/admin/escuderias', { token: tokens.escuderia, body: {} });
    assert.equal(r.status, 403);
    assert.equal(r.body.error, 'ACCESO_DENEGADO');
  });

  test('la FIA no usa la interfaz de escudería', async () => {
    assert.equal((await s.api('GET', '/api/escuderia/mis-escuderias', { token: tokens.fia })).status, 403);
  });

  test('cada rol recibe su perfil para mostrar su propia interfaz', async () => {
    for (const [rol, token] of Object.entries({ PUBLICO: tokens.publico, ESCUDERIA: tokens.escuderia, FIA: tokens.fia })) {
      const r = await s.api('GET', '/api/auth/yo', { token });
      assert.equal(r.body.usuario.rol, rol);
    }
  });

  test('los accesos denegados quedan registrados en la auditoría', async () => {
    const fila = s.db.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'ACCESO_DENEGADO'").get();
    assert.ok(fila.n >= 4);
  });
});

describe('US9 · Sesión: expiración por inactividad, renovación y cierre manual', () => {
  let s;
  before(async () => {
    s = await iniciarServidor();
  });
  after(() => s.cerrar());

  test('la sesión sigue activa mientras haya actividad', async () => {
    const token = await s.loginPublico();
    for (let i = 0; i < 4; i += 1) {
      s.reloj.avanzarMinutos(20);
      assert.equal((await s.api('GET', '/api/auth/yo', { token })).status, 200);
    }
  });

  test('la sesión expira tras el tiempo de inactividad configurado (30 min)', async () => {
    const token = await s.loginPublico();
    s.reloj.avanzarMinutos(31);
    const r = await s.api('GET', '/api/auth/yo', { token });
    assert.equal(r.status, 401);
    assert.equal(r.body.error, 'SESION_INACTIVA');
  });

  test('renovar la sesión entrega un token nuevo y el anterior deja de servir', async () => {
    const viejo = await s.login(CREDENCIALES_DEMO.publico.email, CREDENCIALES_DEMO.publico.password, 'movil');
    const r = await s.api('POST', '/api/auth/renovar', { token: viejo });
    assert.equal(r.status, 200);
    assert.notEqual(r.body.token, viejo);
    assert.equal((await s.api('GET', '/api/auth/yo', { token: viejo })).status, 401);
    assert.equal((await s.api('GET', '/api/auth/yo', { token: r.body.token })).status, 200);
  });

  test('el usuario puede cerrar la sesión manualmente desde la web y desde la app', async () => {
    for (const plataforma of ['web', 'movil']) {
      const token = await s.login(CREDENCIALES_DEMO.publico.email, CREDENCIALES_DEMO.publico.password, plataforma);
      assert.equal((await s.api('POST', '/api/auth/logout', { token })).status, 204);
      assert.equal((await s.api('GET', '/api/auth/yo', { token })).status, 401, plataforma);
    }
  });

  test('la sesión tiene una duración máxima aunque haya actividad (12 h)', async () => {
    const token = await s.loginPublico();
    for (let i = 0; i < 24; i += 1) {
      s.reloj.avanzarMinutos(29); 
      assert.equal((await s.api('GET', '/api/auth/yo', { token })).status, 200);
    }
    s.reloj.avanzarMinutos(25); 
    const r = await s.api('GET', '/api/auth/yo', { token });
    assert.equal(r.status, 401);
    assert.equal(r.body.error, 'SESION_EXPIRADA');
  });

  test('cambiar la contraseña cierra las otras sesiones abiertas', async () => {
    const otraSesion = await s.loginPublico();
    const actual = await s.loginPublico();
    const r = await s.api('POST', '/api/auth/cambiar-password', {
      token: actual,
      body: { actual: CREDENCIALES_DEMO.publico.password, nueva: 'Otra#Clave2026' },
    });
    assert.equal(r.status, 200);
    assert.equal((await s.api('GET', '/api/auth/yo', { token: otraSesion })).status, 401);
    assert.equal((await s.api('GET', '/api/auth/yo', { token: actual })).status, 200);
  });
});
