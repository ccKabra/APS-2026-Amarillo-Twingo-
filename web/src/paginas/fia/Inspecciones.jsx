import { useState } from 'react';
import { api } from '../../api.js';
import { ESTADOS_TECNICOS, TIPOS_DE_INSPECCION, hoyIso } from '../../formato.js';
import { Aviso, BotonConfirmar, Campo, Cargando, Encabezado, IndicadorEnVivo } from '../../componentes/ui.jsx';
import { conFiltros, opcionesDePilotos, useEscuderias, useFiltros, useListadoEnVivo, usePilotos } from '../../componentes/filtros.jsx';
import { FILTROS_DE_INSPECCIONES, FiltrosDeInspecciones, TablaDeInspecciones } from '../publico/Inspecciones.jsx';

function inspeccionVacia() {
  return { escuderiaId: '', pilotoId: '', fecha: hoyIso(), tipo: '', estadoTecnico: 'APROBADO', observaciones: '' };
}

function FormularioDeInspeccion({ inicial, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState(inicial ?? inspeccionVacia());
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const escuderias = useEscuderias();
  const pilotos = usePilotos({ escuderia: datos.escuderiaId });
  const esEdicion = Boolean(inicial?.id);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const vehiculos = opcionesDePilotos(datos.escuderiaId ? pilotos : [], { conEscuderia: false });
  if (esEdicion && datos.pilotoId === inicial.pilotoId && !vehiculos.some((v) => v.valor === inicial.pilotoId)) {
    vehiculos.unshift({ valor: inicial.pilotoId, texto: inicial.vehiculo });
  }

  async function enviar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrores({});
    setError(null);
    try {
      const cuerpo = {
        pilotoId: datos.pilotoId,
        fecha: datos.fecha,
        tipo: datos.tipo,
        estadoTecnico: datos.estadoTecnico,
        observaciones: datos.observaciones,
      };
      const r = esEdicion
        ? await api('PUT', `/fia/inspecciones/${inicial.id}`, cuerpo)
        : await api('POST', '/fia/inspecciones', cuerpo);
      alGuardar(r.inspeccion, esEdicion);
    } catch (e) {
      setErrores(e.detalles ?? {});
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="tarjeta formulario formulario--destacado" onSubmit={enviar} noValidate>
      <h2>{esEdicion ? 'Modificar inspección' : 'Registrar inspección técnica'}</h2>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="fila-de-campos">
        <Campo etiqueta="Escudería" id="in-escuderia" error={errores.escuderiaId}>
          <select
            id="in-escuderia"
            value={datos.escuderiaId}
            onChange={(e) => setDatos({ ...datos, escuderiaId: e.target.value, pilotoId: '' })}
            autoFocus
          >
            <option value="">Elegí una escudería</option>
            {escuderias.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombreOficial} ({e.categoriaNombre})
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Vehículo" id="in-vehiculo" error={errores.pilotoId} ayuda="Se identifica por el número del piloto.">
          <select id="in-vehiculo" value={datos.pilotoId} onChange={cambiar('pilotoId')} disabled={!datos.escuderiaId}>
            <option value="">Elegí el vehículo</option>
            {vehiculos.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="fila-de-campos">
        <Campo etiqueta="Fecha de la inspección" id="in-fecha" error={errores.fecha}>
          <input id="in-fecha" type="date" max={hoyIso()} value={datos.fecha} onChange={cambiar('fecha')} />
        </Campo>
        <Campo etiqueta="Tipo de inspección" id="in-tipo" error={errores.tipo}>
          <select id="in-tipo" value={datos.tipo} onChange={cambiar('tipo')}>
            <option value="">Elegí el tipo</option>
            {Object.entries(TIPOS_DE_INSPECCION).map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                {nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Estado técnico" id="in-estado" error={errores.estadoTecnico}>
        <div className="opciones" role="radiogroup" id="in-estado">
          {Object.entries(ESTADOS_TECNICOS).map(([codigo, e]) => (
            <label key={codigo} className={`opcion${datos.estadoTecnico === codigo ? ' activa' : ''}`}>
              <input
                type="radio"
                name="estadoTecnico"
                value={codigo}
                checked={datos.estadoTecnico === codigo}
                onChange={cambiar('estadoTecnico')}
              />
              {e.texto}
            </label>
          ))}
        </div>
      </Campo>
      <Campo
        etiqueta="Observaciones"
        id="in-observaciones"
        error={errores.observaciones}
        opcional={datos.estadoTecnico === 'APROBADO'}
        ayuda={datos.estadoTecnico === 'APROBADO' ? null : 'Obligatorias si el vehículo no queda aprobado sin observaciones.'}
      >
        <textarea id="in-observaciones" rows={3} value={datos.observaciones} onChange={cambiar('observaciones')} />
      </Campo>
      <div className="acciones-en-linea">
        <button className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar y publicar'}
        </button>
        <button type="button" className="boton boton--claro" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function InspeccionesFia() {
  const [filtros, cambiarFiltros] = useFiltros(FILTROS_DE_INSPECCIONES);
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const {
    datos: inspecciones,
    error,
    actualizado,
    enVivo,
    recargar,
  } = useListadoEnVivo(conFiltros('/publico/inspecciones', filtros), 'inspecciones', 'inspecciones');

  async function eliminar(inspeccion) {
    setMensaje(null);
    try {
      await api('DELETE', `/fia/inspecciones/${inspeccion.id}`);
      setMensaje({ tono: 'ok', texto: `Se eliminó la inspección del vehículo N° ${inspeccion.piloto.numero}.` });
      await recargar();
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }

  return (
    <>
      <Encabezado
        titulo="Controles técnicos"
        subtitulo="Cargá la fecha, el tipo de inspección y el estado técnico de cada vehículo. Los resultados se publican al guardar."
      >
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
        {!formulario && (
          <button type="button" className="boton boton--primario" onClick={() => setFormulario({ inicial: null })}>
            + Registrar inspección
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
        <FormularioDeInspeccion
          key={formulario.inicial?.id ?? 'nueva'}
          inicial={formulario.inicial}
          alCancelar={() => setFormulario(null)}
          alGuardar={(inspeccion, esEdicion) => {
            setFormulario(null);
            setMensaje({
              tono: 'ok',
              texto: `La inspección del vehículo N° ${inspeccion.piloto.numero} (${inspeccion.escuderia.nombreOficial}) ${
                esEdicion ? 'se actualizó' : 'quedó publicada'
              }.`,
            });
            recargar();
          }}
        />
      )}
      <FiltrosDeInspecciones filtros={filtros} alCambiar={cambiarFiltros} />
      {inspecciones === null ? (
        <Cargando />
      ) : (
        <TablaDeInspecciones
          inspecciones={inspecciones}
          acciones={(i) => (
            <>
              <button
                type="button"
                className="boton boton--claro boton--chico"
                onClick={() =>
                  setFormulario({
                    inicial: {
                      id: i.id,
                      escuderiaId: String(i.escuderia.id),
                      pilotoId: String(i.piloto.id),
                      vehiculo: `N° ${i.piloto.numero} · ${i.piloto.nombre} ${i.piloto.apellido}`,
                      fecha: i.fecha,
                      tipo: i.tipo,
                      estadoTecnico: i.estadoTecnico,
                      observaciones: i.observaciones ?? '',
                    },
                  })
                }
              >
                Editar
              </button>
              <BotonConfirmar pregunta="¿Eliminar?" alConfirmar={() => eliminar(i)}>
                Eliminar
              </BotonConfirmar>
            </>
          )}
        />
      )}
    </>
  );
}
