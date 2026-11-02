import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Marco from './componentes/Marco.jsx';
import Guardia from './componentes/Guardia.jsx';
import { Cargando } from './componentes/ui.jsx';
import { inicioSegunRol, useSesion } from './sesion.jsx';
import { ActivarCuenta, CrearCuenta, IniciarSesion } from './paginas/Acceso.jsx';
import MiCuenta from './paginas/MiCuenta.jsx';
import PilotosPublico from './paginas/publico/Pilotos.jsx';
import CalendarioPublico from './paginas/publico/Calendario.jsx';
import SancionesPublicas from './paginas/publico/Sanciones.jsx';
import InspeccionesPublicas from './paginas/publico/Inspecciones.jsx';
import NeumaticosPublico from './paginas/publico/Neumaticos.jsx';
import ReglamentosPublico from './paginas/publico/Reglamentos.jsx';
import { DetalleDeEscuderia, ListaDeEscuderias, NuevaEscuderia } from './paginas/fia/Escuderias.jsx';
import Usuarios from './paginas/fia/Usuarios.jsx';
import { Auditoria, Correos, NominaGeneral } from './paginas/fia/Seguimiento.jsx';
import CalendarioFia from './paginas/fia/Calendario.jsx';
import SancionesFia from './paginas/fia/Sanciones.jsx';
import InspeccionesFia from './paginas/fia/Inspecciones.jsx';
import MensajesFia from './paginas/fia/Mensajes.jsx';
import NeumaticosFia from './paginas/fia/Neumaticos.jsx';
import ReglamentosFia from './paginas/fia/Reglamentos.jsx';
import NominaDeEscuderia from './paginas/escuderia/Nomina.jsx';
import SancionesDeEscuderia from './paginas/escuderia/Sanciones.jsx';
import MensajesDeEscuderia from './paginas/escuderia/Mensajes.jsx';

function Inicio() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <Cargando />;
  return <Navigate to={inicioSegunRol(usuario)} replace />;
}

function NoEncontrado() {
  return (
    <section className="tarjeta tarjeta--centrada estado-vacio">
      <h1>Página no encontrada</h1>
      <Link className="boton boton--primario" to="/">
        Ir al inicio
      </Link>
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Marco />}>
        <Route index element={<Inicio />} />
        <Route path="login" element={<IniciarSesion />} />
        <Route path="registro" element={<CrearCuenta />} />
        <Route path="activar" element={<ActivarCuenta />} />
        <Route path="pilotos" element={<PilotosPublico />} />
        <Route path="calendario" element={<CalendarioPublico />} />
        <Route path="sanciones" element={<SancionesPublicas />} />
        <Route path="controles-tecnicos" element={<InspeccionesPublicas />} />
        <Route path="pruebas-neumaticos" element={<NeumaticosPublico />} />
        <Route path="reglamentos" element={<ReglamentosPublico />} />
        <Route
          path="mi-cuenta"
          element={
            <Guardia>
              <MiCuenta />
            </Guardia>
          }
        />
        <Route path="fia" element={<Guardia roles={['FIA']} />}>
          <Route index element={<Navigate to="escuderias" replace />} />
          <Route path="escuderias" element={<ListaDeEscuderias />} />
          <Route path="escuderias/nueva" element={<NuevaEscuderia />} />
          <Route path="escuderias/:id" element={<DetalleDeEscuderia />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="nomina" element={<NominaGeneral />} />
          <Route path="calendario" element={<CalendarioFia />} />
          <Route path="sanciones" element={<SancionesFia />} />
          <Route path="controles-tecnicos" element={<InspeccionesFia />} />
          <Route path="pruebas-neumaticos" element={<NeumaticosFia />} />
          <Route path="reglamentos" element={<ReglamentosFia />} />
          <Route path="mensajes" element={<MensajesFia />} />
          <Route path="auditoria" element={<Auditoria />} />
          <Route path="correos" element={<Correos />} />
        </Route>
        <Route path="escuderia" element={<Guardia roles={['ESCUDERIA']} />}>
          <Route index element={<Navigate to="nomina" replace />} />
          <Route path="nomina" element={<NominaDeEscuderia />} />
          <Route path="sanciones" element={<SancionesDeEscuderia />} />
          <Route path="mensajes" element={<MensajesDeEscuderia />} />
        </Route>
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  );
}
