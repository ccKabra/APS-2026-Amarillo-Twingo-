import { createHash, randomBytes } from 'node:crypto';

export function generarToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}
