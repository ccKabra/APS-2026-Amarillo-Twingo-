import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { useSesion } from './sesion.jsx';

const ContextoDeMensajes = createContext({ total: 0, porEscuderia: {}, novedades: 0, refrescar: () => {} });
const CADA_MS = 5_000;
const RUTA_DE_AVISOS = { FIA: '/fia/mensajes/no-leidos', ESCUDERIA: '/escuderia/mensajes/no-leidos' };

export function ProveedorDeMensajes({ children }) {
  const { usuario } = useSesion();
  const ruta = RUTA_DE_AVISOS[usuario?.rol];
  const [avisos, setAvisos] = useState({ total: 0, porEscuderia: {} });
  const [novedades, setNovedades] = useState(0);
  const anterior = useRef(null);

  const refrescar = useCallback(async () => {
    if (!ruta) return;
    try {
      const r = await api('GET', ruta);
      setAvisos({ total: r.total, porEscuderia: r.porEscuderia ?? {} });
      if (anterior.current !== null && r.total > anterior.current) setNovedades((n) => n + 1);
      anterior.current = r.total;
    } catch {
      // Un corte momentáneo no debe interrumpir lo que esté haciendo el usuario.
    }
  }, [ruta]);

  useEffect(() => {
    anterior.current = null;
    setAvisos({ total: 0, porEscuderia: {} });
    if (!ruta) return undefined;
    refrescar();
    const intervalo = setInterval(refrescar, CADA_MS);
    return () => clearInterval(intervalo);
  }, [ruta, refrescar]);

  const valor = useMemo(() => ({ ...avisos, novedades, refrescar }), [avisos, novedades, refrescar]);
  return <ContextoDeMensajes.Provider value={valor}>{children}</ContextoDeMensajes.Provider>;
}

export function useMensajesSinLeer() {
  return useContext(ContextoDeMensajes);
}
