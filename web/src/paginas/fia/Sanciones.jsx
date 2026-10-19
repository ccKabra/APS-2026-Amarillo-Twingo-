import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { CLASE_DE_INFRACCION, hoyIso } from '../../formato.js';
import { Aviso, BotonConfirmar, Campo, Cargando, Encabezado, IndicadorEnVivo, Insignia } from '../../componentes/ui.jsx';
import {
  FiltroDeLista,
  conFiltros,
  opcionesDePilotos,
  useEscuderias,
  useFiltros,
  useListadoEnVivo,
  usePilotos,
} from '../../componentes/filtros.jsx';
import { FiltrosDeSanciones, ListaDeSanciones } from '../publico/Sanciones.jsx';

const PENALIZACIONES_SUGERIDAS = [
  'Advertencia',
  'Penalización de 5 segundos',
  'Penalización de 10 segundos',
  'Paso por boxes (drive-through)',
  'Retroceso de 3 puestos en la grilla',
  'Multa de 5.000 €',
  'Descalificación de la sesión',
];

function sancionVacia() {
  return { escuderiaId: '', pilotoId: '', tipoInfraccion: '', fechaInfraccion: hoyIso(), penalizacion: '', descripcion: '' };
}

function useTiposDeInfraccion() {
  const [tipos, setTipos] = useState([]);
  useEffect(() => {
    api('GET', '/publico/sanciones/tipos-infraccion')
      .then((r) => setTipos(r.tipos))
      .catch(() => {});
  }, []);
  return tipos;
}

function textoDeCorreos(correos) {
  if (!correos) return '';
  if (correos.destinatarios.length === 0) return ' La escudería no tiene responsables activos para avisar por correo.';
  return ` Se avisó por correo a ${correos.destinatarios.join(', ')}.`;
}

function FormularioDeSancion({ inicial, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState(inicial ?? sancionVacia());
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const escuderias = useEscuderias();
  const pilotos = usePilotos({ escuderia: datos.escuderiaId });
  const tipos = useTiposDeInfraccion();
  const esEdicion = Boolean(inicial?.id);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  async function guardar(publicar) {
    setGuardando(true);
    setErrores({});
    setError(null);
    try {
      const cuerpo = { ...datos, pilotoId: datos.pilotoId || null, publicar };
      const r = esEdicion
        ? await api('PUT', `/fia/sanciones/${inicial.id}`, cuerpo)
        : await api('POST', '/fia/sanciones', cuerpo);
      alGuardar(r, publicar);
    } catch (e) {
      setErrores(e.detalles ?? {});
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      className="tarjeta formulario formulario--destacado"
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar(false);
      }}
      noValidate
    >
      <h2>{esEdicion ? 'Editar borrador de sanción' : 'Nueva sanción'}</h2>
      {error && <Aviso tono="error">{error}</Aviso>}
      <fieldset>
        <legend>Sancionado</legend>
        <div className="fila-de-campos">
          <Campo etiqueta="Escudería" id="sa-escuderia" error={errores.escuderiaId}>
            <select
              id="sa-escuderia"
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
          <Campo etiqueta="Piloto" id="sa-piloto" error={errores.pilotoId} opcional>
            <select id="sa-piloto" value={datos.pilotoId} onChange={cambiar('pilotoId')} disabled={!datos.escuderiaId}>
              <option value="">Toda la escudería</option>
              {opcionesDePilotos(datos.escuderiaId ? pilotos : [], { conEscuderia: false }).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </fieldset>
      <fieldset>
        <legend>Infracción y penalización</legend>
        <div className="fila-de-campos">
          <Campo etiqueta="Tipo de infracción" id="sa-tipo" error={errores.tipoInfraccion}>
            <select id="sa-tipo" value={datos.tipoInfraccion} onChange={cambiar('tipoInfraccion')}>
              <option value="">Elegí el tipo de infracción</option>
              {Object.entries(CLASE_DE_INFRACCION).map(([clase, nombre]) => (
                <optgroup key={clase} label={`Infracciones ${nombre.toLowerCase()}s`}>
                  {tipos
                    .filter((t) => t.clase === clase)
                    .map((t) => (
                      <option key={t.codigo} value={t.codigo}>
                        {t.nombre}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Fecha de la infracción" id="sa-fecha" error={errores.fechaInfraccion}>
            <input
              id="sa-fecha"
              type="date"
              max={hoyIso()}
              value={datos.fechaInfraccion}
              onChange={cambiar('fechaInfraccion')}
            />
          </Campo>
          <Campo etiqueta="Penalización" id="sa-penalizacion" error={errores.penalizacion}>
            <input
              id="sa-penalizacion"
              list="penalizaciones"
              value={datos.penalizacion}
              onChange={cambiar('penalizacion')}
            />
            <datalist id="penalizaciones">
              {PENALIZACIONES_SUGERIDAS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Campo>
        </div>
        <Campo etiqueta="Descripción" id="sa-descripcion" error={errores.descripcion} ayuda="Qué pasó, en qué sesión y por qué se sanciona.">
          <textarea id="sa-descripcion" rows={4} value={datos.descripcion} onChange={cambiar('descripcion')} />
        </Campo>
      </fieldset>
      <div className="acciones-en-linea">
        <button className="boton boton--claro" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar borrador'}
        </button>
        <BotonConfirmar
          tono="primario"
          chico={false}
          deshabilitado={guardando}
          pregunta="Una vez publicada no se puede modificar. ¿Publicar?"
          alConfirmar={() => guardar(true)}
        >
          Guardar y publicar
        </BotonConfirmar>
        <button type="button" className="boton boton--claro" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function SancionesFia() {
  const [filtros, cambiarFiltros] = useFiltros({ categoria: '', escuderia: '', piloto: '', estado: '' });
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const {
    datos: sanciones,
    error,
    actualizado,
    enVivo,
    recargar,
  } = useListadoEnVivo(conFiltros('/fia/sanciones', filtros), 'sanciones', 'sanciones');

  async function ejecutar(accion, textoOk) {
    setMensaje(null);
    try {
      const r = await accion();
      setMensaje({ tono: 'ok', texto: textoOk + textoDeCorreos(r?.correos) });
      await recargar();
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }

  const borradores = sanciones?.filter((s) => s.estado === 'BORRADOR').length ?? 0;
  const sinFirmar = sanciones?.filter((s) => s.notificacion?.estado === 'NO_ENTERADO').length ?? 0;

  return (
    <>
      <Encabezado
        titulo="Sanciones"
        subtitulo="Registrá las sanciones como borrador y publicalas: la escudería queda notificada y figura como «no enterado» hasta que firme."
      >
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
        {!formulario && (
          <button type="button" className="boton boton--primario" onClick={() => setFormulario({ inicial: null })}>
            + Nueva sanción
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
        <FormularioDeSancion
          key={formulario.inicial?.id ?? 'nueva'}
          inicial={formulario.inicial}
          alCancelar={() => setFormulario(null)}
          alGuardar={(r, publicada) => {
            setFormulario(null);
            setMensaje({
              tono: 'ok',
              texto: publicada
                ? `La sanción a ${r.sancion.escuderia.nombreOficial} se publicó.${textoDeCorreos(r.correos)}`
                : `La sanción a ${r.sancion.escuderia.nombreOficial} quedó guardada como borrador.`,
            });
            recargar();
          }}
        />
      )}
      <FiltrosDeSanciones filtros={filtros} alCambiar={cambiarFiltros}>
        <FiltroDeLista
          etiqueta="Estado"
          valor={filtros.estado}
          alCambiar={(estado) => cambiarFiltros({ estado })}
          opciones={[
            { valor: 'BORRADOR', texto: 'Borradores' },
            { valor: 'PUBLICADA', texto: 'Publicadas' },
          ]}
        />
      </FiltrosDeSanciones>
      {sanciones && (
        <div className="resumen resumen--separado">
          <Insignia tono="info">{sanciones.length} en total</Insignia>
          <Insignia tono="neutro">{borradores} sin publicar</Insignia>
          <Insignia tono={sinFirmar ? 'aviso' : 'ok'}>{sinFirmar} sin firmar por la escudería</Insignia>
        </div>
      )}
      {sanciones === null ? (
        <Cargando />
      ) : (
        <ListaDeSanciones
          sanciones={sanciones}
          acciones={(s) =>
            s.estado === 'BORRADOR' && (
              <>
                <BotonConfirmar
                  tono="primario"
                  pregunta="Una vez publicada no se puede modificar. ¿Publicar?"
                  alConfirmar={() =>
                    ejecutar(
                      () => api('POST', `/fia/sanciones/${s.id}/publicar`),
                      `La sanción a ${s.escuderia.nombreOficial} se publicó.`,
                    )
                  }
                >
                  Publicar
                </BotonConfirmar>
                <button
                  type="button"
                  className="boton boton--claro boton--chico"
                  onClick={() =>
                    setFormulario({
                      inicial: {
                        id: s.id,
                        escuderiaId: String(s.escuderia.id),
                        pilotoId: s.piloto ? String(s.piloto.id) : '',
                        tipoInfraccion: s.tipoInfraccion.codigo,
                        fechaInfraccion: s.fechaInfraccion,
                        penalizacion: s.penalizacion,
                        descripcion: s.descripcion,
                      },
                    })
                  }
                >
                  Editar
                </button>
                <BotonConfirmar
                  pregunta="¿Eliminar el borrador?"
                  alConfirmar={() => ejecutar(() => api('DELETE', `/fia/sanciones/${s.id}`), 'Se eliminó el borrador.')}
                >
                  Eliminar
                </BotonConfirmar>
              </>
            )
          }
        />
      )}
    </>
  );
}
