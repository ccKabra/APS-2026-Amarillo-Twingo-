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
  SANCION_ALTA: 'Alta de sanción',
  SANCION_MODIFICACION: 'Modificación de sanción',
  SANCION_ELIMINADA: 'Eliminación de sanción',
  SANCION_PUBLICACION: 'Publicación de sanción',
  SANCION_FIRMA: 'Firma de notificación de sanción',
  INSPECCION_ALTA: 'Alta de inspección técnica',
  INSPECCION_MODIFICACION: 'Modificación de inspección técnica',
  INSPECCION_ELIMINADA: 'Eliminación de inspección técnica',
  EVENTO_ALTA: 'Alta de fecha del calendario',
  EVENTO_MODIFICACION: 'Modificación de fecha del calendario',
  EVENTO_OFICIALIZADO: 'Firma de fecha oficial',
  EVENTO_ELIMINADO: 'Eliminación de fecha del calendario',
};

export const CLASE_DE_INFRACCION = { TECNICA: 'Técnica', CARRERA: 'De carrera' };

export const ESTADO_DE_NOTIFICACION = {
  NO_ENTERADO: { texto: 'No enterado', tono: 'aviso' },
  ENTERADO: { texto: 'Enterado', tono: 'ok' },
};

export const TIPOS_DE_INSPECCION = {
  PRE_CARRERA: 'Verificación previa a la carrera',
  POST_CARRERA: 'Verificación posterior a la carrera',
  PESO: 'Control de peso',
  DIMENSIONES: 'Dimensiones y aerodinámica',
  UNIDAD_DE_POTENCIA: 'Unidad de potencia',
  COMBUSTIBLE: 'Muestra de combustible',
  SEGURIDAD: 'Elementos de seguridad',
};

export const ESTADOS_TECNICOS = {
  APROBADO: { texto: 'Aprobado', tono: 'ok' },
  OBSERVADO: { texto: 'Aprobado con observaciones', tono: 'aviso' },
  RECHAZADO: { texto: 'No aprobado', tono: 'error' },
};

export const TIPOS_DE_EVENTO = {
  CARRERA: 'Carrera',
  CLASIFICACION: 'Clasificación',
  PRACTICA: 'Práctica',
  PRUEBA: 'Prueba',
  OTRO: 'Otro',
};

export const ESTADO_DE_FECHA = {
  ESPECULATIVA: { texto: 'Especulativa', tono: 'aviso' },
  OFICIAL: { texto: 'Oficial', tono: 'ok' },
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

const nombreDeMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const mesCorto = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' });
const diaDeSemana = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' });

export function hoyIso() {
  const hoy = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;
}

export function mesDe(fechaIso) {
  return fechaIso.slice(0, 7);
}

export function sumarMeses(mesIso, cantidad) {
  const [anio, mes] = mesIso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1 + cantidad, 1));
  return fecha.toISOString().slice(0, 7);
}

export function nombreDelMes(mesIso) {
  const texto = nombreDeMes.format(new Date(`${mesIso}-01T00:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function partesDeFecha(fechaIso) {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  return {
    dia: fechaIso.slice(8, 10),
    mes: mesCorto.format(fecha).replace('.', ''),
    semana: diaDeSemana.format(fecha).replace('.', ''),
  };
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
