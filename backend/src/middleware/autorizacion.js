import { errores } from '../lib/errores.js';
import { MENSAJES_SESION } from '../lib/sesiones.js';

export function tokenDeLaSolicitud(req) {
  const coincidencia = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
  return coincidencia?.[1] ?? null;
}

export function crearMiddlewares({ sesiones, auditoria }) {
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

  return { requiereSesion, requiereRol };
}
