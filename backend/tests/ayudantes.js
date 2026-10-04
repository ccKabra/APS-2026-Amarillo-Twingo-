

import { cargarConfig } from '../src/config.js';
import { abrirBaseDeDatos } from '../src/db/index.js';
import { crearApp } from '../src/app.js';
import { CREDENCIALES_DEMO, cargarDatosDeDemostracion } from '../src/db/datosDemo.js';

export { CREDENCIALES_DEMO };

export function relojControlable(inicio = new Date('2026-09-28T12:00:00Z')) {
  let actual = inicio.getTime();
  return {
    ahora: () => new Date(actual),
    avanzarMinutos: (minutos) => {
      actual += minutos * 60_000;
    },
  };
}

export async function iniciarServidor({ env = {}, conDatosDemo = true } = {}) {
  const config = cargarConfig({
    SCRYPT_LOG_N: '10', 
    MAX_LOGIN_ATTEMPTS: '3',
    LOCK_MINUTES: '15',
    SESSION_IDLE_MINUTES: '30',
    SESSION_MAX_HOURS: '12',
    PUBLIC_URL: 'http://plataforma.test',
    WEB_DIST: '/no-existe',
    SILENCIOSO: 'true',
    ...env,
  });
  const db = abrirBaseDeDatos(':memory:');
  const reloj = relojControlable();
  if (conDatosDemo) await cargarDatosDeDemostracion(db, config, reloj.ahora());
  const { app, eventos } = crearApp({ db, config, reloj });
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  async function api(metodo, ruta, { token, body } = {}) {
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: {
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const texto = await respuesta.text();
    return { status: respuesta.status, body: texto ? JSON.parse(texto) : null };
  }

  async function login(email, password, plataforma = 'web') {
    const r = await api('POST', '/api/auth/login', { body: { email, password, plataforma } });
    if (r.status !== 200) throw new Error(`login falló para ${email}: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body.token;
  }

  const ultimoCorreoPara = (email) => db.prepare('SELECT * FROM correos WHERE para = ? ORDER BY id DESC LIMIT 1').get(email);

  function enlaceDeActivacion(email) {
    const correo = ultimoCorreoPara(email);
    const coincidencia = /activar\?token=([\w-]+)/.exec(correo?.cuerpo ?? '');
    return coincidencia?.[1];
  }

  async function cerrar() {
    eventos.cerrarTodo();
    servidor.closeAllConnections();
    await new Promise((resolve) => servidor.close(resolve));
    db.close();
  }

  return {
    api,
    login,
    base,
    db,
    config,
    reloj,
    cerrar,
    ultimoCorreoPara,
    enlaceDeActivacion,
    loginFia: () => login(CREDENCIALES_DEMO.fia.email, CREDENCIALES_DEMO.fia.password),
    loginPublico: () => login(CREDENCIALES_DEMO.publico.email, CREDENCIALES_DEMO.publico.password),
    loginEscuderia: (email) => login(email, CREDENCIALES_DEMO.escuderia.password),
  };
}

export const ESCUDERIAS_DEMO = {
  andes: { email: 'martin.rios@andesracing.test', nombre: 'Andes Racing Team', categoria: 'F1' },
  pampa: { email: 'diego@pampamotorsport.test', nombre: 'Pampa Motorsport' },
  aurora: { email: 'valentina.ortiz@auroraracing.test', nombre: 'Aurora Racing', categoria: 'F1A' },
};

export function pilotoValido(extra = {}) {
  return {
    nombre: 'Bruno',
    apellido: 'Castaño',
    nacionalidad: 'Argentina',
    fechaNacimiento: '2003-04-10',
    numero: 88,
    rol: 'SUPLENTE',
    ...extra,
  };
}
