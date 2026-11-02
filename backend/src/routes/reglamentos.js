import crypto from 'node:crypto';
import express, { Router } from 'express';
import { enTransaccion } from '../db/index.js';
import { TIPOS_REGLAMENTO } from '../db/esquema.js';
import { errores } from '../lib/errores.js';
import { Validador, idDeRuta } from '../lib/validacion.js';
import { filtroDe } from './publico.js';

export const MAX_MB_REGLAMENTO = 10;

const SQL_REGLAMENTO = `
  SELECT r.id, r.categoria_id, r.tipo, r.titulo, r.version, r.tamanio, r.sha256, r.vigente, r.publicado_en, r.reemplazado_en,
         c.codigo AS categoria, c.nombre AS categoria_nombre, u.nombre AS publicador_nombre, u.apellido AS publicador_apellido
  FROM reglamentos r
  JOIN categorias c ON c.id = r.categoria_id
  JOIN usuarios u ON u.id = r.publicado_por`;

function aReglamento(fila, { interna = false } = {}) {
  const reglamento = {
    categoria: { codigo: fila.categoria, nombre: fila.categoria_nombre },
    tipo: fila.tipo,
    titulo: fila.titulo,
    version: fila.version,
    tamanio: fila.tamanio,
    sha256: fila.sha256,
    publicadoEn: fila.publicado_en,
    documento: `/api/publico/reglamentos/${fila.categoria}/${fila.tipo}/documento`,
  };
  if (interna) {
    reglamento.id = fila.id;
    reglamento.vigente = fila.vigente === 1;
    reglamento.publicadoPor = `${fila.publicador_nombre} ${fila.publicador_apellido}`;
    reglamento.reemplazadoEn = fila.reemplazado_en ?? null;
  }
  return reglamento;
}

function enviarDocumento(res, fila) {
  res
    .set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="reglamento-${fila.categoria}-${fila.tipo}-v${fila.version}.pdf"`,
    })
    .send(Buffer.from(fila.documento));
}

export function rutasDeReglamentos(ctx) {
  const { db, reloj, auditoria, eventos, consultas } = ctx;

  const vigentes = db.prepare(`${SQL_REGLAMENTO}
    WHERE r.vigente = 1 AND (? IS NULL OR c.codigo = ?)
    ORDER BY c.orden, r.tipo`);
  const todos = db.prepare(`${SQL_REGLAMENTO}
    WHERE (? IS NULL OR c.codigo = ?)
    ORDER BY c.orden, r.tipo, r.version DESC`);
  const porId = db.prepare(`${SQL_REGLAMENTO} WHERE r.id = ?`);
  const SQL_DOCUMENTO = `
    SELECT r.version, r.documento, r.tipo, c.codigo AS categoria
    FROM reglamentos r JOIN categorias c ON c.id = r.categoria_id`;
  const documentoVigente = db.prepare(`${SQL_DOCUMENTO} WHERE c.codigo = ? AND r.tipo = ? AND r.vigente = 1`);
  const documentoPorId = db.prepare(`${SQL_DOCUMENTO} WHERE r.id = ?`);
  const ultimaVersion = db.prepare(
    'SELECT COALESCE(MAX(version), 0) AS version FROM reglamentos WHERE categoria_id = ? AND tipo = ?',
  );
  const retirarVigente = db.prepare(
    'UPDATE reglamentos SET vigente = 0, reemplazado_en = ? WHERE categoria_id = ? AND tipo = ? AND vigente = 1',
  );
  const insertar = db.prepare(`
    INSERT INTO reglamentos (categoria_id, tipo, titulo, version, documento, tamanio, sha256, publicado_en, publicado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  function validarPublicacion(req) {
    const v = new Validador();
    const datos = {
      categoria: v.enumerado('categoria', req.query.categoria, consultas.codigosDeCategorias(), 'Categoría'),
      tipo: v.enumerado('tipo', req.query.tipo, TIPOS_REGLAMENTO, 'Tipo de reglamento'),
      titulo: v.requerido('titulo', req.query.titulo, 'Título', { min: 3, max: 150 }),
    };
    const esPdf = Buffer.isBuffer(req.body) && req.body.subarray(0, 5).toString('latin1') === '%PDF-';
    if (!esPdf) v.agregar('documento', 'Hay que adjuntar el reglamento en formato PDF.');
    v.lanzarSiHayErrores();
    return datos;
  }

  const publicas = Router();

  publicas.get('/', (req, res) => {
    const categoria = filtroDe(req.query.categoria);
    res.json({ reglamentos: vigentes.all(categoria, categoria).map((f) => aReglamento(f)) });
  });

  publicas.get('/:categoria/:tipo/documento', (req, res) => {
    const fila = documentoVigente.get(req.params.categoria.toUpperCase(), req.params.tipo.toUpperCase());
    if (!fila) throw errores.noEncontrado('No hay un reglamento vigente para esa categoría.');
    enviarDocumento(res, fila);
  });

  const fia = Router();

  fia.get('/', (req, res) => {
    const categoria = filtroDe(req.query.categoria);
    res.json({ reglamentos: todos.all(categoria, categoria).map((f) => aReglamento(f, { interna: true })) });
  });

  fia.post('/', express.raw({ type: 'application/pdf', limit: `${MAX_MB_REGLAMENTO}mb` }), (req, res) => {
    const { categoria, tipo, titulo } = validarPublicacion(req);
    const categoriaId = consultas.categoriaPorCodigo(categoria).id;
    const sha256 = crypto.createHash('sha256').update(req.body).digest('hex');
    const marca = reloj.ahora().toISOString();
    const { id, version } = enTransaccion(db, () => {
      const nueva = ultimaVersion.get(categoriaId, tipo).version + 1;
      retirarVigente.run(marca, categoriaId, tipo);
      const insertado = insertar.run(categoriaId, tipo, titulo, nueva, req.body, req.body.length, sha256, marca, req.usuario.id);
      auditoria.registrar({
        usuario: req.usuario,
        accion: 'REGLAMENTO_PUBLICADO',
        entidad: 'reglamento',
        entidadId: insertado.lastInsertRowid,
        detalle: { categoria, tipo, titulo, version: nueva, sha256 },
        ip: req.ip,
      });
      return { id: insertado.lastInsertRowid, version: nueva };
    });
    eventos.publicar('reglamentos', { accion: version === 1 ? 'alta' : 'actualizacion', categoria, tipo, version });
    res.status(201).json({ reglamento: aReglamento(porId.get(id), { interna: true }) });
  });

  fia.get('/:id/documento', (req, res) => {
    const fila = documentoPorId.get(idDeRuta(req.params.id, 'No existe ese reglamento.'));
    if (!fila) throw errores.noEncontrado('No existe ese reglamento.');
    enviarDocumento(res, fila);
  });

  return { publicas, fia };
}
