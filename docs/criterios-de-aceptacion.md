# Criterios de aceptación — Sprint 1

Cómo se cumple cada criterio definido por la Comisión Verde Césped, qué prueba automática lo verifica
(`npm test`, carpeta `backend/tests`) y cómo mostrarlo en la demo. Usuarios de demostración en el README.

## US9 — Registro, autenticación y control de acceso por rol

| # | Criterio | Cómo se cumple | Prueba automática | En la demo |
| --- | --- | --- | --- | --- |
| 1 | El sistema distingue los tres tipos de usuario y cada uno accede a una interfaz propia, con funcionalidades distintas y una experiencia visual unificada. | Roles FIA, ESCUDERIA y PUBLICO. Cada uno tiene su menú y su panel (insignia "Panel FIA", "Panel de escudería", "Portal del público") con la misma identidad visual en web y app. | `US9 · Control de acceso por rol` → "cada rol recibe su perfil…" | Ingresar con los tres usuarios de demo y comparar menús. |
| 2 | El público puede registrarse desde la web o la app; las cuentas de escudería y de la FIA solo las crea un administrador de la FIA. | `POST /api/auth/registro` siempre crea rol PUBLICO (ignora cualquier rol enviado). Las cuentas FIA/escudería solo se crean desde `/api/admin` (rol FIA). | `US9 · Registro del público general` (web, app y "no se pueden crear cuentas de escudería ni de la FIA") | Web: "Crear cuenta". App: "Crear una cuenta (público general)". |
| 3 | El registro del público se completa en menos de 15 minutos. | Formulario de 5 campos con validación en el momento; se completa en menos de un minuto e inicia la sesión automáticamente. | — (se mide en la demo) | Cronometrar un registro. |
| 4 | Las contraseñas no se almacenan ni se transmiten en texto plano en ningún punto. | Se guardan derivadas con scrypt; nunca se devuelven en respuestas ni se escriben en logs ni en correos (las cuentas creadas por la FIA se activan con un enlace, ver decisión D5). En producción la API debe publicarse con HTTPS. | "la contraseña no se guarda en texto plano…", "ninguna respuesta de la API incluye la contraseña ni su hash", US8 "el correo no contiene ninguna contraseña" | Mostrar la tabla `usuarios` (por ejemplo con DB Browser for SQLite). |
| 5 | El valor almacenado no permite reconstruir la contraseña original. | scrypt es una función de derivación sin operación inversa. | "…se usa scrypt con sal" | Explicar la decisión D2. |
| 6 | Dos usuarios con la misma contraseña producen valores distintos. | Sal aleatoria de 16 bytes por contraseña. | "dos usuarios con la misma contraseña quedan con valores almacenados distintos" | Los usuarios de demo de escudería comparten contraseña y tienen hashes distintos. |
| 7 | Algoritmo de hashing para contraseñas, documentado por el equipo implementador. | scrypt (N=2^17, r=8, p=1), documentado en `docs/arquitectura.md` (D2) y en `backend/src/lib/passwords.js`. | "…se usa scrypt con sal" | Mostrar la documentación. |
| 8 | Exige longitud mínima y complejidad, y bloquea la cuenta tras un número configurable de intentos fallidos consecutivos. | Mínimo 10 caracteres + mayúscula, minúscula, número y símbolo (lista de requisitos en vivo). Bloqueo tras `MAX_LOGIN_ATTEMPTS` (5) intentos seguidos durante `LOCK_MINUTES` (15); la FIA puede desbloquear. | `US9 · Política y almacenamiento…` (5 casos) y `US9 · Bloqueo por intentos fallidos consecutivos` (6 pruebas) | Equivocar 5 veces la contraseña de publico@demo.test; desbloquear desde Panel FIA → Usuarios. |
| 9 | Quien intenta usar una funcionalidad que no corresponde a su rol recibe un rechazo, desde la interfaz y por llamada directa a la API. | Interfaz: "Acceso denegado". API: middleware `requiereRol` responde 403 y lo registra en la auditoría. | `US9 · Control de acceso por rol` (5 pruebas) | Como escudería, abrir `/fia/escuderias`. Por API: ver comando curl en el guion. |
| 10 | La sesión expira por inactividad y el usuario puede cerrarla manualmente desde ambas plataformas. | Expira a los `SESSION_IDLE_MINUTES` (30) sin actividad, en el servidor y en el cliente. Botón "Cerrar sesión" en la web y en la app. | `US9 · Sesión…` (6 pruebas: inactividad, renovación, cierre web y app, duración máxima) | Con `SESSION_IDLE_MINUTES=1` en `backend/.env`, esperar un minuto sin tocar nada. |

## US8 — Administración de cuentas de escuderías y pilotos

| # | Criterio | Cómo se cumple | Prueba automática | En la demo |
| --- | --- | --- | --- | --- |
| 1 | La FIA crea una cuenta de escudería con sus datos oficiales y el responsable designado. | Panel FIA → Escuderías → "Nueva escudería" (nombre oficial, categoría, país, sede y responsable). | `US8 · Alta de una cuenta de escudería por la FIA` | Crear "Patagonia Racing" en F3. |
| 2 | Al crearse la cuenta, el sistema genera las credenciales y las envía al responsable. | Correo automático con el usuario y un enlace de activación de un solo uso (72 h). Si falla el envío, se puede reenviar. | "el sistema genera las credenciales y se las envía…", "el enlace de activación es de un solo uso", "…vence", "reenviar la activación invalida el enlace anterior" | Panel FIA → Correos: abrir el correo y usar el enlace. |
| 3 | No se permiten dos escuderías con el mismo nombre oficial en una misma categoría ni dos cuentas con el mismo correo. | Validación en la API + restricción `UNIQUE` en la base. El nombre se compara sin mayúsculas, espacios dobles ni tildes. | `US8 · Unicidad de nombre oficial y de correo` (7 pruebas) | Intentar crear "andes racing team" en F1 y repetir un correo. |
| 4 | El responsable inicia sesión con esas credenciales y accede únicamente a la interfaz de escudería. | Tras activar la cuenta ingresa con rol ESCUDERIA; la API rechaza cualquier otra interfaz. | "el responsable activa la cuenta, inicia sesión y accede solo a la interfaz de escudería" | Activar la cuenta creada e ingresar. |
| 5 | Toda alta queda registrada con usuario, fecha y hora. | Tabla `auditoria` (fecha y hora ISO 8601 + usuario + detalle). También quedan modificaciones y bajas. | "toda alta queda registrada en la auditoría…", "la FIA ve el registro de auditoría desde la API" | Panel FIA → Auditoría, filtrar "Alta de escudería". |
| 6 | Un usuario de escudería o del público no accede al módulo de administración de cuentas, ni desde la interfaz ni por API. | Rutas `/api/admin/*` exigen rol FIA; la web muestra "Acceso denegado". | US9 "el público no accede…", "una escudería no accede a las funciones de la FIA" y US8 "…accede solo a la interfaz de escudería" | Igual que US9 #9. |

Además (la historia menciona "modificar y dar de baja"): la FIA puede editar los datos de una escudería, darla de baja o reactivarla,
dar de baja y reactivar usuarios, crear otros administradores FIA y reenviar credenciales (`US8 · Modificación, baja y gestión de usuarios internos`, 8 pruebas).

## US2 — Gestión de nóminas de pilotos por escudería

| # | Criterio | Cómo se cumple | Prueba automática | En la demo |
| --- | --- | --- | --- | --- |
| 1 | La escudería solo puede crear, modificar o dar de baja pilotos de su propia escudería. | Toda operación pasa por el middleware `escuderiaSeleccionada` (escudería asociada a la cuenta y activa) y valida que el piloto pertenezca a ella. | `US2 · La escudería gestiona solo su propia nómina` (5 pruebas) | Ingresar como Andes Racing Team: solo ve y gestiona su nómina. |
| 2 | Permite asignar y cambiar explícitamente el rol del piloto (Titular o Suplente). | Elección obligatoria en el formulario y botón "Pasar a titular / suplente" (`PATCH …/rol`), auditado. | `US2 · Rol del piloto` (2 pruebas) | Cambiar el rol de Mateo Quiroga. |
| 3 | Toda modificación se refleja de forma inmediata en las vistas de la FIA, del público y en la app. | Web pública y nómina FIA: avisos en vivo (SSE) sin recargar. App: se actualiza sola cada 5 s. | `US2 · Los cambios se reflejan de inmediato…` (alta visible al instante, historial de bajas y aviso SSE) | Tener abiertas la vista pública y la app mientras la escudería agrega un piloto. |
| 4 | El formulario valida que los datos obligatorios (nombre, nacionalidad, número, rol, etc.) estén completos antes de guardar. | Datos obligatorios: nombre, apellido, nacionalidad, fecha de nacimiento, número (1–99) y rol. Se validan en el navegador y otra vez en la API. | `US2 · Validaciones del formulario…` | Tocar "Agregar piloto" con el formulario vacío. |
| 5 | Solo pilotos de las escuderías asociadas a su cuenta y sobre la escudería que tenga seleccionada. | Relación N a N cuenta–escudería y selector de escudería (decisión D6). | `US2 · Cuenta con varias escuderías…` (3 pruebas) | Ingresar como diego@pampamotorsport.test (F2 y F3) y cambiar de escudería. |
| 6 | No se puede asignar el mismo número a dos pilotos de una misma categoría. | Índice único `(categoria_id, numero)` para pilotos activos + mensaje que indica quién usa el número. | "no permite asignar un número que ya usa otro piloto…", "el mismo número sí se puede usar en otra categoría", "al dar de baja… su número queda libre" | Intentar cargar el número 7 en Andes Racing Team (lo usa Atlántico GP). |

## Resultado de la última ejecución

```
npm test
ℹ tests 71
ℹ suites 13
ℹ pass 71
ℹ fail 0
```
