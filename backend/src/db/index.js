import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CATEGORIAS, ESQUEMA } from './esquema.js';

export function abrirBaseDeDatos(ruta) {
  const enMemoria = ruta === ':memory:';
  if (!enMemoria) fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA foreign_keys = ON;');
  if (!enMemoria) db.exec('PRAGMA journal_mode = WAL;');
  db.exec(ESQUEMA);
  const insertar = db.prepare('INSERT OR IGNORE INTO categorias (codigo, nombre, orden) VALUES (?, ?, ?)');
  for (const c of CATEGORIAS) insertar.run(c.codigo, c.nombre, c.orden);
  return db;
}

export function enTransaccion(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function esViolacionDeUnicidad(error) {
  return error?.errcode === 2067 || /UNIQUE constraint failed/.test(error?.message ?? '');
}
