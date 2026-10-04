import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../sesion.jsx';
import { NOMBRE_DE_ROL } from '../formato.js';


const MENUS = {
  ANONIMO: [{ a: '/pilotos', texto: 'Pilotos' }],
  PUBLICO: [
    { a: '/pilotos', texto: 'Pilotos' },
    { a: '/mi-cuenta', texto: 'Mi cuenta' },
  ],
  ESCUDERIA: [
    { a: '/escuderia/nomina', texto: 'Mi nómina' },
    { a: '/pilotos', texto: 'Vista pública' },
    { a: '/mi-cuenta', texto: 'Mi cuenta' },
  ],
  FIA: [
    { a: '/fia/escuderias', texto: 'Escuderías' },
    { a: '/fia/usuarios', texto: 'Usuarios' },
    { a: '/fia/nomina', texto: 'Nómina general' },
    { a: '/fia/auditoria', texto: 'Auditoría' },
    { a: '/fia/correos', texto: 'Correos' },
    { a: '/mi-cuenta', texto: 'Mi cuenta' },
  ],
};

const ETIQUETA_DE_PANEL = {
  FIA: 'Panel FIA',
  ESCUDERIA: 'Panel de escudería',
  PUBLICO: 'Portal del público',
};

export function Bandera({ tamanio = 30 }) {
  return (
    <svg width={tamanio} height={tamanio} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#d6202f" />
      <g transform="translate(8 7)">
        <rect x="0" y="0" width="2" height="19" rx="1" fill="#fff" />
        <g fill="#fff">
          <rect x="2" y="1" width="4" height="3.5" />
          <rect x="10" y="1" width="4" height="3.5" />
          <rect x="6" y="4.5" width="4" height="3.5" />
          <rect x="14" y="4.5" width="3" height="3.5" />
          <rect x="2" y="8" width="4" height="3.5" />
          <rect x="10" y="8" width="4" height="3.5" />
        </g>
        <g fill="#0f1b2d">
          <rect x="6" y="1" width="4" height="3.5" />
          <rect x="14" y="1" width="3" height="3.5" />
          <rect x="2" y="4.5" width="4" height="3.5" />
          <rect x="10" y="4.5" width="4" height="3.5" />
          <rect x="6" y="8" width="4" height="3.5" />
          <rect x="14" y="8" width="3" height="3.5" />
        </g>
      </g>
    </svg>
  );
}

export default function Marco() {
  const { usuario, cerrarSesion } = useSesion();
  const ubicacion = useLocation();
  const rol = usuario?.rol ?? 'ANONIMO';
  const enPaginaDeAcceso = ['/login', '/registro', '/activar'].includes(ubicacion.pathname);

  return (
    <div className={`app rol-${rol.toLowerCase()}`}>
      <header className="encabezado">
        <div className="encabezado__interior">
          <NavLink to="/" className="marca">
            <Bandera />
            <span className="marca__texto">
              <strong>Plataforma Integral FIA</strong>
              <small>F1 · F2 · F3 · F1 Academy</small>
            </span>
          </NavLink>
          {usuario && <span className={`insignia-panel insignia-panel--${rol.toLowerCase()}`}>{ETIQUETA_DE_PANEL[rol]}</span>}
          <div className="encabezado__usuario">
            {usuario ? (
              <>
                <span className="usuario-actual">
                  <strong>
                    {usuario.nombre} {usuario.apellido}
                  </strong>
                  <small>{NOMBRE_DE_ROL[usuario.rol]}</small>
                </span>
                <button type="button" className="boton boton--claro boton--chico" onClick={cerrarSesion}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              !enPaginaDeAcceso && (
                <>
                  <NavLink to="/login" className="boton boton--claro boton--chico">
                    Iniciar sesión
                  </NavLink>
                  <NavLink to="/registro" className="boton boton--primario boton--chico">
                    Crear cuenta
                  </NavLink>
                </>
              )
            )}
          </div>
        </div>
        <nav className="navegacion" aria-label="Secciones">
          <div className="navegacion__interior">
            {MENUS[rol].map((item) => (
              <NavLink key={item.a} to={item.a} className={({ isActive }) => `navegacion__enlace${isActive ? ' activo' : ''}`}>
                {item.texto}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
      <footer className="pie">Plataforma Integral FIA · Sprint 1 · Proyecto académico APS 2026 (datos ficticios)</footer>
    </div>
  );
}
