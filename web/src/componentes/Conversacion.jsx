import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatearFechaHora } from '../formato.js';
import { useMensajesSinLeer } from '../mensajeria.jsx';
import { Aviso, Cargando } from './ui.jsx';

export default function Conversacion({ ruta, ladoPropio, vacio }) {
  const { total, novedades, refrescar } = useMensajesSinLeer();
  const [mensajes, setMensajes] = useState(null);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const final = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api('GET', ruta);
      setMensajes(r.mensajes);
      setError(null);
      await api('POST', `${ruta}/leer`);
      await refrescar();
    } catch (e) {
      setError(e.message);
    }
  }, [ruta, refrescar]);

  useEffect(() => {
    cargar();
  }, [cargar, novedades, total > 0]);

  useEffect(() => {
    final.current?.scrollIntoView?.({ block: 'nearest' });
  }, [mensajes]);

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await api('POST', ruta, { texto });
      setMensajes(r.mensajes);
      setTexto('');
    } catch (e) {
      setError(e.detalles?.texto ?? e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (mensajes === null && !error) return <Cargando />;

  return (
    <section className="tarjeta conversacion">
      <p className="conversacion__seguridad">🔒 Conversación cifrada. Solo acceden esta escudería y la administración de la FIA.</p>
      <div className="conversacion__mensajes" aria-live="polite">
        {mensajes?.length === 0 && <p className="estado-vacio">{vacio}</p>}
        {mensajes?.map((m) => (
          <article key={m.id} className={`mensaje${m.lado === ladoPropio ? ' mensaje--propio' : ''}`}>
            <header className="mensaje__autor">
              <strong>{m.lado === 'FIA' ? 'FIA' : 'Escudería'}</strong> · {m.emisor}
            </header>
            {m.integro ? (
              <p className="mensaje__texto">{m.contenido}</p>
            ) : (
              <p className="mensaje__danado">⚠ Este mensaje fue alterado o está dañado, por lo que no se muestra.</p>
            )}
            <small className="texto-suave">
              {formatearFechaHora(m.enviadoEn)}
              {m.lado === ladoPropio && m.leidoEn && ' · Leído'}
            </small>
          </article>
        ))}
        <div ref={final} />
      </div>
      {error && <Aviso tono="error">{error}</Aviso>}
      <form className="conversacion__envio" onSubmit={enviar}>
        <textarea
          aria-label="Mensaje"
          rows={2}
          maxLength={2000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí tu mensaje…"
        />
        <button className="boton boton--primario" disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </section>
  );
}
