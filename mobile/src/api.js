

import { Platform } from 'react-native';
import Constants from 'expo-constants';

let urlBase = '';
let token = null;
let alPerderLaSesion = () => {};

// Si la app se abrió con Expo Go, Metro corre en la misma PC que el backend:
// se usa esa misma IP con el puerto 3000.
export function urlSugerida() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined')
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : 'http://192.168.0.10:3000';
}

export function definirServidor(url) {
  urlBase = url.trim().replace(/\/+$/, '');
}

export function servidorActual() {
  return urlBase;
}

export function definirToken(nuevo) {
  token = nuevo;
}

export function configurarPerdidaDeSesion(funcion) {
  alPerderLaSesion = funcion;
}

export class ErrorApi extends Error {
  constructor(status, cuerpo) {
    super(cuerpo?.mensaje || 'Ocurrió un error al comunicarse con el servidor.');
    this.status = status;
    this.codigo = cuerpo?.error ?? null;
    this.detalles = cuerpo?.detalles ?? {};
  }
}

export async function api(metodo, ruta, cuerpo, { servidor = urlBase, sinSesion = false } = {}) {
  const tokenUsado = sinSesion ? null : token;
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 10_000);
  let respuesta;
  try {
    respuesta = await fetch(`${servidor}/api${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
        ...(tokenUsado && { Authorization: `Bearer ${tokenUsado}` }),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: controlador.signal,
    });
  } catch {
    throw new ErrorApi(0, {
      mensaje: `No se pudo conectar con ${servidor}. Revisá que el backend esté corriendo y que el celular esté en la misma red Wi-Fi que la PC.`,
    });
  } finally {
    clearTimeout(limite);
  }
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401 && tokenUsado && tokenUsado === token && !ruta.startsWith('/auth/login')) {
      alPerderLaSesion(datos?.mensaje);
    }
    throw new ErrorApi(respuesta.status, datos);
  }
  return datos;
}
