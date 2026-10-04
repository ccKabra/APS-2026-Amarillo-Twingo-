
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { reglasDePassword } from '../formato.js';

export function Aviso({ tono = 'info', children, alCerrar }) {
  if (!children) return null;
  return (
    <div className={`aviso aviso--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {alCerrar && (
        <button type="button" className="aviso__cerrar" onClick={alCerrar} aria-label="Cerrar aviso">
          ×
        </button>
      )}
    </div>
  );
}

export function Insignia({ tono = 'neutro', children }) {
  return <span className={`insignia insignia--${tono}`}>{children}</span>;
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando" role="status">
      <span className="cargando__punto" />
      {texto}
    </div>
  );
}

export function Campo({ etiqueta, error, ayuda, id, children, opcional }) {
  return (
    <div className={`campo${error ? ' campo--error' : ''}`}>
      <label htmlFor={id}>
        {etiqueta}
        {opcional && <span className="campo__opcional"> (opcional)</span>}
      </label>
      {children}
      {ayuda && !error && <small className="campo__ayuda">{ayuda}</small>}
      {error && <small className="campo__mensaje">{error}</small>}
    </div>
  );
}

export function Encabezado({ titulo, subtitulo, children }) {
  return (
    <div className="pagina__encabezado">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p className="pagina__subtitulo">{subtitulo}</p>}
      </div>
      {children && <div className="pagina__acciones">{children}</div>}
    </div>
  );
}


export function BotonConfirmar({
  children,
  pregunta = '¿Confirmás?',
  alConfirmar,
  tono = 'peligro',
  chico = true,
  deshabilitado,
}) {
  const [preguntando, setPreguntando] = useState(false);
  const clase = `boton boton--${tono}${chico ? ' boton--chico' : ''}`;
  if (!preguntando) {
    return (
      <button type="button" className={clase} onClick={() => setPreguntando(true)} disabled={deshabilitado}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirmacion">
      <span>{pregunta}</span>
      <button
        type="button"
        className={clase}
        onClick={async () => {
          setPreguntando(false);
          await alConfirmar();
        }}
      >
        Sí
      </button>
      <button type="button" className="boton boton--claro boton--chico" onClick={() => setPreguntando(false)}>
        No
      </button>
    </span>
  );
}

let politicaEnCache = null;
export function usePoliticaDePassword() {
  const [minLongitud, setMinLongitud] = useState(politicaEnCache?.minLongitud ?? 10);
  useEffect(() => {
    if (politicaEnCache) return;
    api('GET', '/auth/politica-password')
      .then((p) => {
        politicaEnCache = p;
        setMinLongitud(p.minLongitud);
      })
      .catch(() => {});
  }, []);
  return minLongitud;
}

export function ChecklistPassword({ password, minLongitud }) {
  const reglas = reglasDePassword(password, minLongitud);
  return (
    <ul className="checklist" aria-label="Requisitos de la contraseña">
      {reglas.map((regla) => (
        <li key={regla.codigo} className={regla.cumple ? 'cumple' : ''}>
          <span aria-hidden="true">{regla.cumple ? '✓' : '○'}</span> {regla.descripcion}
        </li>
      ))}
    </ul>
  );
}

export function passwordCumplePolitica(password, minLongitud) {
  return reglasDePassword(password, minLongitud).every((regla) => regla.cumple);
}

// Escucha los avisos de cambios en la nómina (Server-Sent Events) y ejecuta alCambiar.
export function useEventosDeNomina(alCambiar) {
  const [enVivo, setEnVivo] = useState(false);
  useEffect(() => {
    if (typeof EventSource === 'undefined') return undefined;
    const fuente = new EventSource('/api/publico/eventos');
    fuente.onopen = () => setEnVivo(true);
    fuente.onerror = () => setEnVivo(false);
    const manejador = (evento) => alCambiar(JSON.parse(evento.data));
    fuente.addEventListener('nomina', manejador);
    return () => {
      fuente.removeEventListener('nomina', manejador);
      fuente.close();
    };
  }, [alCambiar]);
  return enVivo;
}

export function IndicadorEnVivo({ enVivo, ultimaActualizacion }) {
  return (
    <span
      className={`en-vivo${enVivo ? ' en-vivo--activo' : ''}`}
      title="Las altas, cambios y bajas se muestran sin recargar la página"
    >
      <span className="en-vivo__punto" />
      {enVivo ? 'En vivo' : 'Sin conexión en vivo'}
      {ultimaActualizacion && <small> · actualizado {ultimaActualizacion}</small>}
    </span>
  );
}
