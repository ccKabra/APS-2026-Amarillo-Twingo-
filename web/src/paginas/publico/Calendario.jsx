import { useState } from 'react';
import {
  ESTADO_DE_FECHA,
  TIPOS_DE_EVENTO,
  formatearFecha,
  formatearFechaHora,
  hoyIso,
  mesDe,
  nombreDelMes,
  partesDeFecha,
} from '../../formato.js';
import { Aviso, Cargando, Encabezado, IndicadorEnVivo, Insignia, InsigniaDeEstado } from '../../componentes/ui.jsx';
import {
  NavegadorDeMes,
  PestaniasDeCategoria,
  conFiltros,
  useCategorias,
  useListadoEnVivo,
} from '../../componentes/filtros.jsx';
import GrillaDeMes from '../../componentes/GrillaDeMes.jsx';

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
  const [vista, setVista] = useState('mes');
  const [mes, setMes] = useState(mesDe(hoyIso()));
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [dia, setDia] = useState('');
  const enGrilla = vista === 'mes';
  const filtros = enGrilla ? { categoria, mes } : { categoria, mes, desde, hasta };
  const { datos: eventos, error, actualizado, enVivo } = useListadoEnVivo(
    conFiltros('/publico/calendario', filtros),
    'eventos',
    'calendario',
  );
  const visibles = enGrilla && dia ? eventos?.filter((e) => e.fecha === dia) : eventos;

  function elegirMes(valor) {
    setDia('');
    setMes(valor);
    if (!valor) setVista('lista');
  }

  function elegirVista(valor) {
    setDia('');
    setVista(valor);
    if (valor === 'mes' && !mes) setMes(mesDe(hoyIso()));
  }

  return (
    <>
      <Encabezado
        titulo="Calendario del campeonato"
        subtitulo="Carreras y eventos de cada categoría. Las fechas especulativas todavía no fueron confirmadas por la FIA."
      >
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
        <a className="boton boton--primario" href={conFiltros('/api/publico/calendario/descargar', filtros)} download>
          Descargar calendario (.ics)
        </a>
      </Encabezado>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="filtros">
        <PestaniasDeCategoria
          categorias={categorias}
          valor={categoria}
          alCambiar={(valor) => {
            setDia('');
            setCategoria(valor);
          }}
        />
        <NavegadorDeMes mes={mes} alCambiar={elegirMes} />
        <div className="filtro">
          Vista
          <div className="acciones-en-linea">
            {[
              ['mes', 'Calendario'],
              ['lista', 'Lista'],
            ].map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={vista === valor}
                className={`boton boton--chico ${vista === valor ? 'boton--primario' : 'boton--claro'}`}
                onClick={() => elegirVista(valor)}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
        {!enGrilla && (
          <>
            <label className="filtro">
              Desde
              <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="filtro">
              Hasta
              <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </>
        )}
      </div>
      {eventos === null ? (
        <Cargando />
      ) : (
        <>
          {enGrilla && <GrillaDeMes mes={mes} eventos={eventos} diaElegido={dia} alElegir={setDia} />}
          {dia && (
            <p className="texto-suave">
              Eventos del {formatearFecha(dia)}.{' '}
              <button type="button" className="boton boton--enlace" onClick={() => setDia('')}>
                Ver todo el mes
              </button>
            </p>
          )}
          <AgendaDeEventos eventos={visibles} />
        </>
      )}
    </>
  );
}
