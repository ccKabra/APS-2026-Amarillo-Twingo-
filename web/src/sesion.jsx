import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, configurarPerdidaDeSesion, tokenGuardado } from './api.js';

const ContextoDeSesion = createContext(null);
const EVENTOS_DE_ACTIVIDAD = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
const AVISO_KEEPALIVE_MS = 4 * 60_000;



let renovacionInicial = null;
function renovarUnaSolaVez() {
  renovacionInicial ??= api('POST', '/auth/renovar');
  return renovacionInicial;
}

export function ProveedorDeSesion({ children }) {
  const navegar = useNavigate();
  
  
  const navegarRef = useRef(navegar);
  useEffect(() => {
    navegarRef.current = navegar;
  }, [navegar]);
  const [usuario, setUsuario] = useState(null);
  const [inactividadMinutos, setInactividadMinutos] = useState(30);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const ultimaActividad = useRef(Date.now());
  const ultimoContacto = useRef(Date.now());

  const olvidarSesion = useCallback((mensaje) => {
    tokenGuardado.borrar();
    setUsuario(null);
    setAviso(mensaje ?? null);
    navegarRef.current('/login');
  }, []);

  const aplicarSesion = useCallback((respuesta) => {
    tokenGuardado.guardar(respuesta.token);
    setUsuario(respuesta.usuario);
    setInactividadMinutos(respuesta.sesion?.inactividadMinutos ?? 30);
    ultimaActividad.current = Date.now();
    ultimoContacto.current = Date.now();
    setAviso(null);
  }, []);

  
  useEffect(() => {
    configurarPerdidaDeSesion((mensaje) => olvidarSesion(mensaje ?? 'Tu sesión terminó. Iniciá sesión nuevamente.'));
    if (!tokenGuardado.leer()) {
      setCargando(false);
      return;
    }
    renovarUnaSolaVez()
      .then(aplicarSesion)
      .catch(() => tokenGuardado.borrar())
      .finally(() => setCargando(false));
  }, [aplicarSesion, olvidarSesion]);

  
  useEffect(() => {
    if (!usuario) return undefined;
    const marcarActividad = () => {
      ultimaActividad.current = Date.now();
    };
    EVENTOS_DE_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, marcarActividad, { passive: true }));
    const intervalo = setInterval(() => {
      const ahora = Date.now();
      if (ahora - ultimaActividad.current > inactividadMinutos * 60_000) {
        api('POST', '/auth/logout').catch(() => {});
        olvidarSesion('La sesión se cerró por inactividad. Iniciá sesión nuevamente.');
      } else if (ahora - ultimaActividad.current < 60_000 && ahora - ultimoContacto.current > AVISO_KEEPALIVE_MS) {
        
        ultimoContacto.current = ahora;
        api('GET', '/auth/yo').catch(() => {});
      }
    }, 15_000);
    return () => {
      EVENTOS_DE_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, marcarActividad));
      clearInterval(intervalo);
    };
  }, [usuario, inactividadMinutos, olvidarSesion]);

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      aviso,
      inactividadMinutos,
      async iniciarSesion(email, password) {
        const respuesta = await api('POST', '/auth/login', { email, password, plataforma: 'web' });
        aplicarSesion(respuesta);
        return respuesta.usuario;
      },
      async registrarse(datos) {
        const respuesta = await api('POST', '/auth/registro', { ...datos, plataforma: 'web' });
        aplicarSesion(respuesta);
        return respuesta.usuario;
      },
      async cerrarSesion() {
        await api('POST', '/auth/logout').catch(() => {});
        tokenGuardado.borrar();
        setUsuario(null);
        setAviso('Cerraste la sesión.');
        navegarRef.current('/login');
      },
      async refrescarPerfil() {
        const respuesta = await api('GET', '/auth/yo');
        setUsuario(respuesta.usuario);
      },
      limpiarAviso: () => setAviso(null),
    }),
    [usuario, cargando, aviso, inactividadMinutos, aplicarSesion],
  );

  return <ContextoDeSesion.Provider value={valor}>{children}</ContextoDeSesion.Provider>;
}

export function useSesion() {
  return useContext(ContextoDeSesion);
}

export function inicioSegunRol(usuario) {
  if (usuario?.rol === 'FIA') return '/fia/escuderias';
  if (usuario?.rol === 'ESCUDERIA') return '/escuderia/nomina';
  return '/pilotos';
}
