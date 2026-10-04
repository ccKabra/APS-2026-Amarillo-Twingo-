
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useSesion } from '../../sesion.jsx';
import { NOMBRE_DE_ROL_PILOTO, edad, formatearFecha, formatearFechaHora } from '../../formato.js';
import { Aviso, BotonConfirmar, Campo, Cargando, Encabezado, Insignia } from '../../componentes/ui.jsx';

const CLAVE_SELECCION = 'fia.escuderiaSeleccionada';
const NACIONALIDADES = [
  'Argentina',
  'Bolivia',
  'Brasil',
  'Chile',
  'Colombia',
  'Ecuador',
  'España',
  'México',
  'Paraguay',
  'Perú',
  'Uruguay',
  'Venezuela',
];
const PILOTO_VACIO = { nombre: '', apellido: '', nacionalidad: '', fechaNacimiento: '', numero: '', rol: 'TITULAR' };
const ETIQUETAS = {
  nombre: 'Nombre',
  apellido: 'Apellido',
  nacionalidad: 'Nacionalidad',
  fechaNacimiento: 'Fecha de nacimiento',
  numero: 'Número',
  rol: 'Rol',
};

function leerSeleccion() {
  try {
    return Number(sessionStorage.getItem(CLAVE_SELECCION)) || null;
  } catch {
    return null;
  }
}

function guardarSeleccion(id) {
  try {
    sessionStorage.setItem(CLAVE_SELECCION, String(id));
  } catch {
    
  }
}


function validarEnElCliente(piloto) {
  const errores = {};
  for (const [campo, etiqueta] of Object.entries(ETIQUETAS)) {
    if (String(piloto[campo] ?? '').trim() === '') errores[campo] = `«${etiqueta}» es un dato obligatorio.`;
  }
  const numero = Number(piloto.numero);
  if (piloto.numero !== '' && (!Number.isInteger(numero) || numero < 1 || numero > 99)) {
    errores.numero = '«Número» debe ser un número entero entre 1 y 99.';
  }
  return errores;
}

function FormularioDePiloto({ inicial, escuderia, alGuardar, alCancelar }) {
  const [piloto, setPiloto] = useState(inicial ?? PILOTO_VACIO);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const esEdicion = Boolean(inicial?.id);
  const cambiar = (campo) => (e) => setPiloto({ ...piloto, [campo]: e.target.value });

  async function enviar(evento) {
    evento.preventDefault();
    const erroresLocales = validarEnElCliente(piloto);
    setErrores(erroresLocales);
    setError(null);
    if (Object.keys(erroresLocales).length) {
      setError('Completá los datos obligatorios antes de guardar.');
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = { ...piloto, numero: Number(piloto.numero) };
      const ruta = `/escuderia/${escuderia.id}/pilotos${esEdicion ? `/${inicial.id}` : ''}`;
      const r = await api(esEdicion ? 'PUT' : 'POST', ruta, cuerpo);
      alGuardar(r.piloto, esEdicion);
    } catch (e) {
      setErrores(e.detalles ?? {});
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="tarjeta formulario formulario--destacado" onSubmit={enviar} noValidate>
      <h2>{esEdicion ? `Editar a ${inicial.nombre} ${inicial.apellido}` : `Nuevo piloto para ${escuderia.nombreOficial}`}</h2>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="fila-de-campos fila-de-campos--3">
        <Campo etiqueta="Nombre" id="p-nombre" error={errores.nombre}>
          <input id="p-nombre" value={piloto.nombre} onChange={cambiar('nombre')} autoFocus />
        </Campo>
        <Campo etiqueta="Apellido" id="p-apellido" error={errores.apellido}>
          <input id="p-apellido" value={piloto.apellido} onChange={cambiar('apellido')} />
        </Campo>
        <Campo etiqueta="Nacionalidad" id="p-nacionalidad" error={errores.nacionalidad}>
          <input id="p-nacionalidad" list="nacionalidades" value={piloto.nacionalidad} onChange={cambiar('nacionalidad')} />
          <datalist id="nacionalidades">
            {NACIONALIDADES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Campo>
      </div>
      <div className="fila-de-campos fila-de-campos--3">
        <Campo etiqueta="Fecha de nacimiento" id="p-nacimiento" error={errores.fechaNacimiento}>
          <input id="p-nacimiento" type="date" value={piloto.fechaNacimiento} onChange={cambiar('fechaNacimiento')} />
        </Campo>
        <Campo etiqueta="Número" id="p-numero" error={errores.numero} ayuda={`Único dentro de ${escuderia.categoriaNombre}.`}>
          <input id="p-numero" type="number" min="1" max="99" value={piloto.numero} onChange={cambiar('numero')} />
        </Campo>
        <Campo etiqueta="Rol" id="p-rol" error={errores.rol}>
          <div className="opciones" role="radiogroup" id="p-rol">
            {['TITULAR', 'SUPLENTE'].map((rol) => (
              <label key={rol} className={`opcion${piloto.rol === rol ? ' activa' : ''}`}>
                <input type="radio" name="rol" value={rol} checked={piloto.rol === rol} onChange={cambiar('rol')} />
                {NOMBRE_DE_ROL_PILOTO[rol]}
              </label>
            ))}
          </div>
        </Campo>
      </div>
      <div className="acciones-en-linea">
        <button className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Agregar piloto'}
        </button>
        <button type="button" className="boton boton--claro" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function NominaDeEscuderia() {
  const { usuario, refrescarPerfil } = useSesion();
  const activas = usuario.escuderias.filter((e) => e.activa);
  const [seleccionada, setSeleccionada] = useState(() => {
    const guardada = leerSeleccion();
    return activas.find((e) => e.id === guardada)?.id ?? activas[0]?.id ?? null;
  });
  const escuderia = activas.find((e) => e.id === seleccionada) ?? activas[0];
  const idSeleccionado = escuderia?.id ?? null;
  const [pilotos, setPilotos] = useState(null);
  const [formulario, setFormulario] = useState(null); 
  const [mensaje, setMensaje] = useState(null);

  const cargar = useCallback(async () => {
    if (!idSeleccionado) return;
    try {
      const r = await api('GET', `/escuderia/${idSeleccionado}/pilotos`);
      setPilotos(r.pilotos);
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }, [idSeleccionado]);

  useEffect(() => {
    setPilotos(null);
    setFormulario(null);
    cargar();
  }, [cargar]);

  
  useEffect(() => {
    refrescarPerfil().catch(() => {});
    
  }, []);

  async function ejecutar(accion, textoOk) {
    setMensaje(null);
    try {
      await accion();
      setMensaje({ tono: 'ok', texto: textoOk });
      await cargar();
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }

  if (!escuderia) {
    return (
      <section className="tarjeta tarjeta--centrada estado-vacio">
        <h1>Sin escuderías activas</h1>
        <p>Tu cuenta no tiene escuderías activas asociadas. Comunicate con la FIA.</p>
      </section>
    );
  }

  const titulares = pilotos?.filter((p) => p.rol === 'TITULAR').length ?? 0;
  const suplentes = pilotos?.filter((p) => p.rol === 'SUPLENTE').length ?? 0;

  return (
    <>
      <Encabezado
        titulo="Nómina de pilotos"
        subtitulo="Los cambios se ven al instante en la vista pública, en la de la FIA y en la app."
      >
        {!formulario && (
          <button type="button" className="boton boton--primario" onClick={() => setFormulario({ inicial: null })}>
            + Agregar piloto
          </button>
        )}
      </Encabezado>

      <div className="selector-escuderia tarjeta">
        {activas.length > 1 ? (
          <label className="filtro">
            Escudería seleccionada
            <select
              value={idSeleccionado}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSeleccionada(id);
                guardarSeleccion(id);
              }}
            >
              {activas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombreOficial} — {e.categoriaNombre}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div>
            <span className="texto-suave">Escudería</span>
            <strong className="selector-escuderia__nombre">{escuderia.nombreOficial}</strong>
          </div>
        )}
        <div className="resumen">
          <Insignia tono="info">{escuderia.categoriaNombre}</Insignia>
          <Insignia tono="ok">
            {titulares} {titulares === 1 ? 'titular' : 'titulares'}
          </Insignia>
          <Insignia tono="neutro">
            {suplentes} {suplentes === 1 ? 'suplente' : 'suplentes'}
          </Insignia>
        </div>
      </div>

      {mensaje && (
        <Aviso tono={mensaje.tono} alCerrar={() => setMensaje(null)}>
          {mensaje.texto}
        </Aviso>
      )}

      {formulario && (
        <FormularioDePiloto
          key={formulario.inicial?.id ?? 'nuevo'}
          inicial={formulario.inicial}
          escuderia={escuderia}
          alCancelar={() => setFormulario(null)}
          alGuardar={(piloto, esEdicion) => {
            setFormulario(null);
            setMensaje({
              tono: 'ok',
              texto: `${piloto.nombre} ${piloto.apellido} ${esEdicion ? 'se actualizó' : 'se agregó a la nómina'}.`,
            });
            cargar();
          }}
        />
      )}

      {pilotos === null ? (
        <Cargando />
      ) : pilotos.length === 0 ? (
        <p className="tarjeta estado-vacio">Todavía no cargaste pilotos en esta escudería.</p>
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
                <th>Última actualización</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {pilotos.map((p) => {
                const otroRol = p.rol === 'TITULAR' ? 'SUPLENTE' : 'TITULAR';
                return (
                  <tr key={p.id}>
                    <td className="numero">
                      <span className="dorsal">{p.numero}</span>
                    </td>
                    <td>
                      <strong>
                        {p.nombre} {p.apellido}
                      </strong>
                    </td>
                    <td>{p.nacionalidad}</td>
                    <td>
                      {formatearFecha(p.fechaNacimiento)} <span className="texto-suave">({edad(p.fechaNacimiento)})</span>
                    </td>
                    <td>
                      <div className="rol-piloto">
                        <Insignia tono={p.rol === 'TITULAR' ? 'ok' : 'neutro'}>{NOMBRE_DE_ROL_PILOTO[p.rol]}</Insignia>
                        <button
                          type="button"
                          className="boton boton--enlace"
                          onClick={() =>
                            ejecutar(
                              () => api('PATCH', `/escuderia/${escuderia.id}/pilotos/${p.id}/rol`, { rol: otroRol }),
                              `${p.nombre} ${p.apellido} ahora es ${NOMBRE_DE_ROL_PILOTO[otroRol].toLowerCase()}.`,
                            )
                          }
                        >
                          Pasar a {NOMBRE_DE_ROL_PILOTO[otroRol].toLowerCase()}
                        </button>
                      </div>
                    </td>
                    <td className="texto-suave">{formatearFechaHora(p.actualizadoEn)}</td>
                    <td>
                      <div className="acciones-en-linea">
                        <button
                          type="button"
                          className="boton boton--claro boton--chico"
                          onClick={() => setFormulario({ inicial: { ...p, numero: String(p.numero) } })}
                        >
                          Editar
                        </button>
                        <BotonConfirmar
                          pregunta="¿Dar de baja?"
                          alConfirmar={() =>
                            ejecutar(
                              () => api('DELETE', `/escuderia/${escuderia.id}/pilotos/${p.id}`),
                              `${p.nombre} ${p.apellido} se dio de baja de la nómina.`,
                            )
                          }
                        >
                          Dar de baja
                        </BotonConfirmar>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
