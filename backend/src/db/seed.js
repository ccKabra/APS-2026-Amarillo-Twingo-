import fs from 'node:fs';
import { cargarArchivoEnv, cargarConfig } from '../config.js';
import { abrirBaseDeDatos } from './index.js';
import { CREDENCIALES_DEMO, cargarDatosDeDemostracion } from './datosDemo.js';

function borrarBase(ruta) {
  try {
    for (const sufijo of ['', '-wal', '-shm']) fs.rmSync(`${ruta}${sufijo}`, { force: true });
  } catch (error) {
    if (['EBUSY', 'EPERM'].includes(error.code)) {
      console.error('No se pudo borrar la base porque está en uso. Cortá el servidor (Ctrl + C) y volvé a intentarlo.');
      process.exit(1);
    }
    throw error;
  }
}

async function principal() {
  cargarArchivoEnv();
  const config = cargarConfig();
  const soloSiVacia = process.argv.includes('--si-vacia');
  if (!soloSiVacia) borrarBase(config.dbRuta);
  const db = abrirBaseDeDatos(config.dbRuta);
  if (soloSiVacia && db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n > 0) {
    console.log('La base ya tiene datos: no se cargó nada. (Para reiniciarla: npm run seed)');
    return;
  }
  console.log('Cargando datos de demostración...');
  const { enlace } = await cargarDatosDeDemostracion(db, config);
  db.close();
  console.log(`
Listo. Usuarios de demostración (datos ficticios):

  Rol                Correo                               Contraseña
  FIA                ${CREDENCIALES_DEMO.fia.email.padEnd(36)} ${CREDENCIALES_DEMO.fia.password}
  Escudería (1)      martin.rios@andesracing.test         ${CREDENCIALES_DEMO.escuderia.password}
  Escudería (2)      diego@pampamotorsport.test           ${CREDENCIALES_DEMO.escuderia.password}   (F2 y F3)
  Escudería (F1A)    valentina.ortiz@auroraracing.test    ${CREDENCIALES_DEMO.escuderia.password}
  Público            ${CREDENCIALES_DEMO.publico.email.padEnd(36)} ${CREDENCIALES_DEMO.publico.password}

  Cuenta pendiente de activación: ignacio.vera@cordillera.test
  Enlace de activación: ${enlace}
`);
}

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
