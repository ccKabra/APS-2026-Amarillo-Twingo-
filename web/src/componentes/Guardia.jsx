import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { inicioSegunRol, useSesion } from '../sesion.jsx';
import { Cargando } from './ui.jsx';



export default function Guardia({ roles, children }) {
  const { usuario, cargando } = useSesion();
  const ubicacion = useLocation();

  if (cargando) return <Cargando />;
  if (!usuario) {
    const volver = encodeURIComponent(ubicacion.pathname + ubicacion.search);
    return <Navigate to={`/login?volver=${volver}`} replace />;
  }
  if (roles && !roles.includes(usuario.rol)) return <AccesoDenegado inicio={inicioSegunRol(usuario)} />;
  return children ?? <Outlet />;
}

export function AccesoDenegado({ inicio = '/' }) {
  return (
    <section className="tarjeta tarjeta--centrada estado-vacio">
      <div className="estado-vacio__icono" aria-hidden="true">
        ⛔
      </div>
      <h1>Acceso denegado</h1>
      <p>Tu tipo de usuario no tiene permisos para usar esta sección.</p>
      <Link className="boton boton--primario" to={inicio}>
        Ir a mi inicio
      </Link>
    </section>
  );
}
