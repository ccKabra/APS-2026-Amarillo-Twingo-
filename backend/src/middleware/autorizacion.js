import { errores } from '../lib/errores.js';
import { MENSAJES_SESION } from '../lib/sesiones.js';

export function tokenDeLaSolicitud(req) {
  const coincidencia = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
  return coincidencia?.[1] ?? null;
}

export function crearMiddlewares({ db, sesiones, auditoria }) {
  const escuderiaAsociada = db.prepare(`
    SELECT e.id, e.nombre_oficial, e.activa, e.categoria_id, c.codigo AS categoria, c.nombre AS categoria_nombre
    FROM usuario_escuderia ue
    JOIN escuderias e ON e.id = ue.escuderia_id
    JOIN categorias c ON c.id = e.categoria_id
    WHERE ue.usuario_id = ? AND e.id = ?`);

  function requiereSesion(req, res, next) {
    const token = tokenDeLaSolicitud(req);
    const resultado = sesiones.validar(token);
    if (resultado.error) {
      return next(errores.noAutenticado(resultado.error, MENSAJES_SESION[resultado.error]));
    }
    req.usuario = resultado.usuario;
    req.sesion = resultado.sesion;
    return next();
  }

  function requiereRol(...roles) {
    return (req, res, next) => {
      if (!roles.includes(req.usuario?.rol)) {
        auditoria.registrar({
          usuario: req.usuario,
          accion: 'ACCESO_DENEGADO',
          detalle: { metodo: req.method, ruta: req.originalUrl, rol: req.usuario?.rol, requerido: roles },
          ip: req.ip,
        });
        return next(errores.prohibido());
      }
      return next();
    };
  }

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

  return { requiereSesion, requiereRol, escuderiaSeleccionada };
}
