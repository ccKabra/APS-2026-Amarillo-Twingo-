import { useState } from 'react';
import { TIPOS_DE_REGLAMENTO, formatearFechaHora, formatearTamanio } from '../../formato.js';
import { Aviso, Cargando, Encabezado, IndicadorEnVivo, Insignia } from '../../componentes/ui.jsx';
import { PestaniasDeCategoria, conFiltros, useCategorias, useListadoEnVivo } from '../../componentes/filtros.jsx';

export default function ReglamentosPublico() {
  const categorias = useCategorias();
  const [categoria, setCategoria] = useState('');
  const {
    datos: reglamentos,
    error,
    actualizado,
    enVivo,
  } = useListadoEnVivo(conFiltros('/publico/reglamentos', { categoria }), 'reglamentos', 'reglamentos');

  return (
    <>
      <Encabezado titulo="Reglamentos" subtitulo="Versión oficial vigente de los reglamentos de cada categoría.">
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
      </Encabezado>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="filtros">
        <PestaniasDeCategoria categorias={categorias} valor={categoria} alCambiar={setCategoria} />
      </div>
      {reglamentos === null ? (
        <Cargando />
      ) : reglamentos.length === 0 ? (
        <p className="tarjeta estado-vacio">No hay reglamentos publicados para esta categoría.</p>
      ) : (
        <ul className="lista-reglamentos">
          {reglamentos.map((r) => (
            <li key={r.documento} className="tarjeta reglamento">
              <div>
                <h2>{r.titulo}</h2>
                <div className="resumen">
                  <Insignia tono="info">{r.categoria.nombre}</Insignia>
                  <Insignia tono="neutro">{TIPOS_DE_REGLAMENTO[r.tipo] ?? r.tipo}</Insignia>
                  <Insignia tono="ok">Vigente · versión {r.version}</Insignia>
                </div>
                <small className="texto-suave">
                  Publicado el {formatearFechaHora(r.publicadoEn)} · PDF, {formatearTamanio(r.tamanio)}
                </small>
              </div>
              <a className="boton boton--primario" href={r.documento} target="_blank" rel="noreferrer">
                Abrir reglamento
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
