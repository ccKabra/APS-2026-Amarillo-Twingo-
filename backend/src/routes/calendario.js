import { Router } from 'express';
import { errores } from '../lib/errores.js';
import { calendarioIcs } from '../lib/ics.js';
import { Validador, esFechaIso, esMesIso, idDeRuta } from '../lib/validacion.js';
import { TIPOS_EVENTO } from '../db/esquema.js';
import { filtroDe } from './publico.js';

const ESTADOS = ['ESPECULATIVA', 'OFICIAL'];

const SQL_EVENTO = `
  SELECT ev.*, c.codigo AS categoria, c.nombre AS categoria_nombre,
         ou.nombre AS oficializador_nombre, ou.apellido AS oficializador_apellido
  FROM eventos_calendario ev
  JOIN categorias c ON c.id = ev.categoria_id
  LEFT JOIN usuarios ou ON ou.id = ev.oficializado_por`;

function aEvento(fila, { interna = false } = {}) {
  const evento = {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    categoria: { codigo: fila.categoria, nombre: fila.categoria_nombre },
    circuito: fila.circuito,
    pais: fila.pais,
    fecha: fila.fecha,
    hora: fila.hora ?? null,
    estado: fila.estado,
    oficializadoEn: fila.oficializado_en ?? null,
    actualizadoEn: fila.actualizado_en,
  };
  if (interna) {
    evento.oficializadoPor = fila.oficializado_en ? `${fila.oficializador_nombre} ${fila.oficializador_apellido}` : null;
    evento.creadoEn = fila.creado_en;
  }
  return evento;
}

export function rutasDeCalendario(ctx) {
  const { db, reloj, auditoria, eventos, consultas } = ctx;

  const listar = db.prepare(`${SQL_EVENTO}
    WHERE (? IS NULL OR c.codigo = ?)
      AND (? IS NULL OR substr(ev.fecha, 1, 7) = ?)
      AND (? IS NULL OR ev.estado = ?)
      AND (? IS NULL OR ev.fecha >= ?)
      AND (? IS NULL OR ev.fecha <= ?)
    ORDER BY ev.fecha, COALESCE(ev.hora, ''), c.orden, ev.id`);
  const eventoPorId = db.prepare(`${SQL_EVENTO} WHERE ev.id = ?`);
  const insertar = db.prepare(`
    INSERT INTO eventos_calendario (categoria_id, nombre, tipo, circuito, pais, fecha, hora, creado_en, creado_por, actualizado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const actualizar = db.prepare(`
    UPDATE eventos_calendario
    SET categoria_id = ?, nombre = ?, tipo = ?, circuito = ?, pais = ?, fecha = ?, hora = ?, actualizado_en = ?,
        estado = ?, oficializado_en = ?, oficializado_por = ?
    WHERE id = ?`);
  const oficializar = db.prepare(`
    UPDATE eventos_calendario SET estado = 'OFICIAL', oficializado_en = ?, oficializado_por = ?, actualizado_en = ?
    WHERE id = ?`);
  const eliminar = db.prepare('DELETE FROM eventos_calendario WHERE id = ?');

  function eventoExistente(id) {
    const fila = eventoPorId.get(idDeRuta(id, 'No existe ese evento.'));
    if (!fila) throw errores.noEncontrado('No existe ese evento.');
    return fila;
  }

  function fechaDeFiltro(valor, campo) {
    const fecha = typeof valor === 'string' && valor.trim() ? valor.trim() : null;
    if (fecha && !esFechaIso(fecha)) throw errores.validacion({ [campo]: 'La fecha debe tener el formato AAAA-MM-DD.' });
    return fecha;
  }

  function filtros(query) {
    const categoria = filtroDe(query.categoria);
    const mes = typeof query.mes === 'string' && query.mes.trim() ? query.mes.trim() : null;
    if (mes && !esMesIso(mes)) throw errores.validacion({ mes: 'El mes debe tener el formato AAAA-MM.' });
    const estado = ESTADOS.includes(query.estado) ? query.estado : null;
    const desde = fechaDeFiltro(query.desde, 'desde');
    const hasta = fechaDeFiltro(query.hasta, 'hasta');
    if (desde && hasta && desde > hasta) {
      throw errores.validacion({ hasta: 'La fecha final no puede ser anterior a la inicial.' });
    }
    return [categoria, categoria, mes, mes, estado, estado, desde, desde, hasta, hasta];
  }

  function validarEvento(datos) {
    const v = new Validador();
    const evento = {
      nombre: v.requerido('nombre', datos.nombre, 'Nombre del evento', { min: 3, max: 100 }),
      tipo: v.enumerado('tipo', datos.tipo, TIPOS_EVENTO, 'Tipo de evento'),
      categoria: v.enumerado('categoria', datos.categoria, consultas.codigosDeCategorias(), 'Categoría'),
      circuito: v.requerido('circuito', datos.circuito, 'Circuito', { min: 2, max: 100 }),
      pais: v.requerido('pais', datos.pais, 'País', { max: 56 }),
      fecha: v.fecha('fecha', datos.fecha, 'Fecha'),
      hora: v.hora('hora', datos.hora, 'Hora'),
    };
    v.lanzarSiHayErrores();
    return { ...evento, categoriaId: consultas.categoriaPorCodigo(evento.categoria).id };
  }

  function datosParaAuditoria(e) {
    return { nombre: e.nombre, tipo: e.tipo, categoria: e.categoria, fecha: e.fecha, hora: e.hora ?? null };
  }

  function avisar(accion, fila) {
    eventos.publicar('calendario', { accion, eventoId: fila.id, categoria: fila.categoria, fecha: fila.fecha });
  }

  const publicas = Router();

  publicas.get('/', (req, res) => {
    res.json({ eventos: listar.all(...filtros(req.query)).map((f) => aEvento(f)) });
  });

  publicas.get('/descargar', (req, res) => {
    const contenido = calendarioIcs(listar.all(...filtros(req.query)).map((f) => aEvento(f)));
    res
      .set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="calendario-fia.ics"',
      })
      .send(contenido);
  });

  const fia = Router();

  fia.get('/', (req, res) => {
    res.json({ eventos: listar.all(...filtros(req.query)).map((f) => aEvento(f, { interna: true })) });
  });

  fia.post('/', (req, res) => {
    const e = validarEvento(req.body ?? {});
    const marca = reloj.ahora().toISOString();
    const id = insertar.run(
      e.categoriaId,
      e.nombre,
      e.tipo,
      e.circuito,
      e.pais,
      e.fecha,
      e.hora,
      marca,
      req.usuario.id,
      marca,
    ).lastInsertRowid;
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'EVENTO_ALTA',
      entidad: 'evento',
      entidadId: id,
      detalle: datosParaAuditoria(e),
      ip: req.ip,
    });
    const fila = eventoPorId.get(id);
    avisar('alta', fila);
    res.status(201).json({ evento: aEvento(fila, { interna: true }) });
  });

  fia.put('/:id', (req, res) => {
    const actual = eventoExistente(req.params.id);
    const e = validarEvento(req.body ?? {});
    const cambiaLaFecha = actual.fecha !== e.fecha || (actual.hora ?? null) !== e.hora;
    const volvioAEspeculativa = actual.estado === 'OFICIAL' && cambiaLaFecha;
    const sigueOficial = actual.estado === 'OFICIAL' && !cambiaLaFecha;
    actualizar.run(
      e.categoriaId,
      e.nombre,
      e.tipo,
      e.circuito,
      e.pais,
      e.fecha,
      e.hora,
      reloj.ahora().toISOString(),
      sigueOficial ? 'OFICIAL' : 'ESPECULATIVA',
      sigueOficial ? actual.oficializado_en : null,
      sigueOficial ? actual.oficializado_por : null,
      actual.id,
    );
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'EVENTO_MODIFICACION',
      entidad: 'evento',
      entidadId: actual.id,
      detalle: {
        antes: datosParaAuditoria(actual),
        despues: datosParaAuditoria(e),
        ...(volvioAEspeculativa && { volvioAEspeculativa: true }),
      },
      ip: req.ip,
    });
    const fila = eventoPorId.get(actual.id);
    avisar('modificacion', fila);
    res.json({ evento: aEvento(fila, { interna: true }), volvioAEspeculativa });
  });

  fia.post('/:id/oficializar', (req, res) => {
    const actual = eventoExistente(req.params.id);
    if (actual.estado === 'OFICIAL') {
      throw errores.conflicto('EVENTO_YA_OFICIAL', 'La fecha de este evento ya es oficial.');
    }
    const marca = reloj.ahora().toISOString();
    oficializar.run(marca, req.usuario.id, marca, actual.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'EVENTO_OFICIALIZADO',
      entidad: 'evento',
      entidadId: actual.id,
      detalle: datosParaAuditoria(actual),
      ip: req.ip,
    });
    const fila = eventoPorId.get(actual.id);
    avisar('oficializacion', fila);
    res.json({ evento: aEvento(fila, { interna: true }) });
  });

  fia.delete('/:id', (req, res) => {
    const actual = eventoExistente(req.params.id);
    eliminar.run(actual.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'EVENTO_ELIMINADO',
      entidad: 'evento',
      entidadId: actual.id,
      detalle: { ...datosParaAuditoria(actual), estado: actual.estado },
      ip: req.ip,
    });
    avisar('eliminacion', actual);
    res.status(204).end();
  });

  return { publicas, fia };
}
