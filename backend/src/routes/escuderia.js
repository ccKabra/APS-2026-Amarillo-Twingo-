import { Router } from 'express';
import { errores } from '../lib/errores.js';
import { Validador } from '../lib/validacion.js';
import { esViolacionDeUnicidad } from '../db/index.js';
import { aPilotoCompleto } from '../lib/consultas.js';

const ROLES = ['TITULAR', 'SUPLENTE'];
const NOMBRES_DE_ROL = ['Titular', 'Suplente'];

export function rutasDeEscuderia(ctx) {
  const { db, reloj, auditoria, eventos, consultas } = ctx;
  const rutas = Router();

  const escuderiaAsociada = db.prepare(`
    SELECT e.id, e.nombre_oficial, e.activa, e.categoria_id, c.codigo AS categoria, c.nombre AS categoria_nombre
    FROM usuario_escuderia ue
    JOIN escuderias e ON e.id = ue.escuderia_id
    JOIN categorias c ON c.id = e.categoria_id
    WHERE ue.usuario_id = ? AND e.id = ?`);
  const sqlPiloto = `
    SELECT p.*, e.nombre_oficial AS escuderia_nombre, c.codigo AS categoria, c.nombre AS categoria_nombre
    FROM pilotos p
    JOIN escuderias e ON e.id = p.escuderia_id
    JOIN categorias c ON c.id = p.categoria_id`;
  const pilotosDeEscuderia = db.prepare(`${sqlPiloto}
    WHERE p.escuderia_id = ? AND p.activo = 1
    ORDER BY CASE p.rol WHEN 'TITULAR' THEN 0 ELSE 1 END, p.numero`);
  const pilotoPorId = db.prepare(`${sqlPiloto} WHERE p.id = ?`);
  const numeroEnUso = db.prepare(`
    SELECT p.id, p.nombre, p.apellido, e.nombre_oficial AS escuderia
    FROM pilotos p JOIN escuderias e ON e.id = p.escuderia_id
    WHERE p.categoria_id = ? AND p.numero = ? AND p.activo = 1 AND p.id <> ?`);
  const insertar = db.prepare(`
    INSERT INTO pilotos (escuderia_id, categoria_id, nombre, apellido, nacionalidad, fecha_nacimiento, numero, rol, creado_en, actualizado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const actualizar = db.prepare(`
    UPDATE pilotos SET nombre = ?, apellido = ?, nacionalidad = ?, fecha_nacimiento = ?, numero = ?, rol = ?, actualizado_en = ?
    WHERE id = ?`);
  const cambiarRol = db.prepare('UPDATE pilotos SET rol = ?, actualizado_en = ? WHERE id = ?');
  const darDeBaja = db.prepare('UPDATE pilotos SET activo = 0, dado_de_baja_en = ?, actualizado_en = ? WHERE id = ?');

  function escuderiaSeleccionada(req, res, next) {
    const id = Number(req.params.escuderiaId);
    const escuderia = Number.isInteger(id) ? escuderiaAsociada.get(req.usuario.id, id) : undefined;
    if (!escuderia) {
      auditoria.registrar({
        usuario: req.usuario,
        accion: 'ACCESO_DENEGADO',
        entidad: 'escuderia',
        entidadId: Number.isInteger(id) ? id : null,
        detalle: { motivo: 'ESCUDERIA_NO_ASOCIADA', metodo: req.method, ruta: req.originalUrl },
        ip: req.ip,
      });
      return next(errores.prohibido('Solo podés gestionar las escuderías asociadas a tu cuenta.'));
    }
    if (!escuderia.activa) return next(errores.prohibido('La escudería seleccionada está dada de baja.'));
    req.escuderia = escuderia;
    return next();
  }

  function pilotoDeLaEscuderia(req) {
    const id = Number(req.params.pilotoId);
    const piloto = Number.isInteger(id) ? pilotoPorId.get(id) : undefined;
    if (!piloto || piloto.escuderia_id !== req.escuderia.id || piloto.activo !== 1) {
      throw errores.noEncontrado('Ese piloto no pertenece a la escudería seleccionada.');
    }
    return piloto;
  }

  function validarPiloto(datos) {
    const v = new Validador();
    const piloto = {
      nombre: v.requerido('nombre', datos.nombre, 'Nombre', { max: 60 }),
      apellido: v.requerido('apellido', datos.apellido, 'Apellido', { max: 60 }),
      nacionalidad: v.requerido('nacionalidad', datos.nacionalidad, 'Nacionalidad', { min: 3, max: 56 }),
      fechaNacimiento: v.fechaDeNacimiento('fechaNacimiento', datos.fechaNacimiento, 'Fecha de nacimiento', reloj.ahora()),
      numero: v.entero('numero', datos.numero, 'Número', { min: 1, max: 99 }),
      rol: v.enumerado('rol', datos.rol, ROLES, 'Rol', NOMBRES_DE_ROL),
    };
    v.lanzarSiHayErrores();
    return piloto;
  }

  function verificarNumeroLibre(escuderia, numero, excluirId = 0) {
    const ocupado = numeroEnUso.get(escuderia.categoria_id, numero, excluirId);
    if (ocupado) {
      throw errores.conflicto(
        'NUMERO_EN_USO',
        `El número ${numero} ya lo usa ${ocupado.nombre} ${ocupado.apellido} (${ocupado.escuderia}) en ${escuderia.categoria_nombre}.`,
        { numero: `El número ${numero} ya está asignado en ${escuderia.categoria_nombre}.` },
      );
    }
  }

  function avisarCambio(accion, escuderia, pilotoId) {
    eventos.publicar('nomina', { tipo: 'piloto', accion, categoria: escuderia.categoria, escuderiaId: escuderia.id, pilotoId });
  }

  rutas.get('/mis-escuderias', (req, res) => {
    res.json({ escuderias: consultas.escuderiasDeUsuario(req.usuario.id) });
  });

  rutas.get('/:escuderiaId/pilotos', escuderiaSeleccionada, (req, res) => {
    res.json({ pilotos: pilotosDeEscuderia.all(req.escuderia.id).map(aPilotoCompleto) });
  });

  rutas.post('/:escuderiaId/pilotos', escuderiaSeleccionada, (req, res) => {
    const piloto = validarPiloto(req.body ?? {});
    verificarNumeroLibre(req.escuderia, piloto.numero);
    const ahora = reloj.ahora().toISOString();
    let id;
    try {
      id = insertar.run(
        req.escuderia.id,
        req.escuderia.categoria_id,
        piloto.nombre,
        piloto.apellido,
        piloto.nacionalidad,
        piloto.fechaNacimiento,
        piloto.numero,
        piloto.rol,
        ahora,
        ahora,
      ).lastInsertRowid;
    } catch (error) {
      if (esViolacionDeUnicidad(error)) verificarNumeroLibre(req.escuderia, piloto.numero);
      throw error;
    }
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'PILOTO_ALTA',
      entidad: 'piloto',
      entidadId: id,
      detalle: { escuderia: req.escuderia.nombre_oficial, ...piloto },
      ip: req.ip,
    });
    avisarCambio('alta', req.escuderia, id);
    res.status(201).json({ piloto: aPilotoCompleto(pilotoPorId.get(id)) });
  });

  rutas.put('/:escuderiaId/pilotos/:pilotoId', escuderiaSeleccionada, (req, res) => {
    const actual = pilotoDeLaEscuderia(req);
    const piloto = validarPiloto(req.body ?? {});
    verificarNumeroLibre(req.escuderia, piloto.numero, actual.id);
    actualizar.run(
      piloto.nombre,
      piloto.apellido,
      piloto.nacionalidad,
      piloto.fechaNacimiento,
      piloto.numero,
      piloto.rol,
      reloj.ahora().toISOString(),
      actual.id,
    );
    const antes = {
      nombre: actual.nombre,
      apellido: actual.apellido,
      nacionalidad: actual.nacionalidad,
      fechaNacimiento: actual.fecha_nacimiento,
      numero: actual.numero,
      rol: actual.rol,
    };
    const cambios = Object.fromEntries(
      Object.keys(piloto)
        .filter((campo) => piloto[campo] !== antes[campo])
        .map((campo) => [campo, { antes: antes[campo], despues: piloto[campo] }]),
    );
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'PILOTO_MODIFICACION',
      entidad: 'piloto',
      entidadId: actual.id,
      detalle: { escuderia: req.escuderia.nombre_oficial, cambios },
      ip: req.ip,
    });
    avisarCambio('modificacion', req.escuderia, actual.id);
    res.json({ piloto: aPilotoCompleto(pilotoPorId.get(actual.id)) });
  });

  rutas.patch('/:escuderiaId/pilotos/:pilotoId/rol', escuderiaSeleccionada, (req, res) => {
    const actual = pilotoDeLaEscuderia(req);
    const v = new Validador();
    const rol = v.enumerado('rol', req.body?.rol, ROLES, 'Rol', NOMBRES_DE_ROL);
    v.lanzarSiHayErrores();
    cambiarRol.run(rol, reloj.ahora().toISOString(), actual.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'PILOTO_CAMBIO_ROL',
      entidad: 'piloto',
      entidadId: actual.id,
      detalle: { escuderia: req.escuderia.nombre_oficial, piloto: `${actual.nombre} ${actual.apellido}`, de: actual.rol, a: rol },
      ip: req.ip,
    });
    avisarCambio('cambio-rol', req.escuderia, actual.id);
    res.json({ piloto: aPilotoCompleto(pilotoPorId.get(actual.id)) });
  });

  rutas.delete('/:escuderiaId/pilotos/:pilotoId', escuderiaSeleccionada, (req, res) => {
    const actual = pilotoDeLaEscuderia(req);
    const ahora = reloj.ahora().toISOString();
    darDeBaja.run(ahora, ahora, actual.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'PILOTO_BAJA',
      entidad: 'piloto',
      entidadId: actual.id,
      detalle: { escuderia: req.escuderia.nombre_oficial, piloto: `${actual.nombre} ${actual.apellido}`, numero: actual.numero },
      ip: req.ip,
    });
    avisarCambio('baja', req.escuderia, actual.id);
    res.status(204).end();
  });

  return rutas;
}
