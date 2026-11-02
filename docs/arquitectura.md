# Arquitectura y decisiones técnicas — Sprints 1, 2 y 3

Proyecto: **Plataforma Integral FIA** (Enunciado 1).
Analistas y management: **Comisión Verde Césped**.
Equipo implementador: Di Meglio Francisco, Cabrera Lautaro, Casal Jeremías y Alzugaray Agustín.

Historias implementadas en el Sprint 1:

| US  | Historia                                              | SP |
| --- | ----------------------------------------------------- | -- |
| 9   | Registro, autenticación y control de acceso por rol   | 5  |
| 8   | Administración de cuentas de escuderías y pilotos     | 5  |
| 2   | Gestión de nóminas de pilotos por escudería           | 3  |

Historias implementadas en el Sprint 2:

| US  | Historia                                              | SP |
| --- | ----------------------------------------------------- | -- |
| 1   | Administración de sanciones                           | 3  |
| 4   | Registro de resultados de controles técnicos          | 5  |
| 10  | Gestión del calendario de carreras y eventos          | 3  |

Historias implementadas en el Sprint 3:

| US  | Historia                                              | SP |
| --- | ----------------------------------------------------- | -- |
| 3   | Consulta y descarga de calendarios                    | 2  |
| 5   | Mensajería FIA-Escudería                              | 8  |
| 7   | Prueba de neumáticos                                  | 2  |
| 12  | Publicación de reglamentos                            | 3  |

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
 │  /api/fia        nómina general, sanciones, inspecciones │
 │                  y calendario (FIA)                      │
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

### D11. Sanciones: borrador, publicación y firma (US1)
- La FIA guarda la sanción como **borrador** (editable y eliminable) y la **publica** cuando está lista; también puede hacer las dos cosas en un paso.
  Una sanción publicada **no se modifica ni se elimina** (es un acto formal); las ediciones quedan en la auditoría.
- Se asocia siempre a una **escudería** y, opcionalmente, a un **piloto** de su nómina activa. Si no tiene piloto, alcanza a toda la escudería.
- Los tipos de infracción son un catálogo en la base (`tipos_infraccion`), separado en **técnicas** y **de carrera**.
- Al publicar se crea el registro de la notificación (`notificaciones_sancion`) y se envía un correo a los responsables de la escudería.
  La sanción figura como **«No enterado»** hasta que un responsable de **esa** escudería la firma desde *Mis sanciones*
  (`POST /api/escuderia/:id/sanciones/:id/firmar`). La firma guarda usuario, fecha y hora, es única y queda auditada.
- La vista pública muestra si la escudería firmó y cuándo; el nombre de quien firmó solo lo ven la FIA y la escudería.

### D12. Controles técnicos: el vehículo se identifica por el número del piloto (US4)
La plataforma no tiene un registro de vehículos: cada auto se identifica por el **número de su piloto** (como en la categoría).
La inspección guarda la escudería y la categoría del vehículo, la fecha (no futura), el tipo de inspección y el estado técnico:
**Aprobado**, **Aprobado con observaciones** o **No aprobado** (en estos dos últimos las observaciones son obligatorias).
Los resultados se publican al guardar; la FIA puede modificarlos o eliminarlos y todo queda en la auditoría.

### D13. Calendario: fechas especulativas y firma de fecha oficial (US10)
Toda fecha nueva se publica como **especulativa**. Solo la FIA puede **firmarla como oficial** (`POST /api/fia/calendario/:id/oficializar`),
lo que guarda quién y cuándo la firmó. Si después se cambia el **día o la hora** de una fecha oficial, vuelve a ser especulativa hasta que se firme
de nuevo (cambiar el nombre, el circuito o el tipo no la afecta). El filtro por mes usa el formato `AAAA-MM`.

### D14. Módulos por historia y avisos en vivo
Cada historia del Sprint 2 tiene su archivo de rutas (`sanciones.js`, `inspecciones.js`, `calendario.js`) con un router público,
uno de la FIA y, para sanciones, uno de escudería. El middleware `escuderiaSeleccionada` pasó a `middleware/autorizacion.js` para compartirlo.
Los cambios públicos se avisan por SSE con los eventos `sanciones`, `inspecciones` y `calendario`, igual que la nómina (D9).

### D15. Calendario público y descarga (US3)
La vista pública ofrece una grilla mensual interactiva y una lista con filtro por rango de fechas (`desde`, `hasta`). La descarga usa
el estándar iCalendar (`.ics`, RFC 5545) porque lo importan Google Calendar, Outlook y Apple Calendar, y respeta los filtros aplicados.
Las fechas especulativas salen como `TENTATIVE` y las oficiales como `CONFIRMED`. La hora se exporta sin huso porque el calendario
guarda la hora local del circuito sin su zona horaria. Duración estimada de cada evento con hora: 2 horas.

### D16. Mensajería cifrada (US5): cifrado en el servidor, homólogo al de extremo a extremo
La historia admite «end-to-end u homólogo». Se eligió **cifrado de sobre en el servidor con AES-256-GCM**:
- Cada conversación (una por escudería) tiene su clave aleatoria, guardada cifrada con una clave maestra que no está en la base
  (`MESSAGES_MASTER_KEY` o `backend/data/mensajeria.key`).
- Cada mensaje usa un IV aleatorio. Conversación, número, emisor, lado y fecha se autentican junto con el texto (AAD): alterar el contenido
  o esos metadatos, o mover un mensaje a otra conversación, hace fallar la verificación y el mensaje se muestra como dañado.
- **Por qué no E2E puro:** los destinatarios son grupos (varios administradores FIA, varias cuentas por escudería), y E2E exigiría
  distribuir claves privadas entre navegadores y dispositivos; quien pierde la clave pierde el historial.
- **Límites conocidos:** quien tenga la clave maestra y la base (o controle el servidor) puede descifrar; por eso no equivale a E2E.
  Borrar los últimos mensajes de una conversación directamente en la base no se detecta. `leido_en` no está autenticado.
  En tránsito la protección depende de publicar la API con HTTPS (igual que las contraseñas, D2).
- La auditoría registra el envío sin el contenido y las respuestas llevan `Cache-Control: no-store`.

### D17. Avisos privados de mensajes (US5)
El canal SSE (D9) es público, y anunciar ahí un mensaje revelaría cuándo se comunica cada escudería con la FIA. Por eso el contador se consulta
cada 5 segundos con autenticación. Esa consulta usa `requiereSesionSinRenovar` para que no cuente como actividad: si contara,
una pestaña abierta impediría que la sesión expire por inactividad en el servidor (US9).

### D18. Pruebas de neumáticos (US7)
Tabla propia con `UNIQUE (anio, numero)` y `numero IN (1, 2)`, de modo que la base garantiza el máximo de 2 fechas por año.
La firma sigue la regla del calendario (D13): cambiar día u hora de una fecha firmada la devuelve a «no oficial».
Son fechas de todo el campeonato, sin categoría, y por eso tienen su propia sección y no aparecen en el calendario de eventos.

### D19. Reglamentos versionados (US12)
Cada publicación agrega una fila con versión correlativa por categoría y tipo (Técnico o Deportivo), en una transacción que retira la vigente.
Un índice único parcial garantiza una sola vigente. El enlace público (`/api/publico/reglamentos/:categoria/:tipo/documento`) no incluye
la versión: siempre entrega la vigente, y las anteriores solo las ve la FIA como historial. El PDF (hasta 10 MB) se guarda como BLOB
en SQLite para que el respaldo sea un único archivo, y se envía como cuerpo binario (`application/pdf`) porque el límite JSON general es de 50 kB.

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
tipos_infraccion (id, codigo*, nombre, clase)                                  clase: TECNICA · CARRERA
sanciones (id, escuderia_id, piloto_id?, categoria_id, tipo_infraccion_id, fecha_infraccion, penalizacion, descripcion,
           estado, creada_en, creada_por, actualizada_en, publicada_en, publicada_por)     estado: BORRADOR · PUBLICADA
notificaciones_sancion (id, sancion_id*, escuderia_id, notificada_en, firmada_en, firmada_por)
inspecciones (id, escuderia_id, piloto_id, categoria_id, fecha, tipo, estado_tecnico, observaciones,
              creada_en, creada_por, actualizada_en, actualizada_por)       estado_tecnico: APROBADO · OBSERVADO · RECHAZADO
eventos_calendario (id, categoria_id, nombre, tipo, circuito, pais, fecha, hora?, estado, creado_en, creado_por,
                    actualizado_en, oficializado_en, oficializado_por)      estado: ESPECULATIVA · OFICIAL
conversaciones (id, escuderia_id*, clave_envuelta, creada_en)
mensajes (id, conversacion_id, numero, emisor_id, emisor_lado, contenido_cifrado, enviado_en, leido_en, leido_por)
pruebas_neumaticos (id, anio, numero, fecha*, hora?, circuito, pais, cronograma?, estado, creada_en, creada_por,
                    actualizada_en, firmada_en, firmada_por)                estado: NO_OFICIAL · OFICIAL
reglamentos (id, categoria_id, tipo, titulo, version, documento, tamanio, sha256, vigente, publicado_en,
             publicado_por, reemplazado_en)                                 tipo: DEPORTIVO · TECNICO
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
| GET | /api/publico/sanciones | — | Sanciones publicadas (filtros `categoria`, `escuderia`, `piloto`) |
| GET | /api/publico/sanciones/tipos-infraccion | — | Catálogo de tipos de infracción |
| GET / POST | /api/fia/sanciones | FIA | Listado (filtros + `estado`) / alta (borrador, o publicada con `publicar: true`) |
| PUT / DELETE | /api/fia/sanciones/:id | FIA | Modificación / eliminación de un borrador |
| POST | /api/fia/sanciones/:id/publicar | FIA | Publicación: crea la notificación y avisa por correo |
| GET | /api/escuderia/:escuderiaId/sanciones | ESCUDERIA | Sanciones publicadas de la escudería seleccionada (filtro `piloto`) |
| POST | /api/escuderia/:escuderiaId/sanciones/:id/firmar | ESCUDERIA | Firma de la notificación («enterado») |
| GET | /api/publico/inspecciones | — | Resultados de controles técnicos (filtros `categoria`, `escuderia`, `estadoTecnico`) |
| POST / PUT / DELETE | /api/fia/inspecciones[/:id] | FIA | Alta / modificación / eliminación de una inspección |
| GET | /api/publico/calendario | — | Fechas del calendario (filtros `categoria`, `mes`=AAAA-MM, `estado`, `desde`, `hasta`) |
| GET | /api/publico/calendario/descargar | — | Descarga en formato `.ics` con los mismos filtros |
| GET / POST | /api/fia/calendario | FIA | Listado con firmante / alta de una fecha (especulativa) |
| PUT / DELETE | /api/fia/calendario/:id | FIA | Modificación / eliminación de una fecha |
| POST | /api/fia/calendario/:id/oficializar | FIA | Firma de fecha oficial |
| GET | /api/fia/mensajes | FIA | Bandeja: escuderías, no leídos y último mensaje |
| GET / POST | /api/fia/mensajes/:escuderiaId | FIA | Historial descifrado / envío |
| POST | /api/fia/mensajes/:escuderiaId/leer | FIA | Marca como leídos los mensajes recibidos |
| GET | /api/fia/mensajes/no-leidos | FIA | Contador de avisos (no renueva la sesión) |
| GET / POST | /api/escuderia/:escuderiaId/mensajes | ESCUDERIA | Historial de la escudería seleccionada / envío |
| POST | /api/escuderia/:escuderiaId/mensajes/leer | ESCUDERIA | Marca como leídos los mensajes recibidos |
| GET | /api/escuderia/mensajes/no-leidos | ESCUDERIA | Contador de avisos de todas sus escuderías (no renueva la sesión) |
| GET | /api/publico/neumaticos | — | Fechas de prueba (filtro `anio`) |
| GET / POST | /api/fia/neumaticos | FIA | Listado con firmante / alta de una fecha (no oficial) |
| PUT / DELETE | /api/fia/neumaticos/:id | FIA | Modificación / eliminación |
| POST | /api/fia/neumaticos/:id/firmar | FIA | Firma de la fecha |
| GET | /api/publico/reglamentos | — | Reglamentos vigentes (filtro `categoria`) |
| GET | /api/publico/reglamentos/:categoria/:tipo/documento | — | PDF de la versión vigente |
| GET | /api/fia/reglamentos | FIA | Todas las versiones |
| POST | /api/fia/reglamentos?categoria&tipo&titulo | FIA | Publica una versión (cuerpo: PDF) y reemplaza la vigente |
| GET | /api/fia/reglamentos/:id/documento | FIA | PDF de cualquier versión |

Los errores tienen siempre el formato `{ "error": "CODIGO", "mensaje": "texto para el usuario", "detalles": { campo: mensaje } }`.

## 5. Pruebas automáticas
`npm test` ejecuta 193 pruebas de integración (`backend/tests`) que levantan la API sobre una base en memoria
y verifican cada criterio de aceptación (ver `criterios-de-aceptacion.md`). Usan un reloj simulado para probar
la expiración por inactividad, la duración máxima de la sesión, el fin del bloqueo y el vencimiento de los enlaces.
