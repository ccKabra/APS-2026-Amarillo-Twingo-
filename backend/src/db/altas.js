import { hashearPassword } from '../lib/passwords.js';
import { normalizarNombre } from '../lib/validacion.js';

export async function crearUsuarioActivo(db, config, { email, nombre, apellido, rol, password }, ahora = new Date()) {
  const hash = await hashearPassword(password, config.scrypt);
  const marca = ahora.toISOString();
  return db
    .prepare(
      `INSERT INTO usuarios (email, nombre, apellido, rol, password_hash, creado_en, activado_en) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(email.toLowerCase(), nombre, apellido, rol, hash, marca, marca).lastInsertRowid;
}

export function crearEscuderia(db, { nombreOficial, categoria, pais, sede = null, creadaPor }, ahora = new Date()) {
  const { id: categoriaId } = db.prepare('SELECT id FROM categorias WHERE codigo = ?').get(categoria);
  const marca = ahora.toISOString();
  return db
    .prepare(
      `INSERT INTO escuderias (nombre_oficial, nombre_normalizado, categoria_id, pais, sede, creada_en, creada_por, actualizada_en)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(nombreOficial, normalizarNombre(nombreOficial), categoriaId, pais, sede, marca, creadaPor, marca).lastInsertRowid;
}

export function asociarResponsable(db, usuarioId, escuderiaId, asignadoPor, ahora = new Date()) {
  db.prepare('INSERT INTO usuario_escuderia (usuario_id, escuderia_id, asignado_en, asignado_por) VALUES (?, ?, ?, ?)').run(
    usuarioId,
    escuderiaId,
    ahora.toISOString(),
    asignadoPor,
  );
}

export function crearPiloto(
  db,
  escuderiaId,
  { nombre, apellido, nacionalidad, fechaNacimiento, numero, rol },
  ahora = new Date(),
) {
  const { categoria_id: categoriaId } = db.prepare('SELECT categoria_id FROM escuderias WHERE id = ?').get(escuderiaId);
  const marca = ahora.toISOString();
  return db
    .prepare(
      `INSERT INTO pilotos (escuderia_id, categoria_id, nombre, apellido, nacionalidad, fecha_nacimiento, numero, rol, creado_en, actualizado_en)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(escuderiaId, categoriaId, nombre, apellido, nacionalidad, fechaNacimiento, numero, rol, marca, marca).lastInsertRowid;
}
