import { useState } from 'react';
import { abrirDocumento, api } from '../../api.js';
import { TIPOS_DE_REGLAMENTO, formatearFechaHora, formatearTamanio } from '../../formato.js';
import { Aviso, Campo, Cargando, Encabezado, IndicadorEnVivo, Insignia } from '../../componentes/ui.jsx';
import { conFiltros, useCategorias, useListadoEnVivo } from '../../componentes/filtros.jsx';

const MAX_MB = 10;
const PUBLICACION_VACIA = { categoria: '', tipo: 'TECNICO', titulo: '' };

function FormularioDeReglamento({ inicial, categorias, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState(inicial ?? PUBLICACION_VACIA);
  const [archivo, setArchivo] = useState(null);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const esReemplazo = Boolean(inicial);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(evento) {
    evento.preventDefault();
    setErrores({});
    setError(null);
    if (!archivo) {
      setErrores({ documento: 'Hay que adjuntar el reglamento en formato PDF.' });
      return;
    }
    if (archivo.size > MAX_MB * 1024 * 1024) {
      setErrores({ documento: `El documento no puede superar los ${MAX_MB} MB.` });
      return;
    }
    setGuardando(true);
    try {
      const r = await api('POST', conFiltros('/fia/reglamentos', datos), archivo);
      alGuardar(r.reglamento);
    } catch (e) {
      setErrores(e.detalles ?? {});
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="tarjeta formulario formulario--destacado" onSubmit={enviar} noValidate>
      <h2>{esReemplazo ? `Actualizar «${inicial.titulo}»` : 'Publicar reglamento'}</h2>
      {error && <Aviso tono="error">{error}</Aviso>}
      {esReemplazo && (
        <Aviso tono="aviso">La versión nueva reemplaza a la vigente en cuanto se publica: el público deja de ver la anterior.</Aviso>
      )}
      <div className="fila-de-campos">
        <Campo etiqueta="Categoría" id="re-categoria" error={errores.categoria}>
          <select id="re-categoria" value={datos.categoria} onChange={cambiar('categoria')} disabled={esReemplazo}>
            <option value="">Elegí una categoría</option>
            {categorias.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Tipo" id="re-tipo" error={errores.tipo}>
          <select id="re-tipo" value={datos.tipo} onChange={cambiar('tipo')} disabled={esReemplazo}>
            {Object.entries(TIPOS_DE_REGLAMENTO).map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                {nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Título" id="re-titulo" error={errores.titulo}>
        <input id="re-titulo" value={datos.titulo} onChange={cambiar('titulo')} maxLength={150} />
      </Campo>
      <Campo etiqueta={`Documento PDF (hasta ${MAX_MB} MB)`} id="re-documento" error={errores.documento}>
        <input id="re-documento" type="file" accept="application/pdf,.pdf" onChange={(e) => setArchivo(e.target.files[0] ?? null)} />
      </Campo>
      <div className="acciones-en-linea">
        <button className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Publicando…' : 'Publicar'}
        </button>
        <button type="button" className="boton boton--claro" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function agrupar(reglamentos) {
  const grupos = new Map();
  for (const r of reglamentos) {
    const clave = `${r.categoria.codigo}|${r.tipo}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(r);
  }
  return [...grupos.entries()].map(([clave, versiones]) => ({ clave, vigente: versiones[0], versiones }));
}

export default function ReglamentosFia() {
  const categorias = useCategorias();
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const {
    datos: reglamentos,
    error,
    actualizado,
    enVivo,
    recargar,
  } = useListadoEnVivo('/fia/reglamentos', 'reglamentos', 'reglamentos');

  async function abrir(reglamento) {
    try {
      await abrirDocumento(`/fia/reglamentos/${reglamento.id}/documento`);
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }

  return (
    <>
      <Encabezado titulo="Reglamentos" subtitulo="Cada publicación crea una versión nueva y reemplaza automáticamente a la vigente.">
        <IndicadorEnVivo enVivo={enVivo} ultimaActualizacion={actualizado} />
        {!formulario && (
          <button type="button" className="boton boton--primario" onClick={() => setFormulario({ inicial: null })}>
            + Publicar reglamento
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
        <FormularioDeReglamento
          key={formulario.inicial?.titulo ?? 'nuevo'}
          inicial={formulario.inicial}
          categorias={categorias}
          alCancelar={() => setFormulario(null)}
          alGuardar={(r) => {
            setFormulario(null);
            setMensaje({ tono: 'ok', texto: `«${r.titulo}» quedó vigente como versión ${r.version}.` });
            recargar();
          }}
        />
      )}
      {reglamentos === null ? (
        <Cargando />
      ) : reglamentos.length === 0 ? (
        <p className="tarjeta estado-vacio">Todavía no se publicaron reglamentos.</p>
      ) : (
        <ul className="lista-reglamentos">
          {agrupar(reglamentos).map(({ clave, vigente, versiones }) => (
            <li key={clave} className="tarjeta">
              <div className="reglamento">
                <div>
                  <h2>{vigente.titulo}</h2>
                  <div className="resumen">
                    <Insignia tono="info">{vigente.categoria.nombre}</Insignia>
                    <Insignia tono="neutro">{TIPOS_DE_REGLAMENTO[vigente.tipo] ?? vigente.tipo}</Insignia>
                  </div>
                </div>
                <button
                  type="button"
                  className="boton boton--claro"
                  onClick={() =>
                    setFormulario({
                      inicial: { categoria: vigente.categoria.codigo, tipo: vigente.tipo, titulo: vigente.titulo },
                    })
                  }
                >
                  Actualizar
                </button>
              </div>
              <table className="tabla tabla--compacta">
                <thead>
                  <tr>
                    <th>Versión</th>
                    <th>Estado</th>
                    <th>Publicada</th>
                    <th>Por</th>
                    <th>Tamaño</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {versiones.map((v) => (
                    <tr key={v.id}>
                      <td>{v.version}</td>
                      <td>
                        <Insignia tono={v.vigente ? 'ok' : 'neutro'}>{v.vigente ? 'Vigente' : 'Reemplazada'}</Insignia>
                      </td>
                      <td>{formatearFechaHora(v.publicadoEn)}</td>
                      <td>{v.publicadoPor}</td>
                      <td>{formatearTamanio(v.tamanio)}</td>
                      <td>
                        <button type="button" className="boton boton--enlace" onClick={() => abrir(v)}>
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
