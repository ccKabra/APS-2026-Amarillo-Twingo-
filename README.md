# Plataforma Integral FIA — Sprint 1

Implementación del Sprint 1 del proyecto del **Enunciado 1 (FIA)**, planificado por la **Comisión Verde Césped**
(analistas y management) y desarrollado por el equipo implementador: Di Meglio Francisco, Cabrera Lautaro,
Casal Jeremías y Alzugaray Agustín.

| US  | Historia                                              | Estado     |
| --- | ----------------------------------------------------- | ---------- |
| 9   | Registro, autenticación y control de acceso por rol   | Terminada  |
| 8   | Administración de cuentas de escuderías y pilotos     | Terminada  |
| 2   | Gestión de nóminas de pilotos por escudería           | Terminada  |

Incluye: API (Node.js + Express + SQLite), web (React) con las interfaces de FIA, escuderías y público,
app móvil (React Native + Expo) y 71 pruebas automáticas, una o más por cada criterio de aceptación.

## Requisitos

- **Node.js 22.13 o superior** (recomendado: la versión LTS actual desde https://nodejs.org). Verificar con `node -v`.
- Para la app móvil: la app **Expo Go** en el celular (Android o iOS), conectado a la **misma red Wi-Fi** que la PC.

No hace falta instalar ninguna base de datos: se usa SQLite integrado en Node.js.

## Puesta en marcha rápida (demo)

**En Windows, lo más simple:** doble clic en **`iniciar-demo.cmd`**. La primera vez instala las dependencias;
después compila la web, carga los datos de demostración, levanta el servidor y abre el navegador en http://localhost:3000.
Para la app móvil, con la demo corriendo, doble clic en **`iniciar-app-movil.cmd`**.

O desde una terminal (PowerShell o CMD), dentro de esta carpeta:

```powershell
npm run instalar     # solo la primera vez: instala backend y web
npm run demo         # compila la web, carga datos de demostración y levanta todo
```

Abrir **http://localhost:3000**. Para cortar: `Ctrl + C`.
Para volver los datos al estado inicial: cortar el servidor, `npm run reiniciar-datos` y de nuevo `npm run demo`.

> La primera vez Windows puede preguntar si permite el acceso de Node.js a la red: aceptar (lo necesita la app del celular).

### Usuarios de demostración (datos ficticios)

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administración FIA | admin@fia.test | FiaAdmin#2026 |
| Escudería (Andes Racing Team, F1) | martin.rios@andesracing.test | Escuderia#2026 |
| Escudería (Atlántico Grand Prix, F1) | sofia.pereyra@atlanticogp.test | Escuderia#2026 |
| Escudería con dos escuderías (Pampa Motorsport, F2 y F3) | diego@pampamotorsport.test | Escuderia#2026 |
| Escudería (Aurora Racing, F1 Academy) | valentina.ortiz@auroraracing.test | Escuderia#2026 |
| Público general | publico@demo.test | Publico#2026 |

La escudería *Cordillera Motorsport* (F2) tiene la cuenta de su responsable **pendiente de activación**:
el enlace está en *Panel FIA → Correos*.

## App móvil

```powershell
cd mobile
npm install          # solo la primera vez
npx expo start
```

- Escanear el código QR con **Expo Go** (Android) o con la cámara (iOS).
- La app propone como servidor la IP de la PC (la misma que usa Expo). Si no conecta, en la pantalla de inicio tocar
  **Cambiar servidor** y poner la dirección que muestra la consola del backend al arrancar (por ejemplo `http://192.168.0.15:3000`).
- Sin celular: `npx expo start --web` abre la app en el navegador.

El backend tiene que estar corriendo (`npm run demo` en otra terminal).

## Modo desarrollo

Dos terminales:

```powershell
npm run dev:backend   # API en http://localhost:3000 (se reinicia sola al guardar cambios)
npm run dev:web       # web en http://localhost:5173 (recarga en caliente)
```

La primera vez, cargar los datos: `npm run reiniciar-datos`.

## Pruebas automáticas

```powershell
npm test
```

Ejecuta 71 pruebas de integración sobre una base en memoria (no tocan los datos de la demo).
Cada prueba está nombrada según el criterio de aceptación que verifica: ver `docs/criterios-de-aceptacion.md`.

## Configuración

Todo es opcional. Copiar `backend/.env.example` como `backend/.env` y cambiar lo necesario:

| Variable | Por defecto | Para qué sirve |
| --- | --- | --- |
| `PORT` | 3000 | Puerto de la API y de la web |
| `PASSWORD_MIN_LENGTH` | 10 | Longitud mínima de contraseña |
| `MAX_LOGIN_ATTEMPTS` | 5 | Intentos fallidos seguidos antes de bloquear la cuenta |
| `LOCK_MINUTES` | 15 | Duración del bloqueo |
| `SESSION_IDLE_MINUTES` | 30 | Minutos sin actividad hasta que se cierra la sesión (poner 1 para mostrarlo en la demo) |
| `SESSION_MAX_HOURS` | 12 | Duración máxima de una sesión |
| `ACTIVATION_HOURS` | 72 | Validez del enlace de activación |
| `MAIL_TRANSPORT` | desarrollo | `desarrollo`: los correos se ven en Panel FIA → Correos. `smtp`: se envían de verdad |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | — | Datos del servidor de correo si `MAIL_TRANSPORT=smtp` |

## Estructura

```
implementacion/
├── backend/            API REST (Node.js + Express 5 + SQLite)
│   ├── src/
│   │   ├── routes/     auth (US9) · admin (US8) · escuderia (US2) · fia · publico
│   │   ├── lib/        contraseñas, sesiones, auditoría, correo, eventos en vivo, validaciones
│   │   ├── middleware/ autenticación y autorización por rol
│   │   └── db/         esquema, datos de demostración
│   └── tests/          pruebas por historia de usuario
├── web/                interfaz web (React + Vite)
│   └── src/paginas/    fia/ · escuderia/ · publico/ · acceso y mi cuenta
├── mobile/             app móvil (React Native + Expo)
└── docs/
    ├── arquitectura.md            decisiones técnicas, modelo de datos y API
    ├── criterios-de-aceptacion.md cómo se cumple y se prueba cada criterio
    └── guion-demo.md              recorrido sugerido para la demo y puntos a validar
```

## Problemas frecuentes

- **`No such built-in module: node:sqlite`**: la versión de Node.js es anterior a 22.13. Actualizarla.
- **`EADDRINUSE: address already in use :::3000`**: ya hay otra copia corriendo. Cerrarla o usar `PORT=3001` en `backend/.env`.
- **La app no conecta**: el celular y la PC tienen que estar en la misma red; revisar la dirección en *Cambiar servidor*
  y que el firewall de Windows permita a Node.js recibir conexiones en redes privadas.
- **La web muestra una página vieja**: volver a correr `npm run demo` (compila la web de nuevo).

