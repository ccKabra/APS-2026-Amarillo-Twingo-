import { errores } from './errores.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function texto(valor) {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
}

export function normalizarEmail(valor) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

export function normalizarNombre(valor) {
  return texto(valor).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function esFechaIso(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

export function edadEn(fechaIso, hoy) {
  const nacimiento = new Date(`${fechaIso}T00:00:00Z`);
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const cumplioEsteAnio =
    hoy.getUTCMonth() > nacimiento.getUTCMonth() ||
    (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() >= nacimiento.getUTCDate());
  if (!cumplioEsteAnio) edad -= 1;
  return edad;
}

export class Validador {
  constructor() {
    this.errores = {};
  }

  requerido(campo, valor, etiqueta, { min = 1, max = 100 } = {}) {
    const v = texto(valor);
    if (!v) this.errores[campo] = `«${etiqueta}» es un dato obligatorio.`;
    else if (v.length < min) this.errores[campo] = `«${etiqueta}» debe tener al menos ${min} caracteres.`;
    else if (v.length > max) this.errores[campo] = `«${etiqueta}» no puede superar los ${max} caracteres.`;
    return v;
  }

  opcional(campo, valor, etiqueta, { max = 100 } = {}) {
    const v = texto(valor);
    if (v.length > max) this.errores[campo] = `«${etiqueta}» no puede superar los ${max} caracteres.`;
    return v || null;
  }

  email(campo, valor, etiqueta = 'Correo electrónico') {
    const v = normalizarEmail(valor);
    if (!v) this.errores[campo] = `«${etiqueta}» es un dato obligatorio.`;
    else if (!EMAIL.test(v) || v.length > 254) this.errores[campo] = `«${etiqueta}» no tiene un formato válido.`;
    return v;
  }

  enumerado(campo, valor, opciones, etiqueta, nombres = opciones) {
    const v = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
    if (!v) this.errores[campo] = `«${etiqueta}» es un dato obligatorio.`;
    else if (!opciones.includes(v)) this.errores[campo] = `«${etiqueta}» debe ser uno de estos valores: ${nombres.join(', ')}.`;
    return v;
  }

  entero(campo, valor, etiqueta, { min, max }) {
    if (valor === undefined || valor === null || valor === '') {
      this.errores[campo] = `«${etiqueta}» es un dato obligatorio.`;
      return null;
    }
    const n = Number(valor);
    if (!Number.isInteger(n) || n < min || n > max) {
      this.errores[campo] = `«${etiqueta}» debe ser un número entero entre ${min} y ${max}.`;
      return null;
    }
    return n;
  }

  fechaDeNacimiento(campo, valor, etiqueta, hoy, { edadMinima = 14, edadMaxima = 70 } = {}) {
    const v = typeof valor === 'string' ? valor.trim() : '';
    if (!v) {
      this.errores[campo] = `«${etiqueta}» es un dato obligatorio.`;
    } else if (!esFechaIso(v)) {
      this.errores[campo] = `«${etiqueta}» debe ser una fecha válida (AAAA-MM-DD).`;
    } else {
      const edad = edadEn(v, hoy);
      if (edad < edadMinima || edad > edadMaxima) {
        this.errores[campo] = `La edad del piloto debe estar entre ${edadMinima} y ${edadMaxima} años.`;
      }
    }
    return v;
  }

  agregar(campo, mensaje) {
    this.errores[campo] = mensaje;
  }

  get hayErrores() {
    return Object.keys(this.errores).length > 0;
  }

  lanzarSiHayErrores() {
    if (this.hayErrores) throw errores.validacion(this.errores);
  }
}
