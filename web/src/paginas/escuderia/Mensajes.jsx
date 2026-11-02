import { useState } from 'react';
import { useSesion } from '../../sesion.jsx';
import { useMensajesSinLeer } from '../../mensajeria.jsx';
import { Encabezado, Insignia } from '../../componentes/ui.jsx';
import Conversacion from '../../componentes/Conversacion.jsx';
import { guardarSeleccion, leerSeleccion } from './Nomina.jsx';

export default function MensajesDeEscuderia() {
  const { usuario } = useSesion();
  const { porEscuderia } = useMensajesSinLeer();
  const activas = usuario.escuderias.filter((e) => e.activa);
  const [seleccionada, setSeleccionada] = useState(() => {
    const guardada = leerSeleccion();
    return activas.find((e) => e.id === guardada)?.id ?? activas[0]?.id ?? null;
  });
  const escuderia = activas.find((e) => e.id === seleccionada) ?? activas[0];

  if (!escuderia) {
    return (
      <section className="tarjeta tarjeta--centrada estado-vacio">
        <h1>Sin escuderías activas</h1>
        <p>Tu cuenta no tiene escuderías activas asociadas. Comunicate con la FIA.</p>
      </section>
    );
  }

  return (
    <>
      <Encabezado titulo="Mensajes con la FIA" subtitulo="Canal directo y confidencial con la administración de la FIA." />
      <div className="selector-escuderia tarjeta">
        {activas.length > 1 ? (
          <label className="filtro">
            Escudería seleccionada
            <select
              value={escuderia.id}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSeleccionada(id);
                guardarSeleccion(id);
              }}
            >
              {activas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombreOficial} — {e.categoriaNombre}
                  {porEscuderia[e.id] ? ` (${porEscuderia[e.id]} sin leer)` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div>
            <span className="texto-suave">Escudería</span>
            <strong className="selector-escuderia__nombre">{escuderia.nombreOficial}</strong>
          </div>
        )}
        <div className="resumen">
          <Insignia tono="info">{escuderia.categoriaNombre}</Insignia>
        </div>
      </div>
      <Conversacion
        key={escuderia.id}
        ruta={`/escuderia/${escuderia.id}/mensajes`}
        ladoPropio="ESCUDERIA"
        vacio="Todavía no hay mensajes. Escribí el primero a la FIA."
      />
    </>
  );
}
