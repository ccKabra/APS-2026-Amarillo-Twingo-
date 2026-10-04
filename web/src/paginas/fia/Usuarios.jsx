
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useSesion } from '../../sesion.jsx';
import { ESTADO_DE_CUENTA, NOMBRE_DE_ROL, formatearFechaHora, formatearHora } from '../../formato.js';
import { Aviso, BotonConfirmar, Campo, Cargando, Encabezado, Insignia } from '../../componentes/ui.jsx';

export default function Usuarios() {
  const { usuario: yo } = useSesion();
  const [rol, setRol] = useState('');
  const [usuarios, setUsuarios] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [alta, setAlta] = useState({ nombre: '', apellido: '', email: '' });
  const [errores, setErrores] = useState({});

  const cargar = useCallback(async () => {
    try {
      const r = await api('GET', `/admin/usuarios${rol ? `?rol=${rol}` : ''}`);
      setUsuarios(r.usuarios);
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }, [rol]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function ejecutar(accion) {
    setMensaje(null);
    try {
      const r = await accion();
      setMensaje({
        tono: 'ok',
        texto: r?.mensaje ?? (r?.correo ? `Se enviaron las credenciales a ${r.correo.para}.` : 'Listo.'),
      });
      await cargar();
    } catch (e) {
      setMensaje({ tono: 'error', texto: e.message });
    }
  }

  async function crearAdministrador(evento) {
    evento.preventDefault();
    setErrores({});
    try {
      const r = await api('POST', '/admin/usuarios-fia', alta);
      setMensaje({ tono: 'ok', texto: `Se creó la cuenta de ${r.usuario.email} y se le enviaron las credenciales.` });
      setAlta({ nombre: '', apellido: '', email: '' });
      setMostrarAlta(false);
      await cargar();
    } catch (e) {
      setErrores(e.detalles ?? {});
      setMensaje({ tono: 'error', texto: e.message });
    }
  }

  return (
    <>
      <Encabezado titulo="Usuarios" subtitulo="Solo la FIA puede crear cuentas de escudería y de administración FIA.">
        <button type="button" className="boton boton--primario" onClick={() => setMostrarAlta(!mostrarAlta)}>
          {mostrarAlta ? 'Cancelar' : '+ Nuevo administrador FIA'}
        </button>
      </Encabezado>
      {mensaje && (
        <Aviso tono={mensaje.tono} alCerrar={() => setMensaje(null)}>
          {mensaje.texto}
        </Aviso>
      )}
      {mostrarAlta && (
        <form className="tarjeta formulario" onSubmit={crearAdministrador} noValidate>
          <h2>Nuevo administrador de la FIA</h2>
          <div className="fila-de-campos fila-de-campos--3">
            <Campo etiqueta="Nombre" id="alta-nombre" error={errores.nombre}>
              <input id="alta-nombre" value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} />
            </Campo>
            <Campo etiqueta="Apellido" id="alta-apellido" error={errores.apellido}>
              <input id="alta-apellido" value={alta.apellido} onChange={(e) => setAlta({ ...alta, apellido: e.target.value })} />
            </Campo>
            <Campo etiqueta="Correo electrónico" id="alta-email" error={errores.email}>
              <input
                id="alta-email"
                type="email"
                value={alta.email}
                onChange={(e) => setAlta({ ...alta, email: e.target.value })}
              />
            </Campo>
          </div>
          <button className="boton boton--primario">Crear y enviar credenciales</button>
        </form>
      )}
      <div className="filtros">
        <label className="filtro">
          Tipo de usuario
          <select value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(NOMBRE_DE_ROL).map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      {usuarios === null ? (
        <Cargando />
      ) : (
        <div className="tabla-contenedor tarjeta">
          <table className="tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Escuderías</th>
                <th>Último acceso</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const estado = ESTADO_DE_CUENTA[u.estado];
                return (
                  <tr key={u.id} className={u.estado === 'DESHABILITADA' ? 'fila--inactiva' : ''}>
                    <td>
                      <strong>
                        {u.nombre} {u.apellido}
                      </strong>
                      <div className="texto-suave">{u.email}</div>
                    </td>
                    <td>{NOMBRE_DE_ROL[u.rol]}</td>
                    <td>
                      <Insignia tono={estado.tono}>{estado.texto}</Insignia>
                      {u.bloqueadaHasta && <div className="texto-suave">hasta las {formatearHora(u.bloqueadaHasta)}</div>}
                    </td>
                    <td>{u.escuderias.map((e) => `${e.nombreOficial} (${e.categoria})`).join(', ') || '—'}</td>
                    <td>{formatearFechaHora(u.ultimoAcceso)}</td>
                    <td>
                      <div className="acciones-en-linea">
                        {u.estado === 'BLOQUEADA' && (
                          <button
                            type="button"
                            className="boton boton--claro boton--chico"
                            onClick={() => ejecutar(() => api('POST', `/admin/usuarios/${u.id}/desbloquear`))}
                          >
                            Desbloquear
                          </button>
                        )}
                        {u.estado === 'PENDIENTE_ACTIVACION' && (
                          <button
                            type="button"
                            className="boton boton--claro boton--chico"
                            onClick={() => ejecutar(() => api('POST', `/admin/usuarios/${u.id}/reenviar-activacion`))}
                          >
                            Reenviar credenciales
                          </button>
                        )}
                        {u.id !== yo.id &&
                          (u.estado === 'DESHABILITADA' ? (
                            <button
                              type="button"
                              className="boton boton--claro boton--chico"
                              onClick={() => ejecutar(() => api('POST', `/admin/usuarios/${u.id}/reactivar`))}
                            >
                              Reactivar
                            </button>
                          ) : (
                            <BotonConfirmar
                              pregunta="¿Dar de baja?"
                              alConfirmar={() => ejecutar(() => api('POST', `/admin/usuarios/${u.id}/baja`))}
                            >
                              Dar de baja
                            </BotonConfirmar>
                          ))}
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
