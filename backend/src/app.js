import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { manejadorDeErrores } from './lib/errores.js';
import { relojDelSistema } from './lib/reloj.js';
import { crearServicioDeSesiones } from './lib/sesiones.js';
import { crearAuditoria } from './lib/auditoria.js';
import { crearServicioDeCorreo } from './lib/correo.js';
import { crearCanalDeEventos } from './lib/eventos.js';
import { crearConsultas } from './lib/consultas.js';
import { crearMiddlewares } from './middleware/autorizacion.js';
import { rutasDeAutenticacion } from './routes/auth.js';
import { rutasDeAdministracion } from './routes/admin.js';
import { rutasDeEscuderia } from './routes/escuderia.js';
import { rutasPublicas } from './routes/publico.js';
import { rutasDeLaFia } from './routes/fia.js';

function cors(origen) {
  return (req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': origen,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    });
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  };
}

function encabezadosDeSeguridad(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  next();
}

export function crearApp({ db, config, reloj = relojDelSistema }) {
  const auditoria = crearAuditoria({ db, reloj });
  const sesiones = crearServicioDeSesiones({ db, config, reloj });
  const correo = crearServicioDeCorreo({ db, config, reloj });
  const eventos = crearCanalDeEventos();
  const consultas = crearConsultas(db);
  const middlewares = crearMiddlewares({ sesiones, auditoria });
  const ctx = { db, config, reloj, auditoria, sesiones, correo, eventos, consultas, middlewares };
  const { requiereSesion, requiereRol } = middlewares;

  const app = express();
  app.disable('x-powered-by');
  app.use(encabezadosDeSeguridad);
  app.use('/api', cors(config.corsOrigen));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/salud', (req, res) => res.json({ estado: 'ok', hora: reloj.ahora().toISOString() }));
  app.use('/api/auth', rutasDeAutenticacion(ctx));
  app.use('/api/publico', rutasPublicas(ctx));
  app.use('/api/admin', requiereSesion, requiereRol('FIA'), rutasDeAdministracion(ctx));
  app.use('/api/fia', requiereSesion, requiereRol('FIA'), rutasDeLaFia(ctx));
  app.use('/api/escuderia', requiereSesion, requiereRol('ESCUDERIA'), rutasDeEscuderia(ctx));
  app.use('/api', (req, res) => res.status(404).json({ error: 'NO_ENCONTRADO', mensaje: 'La ruta de la API no existe.' }));

  const indice = path.join(config.webDist, 'index.html');
  if (fs.existsSync(indice)) {
    app.use(express.static(config.webDist, { index: false }));
    app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(indice) : next()));
  } else {
    app.use((req, res, next) => (req.method === 'GET' ? res.redirect(config.urlWebDesarrollo + req.originalUrl) : next()));
  }

  app.use(manejadorDeErrores);
  return { app, eventos, ctx };
}
