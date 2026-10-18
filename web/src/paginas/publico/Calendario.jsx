import { useState } from 'react';
import { ESTADO_DE_FECHA, TIPOS_DE_EVENTO, formatearFechaHora, mesDe, nombreDelMes, partesDeFecha } from '../../formato.js';
import { Aviso, Cargando, Encabezado, IndicadorEnVivo, Insignia, InsigniaDeEstado } from '../../componentes/ui.jsx';
import {
  NavegadorDeMes,
  PestaniasDeCategoria,
  conFiltros,
  useCategorias,
  useListadoEnVivo,
} from '../../componentes/filtros.jsx';

function agruparPorMes(eventos) {
  const meses = new Map();
  for (const evento of eventos) {
    const mes = mesDe(evento.fecha);
    if (!meses.has(mes)) meses.set(mes, []);
    meses.get(mes).push(evento);
  }
  return [...meses.entries()].map(([mes, lista]) => ({ mes, eventos: lista }));
}

export function AgendaDeEventos({ eventos, acciones }) {
  if (eventos.length === 0) return <p className="tarjeta estado-vacio">No hay fechas cargadas para este filtro.</p>;
  return agruparPorMes(eventos).map(({ mes, eventos: delMes }) => (
    <section key={mes} className="tarjeta agenda">
      <h2 className="agenda__mes">{nombreDelMes(mes)}</h2>
      <ul className="agenda__lista">
        {delMes.map((e) => {
          const { dia, semana } = partesDeFecha(e.fecha);
          return (
            <li key={e.id} className={`agenda__evento agenda__evento--${e.estado.toLowerCase()}`}>
              <div className="agenda__fecha" aria-hidden="true">
                <span className="agenda__dia">{dia}</span>
                <span className="agenda__semana">{semana}</span>
              </div>
              <div className="agenda__detalle">
                <strong>{e.nombre}</strong>
                <span className="texto-suave">
                  {e.circuito} · {e.pais}
                  {e.hora ? ` · ${e.hora} h` : ''}
                </span>
                <div className="resumen">
                  <Insignia tono="info">{e.categoria.nombre}</Insignia>
                  <Insignia tono="neutro">{TIPOS_DE_EVENTO[e.tipo] ?? e.tipo}</Insignia>
                  <InsigniaDeEstado estados={ESTADO_DE_FECHA} estado={e.estado} />
                </div>
                {e.oficializadoPor && (
                  <small className="texto-suave">
                    Firmada como oficial por {e.oficializadoPor} el {formatearFechaHora(e.oficializadoEn)}
                  </small>
                )}
              </div>
              {acciones && <div className="agenda__acciones">{acciones(e)}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  ));
}

export default function CalendarioPublico() {
  const categorias = useCategorias();
  const [categoria, setCategoria] = useState('');
  const [mes, setMes] = useState('');
  const { datos: eventos, error, actualizado, enVivo } = useListadoEnVivo(
    conFiltros('/publico/calendario', { categoria, mes }),
    'eventos',
    'calendario',
  );

  return (
    <>
      <Encabezado
        titulo="Calendario del campeonato"
        subtitulo="Carreras y eventos de cada categoría. Las fechas especulativas todavía no fueron confirmadas por la FIA."
      >
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
      </Encabezado>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="filtros">
        <PestaniasDeCategoria categorias={categorias} valor={categoria} alCambiar={setCategoria} />
        <NavegadorDeMes mes={mes} alCambiar={setMes} />
      </div>
      {eventos === null ? <Cargando /> : <AgendaDeEventos eventos={eventos} />}
    </>
  );
}
