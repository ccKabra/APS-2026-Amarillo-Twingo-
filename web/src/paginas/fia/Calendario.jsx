import { useState } from 'react';
import { api } from '../../api.js';
import { TIPOS_DE_EVENTO } from '../../formato.js';
import { Aviso, BotonConfirmar, Campo, Cargando, Encabezado, IndicadorEnVivo } from '../../componentes/ui.jsx';
import {
  FiltroDeLista,
  NavegadorDeMes,
  PestaniasDeCategoria,
  conFiltros,
  useCategorias,
  useListadoEnVivo,
} from '../../componentes/filtros.jsx';
import { AgendaDeEventos } from '../publico/Calendario.jsx';

const EVENTO_VACIO = { nombre: '', tipo: 'CARRERA', categoria: '', circuito: '', pais: '', fecha: '', hora: '' };

function FormularioDeEvento({ inicial, categorias, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState(inicial ?? EVENTO_VACIO);
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
        ? await api('PUT', `/fia/calendario/${inicial.id}`, cuerpo)
        : await api('POST', '/fia/calendario', cuerpo);
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
      <h2>{esEdicion ? `Editar «${inicial.nombre}»` : 'Nueva fecha del calendario'}</h2>
      {error && <Aviso tono="error">{error}</Aviso>}
      {inicial?.estado === 'OFICIAL' && (
        <Aviso tono="aviso">
          Esta fecha es oficial. Si cambiás el día o la hora, vuelve a figurar como especulativa hasta que se firme de nuevo.
        </Aviso>
      )}
      <div className="fila-de-campos">
        <Campo etiqueta="Nombre del evento" id="ev-nombre" error={errores.nombre}>
          <input id="ev-nombre" value={datos.nombre} onChange={cambiar('nombre')} autoFocus />
        </Campo>
        <Campo etiqueta="Tipo" id="ev-tipo" error={errores.tipo}>
          <select id="ev-tipo" value={datos.tipo} onChange={cambiar('tipo')}>
            {Object.entries(TIPOS_DE_EVENTO).map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                {nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Categoría" id="ev-categoria" error={errores.categoria}>
          <select id="ev-categoria" value={datos.categoria} onChange={cambiar('categoria')}>
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
        <Campo etiqueta="Circuito" id="ev-circuito" error={errores.circuito}>
          <input id="ev-circuito" value={datos.circuito} onChange={cambiar('circuito')} />
        </Campo>
        <Campo etiqueta="País" id="ev-pais" error={errores.pais}>
          <input id="ev-pais" value={datos.pais} onChange={cambiar('pais')} />
        </Campo>
        <Campo etiqueta="Fecha" id="ev-fecha" error={errores.fecha}>
          <input id="ev-fecha" type="date" value={datos.fecha} onChange={cambiar('fecha')} />
        </Campo>
        <Campo etiqueta="Hora local" id="ev-hora" error={errores.hora} opcional>
          <input id="ev-hora" type="time" value={datos.hora} onChange={cambiar('hora')} />
        </Campo>
      </div>
      <p className="campo__ayuda">Las fechas nuevas se publican como especulativas hasta que la FIA las firma como oficiales.</p>
      <div className="acciones-en-linea">
        <button className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Publicar fecha'}
        </button>
        <button type="button" className="boton boton--claro" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function CalendarioFia() {
  const categorias = useCategorias();
  const [categoria, setCategoria] = useState('');
  const [mes, setMes] = useState('');
  const [estado, setEstado] = useState('');
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const {
    datos: eventos,
    error,
    actualizado,
    enVivo,
    recargar,
  } = useListadoEnVivo(conFiltros('/fia/calendario', { categoria, mes, estado }), 'eventos', 'calendario');

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
      <Encabezado
        titulo="Calendario"
        subtitulo="Fechas de carreras y eventos de todas las categorías. Solo la FIA puede firmarlas como oficiales."
      >
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
        <FormularioDeEvento
          key={formulario.inicial?.id ?? 'nuevo'}
          inicial={formulario.inicial}
          categorias={categorias}
          alCancelar={() => setFormulario(null)}
          alGuardar={(r, esEdicion) => {
            setFormulario(null);
            setMensaje({
              tono: r.volvioAEspeculativa ? 'aviso' : 'ok',
              texto: r.volvioAEspeculativa
                ? `«${r.evento.nombre}» cambió de fecha y volvió a figurar como especulativa.`
                : `«${r.evento.nombre}» ${esEdicion ? 'se actualizó' : 'se publicó como fecha especulativa'}.`,
            });
            recargar();
          }}
        />
      )}
      <div className="filtros">
        <PestaniasDeCategoria categorias={categorias} valor={categoria} alCambiar={setCategoria} />
        <NavegadorDeMes mes={mes} alCambiar={setMes} />
        <FiltroDeLista
          etiqueta="Estado"
          valor={estado}
          alCambiar={setEstado}
          opciones={[
            { valor: 'ESPECULATIVA', texto: 'Especulativas' },
            { valor: 'OFICIAL', texto: 'Oficiales' },
          ]}
        />
      </div>
      {eventos === null ? (
        <Cargando />
      ) : (
        <AgendaDeEventos
          eventos={eventos}
          acciones={(e) => (
            <>
              {e.estado === 'ESPECULATIVA' && (
                <BotonConfirmar
                  tono="primario"
                  pregunta="¿Firmar como oficial?"
                  alConfirmar={() =>
                    ejecutar(
                      () => api('POST', `/fia/calendario/${e.id}/oficializar`),
                      `«${e.nombre}» quedó firmada como fecha oficial.`,
                    )
                  }
                >
                  Oficializar
                </BotonConfirmar>
              )}
              <button
                type="button"
                className="boton boton--claro boton--chico"
                onClick={() =>
                  setFormulario({
                    inicial: {
                      id: e.id,
                      estado: e.estado,
                      nombre: e.nombre,
                      tipo: e.tipo,
                      categoria: e.categoria.codigo,
                      circuito: e.circuito,
                      pais: e.pais,
                      fecha: e.fecha,
                      hora: e.hora ?? '',
                    },
                  })
                }
              >
                Editar
              </button>
              <BotonConfirmar
                pregunta="¿Eliminar la fecha?"
                alConfirmar={() =>
                  ejecutar(() => api('DELETE', `/fia/calendario/${e.id}`), `«${e.nombre}» se eliminó del calendario.`)
                }
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
