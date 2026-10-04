# Guion para la demo del Sprint 1 (martes 6/10)

Duración estimada: 15 minutos. La reunión la conduce la Comisión Verde Césped; nosotros mostramos el incremento.

## Antes de empezar (5 minutos antes)

1. En la carpeta `implementacion`: `npm run reiniciar-datos` y después `npm run demo`.
2. Abrir dos ventanas del navegador:
   - **Ventana A** (normal): http://localhost:3000
   - **Ventana B** (incógnito, para tener otra sesión): http://localhost:3000/pilotos
3. App en el celular: `cd mobile` → `npx expo start` → escanear el QR con Expo Go (misma red Wi-Fi que la PC).
   Si no hay celular a mano: `npx expo start --web` y mostrarla en una ventana angosta.
4. Opcional, para mostrar la expiración por inactividad: crear `backend/.env` con `SESSION_IDLE_MINUTES=1` antes de `npm run demo`.

Usuarios de demostración: ver la tabla del README.

## Recorrido

### 1. Tres interfaces, una misma identidad (US9 · criterio 1) — 2 min
- Ventana B: vista pública de la nómina, sin iniciar sesión. Filtros por categoría.
- Ventana A: ingresar como **FIA** (admin@fia.test). Mostrar la insignia "Panel FIA" y su menú.
- Mencionar que escudería y público tienen su propio panel y menú (se ve en los pasos siguientes).

### 2. Alta de una escudería y envío de credenciales (US8 · criterios 1, 2, 3 y 5) — 3 min
- Escuderías → **Nueva escudería**: tocar "Crear escudería" vacío para mostrar las validaciones.
- Cargar: *Patagonia Racing*, Fórmula 3, Argentina, Neuquén; responsable *Rocío Luna*, rocio.luna@patagonia.test.
- Mostrar el mensaje de éxito → **Ver el correo enviado** (Panel FIA → Correos): usuario + enlace de activación.
  Explicar por qué no se manda una contraseña (decisión D5).
- Intentar crear "andes racing team" en Fórmula 1 → rechazo por nombre repetido en la categoría.
- **Auditoría**: filtrar "Alta de escudería" → usuario, fecha y hora.

### 3. Activación y acceso del responsable (US8 · criterio 4, US9 · criterios 8 y 9) — 2 min
- Abrir el enlace del correo, mostrar la lista de requisitos de la contraseña y activar con `Patagonia#2026`.
- Ingresar como Rocío: entra directo a su **Panel de escudería**.
- Escribir a mano `http://localhost:3000/fia/escuderias` → **Acceso denegado**.
- Llamada directa a la API (PowerShell), para mostrar que el rechazo también ocurre en el servidor:

  ```powershell
  $r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{"email":"martin.rios@andesracing.test","password":"Escuderia#2026"}'
  curl.exe -i -H "Authorization: Bearer $($r.token)" http://localhost:3000/api/admin/escuderias
  # → HTTP/1.1 403 Forbidden  {"error":"ACCESO_DENEGADO", ...}
  ```

### 4. Gestión de la nómina (US2 · criterios 1, 2, 4 y 6) — 3 min
- Ingresar como **martin.rios@andesracing.test** (Andes Racing Team, F1).
- "Agregar piloto" vacío → validación de datos obligatorios.
- Cargar *Bruno Castaño*, Argentina, 10/04/2003, número **7**, Suplente → rechazo: el 7 lo usa Santiago Olivera (Atlántico GP) en F1.
- Cambiar a número **88** y guardar.
- "Pasar a titular" (cambio explícito de rol), "Editar" y "Dar de baja".

### 5. Reflejo inmediato en la vista pública, de la FIA y en la app (US2 · criterio 3) — 2 min
- Dejar a la vista la **Ventana B** (pública) y la **app**, y agregar otro piloto desde la ventana A.
- La ventana B se actualiza sola ("La nómina se actualizó…") y la app lo muestra en pocos segundos.

### 6. Cuenta con varias escuderías (US2 · criterio 5) — 1 min
- Ingresar como **diego@pampamotorsport.test**: tiene Pampa Motorsport en F2 y en F3 → selector "Escudería seleccionada".

### 7. Seguridad de la sesión (US9 · criterios 2, 8 y 10) — 2 min
- En la app: **Crear una cuenta (público general)** → queda en el "Portal del público".
- En la web: equivocar 5 veces la contraseña de publico@demo.test → cuenta bloqueada. Desbloquearla como FIA (Usuarios).
- "Cerrar sesión" en la web y en la app (Mi cuenta).
- Si se configuró `SESSION_IDLE_MINUTES=1`: dejar la web sin tocar un minuto → vuelve al login con "La sesión se cerró por inactividad".

### 8. Pruebas automáticas — 30 s
- `npm test` → 71 pruebas, una o más por cada criterio de aceptación (ver `criterios-de-aceptacion.md`).

## Puntos para validar con Verde Césped

1. **Alcance de la US8.** La historia dice "crear, modificar y dar de baja cuentas y perfiles de escuderías y pilotos",
   pero las tareas y criterios cubren solo el alta. Implementamos además la modificación y la baja/reactivación de escuderías y cuentas.
   Los perfiles de pilotos los gestiona cada escudería (US2). ¿Lo dan por cumplido o prefieren abrir una historia aparte?
2. **Credenciales por correo.** Para no transmitir contraseñas en texto plano (criterio de la US9), el correo lleva un enlace
   de activación de un solo uso en lugar de una contraseña. ¿Están de acuerdo?
3. **Varias escuderías por cuenta.** Los criterios 1 y 5 de la US2 se interpretaron como una cuenta que puede tener una o más escuderías
   y elige con cuál trabajar. ¿Es lo que buscaban?
4. **Datos obligatorios del piloto.** El criterio dice "nombre, nacionalidad, número, rol, etc.". Definimos: nombre, apellido,
   nacionalidad, fecha de nacimiento, número (1 a 99) y rol. ¿Falta alguno?
5. **Reglas no definidas.** Edad válida (usamos entre 14 y 70 años) y cantidad máxima de titulares por escudería (no se limita).
6. **App móvil.** En este sprint la app muestra la nómina (pública, FIA y escudería); la carga y edición de pilotos desde la app
   no estaba entre las tareas. Queda para priorizar en el backlog.
7. **Medición del registro.** "Menos de 15 minutos" se cumple con mucho margen; se podría pedir una meta más exigente.
8. **Tareas no estimadas** (para la retrospectiva): armado inicial del proyecto, integración de envío de correos y preparación de datos para la demo.
   Ver la tabla de horas que les pasamos.
