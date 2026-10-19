import { ESTADOS_TECNICOS, TIPOS_DE_INSPECCION, formatearFecha } from '../../formato.js';
import { Aviso, Cargando, Encabezado, IndicadorEnVivo, InsigniaDeEstado } from '../../componentes/ui.jsx';
import {
  FiltroDeLista,
  PestaniasDeCategoria,
  conFiltros,
  opcionesDeEscuderias,
  useCategorias,
  useEscuderias,
  useFiltros,
  useListadoEnVivo,
} from '../../componentes/filtros.jsx';

export function TablaDeInspecciones({ inspecciones, acciones }) {
  if (inspecciones.length === 0) {
    return <p className="tarjeta estado-vacio">No hay inspecciones registradas para este filtro.</p>;
  }
  return (
    <div className="tabla-contenedor tarjeta">
      <table className="tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Vehículo</th>
            <th>Escudería</th>
            <th>Inspección</th>
            <th>Estado técnico</th>
            <th>Observaciones</th>
            {acciones && <th aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {inspecciones.map((i) => (
            <tr key={i.id}>
              <td className="sin-corte">{formatearFecha(i.fecha)}</td>
              <td>
                <div className="vehiculo">
                  <span className="dorsal">{i.piloto.numero}</span>
                  <span>
                    {i.piloto.nombre} {i.piloto.apellido}
                  </span>
                </div>
              </td>
              <td>
                <span className="sin-corte">{i.escuderia.nombreOficial}</span>
                <div className="texto-suave">{i.categoria.nombre}</div>
              </td>
              <td>{TIPOS_DE_INSPECCION[i.tipo] ?? i.tipo}</td>
              <td>
                <InsigniaDeEstado estados={ESTADOS_TECNICOS} estado={i.estadoTecnico} />
              </td>
              <td className="observaciones">{i.observaciones ?? '—'}</td>
              {acciones && (
                <td className="celda-acciones">
                  <div className="acciones-en-linea">{acciones(i)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FiltrosDeInspecciones({ filtros, alCambiar }) {
  const categorias = useCategorias();
  const escuderias = useEscuderias(filtros.categoria);
  return (
    <div className="filtros">
      <PestaniasDeCategoria
        categorias={categorias}
        valor={filtros.categoria}
        alCambiar={(categoria) => alCambiar({ categoria, escuderia: '' })}
      />
      <FiltroDeLista
        etiqueta="Escudería"
        valor={filtros.escuderia}
        alCambiar={(escuderia) => alCambiar({ escuderia })}
        opciones={opcionesDeEscuderias(escuderias)}
      />
      <FiltroDeLista
        etiqueta="Estado técnico"
        valor={filtros.estadoTecnico}
        alCambiar={(estadoTecnico) => alCambiar({ estadoTecnico })}
        opciones={Object.entries(ESTADOS_TECNICOS).map(([valor, e]) => ({ valor, texto: e.texto }))}
        todas="Todos"
      />
    </div>
  );
}

export const FILTROS_DE_INSPECCIONES = { categoria: '', escuderia: '', estadoTecnico: '' };

export default function InspeccionesPublicas() {
  const [filtros, cambiarFiltros] = useFiltros(FILTROS_DE_INSPECCIONES);
  const { datos: inspecciones, error, actualizado, enVivo } = useListadoEnVivo(
    conFiltros('/publico/inspecciones', filtros),
    'inspecciones',
    'inspecciones',
  );

  return (
    <>
      <Encabezado
        titulo="Controles técnicos"
        subtitulo="Resultados de las inspecciones que la FIA realiza a los vehículos de cada escudería."
      >
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
      </Encabezado>
      {error && <Aviso tono="error">{error}</Aviso>}
      <FiltrosDeInspecciones filtros={filtros} alCambiar={cambiarFiltros} />
      {inspecciones === null ? <Cargando /> : <TablaDeInspecciones inspecciones={inspecciones} />}
    </>
  );
}
