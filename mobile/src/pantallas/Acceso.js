
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { useSesion } from '../sesion';
import { colores, reglasDePassword } from '../tema';
import { Aviso, Boton, Campo, ChecklistPassword, Encabezado, Enlace, estilos } from '../componentes';

function Contenedor({ children }) {
  return (
    <View style={estilos.pantalla}>
      <Encabezado />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function mensajeDeLogin(error) {
  const restantes = error.detalles?.intentosRestantes;
  if (error.codigo === 'CREDENCIALES_INVALIDAS' && restantes !== undefined) {
    return `${error.message} Te ${restantes === 1 ? 'queda 1 intento' : `quedan ${restantes} intentos`} antes de que se bloquee la cuenta.`;
  }
  return error.message;
}

export function PantallaLogin({ irA }) {
  const { iniciarSesion, aviso, servidor } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function ingresar() {
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(email.trim(), password);
    } catch (e) {
      setError({ tono: e.codigo === 'CREDENCIALES_INVALIDAS' ? 'error' : 'aviso', texto: mensajeDeLogin(e) });
      setPassword('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Contenedor>
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>Iniciar sesión</Text>
        <Text style={estilos.subtitulo}>Cada tipo de usuario accede a su propia interfaz.</Text>
        <Aviso tono="info">{aviso}</Aviso>
        {error && <Aviso tono={error.tono}>{error.texto}</Aviso>}
        <Campo
          etiqueta="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
        />
        <Campo
          etiqueta="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          onSubmitEditing={ingresar}
        />
        <Boton
          titulo={enviando ? 'Ingresando…' : 'Ingresar'}
          alPresionar={ingresar}
          deshabilitado={enviando || !email || !password}
        />
      </View>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <Enlace titulo="Crear una cuenta (público general)" alPresionar={() => irA('registro')} />
        <Enlace titulo="Ver la nómina sin iniciar sesión" alPresionar={() => irA('publico')} />
        <Text style={{ color: colores.suave, fontSize: 12, textAlign: 'center' }}>
          Servidor: {servidor}
          {'  '}
        </Text>
        <Enlace titulo="Cambiar servidor" alPresionar={() => irA('servidor')} />
      </View>
    </Contenedor>
  );
}

export function PantallaRegistro({ irA }) {
  const { registrarse } = useSesion();
  const [minLongitud, setMinLongitud] = useState(10);
  const [datos, setDatos] = useState({ nombre: '', apellido: '', email: '', password: '', confirmacion: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api('GET', '/auth/politica-password', undefined, { sinSesion: true })
      .then((p) => setMinLongitud(p.minLongitud))
      .catch(() => {});
  }, []);

  const cambiar = (campo) => (valor) => setDatos({ ...datos, [campo]: valor });
  const cumple = reglasDePassword(datos.password, minLongitud).every((r) => r.cumple);
  const coinciden = datos.password === datos.confirmacion;

  async function crear() {
    setEnviando(true);
    setError(null);
    setErrores({});
    try {
      const { confirmacion, ...cuerpo } = datos;
      void confirmacion;
      await registrarse(cuerpo);
    } catch (e) {
      setErrores(e.detalles ?? {});
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Contenedor>
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>Crear cuenta</Text>
        <Text style={estilos.subtitulo}>
          Registro para el público general. Las cuentas de escuderías y de la FIA las crea la FIA.
        </Text>
        {error && <Aviso tono="error">{error}</Aviso>}
        <Campo etiqueta="Nombre" value={datos.nombre} onChangeText={cambiar('nombre')} error={errores.nombre} />
        <Campo etiqueta="Apellido" value={datos.apellido} onChangeText={cambiar('apellido')} error={errores.apellido} />
        <Campo
          etiqueta="Correo electrónico"
          value={datos.email}
          onChangeText={cambiar('email')}
          error={errores.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Campo
          etiqueta="Contraseña"
          value={datos.password}
          onChangeText={cambiar('password')}
          error={errores.password}
          secureTextEntry
          autoCapitalize="none"
        />
        <ChecklistPassword password={datos.password} minLongitud={minLongitud} />
        <Campo
          etiqueta="Repetí la contraseña"
          value={datos.confirmacion}
          onChangeText={cambiar('confirmacion')}
          secureTextEntry
          autoCapitalize="none"
          error={datos.confirmacion && !coinciden ? 'Las contraseñas no coinciden.' : null}
        />
        <Boton
          titulo={enviando ? 'Creando la cuenta…' : 'Crear cuenta'}
          alPresionar={crear}
          deshabilitado={enviando || !cumple || !coinciden}
        />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Enlace titulo="Ya tengo cuenta: iniciar sesión" alPresionar={() => irA('login')} />
      </View>
    </Contenedor>
  );
}

export function PantallaServidor({ irA }) {
  const { servidor, cambiarServidor } = useSesion();
  const [url, setUrl] = useState(servidor);
  const [estado, setEstado] = useState(null);

  async function probar() {
    setEstado({ tono: 'info', texto: 'Probando la conexión…' });
    try {
      await api('GET', '/salud', undefined, { servidor: url.trim().replace(/\/+$/, ''), sinSesion: true });
      setEstado({ tono: 'ok', texto: 'Conexión correcta con el backend.' });
    } catch (e) {
      setEstado({ tono: 'error', texto: e.message });
    }
  }

  return (
    <Contenedor>
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>Servidor</Text>
        <Text style={estilos.subtitulo}>
          Dirección del backend. Al iniciarlo, la consola de la PC muestra la dirección para la app (por ejemplo
          http:
        </Text>
        {estado && <Aviso tono={estado.tono}>{estado.texto}</Aviso>}
        <Campo etiqueta="URL del servidor" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
        <View style={{ gap: 10 }}>
          <Boton titulo="Probar conexión" tipo="claro" alPresionar={probar} />
          <Boton
            titulo="Guardar"
            alPresionar={async () => {
              await cambiarServidor(url);
              irA('login');
            }}
          />
        </View>
      </View>
      <View style={{ alignItems: 'center' }}>
        <Enlace titulo="Volver" alPresionar={() => irA('login')} />
      </View>
    </Contenedor>
  );
}
