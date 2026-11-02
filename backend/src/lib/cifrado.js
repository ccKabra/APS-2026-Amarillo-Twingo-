import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ALGORITMO = 'aes-256-gcm';
const LONGITUD_CLAVE = 32;
const LONGITUD_IV = 12;

function decodificarClave(valor) {
  const clave = Buffer.from(valor, 'base64');
  if (clave.length !== LONGITUD_CLAVE) {
    throw new Error('MESSAGES_MASTER_KEY debe ser una clave de 32 bytes en Base64.');
  }
  return clave;
}

// La clave maestra nunca va a la base: viene del entorno o de un archivo aparte, que se crea la primera vez.
export function obtenerClaveMaestra({ mensajeria }) {
  if (mensajeria.claveMaestra) return decodificarClave(mensajeria.claveMaestra);
  const { archivoClave } = mensajeria;
  if (fs.existsSync(archivoClave)) return decodificarClave(fs.readFileSync(archivoClave, 'utf8').trim());
  const clave = crypto.randomBytes(LONGITUD_CLAVE);
  fs.mkdirSync(path.dirname(archivoClave), { recursive: true });
  fs.writeFileSync(archivoClave, clave.toString('base64'), { flag: 'wx', mode: 0o600 });
  return clave;
}

function sellar(clave, contenido, contexto) {
  const iv = crypto.randomBytes(LONGITUD_IV);
  const cifrador = crypto.createCipheriv(ALGORITMO, clave, iv);
  cifrador.setAAD(Buffer.from(contexto, 'utf8'));
  const cifrado = Buffer.concat([cifrador.update(contenido), cifrador.final()]);
  return [iv, cifrador.getAuthTag(), cifrado].map((parte) => parte.toString('base64')).join('.');
}

function abrir(clave, sobre, contexto) {
  const [iv, etiqueta, cifrado] = sobre.split('.').map((parte) => Buffer.from(parte, 'base64'));
  const descifrador = crypto.createDecipheriv(ALGORITMO, clave, iv);
  descifrador.setAAD(Buffer.from(contexto, 'utf8'));
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([descifrador.update(cifrado), descifrador.final()]);
}

// Cifrado de sobre: cada conversación tiene su clave, guardada cifrada con la clave maestra.
// El contexto se autentica con AES-GCM: un dato movido o alterado en la base deja de descifrar.
export function crearCifrador(claveMaestra) {
  return {
    nuevaClave: (contexto) => sellar(claveMaestra, crypto.randomBytes(LONGITUD_CLAVE), contexto),
    abrirClave: (envuelta, contexto) => abrir(claveMaestra, envuelta, contexto),
    cifrar: (clave, texto, contexto) => sellar(clave, Buffer.from(texto, 'utf8'), contexto),
    descifrar: (clave, sobre, contexto) => abrir(clave, sobre, contexto).toString('utf8'),
  };
}
