import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Marco from './componentes/Marco.jsx';
import Guardia from './componentes/Guardia.jsx';
import { Cargando } from './componentes/ui.jsx';
import { inicioSegunRol, useSesion } from './sesion.jsx';
import { ActivarCuenta, CrearCuenta, IniciarSesion } from './paginas/Acceso.jsx';
import MiCuenta from './paginas/MiCuenta.jsx';
import PilotosPublico from './paginas/publico/Pilotos.jsx';
import { DetalleDeEscuderia, ListaDeEscuderias, NuevaEscuderia } from './paginas/fia/Escuderias.jsx';
import Usuarios from './paginas/fia/Usuarios.jsx';
import { Auditoria, Correos, NominaGeneral } from './paginas/fia/Seguimiento.jsx';
import NominaDeEscuderia from './paginas/escuderia/Nomina.jsx';

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
        <Route
          path="mi-cuenta"
          element={
            <Guardia>
              <MiCuenta />
            </Guardia>
          }
        />
        {}
        <Route path="fia" element={<Guardia roles={['FIA']} />}>
          <Route index element={<Navigate to="escuderias" replace />} />
          <Route path="escuderias" element={<ListaDeEscuderias />} />
          <Route path="escuderias/nueva" element={<NuevaEscuderia />} />
          <Route path="escuderias/:id" element={<DetalleDeEscuderia />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="nomina" element={<NominaGeneral />} />
          <Route path="auditoria" element={<Auditoria />} />
          <Route path="correos" element={<Correos />} />
        </Route>
        {}
        <Route path="escuderia" element={<Guardia roles={['ESCUDERIA']} />}>
          <Route index element={<Navigate to="nomina" replace />} />
          <Route path="nomina" element={<NominaDeEscuderia />} />
        </Route>
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  );
}
