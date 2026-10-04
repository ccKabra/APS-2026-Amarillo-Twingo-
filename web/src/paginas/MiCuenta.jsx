import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { NOMBRE_DE_ROL } from '../formato.js';
import {
  Aviso,
  Campo,
  ChecklistPassword,
  Encabezado,
  Insignia,
  passwordCumplePolitica,
  usePoliticaDePassword,
} from '../componentes/ui.jsx';

export default function MiCuenta() {
  const { usuario, cerrarSesion, inactividadMinutos } = useSesion();
  const minLongitud = usePoliticaDePassword();
  const [form, setForm] = useState({ actual: '', nueva: '', confirmacion: '' });
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cumple = passwordCumplePolitica(form.nueva, minLongitud);
  const coinciden = form.nueva === form.confirmacion;
  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function cambiarPassword(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErrores({});
    setMensaje(null);
    try {
      const r = await api('POST', '/auth/cambiar-password', { actual: form.actual, nueva: form.nueva });
      setMensaje({ tono: 'ok', texto: r.mensaje });
      setForm({ actual: '', nueva: '', confirmacion: '' });
    } catch (e) {
      setErrores(e.detalles ?? {});
      setMensaje({ tono: 'error', texto: e.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Encabezado
        titulo="Mi cuenta"
        subtitulo={`Tu sesión se cierra sola después de ${inactividadMinutos} minutos sin actividad.`}
      >
        <button type="button" className="boton boton--peligro" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </Encabezado>
      <div className="grilla-2">
        <section className="tarjeta">
          <h2>Mis datos</h2>
          <dl className="datos">
            <dt>Nombre</dt>
            <dd>
              {usuario.nombre} {usuario.apellido}
            </dd>
            <dt>Correo</dt>
            <dd>{usuario.email}</dd>
            <dt>Tipo de usuario</dt>
            <dd>
              <Insignia tono="info">{NOMBRE_DE_ROL[usuario.rol]}</Insignia>
            </dd>
            {usuario.rol === 'ESCUDERIA' && (
              <>
                <dt>Escuderías a cargo</dt>
                <dd>
                  <ul className="lista-simple">
                    {usuario.escuderias.map((e) => (
                      <li key={e.id}>
                        {e.nombreOficial} <span className="texto-suave">· {e.categoriaNombre}</span>
                        {!e.activa && <Insignia tono="neutro">Dada de baja</Insignia>}
                      </li>
                    ))}
                  </ul>
                  <Link to="/escuderia/nomina">Ir a la nómina</Link>
                </dd>
              </>
            )}
          </dl>
        </section>
        <section className="tarjeta">
          <h2>Cambiar contraseña</h2>
          {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
          <form onSubmit={cambiarPassword} noValidate>
            <Campo etiqueta="Contraseña actual" id="actual" error={errores.actual}>
              <input
                id="actual"
                type="password"
                value={form.actual}
                onChange={cambiar('actual')}
                autoComplete="current-password"
              />
            </Campo>
            <Campo etiqueta="Contraseña nueva" id="nueva" error={errores.nueva}>
              <input id="nueva" type="password" value={form.nueva} onChange={cambiar('nueva')} autoComplete="new-password" />
            </Campo>
            <ChecklistPassword password={form.nueva} minLongitud={minLongitud} />
            <Campo
              etiqueta="Repetí la contraseña nueva"
              id="confirmacion"
              error={form.confirmacion && !coinciden ? 'Las contraseñas no coinciden.' : null}
            >
              <input
                id="confirmacion"
                type="password"
                value={form.confirmacion}
                onChange={cambiar('confirmacion')}
                autoComplete="new-password"
              />
            </Campo>
            <button className="boton boton--primario" disabled={enviando || !form.actual || !cumple || !coinciden}>
              {enviando ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
