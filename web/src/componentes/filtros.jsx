import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatearHora, hoyIso, mesDe, nombreDelMes, sumarMeses } from '../formato.js';
import { useEventosEnVivo } from './ui.jsx';

export function conFiltros(ruta, filtros) {
  const parametros = new URLSearchParams(
    Object.entries(filtros).filter(([, valor]) => valor !== '' && valor !== null && valor !== undefined),
  );
  const consulta = parametros.toString();
  return consulta ? `${ruta}?${consulta}` : ruta;
}

export function useFiltros(iniciales) {
  const [filtros, setFiltros] = useState(iniciales);
  const cambiar = useCallback((cambios) => setFiltros((actuales) => ({ ...actuales, ...cambios })), []);
  return [filtros, cambiar];
}

export function useCategorias() {
  const [categorias, setCategorias] = useState([]);
  useEffect(() => {
    api('GET', '/publico/categorias')
      .then((r) => setCategorias(r.categorias))
      .catch(() => {});
  }, []);
  return categorias;
}

export function useEscuderias(categoria = '') {
  const [escuderias, setEscuderias] = useState([]);
  useEffect(() => {
    api('GET', conFiltros('/publico/escuderias', { categoria }))
      .then((r) => setEscuderias(r.escuderias))
      .catch(() => setEscuderias([]));
  }, [categoria]);
  return escuderias;
}

export function usePilotos({ categoria = '', escuderia = '' } = {}) {
  const [pilotos, setPilotos] = useState([]);
  useEffect(() => {
    api('GET', conFiltros('/publico/pilotos', { categoria, escuderia }))
      .then((r) => setPilotos(r.pilotos))
      .catch(() => setPilotos([]));
  }, [categoria, escuderia]);
  return pilotos;
}

export function useListadoEnVivo(ruta, clave, tipoDeEvento) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [actualizado, setActualizado] = useState(null);

  const cargar = useCallback(async () => {
    if (!ruta) return;
    try {
      const r = await api('GET', ruta);
      setDatos(r[clave]);
      setActualizado(formatearHora(new Date().toISOString()));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [ruta, clave]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const enVivo = useEventosEnVivo(tipoDeEvento, cargar);
  return { datos, error, actualizado, enVivo, recargar: cargar };
}

export function PestaniasDeCategoria({ categorias, valor, alCambiar }) {
  return (
    <div className="pestanias" role="tablist" aria-label="Categoría">
      {[{ codigo: '', nombre: 'Todas' }, ...categorias].map((c) => (
        <button
          key={c.codigo || 'todas'}
          type="button"
          role="tab"
          aria-selected={valor === c.codigo}
          className={`pestania${valor === c.codigo ? ' activa' : ''}`}
          onClick={() => alCambiar(c.codigo)}
        >
          {c.nombre}
        </button>
      ))}
    </div>
  );
}

export function FiltroDeLista({ etiqueta, valor, alCambiar, opciones, todas = 'Todas', deshabilitado }) {
  return (
    <label className="filtro">
      {etiqueta}
      <select value={valor} onChange={(e) => alCambiar(e.target.value)} disabled={deshabilitado}>
        <option value="">{todas}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export function opcionesDeEscuderias(escuderias) {
  return escuderias.map((e) => ({ valor: String(e.id), texto: `${e.nombreOficial} (${e.categoria})` }));
}

export function opcionesDePilotos(pilotos, { conEscuderia = true } = {}) {
  return pilotos.map((p) => ({
    valor: String(p.id),
    texto: `N° ${p.numero} · ${p.nombre} ${p.apellido}${conEscuderia ? ` (${p.escuderia.nombreOficial} · ${p.categoria.codigo})` : ''}`,
  }));
}

export function NavegadorDeMes({ mes, alCambiar }) {
  const base = mes || mesDe(hoyIso());
  return (
    <div className="filtro">
      Mes
      <div className="navegador-mes">
        <button
          type="button"
          className="boton boton--claro boton--chico"
          aria-label="Mes anterior"
          onClick={() => alCambiar(sumarMeses(base, -1))}
        >
          ‹
        </button>
        <span className="navegador-mes__nombre">{mes ? nombreDelMes(mes) : 'Todos los meses'}</span>
        <button
          type="button"
          className="boton boton--claro boton--chico"
          aria-label="Mes siguiente"
          onClick={() => alCambiar(sumarMeses(base, 1))}
        >
          ›
        </button>
        {mes ? (
          <button type="button" className="boton boton--enlace" onClick={() => alCambiar('')}>
            Ver todos
          </button>
        ) : (
          <button type="button" className="boton boton--enlace" onClick={() => alCambiar(base)}>
            Este mes
          </button>
        )}
      </div>
    </div>
  );
}
