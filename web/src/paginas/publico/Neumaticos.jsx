import { ESTADO_DE_PRUEBA, formatearFecha, formatearFechaHora } from '../../formato.js';
import { Aviso, Cargando, Encabezado, IndicadorEnVivo, InsigniaDeEstado } from '../../componentes/ui.jsx';
import { useListadoEnVivo } from '../../componentes/filtros.jsx';

export function ListaDePruebas({ pruebas, acciones }) {
  if (pruebas.length === 0) return <p className="tarjeta estado-vacio">Todavía no hay fechas de prueba cargadas.</p>;
  return (
    <ul className="lista-pruebas">
      {pruebas.map((p) => (
        <li key={p.id} className={`tarjeta prueba prueba--${p.estado.toLowerCase()}`}>
          <div className="prueba__encabezado">
            <div>
              <span className="texto-suave">
                Prueba {p.numero} de 2 · {p.anio}
              </span>
              <h2>
                {formatearFecha(p.fecha)}
                {p.hora ? ` · ${p.hora} h` : ''}
              </h2>
              <p className="texto-suave">
                {p.circuito} · {p.pais}
              </p>
            </div>
            <InsigniaDeEstado estados={ESTADO_DE_PRUEBA} estado={p.estado} />
          </div>
          {p.cronograma && <p className="prueba__cronograma">{p.cronograma}</p>}
          {p.firmadaPor && (
            <small className="texto-suave">
              Firmada por {p.firmadaPor} el {formatearFechaHora(p.firmadaEn)}
            </small>
          )}
          {acciones && <div className="acciones-en-linea">{acciones(p)}</div>}
        </li>
      ))}
    </ul>
  );
}

export default function NeumaticosPublico() {
  const { datos: pruebas, error, actualizado, enVivo } = useListadoEnVivo('/publico/neumaticos', 'pruebas', 'neumaticos');

  return (
    <>
      <Encabezado
        titulo="Pruebas de neumáticos"
        subtitulo="Las dos fechas anuales de prueba. Las no oficiales todavía no fueron firmadas por la FIA y pueden cambiar."
      >
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
      </Encabezado>
      {error && <Aviso tono="error">{error}</Aviso>}
      {pruebas === null ? <Cargando /> : <ListaDePruebas pruebas={pruebas} />}
    </>
  );
}
