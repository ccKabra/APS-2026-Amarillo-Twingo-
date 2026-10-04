export const NOMBRE_DE_ROL = {
  FIA: 'Administración FIA',
  ESCUDERIA: 'Escudería',
  PUBLICO: 'Público general',
};

export const NOMBRE_DE_ROL_PILOTO = { TITULAR: 'Titular', SUPLENTE: 'Suplente' };

export const ESTADO_DE_CUENTA = {
  ACTIVA: { texto: 'Activa', tono: 'ok' },
  PENDIENTE_ACTIVACION: { texto: 'Pendiente de activación', tono: 'aviso' },
  BLOQUEADA: { texto: 'Bloqueada', tono: 'error' },
  DESHABILITADA: { texto: 'Dada de baja', tono: 'neutro' },
};

export const ACCIONES_DE_AUDITORIA = {
  DATOS_DE_DEMOSTRACION: 'Carga de datos de demostración',
  USUARIO_REGISTRO: 'Registro del público',
  LOGIN_OK: 'Inicio de sesión',
  LOGIN_FALLIDO: 'Intento de ingreso fallido',
  CUENTA_BLOQUEADA: 'Cuenta bloqueada',
  LOGOUT: 'Cierre de sesión',
  PASSWORD_CAMBIADA: 'Cambio de contraseña',
  CUENTA_ACTIVADA: 'Activación de cuenta',
  ACTIVACION_REENVIADA: 'Reenvío de activación',
  USUARIO_ALTA: 'Alta de usuario',
  USUARIO_BAJA: 'Baja de usuario',
  USUARIO_REACTIVACION: 'Reactivación de usuario',
  USUARIO_DESBLOQUEO: 'Desbloqueo de usuario',
  ESCUDERIA_ALTA: 'Alta de escudería',
  ESCUDERIA_MODIFICACION: 'Modificación de escudería',
  ESCUDERIA_BAJA: 'Baja de escudería',
  ESCUDERIA_REACTIVACION: 'Reactivación de escudería',
  PILOTO_ALTA: 'Alta de piloto',
  PILOTO_MODIFICACION: 'Modificación de piloto',
  PILOTO_CAMBIO_ROL: 'Cambio de rol de piloto',
  PILOTO_BAJA: 'Baja de piloto',
  ACCESO_DENEGADO: 'Acceso denegado',
};

const fechaHora = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const soloFecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const soloHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

export function formatearFechaHora(iso) {
  return iso ? fechaHora.format(new Date(iso)) : '—';
}

export function formatearHora(iso) {
  return iso ? soloHora.format(new Date(iso)) : '—';
}

export function formatearFecha(fechaIso) {
  return fechaIso ? soloFecha.format(new Date(`${fechaIso}T00:00:00Z`)) : '—';
}

export function edad(fechaIso) {
  if (!fechaIso) return null;
  const hoy = new Date();
  const nacimiento = new Date(`${fechaIso}T00:00:00`);
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) anios -= 1;
  return anios;
}

export function nombreCompleto(persona) {
  return `${persona.nombre} ${persona.apellido}`;
}

export function reglasDePassword(password, minLongitud) {
  const pw = password ?? '';
  return [
    { codigo: 'longitud', descripcion: `Al menos ${minLongitud} caracteres`, cumple: pw.length >= minLongitud },
    { codigo: 'mayuscula', descripcion: 'Una letra mayúscula', cumple: /\p{Lu}/u.test(pw) },
    { codigo: 'minuscula', descripcion: 'Una letra minúscula', cumple: /\p{Ll}/u.test(pw) },
    { codigo: 'numero', descripcion: 'Un número', cumple: /\p{Nd}/u.test(pw) },
    { codigo: 'simbolo', descripcion: 'Un símbolo (# $ % & !)', cumple: /[^\p{L}\p{Nd}\s]/u.test(pw) },
  ];
}
