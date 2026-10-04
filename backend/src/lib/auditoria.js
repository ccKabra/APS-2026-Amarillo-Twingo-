export function crearAuditoria({ db, reloj }) {
  const insertar = db.prepare(`
    INSERT INTO auditoria (fecha_hora, usuario_id, usuario_email, accion, entidad, entidad_id, detalle, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  function registrar({ usuario, accion, entidad = null, entidadId = null, detalle = null, ip = null }) {
    insertar.run(
      reloj.ahora().toISOString(),
      usuario?.id ?? null,
      usuario?.email ?? null,
      accion,
      entidad,
      entidadId === null || entidadId === undefined ? null : Number(entidadId),
      detalle ? JSON.stringify(detalle) : null,
      ip ?? null,
    );
  }

  return { registrar };
}
