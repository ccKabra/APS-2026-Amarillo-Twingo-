import { Router } from 'express';
import { aPilotoCompleto } from '../lib/consultas.js';
import { ORDEN_PILOTOS, SQL_PILOTOS, filtroDe } from './publico.js';

export function rutasDeLaFia(ctx) {
  const { db } = ctx;
  const rutas = Router();

  const pilotos = db.prepare(`${SQL_PILOTOS}
    WHERE (? = 1 OR p.activo = 1)
      AND (? IS NULL OR c.codigo = ?)
      AND (? IS NULL OR e.id = ?)
    ${ORDEN_PILOTOS}`);

  rutas.get('/pilotos', (req, res) => {
    const incluirBajas = req.query.incluirBajas === 'true' ? 1 : 0;
    const categoria = filtroDe(req.query.categoria);
    const escuderia = Number(req.query.escuderia) || null;
    const filas = pilotos.all(incluirBajas, categoria, categoria, escuderia, escuderia);
    res.json({
      pilotos: filas.map((fila) => ({ ...aPilotoCompleto(fila), escuderiaActiva: fila.escuderia_activa === 1 })),
    });
  });

  return rutas;
}
