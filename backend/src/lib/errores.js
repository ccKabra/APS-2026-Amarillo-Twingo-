export class ErrorDeNegocio extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export const errores = {
  validacion: (detalles, mensaje = 'Hay datos incompletos o inválidos.') =>
    new ErrorDeNegocio(400, 'DATOS_INVALIDOS', mensaje, detalles),
  noAutenticado: (codigo = 'NO_AUTENTICADO', mensaje = 'Tenés que iniciar sesión.') => new ErrorDeNegocio(401, codigo, mensaje),
  prohibido: (mensaje = 'No tenés permisos para usar esta funcionalidad.') => new ErrorDeNegocio(403, 'ACCESO_DENEGADO', mensaje),
  noEncontrado: (mensaje = 'No se encontró el recurso solicitado.') => new ErrorDeNegocio(404, 'NO_ENCONTRADO', mensaje),
  conflicto: (codigo, mensaje, detalles) => new ErrorDeNegocio(409, codigo, mensaje, detalles),
};

export function manejadorDeErrores(error, req, res, next) {
  if (error instanceof ErrorDeNegocio) {
    return res.status(error.estado).json({
      error: error.codigo,
      mensaje: error.message,
      ...(error.detalles ? { detalles: error.detalles } : {}),
    });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON_INVALIDO', mensaje: 'El cuerpo de la solicitud no es un JSON válido.' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'SOLICITUD_DEMASIADO_GRANDE', mensaje: 'La solicitud es demasiado grande.' });
  }
  console.error(error);
  return res.status(500).json({ error: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' });
}
