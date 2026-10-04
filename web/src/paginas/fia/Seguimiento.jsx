
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import {
  ACCIONES_DE_AUDITORIA,
  NOMBRE_DE_ROL_PILOTO,
  edad,
  formatearFecha,
  formatearFechaHora,
  formatearHora,
} from '../../formato.js';
import { Aviso, Cargando, Encabezado, IndicadorEnVivo, Insignia, useEventosDeNomina } from '../../componentes/ui.jsx';

export function NominaGeneral() {
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [incluirBajas, setIncluirBajas] = useState(false);
  const [pilotos, setPilotos] = useState(null);
  const [error, setError] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [ultimoCambio, setUltimoCambio] = useState(null);

  useEffect(() => {
    api('GET', '/publico/categorias')
      .then((r) => setCategorias(r.categorias))
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    const filtros = new URLSearchParams();
    if (categoria) filtros.set('categoria', categoria);
    if (incluirBajas) filtros.set('incluirBajas', 'true');
    try {
      const r = await api('GET', `/fia/pilotos?${filtros}`);
      setPilotos(r.pilotos);
      setActualizado(formatearHora(new Date().toISOString()));
    } catch (e) {
      setError(e.message);
    }
  }, [categoria, incluirBajas]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const alCambiar = useCallback(
    (evento) => {
      setUltimoCambio(evento);
      cargar();
    },
    [cargar],
  );
  const enVivo = useEventosDeNomina(alCambiar);

  return (
    <>
      <Encabezado
        titulo="Nómina general"
        subtitulo="Vista de la FIA: todas las escuderías, con datos completos e historial de bajas."
      >
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
      </Encabezado>
      {error && <Aviso tono="error">{error}</Aviso>}
      {ultimoCambio && (
        <Aviso tono="info" alCerrar={() => setUltimoCambio(null)}>
          Cambio recibido en vivo: {ultimoCambio.tipo} · {ultimoCambio.accion} ({ultimoCambio.categoria}).
        </Aviso>
      )}
      <div className="filtros">
        <label className="filtro">
          Categoría
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="casilla">
          <input type="checkbox" checked={incluirBajas} onChange={(e) => setIncluirBajas(e.target.checked)} />
          Incluir pilotos dados de baja
        </label>
      </div>
      {pilotos === null ? (
        <Cargando />
      ) : (
        <div className="tabla-contenedor tarjeta">
          <table className="tabla">
            <thead>
              <tr>
                <th className="numero">N°</th>
                <th>Piloto</th>
                <th>Nacionalidad</th>
                <th>Nacimiento</th>
                <th>Rol</th>
                <th>Escudería</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {pilotos.map((p) => (
                <tr key={p.id} className={p.activo && p.escuderiaActiva ? '' : 'fila--inactiva'}>
                  <td className="numero">{p.numero}</td>
                  <td>
                    {p.nombre} {p.apellido}
                  </td>
                  <td>{p.nacionalidad}</td>
                  <td>
                    {formatearFecha(p.fechaNacimiento)} <span className="texto-suave">({edad(p.fechaNacimiento)} años)</span>
                  </td>
                  <td>
                    <Insignia tono={p.rol === 'TITULAR' ? 'ok' : 'neutro'}>{NOMBRE_DE_ROL_PILOTO[p.rol]}</Insignia>
                  </td>
                  <td>{p.escuderia.nombreOficial}</td>
                  <td>{p.categoria.nombre}</td>
                  <td>
                    {!p.activo ? (
                      <Insignia tono="neutro">Baja {formatearFecha(p.dadoDeBajaEn?.slice(0, 10))}</Insignia>
                    ) : !p.escuderiaActiva ? (
                      <Insignia tono="aviso">Escudería dada de baja</Insignia>
                    ) : (
                      <Insignia tono="ok">Activo</Insignia>
                    )}
                  </td>
                  <td className="texto-suave">{formatearFechaHora(p.actualizadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function resumirDetalle(detalle) {
  if (!detalle) return '';
  return Object.entries(detalle)
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
    .map(([clave, valor]) => `${clave}: ${typeof valor === 'object' ? JSON.stringify(valor) : valor}`)
    .join(' · ');
}

export function Auditoria() {
  const [accion, setAccion] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('GET', `/admin/auditoria?limite=300${accion ? `&accion=${accion}` : ''}`)
      .then(setDatos)
      .catch((e) => setError(e.message));
  }, [accion]);

  return (
    <>
      <Encabezado
        titulo="Auditoría"
        subtitulo="Cada alta, modificación y baja queda registrada con el usuario, la fecha y la hora."
      />
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="filtros">
        <label className="filtro">
          Acción
          <select value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="">Todas</option>
            {(datos?.acciones ?? []).map((a) => (
              <option key={a} value={a}>
                {ACCIONES_DE_AUDITORIA[a] ?? a}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!datos ? (
        <Cargando />
      ) : (
        <div className="tabla-contenedor tarjeta">
          <table className="tabla tabla--compacta">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {datos.registros.map((r) => (
                <tr key={r.id}>
                  <td className="sin-corte">{formatearFechaHora(r.fechaHora)}</td>
                  <td>{r.usuarioEmail ?? '—'}</td>
                  <td>
                    <Insignia
                      tono={
                        r.accion === 'ACCESO_DENEGADO' || r.accion.includes('FALLIDO') || r.accion.includes('BLOQUEADA')
                          ? 'error'
                          : 'info'
                      }
                    >
                      {ACCIONES_DE_AUDITORIA[r.accion] ?? r.accion}
                    </Insignia>
                  </td>
                  <td className="detalle-auditoria">{resumirDetalle(r.detalle)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TextoConEnlaces({ texto }) {
  const partes = texto.split(/(https?:\/\/\S+)/g);
  return partes.map((parte, i) =>
    /^https?:\/\//.test(parte) ? (
      <a key={i} href={parte} target="_blank" rel="noreferrer">
        {parte}
      </a>
    ) : (
      parte
    ),
  );
}

export function Correos() {
  const [datos, setDatos] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('GET', '/admin/correos')
      .then((r) => {
        setDatos(r);
        setAbierto(r.correos[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Encabezado titulo="Correos enviados" subtitulo="Bandeja de salida de la plataforma." />
      {error && <Aviso tono="error">{error}</Aviso>}
      {datos?.transporte === 'desarrollo' && (
        <Aviso tono="info">
          Modo desarrollo: los correos no salen a Internet, se guardan acá para la demo. Para enviarlos de verdad, configurá SMTP
          en backend/.env (ver README).
        </Aviso>
      )}
      {!datos ? (
        <Cargando />
      ) : datos.correos.length === 0 ? (
        <p className="tarjeta estado-vacio">Todavía no se envió ningún correo.</p>
      ) : (
        <ul className="bandeja">
          {datos.correos.map((c) => (
            <li key={c.id} className="tarjeta">
              <button
                type="button"
                className="bandeja__cabecera"
                onClick={() => setAbierto(abierto === c.id ? null : c.id)}
                aria-expanded={abierto === c.id}
              >
                <span>
                  <strong>{c.asunto}</strong>
                  <span className="texto-suave"> · para {c.para}</span>
                </span>
                <span className="texto-suave sin-corte">{formatearFechaHora(c.enviadoEn)}</span>
              </button>
              {abierto === c.id && (
                <pre className="bandeja__cuerpo">
                  {c.cuerpo ? <TextoConEnlaces texto={c.cuerpo} /> : `Enviado por SMTP · estado: ${c.estado}`}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
