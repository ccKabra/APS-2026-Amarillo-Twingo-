import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const esWeb = Platform.OS === 'web';

export async function leer(clave) {
  try {
    return esWeb ? window.localStorage.getItem(clave) : await SecureStore.getItemAsync(clave);
  } catch {
    return null;
  }
}

export async function guardar(clave, valor) {
  try {
    if (esWeb) window.localStorage.setItem(clave, valor);
    else await SecureStore.setItemAsync(clave, valor);
  } catch {
  }
}

export async function borrar(clave) {
  try {
    if (esWeb) window.localStorage.removeItem(clave);
    else await SecureStore.deleteItemAsync(clave);
  } catch {
  }
}
