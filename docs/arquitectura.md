# Arquitectura y decisiones técnicas — Sprint 1

Proyecto: **Plataforma Integral FIA** (Enunciado 1).
Analistas y management: **Comisión Verde Césped**.
Equipo implementador: Di Meglio Francisco, Cabrera Lautaro, Casal Jeremías y Alzugaray Agustín.

Historias implementadas en el Sprint 1:

| US  | Historia                                              | SP |
| --- | ----------------------------------------------------- | -- |
| 9   | Registro, autenticación y control de acceso por rol   | 5  |
| 8   | Administración de cuentas de escuderías y pilotos     | 5  |
| 2   | Gestión de nóminas de pilotos por escudería           | 3  |

## 1. Vista general

```
 ┌───────────────────────┐        ┌───────────────────────┐
 │  Web (React + Vite)   │        │  App móvil (Expo)     │
 │  FIA · Escudería ·    │        │  Público · Escudería ·│
 │  Público              │        │  FIA                  │
 └──────────┬────────────┘        └──────────┬────────────┘
            │ HTTP/JSON + token Bearer        │
            │ SSE (avisos en vivo)            │ (actualización cada 5 s)
            ▼                                 ▼
 ┌──────────────────────────────────────────────────────────┐
 │ API REST (Node.js + Express 5)                           │
 │  /api/auth       registro, login, renovación, logout     │
 │  /api/admin      cuentas de escuderías y usuarios (FIA)  │
 │  /api/escuderia  nómina de pilotos (escudería)           │
 │  /api/fia        nómina general (FIA)                    │
 │  /api/publico    vistas públicas + eventos en vivo       │
 │  middleware: sesión → rol → escudería seleccionada       │
 └──────────┬──────────────────────────────┬────────────────┘
            ▼                              ▼
 ┌──────────────────────┐        ┌──────────────────────────┐
 │ SQLite (node:sqlite) │        │ Correo: modo desarrollo  │
 │ backend/data/fia.db  │        │ (bandeja) o SMTP         │
 └──────────────────────┘        └──────────────────────────┘
```

- **Backend**: Node.js 22.13+ con Express 5. La base es SQLite usando el módulo `node:sqlite` que ya trae Node: no hay que instalar ningún motor de base de datos.
- **Web**: React 19 + React Router 7, compilada con Vite. En modo demo la sirve el mismo backend (un solo comando).
- **App móvil**: React Native con Expo (SDK 57). Se prueba con Expo Go en el celular o en el navegador.
- **Una sola identidad visual** (colores, encabezado, insignias) y un menú distinto por tipo de usuario.

## 2. Decisiones

### D1. Tres roles y autorización en el backend
Los roles son `FIA`, `ESCUDERIA` y `PUBLICO`. Cada ruta de la API declara qué rol necesita (`requiereSesion` + `requiereRol`).
La interfaz además oculta los menús que no corresponden y muestra "Acceso denegado" si se escribe la URL a mano,
pero **la regla se aplica en el servidor**: una llamada directa a la API sin el rol correcto recibe `403`
y queda registrada en la auditoría (`ACCESO_DENEGADO`).

### D2. Almacenamiento de contraseñas: scrypt
El criterio de aceptación pide "un algoritmo de hashing diseñado específicamente para almacenamiento de contraseñas, documentado por el equipo implementador".
Elegimos **scrypt** (RFC 7914), incluido en `node:crypto` (sin dependencias externas):

| Parámetro | Valor | Motivo |
| --- | --- | --- |
| N (costo) | 2^17 = 131072 | Mínimo recomendado por OWASP para scrypt |
| r (bloque) | 8 | Recomendado por OWASP |
| p (paralelismo) | 1 | Recomendado por OWASP |
| Sal | 16 bytes aleatorios por contraseña | Dos usuarios con la misma contraseña tienen valores distintos |
| Clave derivada | 64 bytes | |

Formato guardado: `scrypt$N$r$p$sal(base64)$clave(base64)`. La verificación usa comparación en tiempo constante (`timingSafeEqual`).
La derivación no tiene operación inversa: el valor guardado no permite reconstruir la contraseña.
Las contraseñas solo viajan del cliente al servidor dentro de la solicitud de login, registro o activación (en producción, siempre sobre HTTPS) y nunca se guardan, se registran en logs ni se devuelven en respuestas.

### D3. Política de contraseñas y bloqueo
- Longitud mínima configurable (`PASSWORD_MIN_LENGTH`, 10 por defecto) + mayúscula, minúscula, número y símbolo.
- Bloqueo tras `MAX_LOGIN_ATTEMPTS` intentos fallidos **consecutivos** (5 por defecto) durante `LOCK_MINUTES` (15 por defecto).
  Un ingreso correcto reinicia el contador. La FIA puede desbloquear una cuenta desde *Usuarios*.

### D4. Sesiones
- Token opaco aleatorio de 256 bits enviado como `Authorization: Bearer`. En la base se guarda solo su hash SHA-256.
- **Expira por inactividad** (`SESSION_IDLE_MINUTES`, 30 por defecto) y tiene una **duración máxima** (`SESSION_MAX_HOURS`, 12).
  La web y la app además cierran la sesión si el usuario no interactúa durante ese tiempo.
- **Renovación** (`POST /api/auth/renovar`): entrega un token nuevo y revoca el anterior. La web y la app la usan al abrirse.
- **Cierre manual** (`POST /api/auth/logout`) desde ambas plataformas. Cambiar la contraseña cierra las demás sesiones.

### D5. Credenciales de las escuderías: enlace de activación (no se envía contraseña)
La US8 pide que "al crearse la cuenta, el sistema genere las credenciales y las envíe al responsable", y la US9 pide que
"las contraseñas no se almacenen ni se transmitan en texto plano en ningún punto". Para cumplir ambos criterios:
el correo lleva el **usuario** (correo electrónico) y un **enlace de activación** de un solo uso, válido por 72 horas,
desde el que el responsable define su propia contraseña. El token del enlace se guarda hasheado; reenviar las credenciales invalida el enlace anterior.
*Este punto conviene validarlo con Verde Césped en la demo.*

### D6. Una cuenta puede tener varias escuderías
La US2 tiene dos criterios: "solo pilotos de su propia escudería" y "de las escuderías asociadas a su cuenta, y sobre la escudería que tenga seleccionada".
El modelo usa una relación N a N `usuario_escuderia`: si la cuenta tiene una sola escudería se comporta como el primer criterio;
si tiene varias (por ejemplo, el mismo equipo en F2 y F3), la interfaz muestra un selector y **cada operación se valida contra la escudería seleccionada**.
Para asociar una escudería nueva a un responsable existente, la FIA marca "Asociar a una cuenta existente" en el alta.

### D7. Reglas de unicidad
- Nombre oficial de escudería único **dentro de cada categoría** (se ignoran mayúsculas, espacios dobles y tildes).
- Correo electrónico único entre todas las cuentas (sin distinguir mayúsculas).
- Número de piloto único **dentro de cada categoría** entre los pilotos activos: lo garantiza un índice único parcial en la base;
  al dar de baja a un piloto su número queda libre. El mismo número puede repetirse en categorías distintas.

### D8. Auditoría
Tabla `auditoria` con fecha y hora (UTC, ISO 8601), usuario, acción, entidad y detalle (JSON con los cambios "antes/después").
Se registran altas, modificaciones y bajas de escuderías, usuarios y pilotos, ingresos exitosos y fallidos, bloqueos y accesos denegados.
Se consulta en *Panel FIA → Auditoría*.

### D9. Reflejo inmediato de los cambios
- Web: la vista pública y la nómina general de la FIA escuchan `GET /api/publico/eventos` (Server-Sent Events) y se recargan solas.
- App: la nómina se actualiza cada 5 segundos mientras la app está abierta (y con "deslizar para actualizar").

### D10. Bajas lógicas
Los pilotos y las escuderías no se borran: se marcan como dados de baja para conservar el historial (la FIA puede verlo).

## 3. Modelo de datos

```
categorias (id, codigo, nombre, orden)                       F1 · F2 · F3 · F1A
usuarios (id, email*, nombre, apellido, rol, password_hash, activo,
          intentos_fallidos, bloqueado_hasta, creado_en, creado_por, activado_en, ultimo_acceso)
sesiones (id, usuario_id, token_hash*, plataforma, creada_en, ultima_actividad, expira_en, revocada_en, motivo_revocacion)
tokens_activacion (id, usuario_id, token_hash*, creado_en, expira_en, usado_en, anulado_en)
escuderias (id, nombre_oficial, nombre_normalizado, categoria_id, pais, sede, activa, creada_en, creada_por, actualizada_en)
           UNIQUE (nombre_normalizado, categoria_id)
usuario_escuderia (usuario_id, escuderia_id, asignado_en, asignado_por)        N a N
pilotos (id, escuderia_id, categoria_id, nombre, apellido, nacionalidad, fecha_nacimiento,
         numero, rol, activo, creado_en, actualizado_en, dado_de_baja_en)
         UNIQUE (categoria_id, numero) WHERE activo = 1
auditoria (id, fecha_hora, usuario_id, usuario_email, accion, entidad, entidad_id, detalle, ip)
correos (id, para, asunto, cuerpo, transporte, estado, error, enviado_en)
```
(*) únicos.

## 4. API

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | /api/auth/politica-password | — | Reglas de la política de contraseñas |
| POST | /api/auth/registro | — | Registro del público general (web o app) |
| POST | /api/auth/login | — | Inicio de sesión (`plataforma`: web o movil) |
| GET | /api/auth/yo | cualquiera | Perfil y datos de la sesión |
| POST | /api/auth/renovar | cualquiera | Renovación de la sesión (token nuevo) |
| POST | /api/auth/logout | cualquiera | Cierre manual de la sesión |
| POST | /api/auth/cambiar-password | cualquiera | Cambio de contraseña |
| GET | /api/auth/activacion?token= | — | Datos de la cuenta a activar |
| POST | /api/auth/activar | — | Activación: el responsable define su contraseña |
| GET | /api/admin/escuderias | FIA | Listado (filtro por categoría) |
| POST | /api/admin/escuderias | FIA | Alta de escudería + responsable + envío de credenciales |
| GET | /api/admin/escuderias/:id | FIA | Detalle con responsables y nómina |
| PATCH | /api/admin/escuderias/:id | FIA | Modificación (nombre, país, sede) |
| POST | /api/admin/escuderias/:id/baja · /reactivar | FIA | Baja lógica y reactivación |
| GET | /api/admin/usuarios | FIA | Cuentas con su estado |
| POST | /api/admin/usuarios-fia | FIA | Alta de otro administrador FIA |
| POST | /api/admin/usuarios/:id/baja · /reactivar · /desbloquear · /reenviar-activacion | FIA | Gestión de cuentas |
| GET | /api/admin/auditoria | FIA | Registro de auditoría |
| GET | /api/admin/correos | FIA | Bandeja de salida |
| GET | /api/fia/pilotos | FIA | Nómina general (opción `incluirBajas`) |
| GET | /api/escuderia/mis-escuderias | ESCUDERIA | Escuderías asociadas a la cuenta |
| GET / POST | /api/escuderia/:escuderiaId/pilotos | ESCUDERIA | Nómina de la escudería seleccionada / alta |
| PUT / DELETE | /api/escuderia/:escuderiaId/pilotos/:id | ESCUDERIA | Modificación / baja |
| PATCH | /api/escuderia/:escuderiaId/pilotos/:id/rol | ESCUDERIA | Cambio de rol Titular ↔ Suplente |
| GET | /api/publico/categorias · /escuderias · /pilotos | — | Vistas públicas |
| GET | /api/publico/eventos | — | Avisos en vivo (SSE) |

Los errores tienen siempre el formato `{ "error": "CODIGO", "mensaje": "texto para el usuario", "detalles": { campo: mensaje } }`.

## 5. Pruebas automáticas
`npm test` ejecuta 71 pruebas de integración (`backend/tests`) que levantan la API sobre una base en memoria
y verifican cada criterio de aceptación (ver `criterios-de-aceptacion.md`). Usan un reloj simulado para probar
la expiración por inactividad, la duración máxima de la sesión, el fin del bloqueo y el vencimiento de los enlaces.
