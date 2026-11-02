import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { formatearFechaHora } from '../../formato.js';
import { useMensajesSinLeer } from '../../mensajeria.jsx';
import { Aviso, Cargando, Encabezado, Insignia } from '../../componentes/ui.jsx';
import Conversacion from '../../componentes/Conversacion.jsx';

export default function MensajesFia() {
  const { total, novedades } = useMensajesSinLeer();
  const [conversaciones, setConversaciones] = useState(null);
  const [elegida, setElegida] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api('GET', '/fia/mensajes');
      setConversaciones(r.conversaciones);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, total, novedades]);

  const activa = conversaciones?.find((c) => c.escuderia.id === elegida);

  return (
    <>
      <Encabezado titulo="Mensajes" subtitulo="Conversaciones cifradas con cada escudería." />
      {error && <Aviso tono="error">{error}</Aviso>}
      {conversaciones === null ? (
        <Cargando />
      ) : (
        <div className="mensajeria">
          <nav className="tarjeta mensajeria__lista" aria-label="Escuderías">
            {conversaciones.map((c) => (
              <button
                key={c.escuderia.id}
                type="button"
                className={`mensajeria__item${c.escuderia.id === elegida ? ' activa' : ''}`}
                onClick={() => setElegida(c.escuderia.id)}
              >
                <span>
                  <strong>{c.escuderia.nombreOficial}</strong>
                  <small className="texto-suave">
                    {c.categoria.nombre}
                    {c.ultimoMensajeEn ? ` · ${formatearFechaHora(c.ultimoMensajeEn)}` : ' · Sin mensajes'}
                  </small>
                </span>
                {c.noLeidos > 0 && <Insignia tono="error">{c.noLeidos}</Insignia>}
              </button>
            ))}
          </nav>
          {activa ? (
            <Conversacion
              key={activa.escuderia.id}
              ruta={`/fia/mensajes/${activa.escuderia.id}`}
              ladoPropio="FIA"
              vacio={`Todavía no hay mensajes con ${activa.escuderia.nombreOficial}.`}
            />
          ) : (
            <p className="tarjeta estado-vacio">Elegí una escudería para ver la conversación.</p>
          )}
        </div>
      )}
    </>
  );
}
