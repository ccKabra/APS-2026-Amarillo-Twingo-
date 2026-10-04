





import { generarToken, hashToken } from './tokens.js';
import { sumarMinutos } from './reloj.js';

export const MENSAJES_SESION = {
  NO_AUTENTICADO: 'Tenés que iniciar sesión.',
  SESION_INVALIDA: 'La sesión no es válida. Iniciá sesión nuevamente.',
  SESION_EXPIRADA: 'La sesión llegó a su duración máxima. Iniciá sesión nuevamente.',
  SESION_INACTIVA: 'La sesión se cerró por inactividad. Iniciá sesión nuevamente.',
  CUENTA_DESHABILITADA: 'Tu cuenta fue deshabilitada. Comunicate con la FIA.',
};

export function crearServicioDeSesiones({ db, config, reloj }) {
  const { inactividadMinutos, duracionMaximaHoras } = config.sesion;

  const insertar = db.prepare(`
    INSERT INTO sesiones (usuario_id, token_hash, plataforma, creada_en, ultima_actividad, expira_en)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const buscar = db.prepare(`
    SELECT s.id, s.usuario_id, s.plataforma, s.ultima_actividad, s.expira_en, s.revocada_en,
           u.email, u.nombre, u.apellido, u.rol, u.activo
    FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ?`);
  const registrarActividad = db.prepare('UPDATE sesiones SET ultima_actividad = ? WHERE id = ?');
  const revocarPorId = db.prepare(
    'UPDATE sesiones SET revocada_en = ?, motivo_revocacion = ? WHERE id = ? AND revocada_en IS NULL',
  );
  const revocarDeUsuario = db.prepare(
    'UPDATE sesiones SET revocada_en = ?, motivo_revocacion = ? WHERE usuario_id = ? AND revocada_en IS NULL AND id <> ?',
  );

  function crear(usuarioId, plataforma = 'web') {
    const token = generarToken();
    const ahora = reloj.ahora();
    const expira = sumarMinutos(ahora, duracionMaximaHoras * 60);
    insertar.run(usuarioId, hashToken(token), plataforma, ahora.toISOString(), ahora.toISOString(), expira.toISOString());
    return { token, plataforma, expiraEn: expira.toISOString(), inactividadMinutos };
  }

  function validar(token) {
    if (!token) return { error: 'NO_AUTENTICADO' };
    const fila = buscar.get(hashToken(token));
    if (!fila || fila.revocada_en) return { error: 'SESION_INVALIDA' };

    const ahora = reloj.ahora();
    const marca = ahora.toISOString();
    if (ahora >= new Date(fila.expira_en)) {
      revocarPorId.run(marca, 'DURACION_MAXIMA', fila.id);
      return { error: 'SESION_EXPIRADA' };
    }
    if (ahora - new Date(fila.ultima_actividad) > inactividadMinutos * 60_000) {
      revocarPorId.run(marca, 'INACTIVIDAD', fila.id);
      return { error: 'SESION_INACTIVA' };
    }
    if (!fila.activo) {
      revocarPorId.run(marca, 'CUENTA_DESHABILITADA', fila.id);
      return { error: 'CUENTA_DESHABILITADA' };
    }

    registrarActividad.run(marca, fila.id);
    return {
      sesion: { id: fila.id, plataforma: fila.plataforma, expiraEn: fila.expira_en, inactividadMinutos },
      usuario: { id: fila.usuario_id, email: fila.email, nombre: fila.nombre, apellido: fila.apellido, rol: fila.rol },
    };
  }

  
  function renovar(sesionId, usuarioId, plataforma) {
    revocarPorId.run(reloj.ahora().toISOString(), 'RENOVADA', sesionId);
    return crear(usuarioId, plataforma);
  }

  function cerrar(sesionId, motivo = 'CIERRE_MANUAL') {
    revocarPorId.run(reloj.ahora().toISOString(), motivo, sesionId);
  }

  
  function cerrarTodasDeUsuario(usuarioId, motivo, excepto = 0) {
    revocarDeUsuario.run(reloj.ahora().toISOString(), motivo, usuarioId, excepto);
  }

  return { crear, validar, renovar, cerrar, cerrarTodasDeUsuario };
}
