import { Router } from 'express';
import { errores } from '../lib/errores.js';
import { Validador, fechaIsoDe, idDeFiltro, idDeRuta } from '../lib/validacion.js';
import { enTransaccion } from '../db/index.js';
import * as plantillas from '../lib/plantillas.js';
import { filtroDe } from './publico.js';

const ESTADOS = ['BORRADOR', 'PUBLICADA'];

const SQL_SANCION = `
  SELECT s.*, t.codigo AS tipo_codigo, t.nombre AS tipo_nombre, t.clase AS tipo_clase,
         e.nombre_oficial AS escuderia_nombre, c.codigo AS categoria, c.nombre AS categoria_nombre,
         p.nombre AS piloto_nombre, p.apellido AS piloto_apellido, p.numero AS piloto_numero,
         n.notificada_en, n.firmada_en, fu.nombre AS firmante_nombre, fu.apellido AS firmante_apellido,
         cu.email AS creada_por_email
  FROM sanciones s
  JOIN tipos_infraccion t ON t.id = s.tipo_infraccion_id
  JOIN escuderias e ON e.id = s.escuderia_id
  JOIN categorias c ON c.id = s.categoria_id
  LEFT JOIN pilotos p ON p.id = s.piloto_id
  LEFT JOIN notificaciones_sancion n ON n.sancion_id = s.id
  LEFT JOIN usuarios fu ON fu.id = n.firmada_por
  LEFT JOIN usuarios cu ON cu.id = s.creada_por`;

const FILTROS = `
  WHERE (? IS NULL OR s.estado = ?)
    AND (? IS NULL OR c.codigo = ?)
    AND (? IS NULL OR s.escuderia_id = ?)
    AND (? IS NULL OR s.piloto_id = ?)
  ORDER BY s.fecha_infraccion DESC, s.id DESC`;

function aSancion(fila, { interna = false, firmante = interna } = {}) {
  const sancion = {
    id: fila.id,
    tipoInfraccion: { codigo: fila.tipo_codigo, nombre: fila.tipo_nombre, clase: fila.tipo_clase },
    fechaInfraccion: fila.fecha_infraccion,
    penalizacion: fila.penalizacion,
    descripcion: fila.descripcion,
    estado: fila.estado,
    escuderia: { id: fila.escuderia_id, nombreOficial: fila.escuderia_nombre },
    categoria: { codigo: fila.categoria, nombre: fila.categoria_nombre },
    piloto: fila.piloto_id
      ? { id: fila.piloto_id, nombre: fila.piloto_nombre, apellido: fila.piloto_apellido, numero: fila.piloto_numero }
      : null,
    publicadaEn: fila.publicada_en ?? null,
    notificacion: fila.notificada_en
      ? {
          estado: fila.firmada_en ? 'ENTERADO' : 'NO_ENTERADO',
          notificadaEn: fila.notificada_en,
          firmadaEn: fila.firmada_en ?? null,
          ...(firmante && {
            firmadaPor: fila.firmada_en ? `${fila.firmante_nombre} ${fila.firmante_apellido}` : null,
          }),
        }
      : null,
  };
  if (interna) {
    sancion.creadaEn = fila.creada_en;
    sancion.creadaPor = fila.creada_por_email;
    sancion.actualizadaEn = fila.actualizada_en;
  }
  return sancion;
}

function filtrosDe(query, estado = null) {
  const categoria = filtroDe(query.categoria);
  const escuderia = idDeFiltro(query.escuderia);
  const piloto = idDeFiltro(query.piloto);
  return [estado, estado, categoria, categoria, escuderia, escuderia, piloto, piloto];
}

export function rutasDeSanciones(ctx) {
  const { db, config, reloj, auditoria, correo, eventos } = ctx;

  const listar = db.prepare(`${SQL_SANCION} ${FILTROS}`);
  const sancionPorId = db.prepare(`${SQL_SANCION} WHERE s.id = ?`);
  const tiposDeInfraccion = db.prepare('SELECT codigo, nombre, clase FROM tipos_infraccion ORDER BY clase DESC, nombre');
  const tipoPorCodigo = db.prepare('SELECT id, codigo FROM tipos_infraccion WHERE codigo = ?');
  const escuderiaPorId = db.prepare('SELECT id, nombre_oficial, categoria_id, activa FROM escuderias WHERE id = ?');
  const pilotoPorId = db.prepare('SELECT id, escuderia_id, activo FROM pilotos WHERE id = ?');
  const insertar = db.prepare(`
    INSERT INTO sanciones (escuderia_id, piloto_id, categoria_id, tipo_infraccion_id, fecha_infraccion, penalizacion,
                           descripcion, creada_en, creada_por, actualizada_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const actualizar = db.prepare(`
    UPDATE sanciones SET escuderia_id = ?, piloto_id = ?, categoria_id = ?, tipo_infraccion_id = ?, fecha_infraccion = ?,
                         penalizacion = ?, descripcion = ?, actualizada_en = ?
    WHERE id = ?`);
  const eliminar = db.prepare('DELETE FROM sanciones WHERE id = ?');
  const marcarPublicada = db.prepare(
    "UPDATE sanciones SET estado = 'PUBLICADA', publicada_en = ?, publicada_por = ?, actualizada_en = ? WHERE id = ?",
  );
  const insertarNotificacion = db.prepare(
    'INSERT INTO notificaciones_sancion (sancion_id, escuderia_id, notificada_en) VALUES (?, ?, ?)',
  );
  const firmarNotificacion = db.prepare(
    'UPDATE notificaciones_sancion SET firmada_en = ?, firmada_por = ? WHERE sancion_id = ? AND firmada_en IS NULL',
  );
  const responsablesActivos = db.prepare(`
    SELECT u.email, u.nombre FROM usuario_escuderia ue JOIN usuarios u ON u.id = ue.usuario_id
    WHERE ue.escuderia_id = ? AND u.activo = 1
    ORDER BY u.id`);

  function sancionExistente(id) {
    const fila = sancionPorId.get(idDeRuta(id, 'No existe esa sanción.'));
    if (!fila) throw errores.noEncontrado('No existe esa sanción.');
    return fila;
  }

  function borradorExistente(id) {
    const fila = sancionExistente(id);
    if (fila.estado !== 'BORRADOR') {
      throw errores.conflicto('SANCION_PUBLICADA', 'La sanción ya fue publicada y no se puede modificar ni eliminar.');
    }
    return fila;
  }

  function validarSancion(datos) {
    const v = new Validador();
    const escuderiaId = v.id('escuderiaId', datos.escuderiaId, 'Escudería');
    const sinPiloto = datos.pilotoId === undefined || datos.pilotoId === null || datos.pilotoId === '';
    const pilotoId = sinPiloto ? null : v.id('pilotoId', datos.pilotoId, 'Piloto');
    const codigoTipo = v.requerido('tipoInfraccion', datos.tipoInfraccion, 'Tipo de infracción');
    const fechaInfraccion = v.fecha('fechaInfraccion', datos.fechaInfraccion, 'Fecha de la infracción', {
      hasta: fechaIsoDe(reloj.ahora()),
    });
    const penalizacion = v.requerido('penalizacion', datos.penalizacion, 'Penalización', { min: 3, max: 120 });
    const descripcion = v.parrafo('descripcion', datos.descripcion, 'Descripción', { min: 10, max: 1000 });

    const escuderia = escuderiaId ? escuderiaPorId.get(escuderiaId) : null;
    if (escuderiaId && (!escuderia || !escuderia.activa)) v.agregar('escuderiaId', 'La escudería no existe o está dada de baja.');
    const tipo = codigoTipo ? tipoPorCodigo.get(codigoTipo.toUpperCase()) : null;
    if (codigoTipo && !tipo) v.agregar('tipoInfraccion', 'El tipo de infracción no existe.');
    if (pilotoId) {
      const piloto = pilotoPorId.get(pilotoId);
      if (!piloto || !piloto.activo || piloto.escuderia_id !== escuderiaId) {
        v.agregar('pilotoId', 'El piloto no pertenece a la nómina activa de la escudería elegida.');
      }
    }
    v.lanzarSiHayErrores();
    return {
      escuderiaId,
      pilotoId,
      categoriaId: escuderia.categoria_id,
      tipoId: tipo.id,
      tipoCodigo: tipo.codigo,
      fechaInfraccion,
      penalizacion,
      descripcion,
    };
  }

  function publicar(id, req) {
    const fila = sancionPorId.get(id);
    const marca = reloj.ahora().toISOString();
    marcarPublicada.run(marca, req.usuario.id, marca, id);
    insertarNotificacion.run(id, fila.escuderia_id, marca);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'SANCION_PUBLICACION',
      entidad: 'sancion',
      entidadId: id,
      detalle: { escuderia: fila.escuderia_nombre, infraccion: fila.tipo_nombre, penalizacion: fila.penalizacion },
      ip: req.ip,
    });
  }

  async function notificarPublicacion(id) {
    const sancion = aSancion(sancionPorId.get(id));
    const enlace = `${config.urlPublica}/escuderia/sanciones`;
    const destinatarios = responsablesActivos.all(sancion.escuderia.id);
    let enviados = 0;
    for (const destinatario of destinatarios) {
      const mensaje = plantillas.sancionPublicada({ nombre: destinatario.nombre, sancion, enlace });
      const envio = await correo.enviar({ para: destinatario.email, asunto: mensaje.asunto, texto: mensaje.texto });
      if (envio.enviado) enviados += 1;
    }
    eventos.publicar('sanciones', {
      accion: 'publicacion',
      sancionId: id,
      escuderiaId: sancion.escuderia.id,
      categoria: sancion.categoria.codigo,
    });
    return { enviados, destinatarios: destinatarios.map((d) => d.email) };
  }

  async function responderGuardado(res, id, publicada, estado) {
    const correos = publicada ? await notificarPublicacion(id) : null;
    res.status(estado).json({ sancion: aSancion(sancionPorId.get(id), { interna: true }), ...(correos && { correos }) });
  }

  const publicas = Router();

  publicas.get('/', (req, res) => {
    res.json({ sanciones: listar.all(...filtrosDe(req.query, 'PUBLICADA')).map((f) => aSancion(f)) });
  });

  publicas.get('/tipos-infraccion', (req, res) => {
    res.json({ tipos: tiposDeInfraccion.all() });
  });

  const fia = Router();

  fia.get('/', (req, res) => {
    const estado = ESTADOS.includes(req.query.estado) ? req.query.estado : null;
    res.json({ sanciones: listar.all(...filtrosDe(req.query, estado)).map((f) => aSancion(f, { interna: true })) });
  });

  fia.post('/', async (req, res) => {
    const datos = req.body ?? {};
    const s = validarSancion(datos);
    const publicarAhora = datos.publicar === true;
    const marca = reloj.ahora().toISOString();
    let id;
    enTransaccion(db, () => {
      id = insertar.run(
        s.escuderiaId,
        s.pilotoId,
        s.categoriaId,
        s.tipoId,
        s.fechaInfraccion,
        s.penalizacion,
        s.descripcion,
        marca,
        req.usuario.id,
        marca,
      ).lastInsertRowid;
      auditoria.registrar({
        usuario: req.usuario,
        accion: 'SANCION_ALTA',
        entidad: 'sancion',
        entidadId: id,
        detalle: {
          escuderiaId: s.escuderiaId,
          pilotoId: s.pilotoId,
          infraccion: s.tipoCodigo,
          fechaInfraccion: s.fechaInfraccion,
          penalizacion: s.penalizacion,
        },
        ip: req.ip,
      });
      if (publicarAhora) publicar(id, req);
    });
    await responderGuardado(res, id, publicarAhora, 201);
  });

  fia.put('/:id', async (req, res) => {
    const actual = borradorExistente(req.params.id);
    const datos = req.body ?? {};
    const s = validarSancion(datos);
    const publicarAhora = datos.publicar === true;
    enTransaccion(db, () => {
      actualizar.run(
        s.escuderiaId,
        s.pilotoId,
        s.categoriaId,
        s.tipoId,
        s.fechaInfraccion,
        s.penalizacion,
        s.descripcion,
        reloj.ahora().toISOString(),
        actual.id,
      );
      auditoria.registrar({
        usuario: req.usuario,
        accion: 'SANCION_MODIFICACION',
        entidad: 'sancion',
        entidadId: actual.id,
        detalle: {
          antes: { escuderiaId: actual.escuderia_id, pilotoId: actual.piloto_id, penalizacion: actual.penalizacion },
          despues: { escuderiaId: s.escuderiaId, pilotoId: s.pilotoId, penalizacion: s.penalizacion },
        },
        ip: req.ip,
      });
      if (publicarAhora) publicar(actual.id, req);
    });
    await responderGuardado(res, actual.id, publicarAhora, 200);
  });

  fia.post('/:id/publicar', async (req, res) => {
    const actual = borradorExistente(req.params.id);
    enTransaccion(db, () => publicar(actual.id, req));
    await responderGuardado(res, actual.id, true, 200);
  });

  fia.delete('/:id', (req, res) => {
    const actual = borradorExistente(req.params.id);
    eliminar.run(actual.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'SANCION_ELIMINADA',
      entidad: 'sancion',
      entidadId: actual.id,
      detalle: { escuderia: actual.escuderia_nombre, infraccion: actual.tipo_nombre, penalizacion: actual.penalizacion },
      ip: req.ip,
    });
    res.status(204).end();
  });

  const escuderia = Router();

  escuderia.get('/', (req, res) => {
    const filtros = filtrosDe({ ...req.query, escuderia: req.escuderia.id, categoria: undefined }, 'PUBLICADA');
    res.json({ sanciones: listar.all(...filtros).map((f) => aSancion(f, { firmante: true })) });
  });

  escuderia.post('/:sancionId/firmar', (req, res) => {
    const fila = sancionPorId.get(idDeRuta(req.params.sancionId, 'No existe esa sanción.'));
    if (!fila || fila.escuderia_id !== req.escuderia.id || fila.estado !== 'PUBLICADA') {
      throw errores.noEncontrado('Esa sanción no corresponde a la escudería seleccionada.');
    }
    if (fila.firmada_en) {
      throw errores.conflicto('SANCION_YA_FIRMADA', 'La escudería ya firmó la notificación de esta sanción.');
    }
    const marca = reloj.ahora().toISOString();
    firmarNotificacion.run(marca, req.usuario.id, fila.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'SANCION_FIRMA',
      entidad: 'sancion',
      entidadId: fila.id,
      detalle: { escuderia: req.escuderia.nombre_oficial, infraccion: fila.tipo_nombre, penalizacion: fila.penalizacion },
      ip: req.ip,
    });
    eventos.publicar('sanciones', {
      accion: 'firma',
      sancionId: fila.id,
      escuderiaId: req.escuderia.id,
      categoria: req.escuderia.categoria,
    });
    res.json({ sancion: aSancion(sancionPorId.get(fila.id), { firmante: true }) });
  });

  return { publicas, fia, escuderia };
}
