export const colores = {
  tinta: '#0f1b2d',
  tinta2: '#182a44',
  rojo: '#d6202f',
  fondo: '#f3f5f8',
  superficie: '#ffffff',
  borde: '#dfe4ec',
  bordeFuerte: '#c7cfdb',
  texto: '#1b2433',
  suave: '#5d6879',
  claroSobreOscuro: '#aab6c8',
  ok: '#146c43',
  okFondo: '#e3f3ea',
  aviso: '#8a5a00',
  avisoFondo: '#fff3d6',
  error: '#b42318',
  errorFondo: '#fdecea',
  info: '#1d4e89',
  infoFondo: '#e7effa',
  neutro: '#4a5568',
  neutroFondo: '#edf0f4',
};

export const acentoPorRol = {
  ANONIMO: colores.rojo,
  FIA: colores.rojo,
  ESCUDERIA: '#0d7680',
  PUBLICO: '#2f55c9',
};

export const etiquetaDePanel = {
  FIA: 'Panel FIA',
  ESCUDERIA: 'Panel de escudería',
  PUBLICO: 'Portal del público',
};

export const nombreDeRol = {
  FIA: 'Administración FIA',
  ESCUDERIA: 'Escudería',
  PUBLICO: 'Público general',
};

export const nombreDeRolPiloto = { TITULAR: 'Titular', SUPLENTE: 'Suplente' };

export function formatearFecha(fechaIso) {
  if (!fechaIso) return '—';
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

export function formatearHora(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
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
