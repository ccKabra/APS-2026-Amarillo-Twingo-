import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useSesion } from '../../sesion.jsx';
import { Aviso, BotonConfirmar, Cargando, Encabezado, IndicadorEnVivo, Insignia } from '../../componentes/ui.jsx';
import { FiltroDeLista, conFiltros, opcionesDePilotos, useListadoEnVivo } from '../../componentes/filtros.jsx';
import { ListaDeSanciones } from '../publico/Sanciones.jsx';
import { guardarSeleccion, leerSeleccion } from './Nomina.jsx';

export default function SancionesDeEscuderia() {
  const { usuario } = useSesion();
  const activas = usuario.escuderias.filter((e) => e.activa);
  const [seleccionada, setSeleccionada] = useState(() => {
    const guardada = leerSeleccion();
    return activas.find((e) => e.id === guardada)?.id ?? activas[0]?.id ?? null;
  });
  const escuderia = activas.find((e) => e.id === seleccionada) ?? activas[0];
  const [piloto, setPiloto] = useState('');
  const [pilotos, setPilotos] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const {
    datos: sanciones,
    error,
    actualizado,
    enVivo,
    recargar,
  } = useListadoEnVivo(
    escuderia ? conFiltros(`/escuderia/${escuderia.id}/sanciones`, { piloto }) : null,
    'sanciones',
    'sanciones',
  );

  useEffect(() => {
    if (!escuderia) return;
    api('GET', `/escuderia/${escuderia.id}/pilotos`)
      .then((r) => setPilotos(r.pilotos))
      .catch(() => setPilotos([]));
  }, [escuderia?.id]);

  async function firmar(sancion) {
    setMensaje(null);
    try {
      await api('POST', `/escuderia/${escuderia.id}/sanciones/${sancion.id}/firmar`);
      setMensaje({
        tono: 'ok',
        texto: `Firmaste la notificación: ${escuderia.nombreOficial} quedó como enterada de la sanción por «${sancion.tipoInfraccion.nombre}».`,
      });
      await recargar();
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }

  if (!escuderia) {
    return (
      <section className="tarjeta tarjeta--centrada estado-vacio">
        <h1>Sin escuderías activas</h1>
        <p>Tu cuenta no tiene escuderías activas asociadas. Comunicate con la FIA.</p>
      </section>
    );
  }

  const sinFirmar = sanciones?.filter((s) => s.notificacion?.estado === 'NO_ENTERADO').length ?? 0;

  return (
    <>
      <Encabezado
        titulo="Sanciones de mi escudería"
        subtitulo="Las sanciones publicadas por la FIA figuran como «no enterado» hasta que la escudería firma la notificación."
      >
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
        <Link to="/sanciones" className="boton boton--claro">
          Ver todas las sanciones
        </Link>
      </Encabezado>

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
                setPiloto('');
              }}
            >
              {activas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombreOficial} — {e.categoriaNombre}
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
          {sanciones && (
            <Insignia tono={sinFirmar ? 'aviso' : 'ok'}>
              {sinFirmar ? `${sinFirmar} sin firmar` : 'Todas las notificaciones firmadas'}
            </Insignia>
          )}
        </div>
      </div>

      {error && <Aviso tono="error">{error}</Aviso>}
      {mensaje && (
        <Aviso tono={mensaje.tono} alCerrar={() => setMensaje(null)}>
          {mensaje.texto}
        </Aviso>
      )}

      <div className="filtros">
        <FiltroDeLista
          etiqueta="Piloto"
          valor={piloto}
          alCambiar={setPiloto}
          opciones={opcionesDePilotos(pilotos, { conEscuderia: false })}
          todas="Todos"
        />
      </div>

      {sanciones === null ? (
        <Cargando />
      ) : (
        <ListaDeSanciones
          sanciones={sanciones}
          vacio="La FIA no publicó sanciones para esta escudería con este filtro."
          acciones={(s) =>
            s.notificacion?.estado === 'NO_ENTERADO' && (
              <BotonConfirmar
                tono="primario"
                chico={false}
                pregunta="¿Confirmás que la escudería se da por notificada?"
                alConfirmar={() => firmar(s)}
              >
                Firmar notificación
              </BotonConfirmar>
            )
          }
        />
      )}
    </>
  );
}
