import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function cargarArchivoEnv() {
  const archivo = path.join(raiz, '.env');
  if (fs.existsSync(archivo)) process.loadEnvFile(archivo);
}

function numero(valor, porDefecto) {
  if (valor === undefined || valor === null || valor === '') return porDefecto;
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

export function cargarConfig(env = process.env) {
  const puerto = numero(env.PORT, 3000);
  return {
    puerto,
    raiz,
    dbRuta: env.DB_PATH || path.join(raiz, 'data', 'fia.db'),
    urlPublica: (env.PUBLIC_URL || `http://localhost:${puerto}`).replace(/\/$/, ''),
    urlWebDesarrollo: (env.WEB_DEV_URL || 'http:
    webDist: env.WEB_DIST || path.resolve(raiz, '..', 'web', 'dist'),
    corsOrigen: env.CORS_ORIGIN || '*',
    password: {
      minLongitud: numero(env.PASSWORD_MIN_LENGTH, 10),
    },
    login: {
      maxIntentos: numero(env.MAX_LOGIN_ATTEMPTS, 5),
      bloqueoMinutos: numero(env.LOCK_MINUTES, 15),
    },
    sesion: {
      inactividadMinutos: numero(env.SESSION_IDLE_MINUTES, 30),
      duracionMaximaHoras: numero(env.SESSION_MAX_HOURS, 12),
    },
    scrypt: { N: 2 ** numero(env.SCRYPT_LOG_N, 17), r: 8, p: 1, longitudClave: 64 },
    activacion: {
      validezHoras: numero(env.ACTIVATION_HOURS, 72),
    },
    correo: {
      transporte: env.MAIL_TRANSPORT || 'desarrollo',
      remitente: env.MAIL_FROM || 'Plataforma FIA <no-responder@plataforma-fia.test>',
      smtp: {
        host: env.SMTP_HOST,
        port: numero(env.SMTP_PORT, 587),
        secure: env.SMTP_SECURE === 'true',
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    },
    silencioso: env.SILENCIOSO === 'true',
  };
}
