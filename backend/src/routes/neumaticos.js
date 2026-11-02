import { Router } from 'express';
import { errores } from '../lib/errores.js';
import { Validador, idDeRuta } from '../lib/validacion.js';

const FECHAS_POR_ANIO = 2;

const SQL_PRUEBA = `
  SELECT pn.*, fu.nombre AS firmante_nombre, fu.apellido AS firmante_apellido
  FROM pruebas_neumaticos pn
  LEFT JOIN usuarios fu ON fu.id = pn.firmada_por`;

function aPrueba(fila, { interna = false } = {}) {
  const prueba = {
    id: fila.id,
    anio: fila.anio,
    numero: fila.numero,
    fecha: fila.fecha,
    hora: fila.hora ?? null,
    circuito: fila.circuito,
    pais: fila.pais,
    cronograma: fila.cronograma ?? null,
    estado: fila.estado,
    firmadaEn: fila.firmada_en ?? null,
  };
  if (interna) prueba.firmadaPor = fila.firmada_en ? `${fila.firmante_nombre} ${fila.firmante_apellido}` : null;
  return prueba;
}

export function rutasDeNeumaticos(ctx) {
  const { db, reloj, auditoria, eventos } = ctx;

  const listar = db.prepare(`${SQL_PRUEBA} WHERE (? IS NULL OR pn.anio = ?) ORDER BY pn.fecha`);
  const pruebaPorId = db.prepare(`${SQL_PRUEBA} WHERE pn.id = ?`);
  const pruebasDelAnio = db.prepare('SELECT id, numero, fecha FROM pruebas_neumaticos WHERE anio = ? AND id <> ?');
  const insertar = db.prepare(`
    INSERT INTO pruebas_neumaticos (anio, numero, fecha, hora, circuito, pais, cronograma, creada_en, creada_por, actualizada_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const actualizar = db.prepare(`
    UPDATE pruebas_neumaticos
    SET anio = ?, numero = ?, fecha = ?, hora = ?, circuito = ?, pais = ?, cronograma = ?, actualizada_en = ?,
        estado = ?, firmada_en = ?, firmada_por = ?
    WHERE id = ?`);
  const firmar = db.prepare(`
    UPDATE pruebas_neumaticos SET estado = 'OFICIAL', firmada_en = ?, firmada_por = ?, actualizada_en = ? WHERE id = ?`);
  const eliminar = db.prepare('DELETE FROM pruebas_neumaticos WHERE id = ?');

  function pruebaExistente(id) {
    const fila = pruebaPorId.get(idDeRuta(id, 'No existe esa prueba.'));
    if (!fila) throw errores.noEncontrado('No existe esa prueba.');
    return fila;
  }

  function validarPrueba(datos) {
    const v = new Validador();
    const hayCronograma = typeof datos.cronograma === 'string' && datos.cronograma.trim();
    const prueba = {
      fecha: v.fecha('fecha', datos.fecha, 'Fecha'),
      hora: v.hora('hora', datos.hora, 'Hora'),
      circuito: v.requerido('circuito', datos.circuito, 'Circuito', { min: 2, max: 100 }),
      pais: v.requerido('pais', datos.pais, 'País', { max: 56 }),
      cronograma: hayCronograma ? v.parrafo('cronograma', datos.cronograma, 'Cronograma', { max: 1000 }) : null,
    };
    v.lanzarSiHayErrores();
    return { ...prueba, anio: Number(prueba.fecha.slice(0, 4)) };
  }

  function numeroDisponible({ anio, fecha }, actual = { id: 0 }) {
    const otras = pruebasDelAnio.all(anio, actual.id);
    if (otras.some((o) => o.fecha === fecha)) {
      throw errores.conflicto('FECHA_REPETIDA', 'Esa fecha ya está cargada para las pruebas de este año.', {
        fecha: 'Las dos fechas del año tienen que ser distintas.',
      });
    }
    if (otras.length >= FECHAS_POR_ANIO) {
      throw errores.conflicto('CUPO_COMPLETO', `Ya están cargadas las ${FECHAS_POR_ANIO} fechas de prueba de ${anio}.`, {
        fecha: `El año ${anio} ya tiene sus ${FECHAS_POR_ANIO} fechas.`,
      });
    }
    if (actual.anio === anio) return actual.numero;
    return [1, 2].find((numero) => otras.every((o) => o.numero !== numero));
  }

  function datosParaAuditoria(p) {
    return { fecha: p.fecha, hora: p.hora ?? null, circuito: p.circuito, pais: p.pais };
  }

  function avisar(accion, fila) {
    eventos.publicar('neumaticos', { accion, pruebaId: fila.id, anio: fila.anio });
  }

  function listado(query, opciones) {
    const anio = Number(query.anio);
    const filtro = Number.isInteger(anio) && anio > 0 ? anio : null;
    return listar.all(filtro, filtro).map((f) => aPrueba(f, opciones));
  }

  const publicas = Router();

  publicas.get('/', (req, res) => {
    res.json({ pruebas: listado(req.query) });
  });

  const fia = Router();

  fia.get('/', (req, res) => {
    res.json({ pruebas: listado(req.query, { interna: true }) });
  });

  fia.post('/', (req, res) => {
    const p = validarPrueba(req.body ?? {});
    const numero = numeroDisponible(p);
    const marca = reloj.ahora().toISOString();
    const id = insertar.run(p.anio, numero, p.fecha, p.hora, p.circuito, p.pais, p.cronograma, marca, req.usuario.id, marca)
      .lastInsertRowid;
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'PRUEBA_NEUMATICOS_ALTA',
      entidad: 'prueba_neumaticos',
      entidadId: id,
      detalle: datosParaAuditoria(p),
      ip: req.ip,
    });
    const fila = pruebaPorId.get(id);
    avisar('alta', fila);
    res.status(201).json({ prueba: aPrueba(fila, { interna: true }) });
  });

  fia.put('/:id', (req, res) => {
    const actual = pruebaExistente(req.params.id);
    const p = validarPrueba(req.body ?? {});
    const numero = numeroDisponible(p, actual);
    const cambiaLaFecha = actual.fecha !== p.fecha || (actual.hora ?? null) !== p.hora;
    const sigueOficial = actual.estado === 'OFICIAL' && !cambiaLaFecha;
    const volvioANoOficial = actual.estado === 'OFICIAL' && cambiaLaFecha;
    actualizar.run(
      p.anio,
      numero,
      p.fecha,
      p.hora,
      p.circuito,
      p.pais,
      p.cronograma,
      reloj.ahora().toISOString(),
      sigueOficial ? 'OFICIAL' : 'NO_OFICIAL',
      sigueOficial ? actual.firmada_en : null,
      sigueOficial ? actual.firmada_por : null,
      actual.id,
    );
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'PRUEBA_NEUMATICOS_MODIFICACION',
      entidad: 'prueba_neumaticos',
      entidadId: actual.id,
      detalle: {
        antes: datosParaAuditoria(actual),
        despues: datosParaAuditoria(p),
        ...(volvioANoOficial && { volvioANoOficial: true }),
      },
      ip: req.ip,
    });
    const fila = pruebaPorId.get(actual.id);
    avisar('modificacion', fila);
    res.json({ prueba: aPrueba(fila, { interna: true }), volvioANoOficial });
  });

  fia.post('/:id/firmar', (req, res) => {
    const actual = pruebaExistente(req.params.id);
    if (actual.estado === 'OFICIAL') {
      throw errores.conflicto('PRUEBA_YA_FIRMADA', 'Esta fecha de prueba ya está firmada.');
    }
    const marca = reloj.ahora().toISOString();
    firmar.run(marca, req.usuario.id, marca, actual.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'PRUEBA_NEUMATICOS_FIRMA',
      entidad: 'prueba_neumaticos',
      entidadId: actual.id,
      detalle: datosParaAuditoria(actual),
      ip: req.ip,
    });
    const fila = pruebaPorId.get(actual.id);
    avisar('firma', fila);
    res.json({ prueba: aPrueba(fila, { interna: true }) });
  });

  fia.delete('/:id', (req, res) => {
    const actual = pruebaExistente(req.params.id);
    eliminar.run(actual.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'PRUEBA_NEUMATICOS_ELIMINADA',
      entidad: 'prueba_neumaticos',
      entidadId: actual.id,
      detalle: { ...datosParaAuditoria(actual), estado: actual.estado },
      ip: req.ip,
    });
    avisar('eliminacion', actual);
    res.status(204).end();
  });

  return { publicas, fia };
}
