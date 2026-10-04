
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { inicioSegunRol, useSesion } from '../sesion.jsx';
import { Aviso, Campo, Cargando, ChecklistPassword, passwordCumplePolitica, usePoliticaDePassword } from '../componentes/ui.jsx';

function mensajeDeLogin(error) {
  if (error.codigo === 'CREDENCIALES_INVALIDAS' && error.detalles?.intentosRestantes !== undefined) {
    const n = error.detalles.intentosRestantes;
    return `${error.message} Te ${n === 1 ? 'queda 1 intento' : `quedan ${n} intentos`} antes de que se bloquee la cuenta.`;
  }
  return error.message;
}

export function IniciarSesion() {
  const { usuario, iniciarSesion, aviso, limpiarAviso } = useSesion();
  const ubicacion = useLocation();
  const [parametros] = useSearchParams();
  const [email, setEmail] = useState(ubicacion.state?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Con la sesión iniciada se redirige a la página que se quería abrir o al inicio de cada rol.
  if (usuario) {
    const volver = parametros.get('volver');
    return (
      <Navigate to={volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : inicioSegunRol(usuario)} replace />
    );
  }

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(email, password);
    } catch (e) {
      setError({ tono: e.codigo === 'CREDENCIALES_INVALIDAS' ? 'error' : 'aviso', texto: mensajeDeLogin(e) });
      setPassword('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta tarjeta--acceso">
      <h1>Iniciar sesión</h1>
      <p className="texto-suave">Ingresá con tu correo y contraseña. Cada tipo de usuario accede a su propia interfaz.</p>
      <Aviso tono="info" alCerrar={limpiarAviso}>
        {aviso}
      </Aviso>
      <Aviso tono="ok">{ubicacion.state?.mensaje}</Aviso>
      {error && <Aviso tono={error.tono}>{error.texto}</Aviso>}
      <form onSubmit={enviar} noValidate>
        <Campo etiqueta="Correo electrónico" id="email">
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Campo>
        <Campo etiqueta="Contraseña" id="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Campo>
        <button className="boton boton--primario boton--ancho" disabled={enviando || !email || !password}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="acceso__pie">
        ¿Sos parte del público y no tenés cuenta? <Link to="/registro">Creá tu cuenta</Link>
        <br />
        <Link to="/pilotos">Ver la nómina de pilotos sin iniciar sesión</Link>
      </p>
    </section>
  );
}

export function CrearCuenta() {
  const { usuario, registrarse } = useSesion();
  const recienRegistrado = useRef(false);
  const minLongitud = usePoliticaDePassword();
  const [datos, setDatos] = useState({ nombre: '', apellido: '', email: '', password: '', confirmacion: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) {
    return recienRegistrado.current ? (
      <Navigate to="/pilotos" replace state={{ bienvenida: true }} />
    ) : (
      <Navigate to={inicioSegunRol(usuario)} replace />
    );
  }

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const cumple = passwordCumplePolitica(datos.password, minLongitud);
  const coinciden = datos.password === datos.confirmacion;

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    setErrores({});
    try {
      const { confirmacion, ...cuerpo } = datos;
      void confirmacion;
      recienRegistrado.current = true;
      await registrarse(cuerpo);
    } catch (e) {
      recienRegistrado.current = false;
      setErrores(e.detalles ?? {});
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta tarjeta--acceso">
      <h1>Crear cuenta</h1>
      <p className="texto-suave">
        Registro para el público general. Las cuentas de escuderías y de la FIA las crea la administración de la FIA.
      </p>
      {error && <Aviso tono="error">{error}</Aviso>}
      <form onSubmit={enviar} noValidate>
        <div className="fila-de-campos">
          <Campo etiqueta="Nombre" id="nombre" error={errores.nombre}>
            <input id="nombre" value={datos.nombre} onChange={cambiar('nombre')} autoComplete="given-name" autoFocus />
          </Campo>
          <Campo etiqueta="Apellido" id="apellido" error={errores.apellido}>
            <input id="apellido" value={datos.apellido} onChange={cambiar('apellido')} autoComplete="family-name" />
          </Campo>
        </div>
        <Campo etiqueta="Correo electrónico" id="email" error={errores.email}>
          <input id="email" type="email" value={datos.email} onChange={cambiar('email')} autoComplete="email" />
        </Campo>
        <Campo etiqueta="Contraseña" id="password" error={errores.password}>
          <input
            id="password"
            type="password"
            value={datos.password}
            onChange={cambiar('password')}
            autoComplete="new-password"
          />
        </Campo>
        <ChecklistPassword password={datos.password} minLongitud={minLongitud} />
        <Campo
          etiqueta="Repetí la contraseña"
          id="confirmacion"
          error={datos.confirmacion && !coinciden ? 'Las contraseñas no coinciden.' : null}
        >
          <input
            id="confirmacion"
            type="password"
            value={datos.confirmacion}
            onChange={cambiar('confirmacion')}
            autoComplete="new-password"
          />
        </Campo>
        <button className="boton boton--primario boton--ancho" disabled={enviando || !cumple || !coinciden}>
          {enviando ? 'Creando la cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="acceso__pie">
        ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
      </p>
    </section>
  );
}

export function ActivarCuenta() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const token = parametros.get('token') ?? '';
  const minLongitud = usePoliticaDePassword();
  const [estado, setEstado] = useState({ cargando: true });
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api('GET', `/auth/activacion?token=${encodeURIComponent(token)}`)
      .then((cuenta) => setEstado({ cuenta }))
      .catch((e) => setEstado({ error: e }));
  }, [token]);

  if (estado.cargando) return <Cargando texto="Verificando el enlace…" />;
  if (estado.error) {
    return (
      <section className="tarjeta tarjeta--acceso">
        <h1>Activar cuenta</h1>
        <Aviso tono={estado.error.codigo === 'CUENTA_YA_ACTIVADA' ? 'info' : 'error'}>{estado.error.message}</Aviso>
        <Link className="boton boton--primario" to="/login">
          Ir a iniciar sesión
        </Link>
      </section>
    );
  }

  const { cuenta } = estado;
  const cumple = passwordCumplePolitica(password, minLongitud);
  const coinciden = password === confirmacion;

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api('POST', '/auth/activar', { token, password });
      navegar('/login', {
        replace: true,
        state: { email: cuenta.email, mensaje: 'Cuenta activada. Ya podés iniciar sesión con tu nueva contraseña.' },
      });
    } catch (e) {
      setError(e.detalles?.password ?? e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta tarjeta--acceso">
      <h1>Activar cuenta</h1>
      <p className="texto-suave">
        Hola <strong>{cuenta.nombre}</strong>. Definí la contraseña para tu cuenta <strong>{cuenta.email}</strong>.
      </p>
      {error && <Aviso tono="error">{error}</Aviso>}
      <form onSubmit={enviar} noValidate>
        <Campo etiqueta="Contraseña nueva" id="password">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
        </Campo>
        <ChecklistPassword password={password} minLongitud={minLongitud} />
        <Campo
          etiqueta="Repetí la contraseña"
          id="confirmacion"
          error={confirmacion && !coinciden ? 'Las contraseñas no coinciden.' : null}
        >
          <input
            id="confirmacion"
            type="password"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            autoComplete="new-password"
          />
        </Campo>
        <button className="boton boton--primario boton--ancho" disabled={enviando || !cumple || !coinciden}>
          {enviando ? 'Activando…' : 'Activar cuenta'}
        </button>
      </form>
    </section>
  );
}
