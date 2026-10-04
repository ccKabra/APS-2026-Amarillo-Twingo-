

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProveedorDeSesion, useSesion } from './src/sesion';
import { acentoPorRol } from './src/tema';
import { BarraDePestanias, Cargando, Encabezado, estilos } from './src/componentes';
import { PantallaLogin, PantallaRegistro, PantallaServidor } from './src/pantallas/Acceso';
import PantallaNomina from './src/pantallas/Nomina';
import PantallaMiCuenta from './src/pantallas/MiCuenta';

const MODO_POR_ROL = { FIA: 'fia', ESCUDERIA: 'escuderia', PUBLICO: 'publico' };
const TITULO_NOMINA = { FIA: 'Nómina general', ESCUDERIA: 'Mi nómina', PUBLICO: 'Pilotos' };

function Navegacion() {
  const { listo, usuario, marcarActividad } = useSesion();
  const [pantalla, setPantalla] = useState('login');

  useEffect(() => {
    setPantalla(usuario ? 'nomina' : 'login');
  }, [usuario?.id]); 

  if (!listo) return <Cargando texto="Iniciando…" />;

  if (!usuario) {
    if (pantalla === 'registro') return <PantallaRegistro irA={setPantalla} />;
    if (pantalla === 'servidor') return <PantallaServidor irA={setPantalla} />;
    if (pantalla === 'publico') {
      return (
        <View style={estilos.pantalla}>
          <Encabezado />
          <PantallaNomina modo="publico" alVolver={() => setPantalla('login')} />
        </View>
      );
    }
    return <PantallaLogin irA={setPantalla} />;
  }

  return (
    <View style={estilos.pantalla} onTouchStart={marcarActividad}>
      <Encabezado rol={usuario.rol} usuario={usuario} />
      <View style={{ flex: 1 }}>
        {pantalla === 'cuenta' ? (
          <PantallaMiCuenta />
        ) : (
          <PantallaNomina key={usuario.id} modo={MODO_POR_ROL[usuario.rol]} usuario={usuario} />
        )}
      </View>
      <BarraDePestanias
        acento={acentoPorRol[usuario.rol]}
        activa={pantalla}
        alCambiar={setPantalla}
        pestanias={[
          { clave: 'nomina', titulo: TITULO_NOMINA[usuario.rol], icono: '🏁' },
          { clave: 'cuenta', titulo: 'Mi cuenta', icono: '👤' },
        ]}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ProveedorDeSesion>
        <StatusBar style="light" />
        <Navegacion />
      </ProveedorDeSesion>
    </SafeAreaProvider>
  );
}
