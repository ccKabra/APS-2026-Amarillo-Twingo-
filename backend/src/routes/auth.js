
import { Router } from 'express';
import { ErrorDeNegocio, errores } from '../lib/errores.js';
import {
  hashearPassword,
  incumplimientosPassword,
  mensajePolitica,
  reglasPassword,
  verificarPassword,
} from '../lib/passwords.js';
import { hashToken } from '../lib/tokens.js';
import { Validador, normalizarEmail } from '../lib/validacion.js';
import { esViolacionDeUnicidad } from '../db/index.js';
import { sumarMinutos } from '../lib/reloj.js';

function plataformaDe(valor) {
  return valor === 'movil' ? 'movil' : 'web';
}

export function rutasDeAutenticacion(ctx) {
  const { db, config, reloj, sesiones, auditoria, consultas, middlewares } = ctx;
  const { maxIntentos, bloqueoMinutos } = config.login;
  const rutas = Router();

  const buscarPorEmail = db.prepare('SELECT * FROM usuarios WHERE email = ?');
  const buscarPorId = db.prepare('SELECT * FROM usuarios WHERE id = ?');
  const insertarPublico = db.prepare(`
    INSERT INTO usuarios (email, nombre, apellido, rol, password_hash, creado_en, activado_en)
    VALUES (?, ?, ?, 'PUBLICO', ?, ?, ?)`);
  const registrarFallo = db.prepare('UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = NULL WHERE id = ?');
  const bloquear = db.prepare('UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?');
  const registrarExito = db.prepare(
    'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = ? WHERE id = ?',
  );
  const actualizarPassword = db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?');
  const buscarTokenActivacion = db.prepare(`
    SELECT t.id, t.usuario_id, t.expira_en, t.usado_en, t.anulado_en,
           u.email, u.nombre, u.apellido, u.rol, u.password_hash, u.activo
    FROM tokens_activacion t JOIN usuarios u ON u.id = t.usuario_id
    WHERE t.token_hash = ?`);
  const activarCuenta = db.prepare('UPDATE usuarios SET password_hash = ?, activado_en = ? WHERE id = ?');
  const marcarTokenUsado = db.prepare('UPDATE tokens_activacion SET usado_en = ? WHERE id = ?');

  
  const hashDeReferencia = hashearPassword('referencia-no-utilizable', config.scrypt);

  function respuestaDeSesion(usuarioId, sesion) {
    return {
      token: sesion.token,
      sesion: { plataforma: sesion.plataforma, expiraEn: sesion.expiraEn, inactividadMinutos: sesion.inactividadMinutos },
      usuario: consultas.perfil(usuarioId),
    };
  }

  function validarTokenDeActivacion(token) {
    if (typeof token !== 'string' || token.length < 20) {
      throw new ErrorDeNegocio(400, 'ENLACE_INVALIDO', 'El enlace de activación no es válido.');
    }
    const fila = buscarTokenActivacion.get(hashToken(token));
    if (!fila || fila.anulado_en) {
      throw new ErrorDeNegocio(
        400,
        'ENLACE_INVALIDO',
        'El enlace de activación no es válido. Pedile a la FIA que te reenvíe las credenciales.',
      );
    }
    if (fila.usado_en || fila.password_hash) {
      throw new ErrorDeNegocio(
        409,
        'CUENTA_YA_ACTIVADA',
        'Esta cuenta ya fue activada. Iniciá sesión con tu correo y contraseña.',
      );
    }
    if (reloj.ahora() >= new Date(fila.expira_en)) {
      throw new ErrorDeNegocio(
        410,
        'ENLACE_VENCIDO',
        'El enlace de activación venció. Pedile a la FIA que te reenvíe las credenciales.',
      );
    }
    if (!fila.activo) {
      throw new ErrorDeNegocio(403, 'CUENTA_DESHABILITADA', 'La cuenta fue deshabilitada por la FIA.');
    }
    return fila;
  }

  rutas.get('/politica-password', (req, res) => {
    const { minLongitud } = config.password;
    res.json({
      minLongitud,
      reglas: reglasPassword('', minLongitud).map(({ codigo, descripcion }) => ({ codigo, descripcion })),
    });
  });

  // Registro del público general (web o app). Las cuentas FIA y de escudería
  // NO se pueden crear por acá: solo las crea un administrador de la FIA.
  rutas.post('/registro', async (req, res) => {
    const datos = req.body ?? {};
    const v = new Validador();
    const nombre = v.requerido('nombre', datos.nombre, 'Nombre', { max: 60 });
    const apellido = v.requerido('apellido', datos.apellido, 'Apellido', { max: 60 });
    const email = v.email('email', datos.email);
    const fallas = incumplimientosPassword(datos.password, config.password);
    if (fallas.length) v.agregar('password', mensajePolitica(fallas));
    v.lanzarSiHayErrores();

    if (buscarPorEmail.get(email)) {
      throw errores.conflicto('EMAIL_DUPLICADO', 'Ya existe una cuenta con ese correo electrónico.');
    }

    const plataforma = plataformaDe(datos.plataforma);
    const hash = await hashearPassword(datos.password, config.scrypt);
    const ahora = reloj.ahora().toISOString();
    let usuarioId;
    try {
      usuarioId = insertarPublico.run(email, nombre, apellido, hash, ahora, ahora).lastInsertRowid;
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw errores.conflicto('EMAIL_DUPLICADO', 'Ya existe una cuenta con ese correo electrónico.');
      }
      throw error;
    }
    auditoria.registrar({
      usuario: { id: usuarioId, email },
      accion: 'USUARIO_REGISTRO',
      entidad: 'usuario',
      entidadId: usuarioId,
      detalle: { rol: 'PUBLICO', plataforma },
      ip: req.ip,
    });
    const sesion = sesiones.crear(usuarioId, plataforma);
    res.status(201).json(respuestaDeSesion(usuarioId, sesion));
  });

  rutas.post('/login', async (req, res) => {
    const datos = req.body ?? {};
    const email = normalizarEmail(datos.email);
    const password = typeof datos.password === 'string' ? datos.password : '';
    const plataforma = plataformaDe(datos.plataforma);
    if (!email || !password) {
      throw errores.validacion({
        ...(!email && { email: '«Correo electrónico» es un dato obligatorio.' }),
        ...(!password && { password: '«Contraseña» es un dato obligatorio.' }),
      });
    }

    const usuario = buscarPorEmail.get(email);
    const ahora = reloj.ahora();

    if (!usuario) {
      await verificarPassword(password, await hashDeReferencia);
      auditoria.registrar({
        usuario: { email },
        accion: 'LOGIN_FALLIDO',
        detalle: { motivo: 'USUARIO_INEXISTENTE', plataforma },
        ip: req.ip,
      });
      throw new ErrorDeNegocio(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
    }

    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > ahora) {
      const minutos = Math.ceil((new Date(usuario.bloqueado_hasta) - ahora) / 60_000);
      throw new ErrorDeNegocio(
        423,
        'CUENTA_BLOQUEADA',
        `La cuenta está bloqueada por intentos fallidos. Probá de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'} o pedile el desbloqueo a la FIA.`,
        { minutosRestantes: minutos, bloqueadaHasta: usuario.bloqueado_hasta },
      );
    }

    if (!usuario.password_hash) {
      throw new ErrorDeNegocio(
        403,
        'CUENTA_PENDIENTE_ACTIVACION',
        'La cuenta todavía no fue activada. Buscá en tu correo el enlace de activación que te envió la FIA.',
      );
    }

    if (!(await verificarPassword(password, usuario.password_hash))) {
      
      const intentos = (usuario.bloqueado_hasta ? 0 : usuario.intentos_fallidos) + 1;
      if (intentos >= maxIntentos) {
        const hasta = sumarMinutos(ahora, bloqueoMinutos).toISOString();
        bloquear.run(intentos, hasta, usuario.id);
        auditoria.registrar({
          usuario,
          accion: 'CUENTA_BLOQUEADA',
          entidad: 'usuario',
          entidadId: usuario.id,
          detalle: { intentos, hasta },
          ip: req.ip,
        });
        throw new ErrorDeNegocio(
          423,
          'CUENTA_BLOQUEADA',
          `Bloqueamos la cuenta por ${maxIntentos} intentos fallidos seguidos. Probá de nuevo en ${bloqueoMinutos} minutos o pedile el desbloqueo a la FIA.`,
          { minutosRestantes: bloqueoMinutos, bloqueadaHasta: hasta },
        );
      }
      registrarFallo.run(intentos, usuario.id);
      auditoria.registrar({
        usuario,
        accion: 'LOGIN_FALLIDO',
        entidad: 'usuario',
        entidadId: usuario.id,
        detalle: { intentos, plataforma },
        ip: req.ip,
      });
      throw new ErrorDeNegocio(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.', {
        intentosRestantes: maxIntentos - intentos,
      });
    }

    if (!usuario.activo) {
      throw new ErrorDeNegocio(403, 'CUENTA_DESHABILITADA', 'Tu cuenta fue deshabilitada. Comunicate con la FIA.');
    }

    registrarExito.run(ahora.toISOString(), usuario.id);
    const sesion = sesiones.crear(usuario.id, plataforma);
    auditoria.registrar({
      usuario,
      accion: 'LOGIN_OK',
      entidad: 'usuario',
      entidadId: usuario.id,
      detalle: { plataforma },
      ip: req.ip,
    });
    res.json(respuestaDeSesion(usuario.id, sesion));
  });

  rutas.get('/yo', middlewares.requiereSesion, (req, res) => {
    res.json({ usuario: consultas.perfil(req.usuario.id), sesion: req.sesion });
  });

  
  rutas.post('/renovar', middlewares.requiereSesion, (req, res) => {
    const sesion = sesiones.renovar(req.sesion.id, req.usuario.id, req.sesion.plataforma);
    res.json(respuestaDeSesion(req.usuario.id, sesion));
  });

  
  rutas.post('/logout', middlewares.requiereSesion, (req, res) => {
    sesiones.cerrar(req.sesion.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'LOGOUT',
      entidad: 'usuario',
      entidadId: req.usuario.id,
      detalle: { plataforma: req.sesion.plataforma },
      ip: req.ip,
    });
    res.status(204).end();
  });

  rutas.post('/cambiar-password', middlewares.requiereSesion, async (req, res) => {
    const { actual, nueva } = req.body ?? {};
    const usuario = buscarPorId.get(req.usuario.id);
    if (typeof actual !== 'string' || !(await verificarPassword(actual, usuario.password_hash))) {
      throw errores.validacion({ actual: 'La contraseña actual no es correcta.' });
    }
    const fallas = incumplimientosPassword(nueva, config.password);
    if (fallas.length) throw errores.validacion({ nueva: mensajePolitica(fallas) });
    if (nueva === actual) throw errores.validacion({ nueva: 'La contraseña nueva tiene que ser distinta de la actual.' });

    actualizarPassword.run(await hashearPassword(nueva, config.scrypt), usuario.id);
    sesiones.cerrarTodasDeUsuario(usuario.id, 'CAMBIO_DE_PASSWORD', req.sesion.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'PASSWORD_CAMBIADA',
      entidad: 'usuario',
      entidadId: usuario.id,
      ip: req.ip,
    });
    res.json({ mensaje: 'Contraseña actualizada. Se cerraron tus otras sesiones abiertas.' });
  });

  
  rutas.get('/activacion', (req, res) => {
    const fila = validarTokenDeActivacion(req.query.token);
    res.json({ email: fila.email, nombre: fila.nombre, apellido: fila.apellido, rol: fila.rol });
  });

  rutas.post('/activar', async (req, res) => {
    const { token, password } = req.body ?? {};
    const fila = validarTokenDeActivacion(token);
    const fallas = incumplimientosPassword(password, config.password);
    if (fallas.length) throw errores.validacion({ password: mensajePolitica(fallas) });

    const hash = await hashearPassword(password, config.scrypt);
    const ahora = reloj.ahora().toISOString();
    activarCuenta.run(hash, ahora, fila.usuario_id);
    marcarTokenUsado.run(ahora, fila.id);
    auditoria.registrar({
      usuario: { id: fila.usuario_id, email: fila.email },
      accion: 'CUENTA_ACTIVADA',
      entidad: 'usuario',
      entidadId: fila.usuario_id,
      ip: req.ip,
    });
    res.json({ email: fila.email, mensaje: 'Cuenta activada. Ya podés iniciar sesión.' });
  });

  return rutas;
}
