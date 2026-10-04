const CLAVE_TOKEN = 'fia.token';

export const tokenGuardado = {
  leer() {
    try {
      return sessionStorage.getItem(CLAVE_TOKEN);
    } catch {
      return null;
    }
  },
  guardar(token) {
    try {
      sessionStorage.setItem(CLAVE_TOKEN, token);
    } catch {
    }
  },
  borrar() {
    try {
      sessionStorage.removeItem(CLAVE_TOKEN);
    } catch {
    }
  },
};

export class ErrorApi extends Error {
  constructor(status, cuerpo) {
    super(cuerpo?.mensaje || 'Ocurrió un error al comunicarse con el servidor.');
    this.status = status;
    this.codigo = cuerpo?.error ?? null;
    this.detalles = cuerpo?.detalles ?? {};
  }
}

let alPerderLaSesion = () => {};
export function configurarPerdidaDeSesion(funcion) {
  alPerderLaSesion = funcion;
}

export async function api(metodo, ruta, cuerpo) {
  const token = tokenGuardado.leer();
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, { mensaje: 'No se pudo conectar con el servidor. ¿Está corriendo el backend?' });
  }
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token && token === tokenGuardado.leer() && !ruta.startsWith('/auth/login')) {
      alPerderLaSesion(datos?.mensaje);
    }
    throw new ErrorApi(respuesta.status, datos);
  }
  return datos;
}
