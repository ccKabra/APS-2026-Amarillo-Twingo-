import { Router } from 'express';
import { aEscuderia, aPilotoPublico } from '../lib/consultas.js';

export const SQL_PILOTOS = `
  SELECT p.*, e.nombre_oficial AS escuderia_nombre, e.activa AS escuderia_activa,
         c.codigo AS categoria, c.nombre AS categoria_nombre, c.orden AS categoria_orden
  FROM pilotos p
  JOIN escuderias e ON e.id = p.escuderia_id
  JOIN categorias c ON c.id = p.categoria_id`;

export const ORDEN_PILOTOS = `
  ORDER BY c.orden, e.nombre_oficial COLLATE NOCASE, CASE p.rol WHEN 'TITULAR' THEN 0 ELSE 1 END, p.numero`;

export function filtroDe(valor) {
  return typeof valor === 'string' && valor.trim() ? valor.trim().toUpperCase() : null;
}

export function rutasPublicas(ctx) {
  const { db, eventos, consultas } = ctx;
  const rutas = Router();

  const escuderias = db.prepare(`
    SELECT e.id, e.nombre_oficial, e.pais, e.sede, e.activa, c.codigo AS categoria, c.nombre AS categoria_nombre
    FROM escuderias e JOIN categorias c ON c.id = e.categoria_id
    WHERE e.activa = 1 AND (? IS NULL OR c.codigo = ?)
    ORDER BY c.orden, e.nombre_oficial COLLATE NOCASE`);
  const pilotos = db.prepare(`${SQL_PILOTOS}
    WHERE p.activo = 1 AND e.activa = 1
      AND (? IS NULL OR c.codigo = ?)
      AND (? IS NULL OR e.id = ?)
    ${ORDEN_PILOTOS}`);

  rutas.get('/categorias', (req, res) => {
    res.json({ categorias: consultas.categorias() });
  });

  rutas.get('/escuderias', (req, res) => {
    const categoria = filtroDe(req.query.categoria);
    res.json({ escuderias: escuderias.all(categoria, categoria).map(aEscuderia) });
  });

  rutas.get('/pilotos', (req, res) => {
    const categoria = filtroDe(req.query.categoria);
    const escuderia = Number(req.query.escuderia) || null;
    res.json({ pilotos: pilotos.all(categoria, categoria, escuderia, escuderia).map(aPilotoPublico) });
  });

  rutas.get('/eventos', (req, res) => eventos.suscribir(req, res));

  return rutas;
}
