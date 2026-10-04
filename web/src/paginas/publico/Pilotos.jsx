
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api.js';
import { useSesion } from '../../sesion.jsx';
import { NOMBRE_DE_ROL_PILOTO, formatearHora } from '../../formato.js';
import { Aviso, Cargando, Encabezado, IndicadorEnVivo, Insignia, useEventosDeNomina } from '../../componentes/ui.jsx';

export function agruparPorEscuderia(pilotos) {
  const grupos = new Map();
  for (const piloto of pilotos) {
    const clave = piloto.escuderia.id;
    if (!grupos.has(clave)) grupos.set(clave, { escuderia: piloto.escuderia, categoria: piloto.categoria, pilotos: [] });
    grupos.get(clave).pilotos.push(piloto);
  }
  return [...grupos.values()];
}

export default function PilotosPublico() {
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [escuderias, setEscuderias] = useState([]);
  const [escuderia, setEscuderia] = useState('');
  const [pilotos, setPilotos] = useState(null);
  const [error, setError] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [destacado, setDestacado] = useState(false);

  useEffect(() => {
    api('GET', '/publico/categorias')
      .then((r) => setCategorias(r.categorias))
      .catch((e) => setError(e.message));
  }, []);

  const cargar = useCallback(async () => {
    const filtros = new URLSearchParams();
    if (categoria) filtros.set('categoria', categoria);
    if (escuderia) filtros.set('escuderia', escuderia);
    try {
      const [p, e] = await Promise.all([
        api('GET', `/publico/pilotos?${filtros}`),
        api('GET', `/publico/escuderias${categoria ? `?categoria=${categoria}` : ''}`),
      ]);
      setPilotos(p.pilotos);
      setEscuderias(e.escuderias);
      setActualizado(formatearHora(new Date().toISOString()));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [categoria, escuderia]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const alCambiarLaNomina = useCallback(() => {
    cargar();
    setDestacado(true);
    setTimeout(() => setDestacado(false), 2500);
  }, [cargar]);
  const enVivo = useEventosDeNomina(alCambiarLaNomina);

  const grupos = useMemo(() => agruparPorEscuderia(pilotos ?? []), [pilotos]);

  return (
    <>
      <Encabezado titulo="Nómina de pilotos" subtitulo="Pilotos titulares y suplentes de cada escudería, por categoría.">
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
      </Encabezado>
      {ubicacion.state?.bienvenida && usuario && (
        <Aviso tono="ok">¡Bienvenida/o, {usuario.nombre}! Tu cuenta quedó creada.</Aviso>
      )}
      {destacado && <Aviso tono="info">La nómina se actualizó con un cambio reciente.</Aviso>}
      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="filtros">
        <div className="pestanias" role="tablist" aria-label="Categoría">
          {[{ codigo: '', nombre: 'Todas' }, ...categorias].map((c) => (
            <button
              key={c.codigo || 'todas'}
              type="button"
              role="tab"
              aria-selected={categoria === c.codigo}
              className={`pestania${categoria === c.codigo ? ' activa' : ''}`}
              onClick={() => {
                setCategoria(c.codigo);
                setEscuderia('');
              }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
        <label className="filtro">
          Escudería
          <select value={escuderia} onChange={(e) => setEscuderia(e.target.value)}>
            <option value="">Todas</option>
            {escuderias.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombreOficial} ({e.categoria})
              </option>
            ))}
          </select>
        </label>
      </div>

      {pilotos === null ? (
        <Cargando />
      ) : grupos.length === 0 ? (
        <p className="tarjeta estado-vacio">No hay pilotos cargados para este filtro.</p>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.escuderia.id} className="tarjeta escuderia-publica">
            <header className="escuderia-publica__encabezado">
              <h2>{grupo.escuderia.nombreOficial}</h2>
              <Insignia tono="info">{grupo.categoria.nombre}</Insignia>
            </header>
            <div className="grilla-pilotos">
              {grupo.pilotos.map((p) => (
                <article key={p.id} className={`piloto piloto--${p.rol.toLowerCase()}`}>
                  <span className="piloto__numero">{p.numero}</span>
                  <div>
                    <strong className="piloto__nombre">
                      {p.nombre} {p.apellido}
                    </strong>
                    <span className="piloto__nacionalidad">{p.nacionalidad}</span>
                  </div>
                  <Insignia tono={p.rol === 'TITULAR' ? 'ok' : 'neutro'}>{NOMBRE_DE_ROL_PILOTO[p.rol]}</Insignia>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
