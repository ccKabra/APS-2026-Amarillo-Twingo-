@echo off
rem Levanta toda la Plataforma FIA: API + web (http://localhost:3000) y la app movil (Expo).
rem Uso: doble clic, o "levantar-todo.cmd" desde una terminal.
rem      "levantar-todo.cmd sin-movil"  -> solo API + web.
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>&1 || (
  echo [X] No se encontro Node.js. Instalalo desde https://nodejs.org ^(22.13 o superior^).
  pause & exit /b 1
)

if not exist "backend\node_modules" (
  echo == Instalando dependencias del backend...
  call npm install --prefix backend || goto :error
)
if not exist "web\node_modules" (
  echo == Instalando dependencias de la web...
  call npm install --prefix web || goto :error
)
if /i not "%~1"=="sin-movil" if not exist "mobile\node_modules" (
  echo == Instalando dependencias de la app movil...
  call npm install --prefix mobile || goto :error
)

echo == Compilando la web...
call npm run build --prefix web || goto :error

echo == Cargando datos de demostracion ^(solo si la base esta vacia^)...
call npm run seed --prefix backend -- --si-vacia || goto :error

echo == Iniciando API + web en una ventana nueva...
start "Plataforma FIA - Servidor" cmd /k "set ABRIR_NAVEGADOR=1&& npm start --prefix backend"

if /i not "%~1"=="sin-movil" (
  echo == Iniciando la app movil ^(Expo^) en otra ventana...
  start "Plataforma FIA - App movil" cmd /k "cd /d mobile && npx expo start"
)

echo.
echo Listo. Web: http://localhost:3000
echo App movil: escanear el QR de la ventana de Expo con Expo Go ^(misma red Wi-Fi^).
echo Para cortar: cerrar las ventanas o Ctrl + C en cada una.
exit /b 0

:error
echo.
echo [X] Algo fallo. Revisa los mensajes de arriba.
pause
exit /b 1
