import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, configurarPerdidaDeSesion, definirServidor, definirToken, servidorActual, urlSugerida } from './api';
import { borrar, guardar, leer } from './almacenamiento';

const CLAVE_TOKEN = 'fia.token';
const CLAVE_SERVIDOR = 'fia.servidor';
const Contexto = createContext(null);

export function ProveedorDeSesion({ children }) {
  const [listo, setListo] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [inactividadMinutos, setInactividadMinutos] = useState(30);
  const [servidor, setServidor] = useState('');
  const ultimaActividad = useRef(Date.now());

  const olvidarSesion = useCallback(async (mensaje) => {
    definirToken(null);
    await borrar(CLAVE_TOKEN);
    setUsuario(null);
    setAviso(mensaje ?? null);
  }, []);

  const aplicarSesion = useCallback(async (respuesta) => {
    definirToken(respuesta.token);
    await guardar(CLAVE_TOKEN, respuesta.token);
    setUsuario(respuesta.usuario);
    setInactividadMinutos(respuesta.sesion?.inactividadMinutos ?? 30);
    ultimaActividad.current = Date.now();
    setAviso(null);
  }, []);

  // Al abrir la app: servidor guardado y, si había sesión, se renueva (token nuevo).
  useEffect(() => {
    (async () => {
      const url = (await leer(CLAVE_SERVIDOR)) || urlSugerida();
      definirServidor(url);
      setServidor(url);
      configurarPerdidaDeSesion((mensaje) => olvidarSesion(mensaje ?? 'Tu sesión terminó. Iniciá sesión nuevamente.'));
      const token = await leer(CLAVE_TOKEN);
      if (token) {
        definirToken(token);
        try {
          await aplicarSesion(await api('POST', '/auth/renovar'));
        } catch {
          definirToken(null);
          await borrar(CLAVE_TOKEN);
        }
      }
      setListo(true);
    })();
  }, [aplicarSesion, olvidarSesion]);

  
  useEffect(() => {
    if (!usuario) return undefined;
    const revisar = () => {
      if (Date.now() - ultimaActividad.current > inactividadMinutos * 60_000) {
        api('POST', '/auth/logout').catch(() => {});
        olvidarSesion('La sesión se cerró por inactividad. Iniciá sesión nuevamente.');
      }
    };
    const intervalo = setInterval(revisar, 15_000);
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') revisar();
    });
    return () => {
      clearInterval(intervalo);
      suscripcion.remove();
    };
  }, [usuario, inactividadMinutos, olvidarSesion]);

  const valor = useMemo(
    () => ({
      listo,
      usuario,
      aviso,
      servidor,
      inactividadMinutos,
      marcarActividad() {
        ultimaActividad.current = Date.now();
      },
      limpiarAviso: () => setAviso(null),
      async iniciarSesion(email, password) {
        await aplicarSesion(await api('POST', '/auth/login', { email, password, plataforma: 'movil' }));
      },
      async registrarse(datos) {
        await aplicarSesion(await api('POST', '/auth/registro', { ...datos, plataforma: 'movil' }));
      },
      
      async cerrarSesion() {
        await api('POST', '/auth/logout').catch(() => {});
        await olvidarSesion('Cerraste la sesión.');
      },
      async cambiarServidor(url) {
        definirServidor(url);
        await guardar(CLAVE_SERVIDOR, servidorActual());
        setServidor(servidorActual());
      },
    }),
    [listo, usuario, aviso, servidor, inactividadMinutos, aplicarSesion, olvidarSesion],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  return useContext(Contexto);
}
