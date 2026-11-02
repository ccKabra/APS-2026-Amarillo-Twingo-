import { useState } from 'react';
import { api } from '../../api.js';
import { Aviso, BotonConfirmar, Campo, Cargando, Encabezado, IndicadorEnVivo } from '../../componentes/ui.jsx';
import { useListadoEnVivo } from '../../componentes/filtros.jsx';
import { ListaDePruebas } from '../publico/Neumaticos.jsx';

const PRUEBA_VACIA = { fecha: '', hora: '', circuito: '', pais: '', cronograma: '' };

function FormularioDePrueba({ inicial, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState(inicial ?? PRUEBA_VACIA);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const esEdicion = Boolean(inicial?.id);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrores({});
    setError(null);
    try {
      const cuerpo = { ...datos, hora: datos.hora || null };
      const r = esEdicion
        ? await api('PUT', `/fia/neumaticos/${inicial.id}`, cuerpo)
        : await api('POST', '/fia/neumaticos', cuerpo);
      alGuardar(r, esEdicion);
    } catch (e) {
      setErrores(e.detalles ?? {});
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="tarjeta formulario formulario--destacado" onSubmit={enviar} noValidate>
      <h2>{esEdicion ? 'Editar fecha de prueba' : 'Nueva fecha de prueba'}</h2>
      {error && <Aviso tono="error">{error}</Aviso>}
      {inicial?.estado === 'OFICIAL' && (
        <Aviso tono="aviso">
          Esta fecha está firmada. Si cambiás el día o la hora, vuelve a figurar como no oficial hasta que se firme de nuevo.
        </Aviso>
      )}
      <div className="fila-de-campos">
        <Campo etiqueta="Fecha" id="pn-fecha" error={errores.fecha}>
          <input id="pn-fecha" type="date" value={datos.fecha} onChange={cambiar('fecha')} autoFocus />
        </Campo>
        <Campo etiqueta="Hora local" id="pn-hora" error={errores.hora} opcional>
          <input id="pn-hora" type="time" value={datos.hora} onChange={cambiar('hora')} />
        </Campo>
        <Campo etiqueta="Circuito" id="pn-circuito" error={errores.circuito}>
          <input id="pn-circuito" value={datos.circuito} onChange={cambiar('circuito')} />
        </Campo>
        <Campo etiqueta="País" id="pn-pais" error={errores.pais}>
          <input id="pn-pais" value={datos.pais} onChange={cambiar('pais')} />
        </Campo>
      </div>
      <Campo etiqueta="Cronograma" id="pn-cronograma" error={errores.cronograma} opcional>
        <textarea id="pn-cronograma" rows={3} maxLength={1000} value={datos.cronograma} onChange={cambiar('cronograma')} />
      </Campo>
      <p className="campo__ayuda">Se pactan 2 fechas por año. Figuran como no oficiales hasta que la FIA las firma.</p>
      <div className="acciones-en-linea">
        <button className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Cargar fecha'}
        </button>
        <button type="button" className="boton boton--claro" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function NeumaticosFia() {
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const {
    datos: pruebas,
    error,
    actualizado,
    enVivo,
    recargar,
  } = useListadoEnVivo('/fia/neumaticos', 'pruebas', 'neumaticos');

  async function ejecutar(accion, textoOk) {
    setMensaje(null);
    try {
      await accion();
      setMensaje({ tono: 'ok', texto: textoOk });
      await recargar();
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }

  return (
    <>
      <Encabezado titulo="Pruebas de neumáticos" subtitulo="Fechas anuales de prueba. Solo la FIA puede firmarlas como oficiales.">
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
        {!formulario && (
          <button type="button" className="boton boton--primario" onClick={() => setFormulario({ inicial: null })}>
            + Nueva fecha
          </button>
        )}
      </Encabezado>
      {error && <Aviso tono="error">{error}</Aviso>}
      {mensaje && (
        <Aviso tono={mensaje.tono} alCerrar={() => setMensaje(null)}>
          {mensaje.texto}
        </Aviso>
      )}
      {formulario && (
        <FormularioDePrueba
          key={formulario.inicial?.id ?? 'nueva'}
          inicial={formulario.inicial}
          alCancelar={() => setFormulario(null)}
          alGuardar={(r, esEdicion) => {
            setFormulario(null);
            setMensaje({
              tono: r.volvioANoOficial ? 'aviso' : 'ok',
              texto: r.volvioANoOficial
                ? 'La fecha cambió y volvió a figurar como no oficial.'
                : `La fecha ${esEdicion ? 'se actualizó' : 'se cargó como no oficial'}.`,
            });
            recargar();
          }}
        />
      )}
      {pruebas === null ? (
        <Cargando />
      ) : (
        <ListaDePruebas
          pruebas={pruebas}
          acciones={(p) => (
            <>
              {p.estado === 'NO_OFICIAL' && (
                <BotonConfirmar
                  tono="primario"
                  pregunta="¿Firmar como oficial?"
                  alConfirmar={() => ejecutar(() => api('POST', `/fia/neumaticos/${p.id}/firmar`), 'La fecha quedó firmada como oficial.')}
                >
                  Firmar
                </BotonConfirmar>
              )}
              <button
                type="button"
                className="boton boton--claro boton--chico"
                onClick={() =>
                  setFormulario({
                    inicial: {
                      id: p.id,
                      estado: p.estado,
                      fecha: p.fecha,
                      hora: p.hora ?? '',
                      circuito: p.circuito,
                      pais: p.pais,
                      cronograma: p.cronograma ?? '',
                    },
                  })
                }
              >
                Editar
              </button>
              <BotonConfirmar
                pregunta="¿Eliminar la fecha?"
                alConfirmar={() => ejecutar(() => api('DELETE', `/fia/neumaticos/${p.id}`), 'La fecha se eliminó.')}
              >
                Eliminar
              </BotonConfirmar>
            </>
          )}
        />
      )}
    </>
  );
}
