import { exec } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cargarArchivoEnv, cargarConfig } from './config.js';
import { abrirBaseDeDatos } from './db/index.js';
import { crearApp } from './app.js';

cargarArchivoEnv();
const config = cargarConfig();
const db = abrirBaseDeDatos(config.dbRuta);
const { app } = crearApp({ db, config });

function direccionesDeRedLocal() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((d) => d && d.family === 'IPv4' && !d.internal)
    .map((d) => d.address);
}

function abrirNavegador(url) {
  if (process.env.ABRIR_NAVEGADOR !== '1') return;
  const comando =
    process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(comando, () => {});
}

const servidor = app.listen(config.puerto, '0.0.0.0', () => {
  const webCompilada = fs.existsSync(path.join(config.webDist, 'index.html'));
  console.log('\n🏁 Plataforma Integral FIA — Sprint 1');
  console.log(`   API:  ${config.urlPublica}/api`);
  console.log(
    `   Web:  ${webCompilada ? config.urlPublica : `${config.urlWebDesarrollo} (modo desarrollo: corré "npm run dev:web")`}`,
  );
  const ips = direccionesDeRedLocal();
  if (ips.length) {
    console.log('   App móvil: en la pantalla de inicio de la app, configurá el servidor como');
    for (const ip of ips) console.log(`              http://${ip}:${config.puerto}`);
  }
  console.log(`   Correos: modo ${config.correo.transporte}`);
  const usuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
  if (usuarios === 0) console.log('\n⚠  La base está vacía. Corré "npm run seed" para cargar los datos de demostración.');
  console.log('\n   Para cortar el servidor: Ctrl + C\n');
  if (webCompilada) abrirNavegador(config.urlPublica);
});

servidor.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n⚠  El puerto ${config.puerto} ya está en uso: probablemente la demo ya está corriendo en otra ventana.`);
    console.error(`   Abrí ${config.urlPublica} o cerrá la otra ventana y volvé a intentar.\n`);
    abrirNavegador(config.urlPublica);
    process.exitCode = 1;
    return;
  }
  throw error;
});
