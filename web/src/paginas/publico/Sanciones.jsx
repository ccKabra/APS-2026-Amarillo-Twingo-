import { CLASE_DE_INFRACCION, ESTADO_DE_NOTIFICACION, formatearFecha, formatearFechaHora } from '../../formato.js';
import { Aviso, Cargando, Encabezado, IndicadorEnVivo, Insignia, InsigniaDeEstado } from '../../componentes/ui.jsx';
import {
  FiltroDeLista,
  PestaniasDeCategoria,
  conFiltros,
  opcionesDeEscuderias,
  opcionesDePilotos,
  useCategorias,
  useEscuderias,
  useFiltros,
  useListadoEnVivo,
  usePilotos,
} from '../../componentes/filtros.jsx';

export function TarjetaDeSancion({ sancion: s, children }) {
  const n = s.notificacion;
  return (
    <article className={`tarjeta sancion${s.estado === 'BORRADOR' ? ' sancion--borrador' : ''}`}>
      <header className="sancion__encabezado">
        <div>
          <h2 className="sancion__titulo">{s.tipoInfraccion.nombre}</h2>
          <span className="texto-suave">
            {formatearFecha(s.fechaInfraccion)} · {s.escuderia.nombreOficial} · {s.categoria.nombre}
          </span>
        </div>
        <div className="resumen">
          <Insignia tono={s.tipoInfraccion.clase === 'TECNICA' ? 'info' : 'neutro'}>
            Infracción {CLASE_DE_INFRACCION[s.tipoInfraccion.clase]?.toLowerCase()}
          </Insignia>
          {s.estado === 'BORRADOR' ? (
            <Insignia tono="neutro">Borrador sin publicar</Insignia>
          ) : (
            <InsigniaDeEstado estados={ESTADO_DE_NOTIFICACION} estado={n.estado} />
          )}
        </div>
      </header>
      <dl className="datos">
        <dt>Sancionado</dt>
        <dd>{s.piloto ? `${s.piloto.nombre} ${s.piloto.apellido} (N° ${s.piloto.numero})` : 'Toda la escudería'}</dd>
        <dt>Penalización</dt>
        <dd>
          <strong>{s.penalizacion}</strong>
        </dd>
        <dt>Descripción</dt>
        <dd className="sancion__descripcion">{s.descripcion}</dd>
        {s.publicadaEn && (
          <>
            <dt>Publicada</dt>
            <dd>{formatearFechaHora(s.publicadaEn)}</dd>
          </>
        )}
        {n && (
          <>
            <dt>Notificación</dt>
            <dd>
              {n.firmadaEn
                ? `La escudería firmó${n.firmadaPor ? ` (${n.firmadaPor})` : ''} el ${formatearFechaHora(n.firmadaEn)}`
                : 'La escudería todavía no firmó la notificación.'}
            </dd>
          </>
        )}
      </dl>
      {children && <div className="acciones-en-linea sancion__acciones">{children}</div>}
    </article>
  );
}

export function ListaDeSanciones({ sanciones, vacio = 'No hay sanciones para este filtro.', acciones }) {
  if (sanciones.length === 0) return <p className="tarjeta estado-vacio">{vacio}</p>;
  return sanciones.map((s) => (
    <TarjetaDeSancion key={s.id} sancion={s}>
      {acciones?.(s)}
    </TarjetaDeSancion>
  ));
}

export function FiltrosDeSanciones({ filtros, alCambiar, children }) {
  const categorias = useCategorias();
  const escuderias = useEscuderias(filtros.categoria);
  const pilotos = usePilotos({ categoria: filtros.categoria, escuderia: filtros.escuderia });
  return (
    <div className="filtros">
      <PestaniasDeCategoria
        categorias={categorias}
        valor={filtros.categoria}
        alCambiar={(categoria) => alCambiar({ categoria, escuderia: '', piloto: '' })}
      />
      <FiltroDeLista
        etiqueta="Escudería"
        valor={filtros.escuderia}
        alCambiar={(escuderia) => alCambiar({ escuderia, piloto: '' })}
        opciones={opcionesDeEscuderias(escuderias)}
      />
      <FiltroDeLista
        etiqueta="Piloto"
        valor={filtros.piloto}
        alCambiar={(piloto) => alCambiar({ piloto })}
        opciones={opcionesDePilotos(pilotos, { conEscuderia: !filtros.escuderia })}
        todas="Todos"
      />
      {children}
    </div>
  );
}

export default function SancionesPublicas() {
  const [filtros, cambiarFiltros] = useFiltros({ categoria: '', escuderia: '', piloto: '' });
  const { datos: sanciones, error, actualizado, enVivo } = useListadoEnVivo(
    conFiltros('/publico/sanciones', filtros),
    'sanciones',
    'sanciones',
  );

  return (
    <>
      <Encabezado
        titulo="Sanciones"
        subtitulo="Sanciones publicadas por la FIA a pilotos y escuderías, y si la escudería ya firmó la notificación."
      >
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
      </Encabezado>
      {error && <Aviso tono="error">{error}</Aviso>}
      <FiltrosDeSanciones filtros={filtros} alCambiar={cambiarFiltros} />
      {sanciones === null ? <Cargando /> : <ListaDeSanciones sanciones={sanciones} />}
    </>
  );
}
