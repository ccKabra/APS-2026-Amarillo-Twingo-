import { Router } from 'express';
import { errores } from '../lib/errores.js';
import { Validador, fechaIsoDe, idDeFiltro, idDeRuta } from '../lib/validacion.js';
import { ESTADOS_TECNICOS, TIPOS_INSPECCION } from '../db/esquema.js';
import { filtroDe } from './publico.js';

const SQL_INSPECCION = `
  SELECT i.*, e.nombre_oficial AS escuderia_nombre, c.codigo AS categoria, c.nombre AS categoria_nombre,
         p.nombre AS piloto_nombre, p.apellido AS piloto_apellido, p.numero AS piloto_numero
  FROM inspecciones i
  JOIN escuderias e ON e.id = i.escuderia_id
  JOIN categorias c ON c.id = i.categoria_id
  JOIN pilotos p ON p.id = i.piloto_id`;

function aInspeccion(fila) {
  return {
    id: fila.id,
    fecha: fila.fecha,
    tipo: fila.tipo,
    estadoTecnico: fila.estado_tecnico,
    observaciones: fila.observaciones ?? null,
    piloto: { id: fila.piloto_id, nombre: fila.piloto_nombre, apellido: fila.piloto_apellido, numero: fila.piloto_numero },
    escuderia: { id: fila.escuderia_id, nombreOficial: fila.escuderia_nombre },
    categoria: { codigo: fila.categoria, nombre: fila.categoria_nombre },
    actualizadaEn: fila.actualizada_en,
  };
}

export function rutasDeInspecciones(ctx) {
  const { db, reloj, auditoria, eventos } = ctx;

  const listar = db.prepare(`${SQL_INSPECCION}
    WHERE (? IS NULL OR c.codigo = ?)
      AND (? IS NULL OR i.escuderia_id = ?)
      AND (? IS NULL OR i.estado_tecnico = ?)
    ORDER BY i.fecha DESC, i.id DESC`);
  const inspeccionPorId = db.prepare(`${SQL_INSPECCION} WHERE i.id = ?`);
  const pilotoPorId = db.prepare(`
    SELECT p.id, p.escuderia_id, p.categoria_id, p.activo, e.activa AS escuderia_activa
    FROM pilotos p JOIN escuderias e ON e.id = p.escuderia_id
    WHERE p.id = ?`);
  const insertar = db.prepare(`
    INSERT INTO inspecciones (escuderia_id, piloto_id, categoria_id, fecha, tipo, estado_tecnico, observaciones,
                              creada_en, creada_por, actualizada_en, actualizada_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const actualizar = db.prepare(`
    UPDATE inspecciones SET escuderia_id = ?, piloto_id = ?, categoria_id = ?, fecha = ?, tipo = ?, estado_tecnico = ?,
                            observaciones = ?, actualizada_en = ?, actualizada_por = ?
    WHERE id = ?`);
  const eliminar = db.prepare('DELETE FROM inspecciones WHERE id = ?');

  function inspeccionExistente(id) {
    const fila = inspeccionPorId.get(idDeRuta(id, 'No existe esa inspección.'));
    if (!fila) throw errores.noEncontrado('No existe esa inspección.');
    return fila;
  }

  function validarInspeccion(datos, actual = null) {
    const v = new Validador();
    const pilotoId = v.id('pilotoId', datos.pilotoId, 'Vehículo');
    const fecha = v.fecha('fecha', datos.fecha, 'Fecha de la inspección', { hasta: fechaIsoDe(reloj.ahora()) });
    const tipo = v.enumerado('tipo', datos.tipo, TIPOS_INSPECCION, 'Tipo de inspección');
    const estadoTecnico = v.enumerado('estadoTecnico', datos.estadoTecnico, ESTADOS_TECNICOS, 'Estado técnico');
    const observaciones =
      estadoTecnico && estadoTecnico !== 'APROBADO'
        ? v.parrafo('observaciones', datos.observaciones, 'Observaciones', { min: 5, max: 500 })
        : typeof datos.observaciones === 'string' && datos.observaciones.trim()
          ? v.parrafo('observaciones', datos.observaciones, 'Observaciones', { max: 500 })
          : null;

    const piloto = pilotoId ? pilotoPorId.get(pilotoId) : null;
    const cambiaDeVehiculo = !actual || actual.piloto_id !== pilotoId;
    if (pilotoId && (!piloto || (cambiaDeVehiculo && (!piloto.activo || !piloto.escuderia_activa)))) {
      v.agregar('pilotoId', 'El vehículo no corresponde a un piloto activo de una escudería habilitada.');
    }
    v.lanzarSiHayErrores();
    return {
      pilotoId,
      escuderiaId: piloto.escuderia_id,
      categoriaId: piloto.categoria_id,
      fecha,
      tipo,
      estadoTecnico,
      observaciones: observaciones || null,
    };
  }

  function avisar(accion, fila) {
    eventos.publicar('inspecciones', {
      accion,
      inspeccionId: fila.id,
      escuderiaId: fila.escuderia_id,
      categoria: fila.categoria,
    });
  }

  const publicas = Router();

  publicas.get('/', (req, res) => {
    const categoria = filtroDe(req.query.categoria);
    const escuderia = idDeFiltro(req.query.escuderia);
    const estado = ESTADOS_TECNICOS.includes(req.query.estadoTecnico) ? req.query.estadoTecnico : null;
    res.json({
      inspecciones: listar.all(categoria, categoria, escuderia, escuderia, estado, estado).map(aInspeccion),
    });
  });

  const fia = Router();

  fia.post('/', (req, res) => {
    const i = validarInspeccion(req.body ?? {});
    const marca = reloj.ahora().toISOString();
    const id = insertar.run(
      i.escuderiaId,
      i.pilotoId,
      i.categoriaId,
      i.fecha,
      i.tipo,
      i.estadoTecnico,
      i.observaciones,
      marca,
      req.usuario.id,
      marca,
      req.usuario.id,
    ).lastInsertRowid;
    const fila = inspeccionPorId.get(id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'INSPECCION_ALTA',
      entidad: 'inspeccion',
      entidadId: id,
      detalle: {
        escuderia: fila.escuderia_nombre,
        vehiculo: fila.piloto_numero,
        fecha: i.fecha,
        tipo: i.tipo,
        estadoTecnico: i.estadoTecnico,
      },
      ip: req.ip,
    });
    avisar('alta', fila);
    res.status(201).json({ inspeccion: aInspeccion(fila) });
  });

  fia.put('/:id', (req, res) => {
    const actual = inspeccionExistente(req.params.id);
    const i = validarInspeccion(req.body ?? {}, actual);
    actualizar.run(
      i.escuderiaId,
      i.pilotoId,
      i.categoriaId,
      i.fecha,
      i.tipo,
      i.estadoTecnico,
      i.observaciones,
      reloj.ahora().toISOString(),
      req.usuario.id,
      actual.id,
    );
    const antes = {
      pilotoId: actual.piloto_id,
      fecha: actual.fecha,
      tipo: actual.tipo,
      estadoTecnico: actual.estado_tecnico,
      observaciones: actual.observaciones,
    };
    const despues = {
      pilotoId: i.pilotoId,
      fecha: i.fecha,
      tipo: i.tipo,
      estadoTecnico: i.estadoTecnico,
      observaciones: i.observaciones,
    };
    const cambios = Object.fromEntries(
      Object.keys(despues)
        .filter((campo) => despues[campo] !== antes[campo])
        .map((campo) => [campo, { antes: antes[campo], despues: despues[campo] }]),
    );
    const fila = inspeccionPorId.get(actual.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'INSPECCION_MODIFICACION',
      entidad: 'inspeccion',
      entidadId: actual.id,
      detalle: { escuderia: fila.escuderia_nombre, cambios },
      ip: req.ip,
    });
    avisar('modificacion', fila);
    res.json({ inspeccion: aInspeccion(fila) });
  });

  fia.delete('/:id', (req, res) => {
    const actual = inspeccionExistente(req.params.id);
    eliminar.run(actual.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'INSPECCION_ELIMINADA',
      entidad: 'inspeccion',
      entidadId: actual.id,
      detalle: {
        escuderia: actual.escuderia_nombre,
        vehiculo: actual.piloto_numero,
        fecha: actual.fecha,
        tipo: actual.tipo,
        estadoTecnico: actual.estado_tecnico,
      },
      ip: req.ip,
    });
    avisar('eliminacion', actual);
    res.status(204).end();
  });

  return { publicas, fia };
}
