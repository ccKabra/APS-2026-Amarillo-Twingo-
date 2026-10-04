import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ProveedorDeSesion } from './sesion.jsx';
import App from './App.jsx';
import './estilos.css';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorDeSesion>
        <App />
      </ProveedorDeSesion>
    </BrowserRouter>
  </StrictMode>,
);
