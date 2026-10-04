
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { ESTADO_DE_CUENTA, NOMBRE_DE_ROL_PILOTO, formatearFecha, formatearFechaHora } from '../../formato.js';
import { Aviso, BotonConfirmar, Campo, Cargando, Encabezado, Insignia } from '../../componentes/ui.jsx';

function EstadoCuenta({ estado }) {
  const e = ESTADO_DE_CUENTA[estado] ?? { texto: estado, tono: 'neutro' };
  return <Insignia tono={e.tono}>{e.texto}</Insignia>;
}

function useCategorias() {
  const [categorias, setCategorias] = useState([]);
  useEffect(() => {
    api('GET', '/publico/categorias')
      .then((r) => setCategorias(r.categorias))
      .catch(() => {});
  }, []);
  return categorias;
}

export function ListaDeEscuderias() {
  const categorias = useCategorias();
  const [categoria, setCategoria] = useState('');
  const [escuderias, setEscuderias] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setEscuderias(null);
    api('GET', `/admin/escuderias${categoria ? `?categoria=${categoria}` : ''}`)
      .then((r) => setEscuderias(r.escuderias))
      .catch((e) => setError(e.message));
  }, [categoria]);

  return (
    <>
      <Encabezado titulo="Escuderías" subtitulo="Cuentas de escudería habilitadas por la FIA y sus responsables designados.">
        <Link to="/fia/escuderias/nueva" className="boton boton--primario">
          + Nueva escudería
        </Link>
      </Encabezado>
      {error && <Aviso tono="error">{error}</Aviso>}
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
      </div>
      {escuderias === null ? (
        <Cargando />
      ) : (
        <div className="tabla-contenedor tarjeta">
          <table className="tabla">
            <thead>
              <tr>
                <th>Escudería</th>
                <th>Categoría</th>
                <th>Responsable designado</th>
                <th className="numero">Pilotos</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {escuderias.map((e) => (
                <tr key={e.id} className={e.activa ? '' : 'fila--inactiva'}>
                  <td>
                    <strong>{e.nombreOficial}</strong>
                    <div className="texto-suave">
                      {e.sede ? `${e.sede}, ` : ''}
                      {e.pais}
                    </div>
                  </td>
                  <td>{e.categoriaNombre}</td>
                  <td>
                    {e.responsables.map((r) => (
                      <div key={r.id} className="responsable">
                        <span>
                          {r.nombre} {r.apellido}
                        </span>
                        <span className="texto-suave">{r.email}</span>
                        <EstadoCuenta estado={r.estado} />
                      </div>
                    ))}
                  </td>
                  <td className="numero">{e.cantidadPilotos}</td>
                  <td>{e.activa ? <Insignia tono="ok">Activa</Insignia> : <Insignia tono="neutro">Dada de baja</Insignia>}</td>
                  <td>
                    <Link to={`/fia/escuderias/${e.id}`} className="boton boton--claro boton--chico">
                      Ver / editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const ALTA_VACIA = {
  nombreOficial: '',
  categoria: '',
  pais: '',
  sede: '',
  responsable: { nombre: '', apellido: '', email: '', usarCuentaExistente: false },
};

export function NuevaEscuderia() {
  const categorias = useCategorias();
  const navegar = useNavigate();
  const [datos, setDatos] = useState(ALTA_VACIA);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const cambiarResponsable = (campo) => (e) =>
    setDatos({
      ...datos,
      responsable: { ...datos.responsable, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value },
    });
  const existente = datos.responsable.usarCuentaExistente;

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErrores({});
    setError(null);
    try {
      setResultado(await api('POST', '/admin/escuderias', datos));
    } catch (e) {
      setErrores(e.detalles ?? {});
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    const { escuderia, correo } = resultado;
    return (
      <section className="tarjeta tarjeta--centrada">
        <div className="estado-vacio__icono" aria-hidden="true">
          ✅
        </div>
        <h1>Escudería creada</h1>
        <p>
          <strong>{escuderia.nombreOficial}</strong> quedó habilitada en {escuderia.categoriaNombre}.
        </p>
        <Aviso tono={correo.enviado ? 'ok' : 'error'}>
          {correo.enviado
            ? correo.tipo === 'CREDENCIALES'
              ? `Se enviaron las credenciales de acceso a ${correo.para}. El responsable define su contraseña desde el enlace del correo.`
              : `Se avisó a ${correo.para} que la escudería quedó asociada a su cuenta.`
            : `La cuenta se creó, pero no se pudo enviar el correo a ${correo.para}. Podés reenviarlo desde el detalle.`}
        </Aviso>
        <div className="acciones-en-linea">
          <Link to={`/fia/escuderias/${escuderia.id}`} className="boton boton--primario">
            Ver la escudería
          </Link>
          <Link to="/fia/correos" className="boton boton--claro">
            Ver el correo enviado
          </Link>
          <button
            type="button"
            className="boton boton--claro"
            onClick={() => {
              setResultado(null);
              setDatos(ALTA_VACIA);
            }}
          >
            Crear otra
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <Encabezado
        titulo="Nueva escudería"
        subtitulo="Al guardar, el sistema genera las credenciales y se las envía al responsable designado."
      />
      {error && <Aviso tono="error">{error}</Aviso>}
      <form className="tarjeta formulario" onSubmit={enviar} noValidate>
        <fieldset>
          <legend>Datos oficiales</legend>
          <div className="fila-de-campos">
            <Campo etiqueta="Nombre oficial" id="nombreOficial" error={errores.nombreOficial}>
              <input id="nombreOficial" value={datos.nombreOficial} onChange={cambiar('nombreOficial')} autoFocus />
            </Campo>
            <Campo etiqueta="Categoría" id="categoria" error={errores.categoria}>
              <select id="categoria" value={datos.categoria} onChange={cambiar('categoria')}>
                <option value="">Elegí una categoría</option>
                {categorias.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="fila-de-campos">
            <Campo etiqueta="País" id="pais" error={errores.pais}>
              <input id="pais" value={datos.pais} onChange={cambiar('pais')} />
            </Campo>
            <Campo etiqueta="Sede" id="sede" error={errores.sede} opcional>
              <input id="sede" value={datos.sede} onChange={cambiar('sede')} />
            </Campo>
          </div>
        </fieldset>
        <fieldset>
          <legend>Responsable designado</legend>
          <label className="casilla">
            <input type="checkbox" checked={existente} onChange={cambiarResponsable('usarCuentaExistente')} />
            Asociar a una cuenta de escudería existente (por ejemplo, el mismo equipo en otra categoría)
          </label>
          {!existente && (
            <div className="fila-de-campos">
              <Campo etiqueta="Nombre" id="resp-nombre" error={errores['responsable.nombre']}>
                <input id="resp-nombre" value={datos.responsable.nombre} onChange={cambiarResponsable('nombre')} />
              </Campo>
              <Campo etiqueta="Apellido" id="resp-apellido" error={errores['responsable.apellido']}>
                <input id="resp-apellido" value={datos.responsable.apellido} onChange={cambiarResponsable('apellido')} />
              </Campo>
            </div>
          )}
          <Campo
            etiqueta="Correo electrónico del responsable"
            id="resp-email"
            error={errores['responsable.email']}
            ayuda={
              existente
                ? 'Correo de la cuenta de escudería que ya existe.'
                : 'A este correo se envían las credenciales de acceso.'
            }
          >
            <input id="resp-email" type="email" value={datos.responsable.email} onChange={cambiarResponsable('email')} />
          </Campo>
        </fieldset>
        <div className="acciones-en-linea">
          <button className="boton boton--primario" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear escudería'}
          </button>
          <button type="button" className="boton boton--claro" onClick={() => navegar('/fia/escuderias')}>
            Cancelar
          </button>
        </div>
      </form>
    </>
  );
}

export function DetalleDeEscuderia() {
  const { id } = useParams();
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api('GET', `/admin/escuderias/${id}`);
      setDatos(r);
      setForm({ nombreOficial: r.escuderia.nombreOficial, pais: r.escuderia.pais, sede: r.escuderia.sede ?? '' });
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function ejecutar(accion, textoOk) {
    setMensaje(null);
    setErrores({});
    try {
      await accion();
      setMensaje({ tono: 'ok', texto: textoOk });
      await cargar();
    } catch (e) {
      setErrores(e.detalles ?? {});
      setMensaje({ tono: 'error', texto: e.message });
    }
  }

  if (!datos) return mensaje ? <Aviso tono="error">{mensaje.texto}</Aviso> : <Cargando />;
  const { escuderia, pilotos } = datos;

  return (
    <>
      <Encabezado
        titulo={escuderia.nombreOficial}
        subtitulo={`${escuderia.categoriaNombre} · creada el ${formatearFechaHora(escuderia.creadaEn)} por ${escuderia.creadaPor}`}
      >
        <Link to="/fia/escuderias" className="boton boton--claro">
          ← Volver
        </Link>
        {escuderia.activa ? (
          <BotonConfirmar
            chico={false}
            pregunta="¿Dar de baja la escudería?"
            alConfirmar={() =>
              ejecutar(
                () => api('POST', `/admin/escuderias/${id}/baja`),
                'La escudería quedó dada de baja: ya no aparece en la vista pública.',
              )
            }
          >
            Dar de baja
          </BotonConfirmar>
        ) : (
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => ejecutar(() => api('POST', `/admin/escuderias/${id}/reactivar`), 'La escudería se reactivó.')}
          >
            Reactivar
          </button>
        )}
      </Encabezado>
      {mensaje && (
        <Aviso tono={mensaje.tono} alCerrar={() => setMensaje(null)}>
          {mensaje.texto}
        </Aviso>
      )}
      {!escuderia.activa && <Aviso tono="aviso">Esta escudería está dada de baja.</Aviso>}
      <div className="grilla-2">
        <form
          className="tarjeta"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            ejecutar(() => api('PATCH', `/admin/escuderias/${id}`, form), 'Cambios guardados.');
          }}
        >
          <h2>Datos oficiales</h2>
          <Campo etiqueta="Nombre oficial" id="nombreOficial" error={errores.nombreOficial}>
            <input
              id="nombreOficial"
              value={form.nombreOficial}
              onChange={(e) => setForm({ ...form, nombreOficial: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Categoría" id="categoria" ayuda="La categoría no se puede modificar.">
            <input id="categoria" value={escuderia.categoriaNombre} disabled />
          </Campo>
          <div className="fila-de-campos">
            <Campo etiqueta="País" id="pais" error={errores.pais}>
              <input id="pais" value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} />
            </Campo>
            <Campo etiqueta="Sede" id="sede" error={errores.sede} opcional>
              <input id="sede" value={form.sede} onChange={(e) => setForm({ ...form, sede: e.target.value })} />
            </Campo>
          </div>
          <button className="boton boton--primario">Guardar cambios</button>
        </form>
        <section className="tarjeta">
          <h2>Responsables designados</h2>
          <ul className="lista-tarjetas">
            {escuderia.responsables.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>
                    {r.nombre} {r.apellido}
                  </strong>
                  <div className="texto-suave">{r.email}</div>
                </div>
                <div className="acciones-en-linea">
                  <EstadoCuenta estado={r.estado} />
                  {r.estado === 'PENDIENTE_ACTIVACION' && (
                    <button
                      type="button"
                      className="boton boton--claro boton--chico"
                      onClick={() =>
                        ejecutar(
                          () => api('POST', `/admin/usuarios/${r.id}/reenviar-activacion`),
                          `Se reenviaron las credenciales a ${r.email}.`,
                        )
                      }
                    >
                      Reenviar credenciales
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="tarjeta">
        <h2>Nómina actual ({pilotos.length})</h2>
        {pilotos.length === 0 ? (
          <p className="texto-suave">La escudería todavía no cargó pilotos.</p>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="numero">N°</th>
                  <th>Piloto</th>
                  <th>Nacionalidad</th>
                  <th>Nacimiento</th>
                  <th>Rol</th>
                </tr>
              </thead>
              <tbody>
                {pilotos.map((p) => (
                  <tr key={p.id}>
                    <td className="numero">{p.numero}</td>
                    <td>
                      {p.nombre} {p.apellido}
                    </td>
                    <td>{p.nacionalidad}</td>
                    <td>{formatearFecha(p.fechaNacimiento)}</td>
                    <td>
                      <Insignia tono={p.rol === 'TITULAR' ? 'ok' : 'neutro'}>{NOMBRE_DE_ROL_PILOTO[p.rol]}</Insignia>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
