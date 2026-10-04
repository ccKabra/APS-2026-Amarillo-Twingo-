import { ScrollView, Text, View } from 'react-native';
import { useSesion } from '../sesion';
import { colores, nombreDeRol } from '../tema';
import { Boton, Insignia, estilos } from '../componentes';

function Dato({ etiqueta, children }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: colores.suave, fontWeight: '600', fontSize: 13 }}>{etiqueta}</Text>
      {typeof children === 'string' ? <Text style={{ fontSize: 16 }}>{children}</Text> : children}
    </View>
  );
}

export default function PantallaMiCuenta() {
  const { usuario, cerrarSesion, inactividadMinutos, servidor } = useSesion();
  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <Text style={estilos.titulo}>Mi cuenta</Text>
      <Text style={estilos.subtitulo}>Tu sesión se cierra sola después de {inactividadMinutos} minutos sin actividad.</Text>
      <View style={estilos.tarjeta}>
        <Dato etiqueta="Nombre">{`${usuario.nombre} ${usuario.apellido}`}</Dato>
        <Dato etiqueta="Correo">{usuario.email}</Dato>
        <Dato etiqueta="Tipo de usuario">
          <Insignia tono="info">{nombreDeRol[usuario.rol]}</Insignia>
        </Dato>
        {usuario.rol === 'ESCUDERIA' && (
          <Dato etiqueta="Escuderías a cargo">
            {usuario.escuderias.map((e) => (
              <Text key={e.id} style={{ fontSize: 15 }}>
                • {e.nombreOficial} ({e.categoriaNombre}){e.activa ? '' : ' — dada de baja'}
              </Text>
            ))}
          </Dato>
        )}
        {usuario.rol === 'FIA' && (
          <Text style={{ color: colores.suave, fontSize: 13 }}>
            La administración de cuentas y la auditoría están disponibles en la web.
          </Text>
        )}
      </View>
      <Boton titulo="Cerrar sesión" tipo="peligro" alPresionar={cerrarSesion} />
      <Text style={{ color: colores.suave, fontSize: 12, textAlign: 'center', marginTop: 16 }}>Servidor: {servidor}</Text>
    </ScrollView>
  );
}
