import { Router } from 'express';
import { ErrorDeNegocio, errores } from '../lib/errores.js';
import { Validador, normalizarNombre, texto } from '../lib/validacion.js';
import { enTransaccion, esViolacionDeUnicidad } from '../db/index.js';
import { generarToken, hashToken } from '../lib/tokens.js';
import { sumarMinutos } from '../lib/reloj.js';
import { aEscuderia, estadoDeCuenta } from '../lib/consultas.js';
import * as plantillas from '../lib/plantillas.js';

function idDe(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw errores.noEncontrado();
  return n;
}

export function rutasDeAdministracion(ctx) {
  const { db, config, reloj, sesiones, auditoria, correo, eventos, consultas } = ctx;
  const rutas = Router();

  const sqlEscuderia = `
    SELECT e.id, e.nombre_oficial, e.pais, e.sede, e.activa, e.creada_en, e.actualizada_en,
           c.codigo AS categoria, c.nombre AS categoria_nombre,
           (SELECT COUNT(*) FROM pilotos p WHERE p.escuderia_id = e.id AND p.activo = 1) AS pilotos,
           cu.email AS creada_por_email
    FROM escuderias e
    JOIN categorias c ON c.id = e.categoria_id
    LEFT JOIN usuarios cu ON cu.id = e.creada_por`;
  const listarEscuderias = db.prepare(`${sqlEscuderia}
    WHERE (? IS NULL OR c.codigo = ?)
    ORDER BY c.orden, e.nombre_oficial COLLATE NOCASE`);
  const escuderiaPorId = db.prepare(`${sqlEscuderia} WHERE e.id = ?`);
  const escuderiaPorNombre = db.prepare(
    'SELECT id FROM escuderias WHERE nombre_normalizado = ? AND categoria_id = ? AND id <> ?',
  );
  const responsablesDe = db.prepare(`
    SELECT u.id, u.nombre, u.apellido, u.email, u.activo, u.password_hash, u.bloqueado_hasta
    FROM usuario_escuderia ue JOIN usuarios u ON u.id = ue.usuario_id
    WHERE ue.escuderia_id = ?
    ORDER BY u.apellido, u.nombre`);
  const pilotosDe = db.prepare(`
    SELECT id, nombre, apellido, nacionalidad, numero, rol, fecha_nacimiento
    FROM pilotos WHERE escuderia_id = ? AND activo = 1
    ORDER BY CASE rol WHEN 'TITULAR' THEN 0 ELSE 1 END, numero`);
  const insertarEscuderia = db.prepare(`
    INSERT INTO escuderias (nombre_oficial, nombre_normalizado, categoria_id, pais, sede, creada_en, creada_por, actualizada_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const actualizarEscuderia = db.prepare(`
    UPDATE escuderias SET nombre_oficial = ?, nombre_normalizado = ?, pais = ?, sede = ?, actualizada_en = ? WHERE id = ?`);
  const cambiarEstadoEscuderia = db.prepare('UPDATE escuderias SET activa = ?, actualizada_en = ? WHERE id = ?');

  const usuarioPorEmail = db.prepare('SELECT * FROM usuarios WHERE email = ?');
  const usuarioPorId = db.prepare('SELECT * FROM usuarios WHERE id = ?');
  const insertarUsuarioInterno = db.prepare(`
    INSERT INTO usuarios (email, nombre, apellido, rol, password_hash, creado_en, creado_por)
    VALUES (?, ?, ?, ?, NULL, ?, ?)`);
  const asociar = db.prepare(`
    INSERT OR IGNORE INTO usuario_escuderia (usuario_id, escuderia_id, asignado_en, asignado_por) VALUES (?, ?, ?, ?)`);
  const anularTokens = db.prepare(
    'UPDATE tokens_activacion SET anulado_en = ? WHERE usuario_id = ? AND usado_en IS NULL AND anulado_en IS NULL',
  );
  const insertarToken = db.prepare(
    'INSERT INTO tokens_activacion (usuario_id, token_hash, creado_en, expira_en) VALUES (?, ?, ?, ?)',
  );
  const listarUsuarios = db.prepare(`
    SELECT id, email, nombre, apellido, rol, activo, password_hash, bloqueado_hasta, intentos_fallidos, creado_en, ultimo_acceso
    FROM usuarios WHERE (? IS NULL OR rol = ?)
    ORDER BY CASE rol WHEN 'FIA' THEN 0 WHEN 'ESCUDERIA' THEN 1 ELSE 2 END, apellido, nombre`);
  const cambiarEstadoUsuario = db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?');
  const desbloquear = db.prepare('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?');
  const listarAuditoria = db.prepare(`
    SELECT id, fecha_hora, usuario_id, usuario_email, accion, entidad, entidad_id, detalle
    FROM auditoria WHERE (? IS NULL OR accion = ?)
    ORDER BY id DESC LIMIT ?`);
  const accionesAuditadas = db.prepare('SELECT DISTINCT accion FROM auditoria ORDER BY accion');
  const listarCorreos = db.prepare(
    'SELECT id, para, asunto, cuerpo, transporte, estado, error, enviado_en FROM correos ORDER BY id DESC LIMIT ?',
  );

  function aResponsable(u) {
    return {
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      estado: estadoDeCuenta(u, reloj.ahora()),
    };
  }

  function detalleDeEscuderia(id) {
    const fila = escuderiaPorId.get(id);
    if (!fila) throw errores.noEncontrado('No existe esa escudería.');
    return {
      ...aEscuderia(fila),
      cantidadPilotos: fila.pilotos,
      creadaEn: fila.creada_en,
      creadaPor: fila.creada_por_email,
      actualizadaEn: fila.actualizada_en,
      responsables: responsablesDe.all(id).map(aResponsable),
    };
  }

  function nuevoEnlaceDeActivacion(usuarioId, ahora) {
    const token = generarToken();
    const expira = sumarMinutos(ahora, config.activacion.validezHoras * 60);
    anularTokens.run(ahora.toISOString(), usuarioId);
    insertarToken.run(usuarioId, hashToken(token), ahora.toISOString(), expira.toISOString());
    return `${config.urlPublica}/activar?token=${token}`;
  }

  async function enviarCredenciales(usuario, enlace) {
    const { validezHoras } = config.activacion;
    const mensaje =
      usuario.rol === 'FIA'
        ? plantillas.credencialesFia({ nombre: usuario.nombre, email: usuario.email, enlace, validezHoras })
        : plantillas.credencialesEscuderia({
            nombre: usuario.nombre,
            email: usuario.email,
            escuderias: consultas.escuderiasDeUsuario(usuario.id),
            enlace,
            validezHoras,
          });
    return correo.enviar({ para: usuario.email, asunto: mensaje.asunto, texto: mensaje.texto });
  }


  rutas.get('/escuderias', (req, res) => {
    const categoria = typeof req.query.categoria === 'string' && req.query.categoria ? req.query.categoria.toUpperCase() : null;
    const escuderias = listarEscuderias.all(categoria, categoria).map((fila) => ({
      ...aEscuderia(fila),
      cantidadPilotos: fila.pilotos,
      creadaEn: fila.creada_en,
      responsables: responsablesDe.all(fila.id).map(aResponsable),
    }));
    res.json({ escuderias });
  });

  rutas.get('/escuderias/:id', (req, res) => {
    const id = idDe(req.params.id);
    const pilotos = pilotosDe.all(id).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      apellido: p.apellido,
      nacionalidad: p.nacionalidad,
      numero: p.numero,
      rol: p.rol,
      fechaNacimiento: p.fecha_nacimiento,
    }));
    res.json({ escuderia: detalleDeEscuderia(id), pilotos });
  });

  rutas.post('/escuderias', async (req, res) => {
    const datos = req.body ?? {};
    const responsable = datos.responsable ?? {};
    const usarCuentaExistente = responsable.usarCuentaExistente === true;

    const v = new Validador();
    const nombreOficial = v.requerido('nombreOficial', datos.nombreOficial, 'Nombre oficial', { min: 2, max: 80 });
    const codigoCategoria = v.enumerado('categoria', datos.categoria, consultas.codigosDeCategorias(), 'Categoría');
    const pais = v.requerido('pais', datos.pais, 'País', { max: 56 });
    const sede = v.opcional('sede', datos.sede, 'Sede', { max: 80 });
    const email = v.email('responsable.email', responsable.email, 'Correo del responsable');
    let nombreResponsable = '';
    let apellidoResponsable = '';
    if (!usarCuentaExistente) {
      nombreResponsable = v.requerido('responsable.nombre', responsable.nombre, 'Nombre del responsable', { max: 60 });
      apellidoResponsable = v.requerido('responsable.apellido', responsable.apellido, 'Apellido del responsable', { max: 60 });
    }
    v.lanzarSiHayErrores();

    const categoria = consultas.categoriaPorCodigo(codigoCategoria);
    const nombreNormalizado = normalizarNombre(nombreOficial);
    if (escuderiaPorNombre.get(nombreNormalizado, categoria.id, 0)) {
      throw errores.conflicto(
        'ESCUDERIA_DUPLICADA',
        `Ya existe una escudería llamada «${nombreOficial}» en ${categoria.nombre}.`,
      );
    }

    const existente = usuarioPorEmail.get(email);
    if (usarCuentaExistente) {
      if (!existente) throw errores.validacion({ 'responsable.email': 'No hay ninguna cuenta con ese correo para asociar.' });
      if (existente.rol !== 'ESCUDERIA') {
        throw errores.conflicto('EMAIL_DE_OTRO_ROL', 'Ese correo pertenece a una cuenta que no es de escudería.');
      }
      if (!existente.activo) throw errores.conflicto('CUENTA_DESHABILITADA', 'La cuenta de ese responsable está deshabilitada.');
    } else if (existente) {
      throw errores.conflicto(
        'EMAIL_DUPLICADO',
        'Ya existe una cuenta con ese correo electrónico. Si es responsable de otra escudería, marcá «Asociar a una cuenta existente».',
      );
    }

    const ahora = reloj.ahora();
    const marca = ahora.toISOString();
    let escuderiaId;
    let usuarioId;
    let enlace = null;
    try {
      enTransaccion(db, () => {
        escuderiaId = insertarEscuderia.run(
          nombreOficial,
          nombreNormalizado,
          categoria.id,
          pais,
          sede,
          marca,
          req.usuario.id,
          marca,
        ).lastInsertRowid;
        if (usarCuentaExistente) {
          usuarioId = existente.id;
        } else {
          usuarioId = insertarUsuarioInterno.run(
            email,
            nombreResponsable,
            apellidoResponsable,
            'ESCUDERIA',
            marca,
            req.usuario.id,
          ).lastInsertRowid;
          enlace = nuevoEnlaceDeActivacion(usuarioId, ahora);
          auditoria.registrar({
            usuario: req.usuario,
            accion: 'USUARIO_ALTA',
            entidad: 'usuario',
            entidadId: usuarioId,
            detalle: { email, rol: 'ESCUDERIA' },
            ip: req.ip,
          });
        }
        asociar.run(usuarioId, escuderiaId, marca, req.usuario.id);
        auditoria.registrar({
          usuario: req.usuario,
          accion: 'ESCUDERIA_ALTA',
          entidad: 'escuderia',
          entidadId: escuderiaId,
          detalle: { nombreOficial, categoria: categoria.codigo, pais, responsable: email, cuentaExistente: usarCuentaExistente },
          ip: req.ip,
        });
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw errores.conflicto('ESCUDERIA_DUPLICADA', 'Ya existe una escudería o una cuenta con esos datos.');
      }
      throw error;
    }

    const usuario = usuarioPorId.get(usuarioId);
    let envio;
    if (usarCuentaExistente) {
      const aviso = plantillas.escuderiaAsignada({ nombre: usuario.nombre, escuderia: detalleDeEscuderia(escuderiaId) });
      envio = await correo.enviar({ para: usuario.email, asunto: aviso.asunto, texto: aviso.texto });
    } else {
      envio = await enviarCredenciales(usuario, enlace);
    }

    eventos.publicar('nomina', { tipo: 'escuderia', accion: 'alta', categoria: categoria.codigo, escuderiaId });
    res.status(201).json({
      escuderia: detalleDeEscuderia(escuderiaId),
      correo: { enviado: envio.enviado, para: usuario.email, tipo: usarCuentaExistente ? 'ASIGNACION' : 'CREDENCIALES' },
    });
  });

  rutas.patch('/escuderias/:id', (req, res) => {
    const id = idDe(req.params.id);
    const actual = escuderiaPorId.get(id);
    if (!actual) throw errores.noEncontrado('No existe esa escudería.');
    const datos = req.body ?? {};
    if (datos.categoria !== undefined && String(datos.categoria).toUpperCase() !== actual.categoria) {
      throw errores.validacion({ categoria: 'La categoría de una escudería no se puede modificar.' });
    }
    const v = new Validador();
    const nombreOficial =
      datos.nombreOficial === undefined
        ? actual.nombre_oficial
        : v.requerido('nombreOficial', datos.nombreOficial, 'Nombre oficial', { min: 2, max: 80 });
    const pais = datos.pais === undefined ? actual.pais : v.requerido('pais', datos.pais, 'País', { max: 56 });
    const sede = datos.sede === undefined ? actual.sede : v.opcional('sede', datos.sede, 'Sede', { max: 80 });
    v.lanzarSiHayErrores();

    const categoria = consultas.categoriaPorCodigo(actual.categoria);
    const nombreNormalizado = normalizarNombre(nombreOficial);
    if (escuderiaPorNombre.get(nombreNormalizado, categoria.id, id)) {
      throw errores.conflicto(
        'ESCUDERIA_DUPLICADA',
        `Ya existe una escudería llamada «${nombreOficial}» en ${categoria.nombre}.`,
      );
    }
    actualizarEscuderia.run(nombreOficial, nombreNormalizado, pais, sede, reloj.ahora().toISOString(), id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'ESCUDERIA_MODIFICACION',
      entidad: 'escuderia',
      entidadId: id,
      detalle: {
        antes: { nombreOficial: actual.nombre_oficial, pais: actual.pais, sede: actual.sede },
        despues: { nombreOficial, pais, sede },
      },
      ip: req.ip,
    });
    eventos.publicar('nomina', { tipo: 'escuderia', accion: 'modificacion', categoria: actual.categoria, escuderiaId: id });
    res.json({ escuderia: detalleDeEscuderia(id) });
  });

  function cambiarEstadoDeEscuderia(activa) {
    return (req, res) => {
      const id = idDe(req.params.id);
      const actual = escuderiaPorId.get(id);
      if (!actual) throw errores.noEncontrado('No existe esa escudería.');
      cambiarEstadoEscuderia.run(activa ? 1 : 0, reloj.ahora().toISOString(), id);
      auditoria.registrar({
        usuario: req.usuario,
        accion: activa ? 'ESCUDERIA_REACTIVACION' : 'ESCUDERIA_BAJA',
        entidad: 'escuderia',
        entidadId: id,
        detalle: { nombreOficial: actual.nombre_oficial, categoria: actual.categoria },
        ip: req.ip,
      });
      eventos.publicar('nomina', {
        tipo: 'escuderia',
        accion: activa ? 'reactivacion' : 'baja',
        categoria: actual.categoria,
        escuderiaId: id,
      });
      res.json({ escuderia: detalleDeEscuderia(id) });
    };
  }
  rutas.post('/escuderias/:id/baja', cambiarEstadoDeEscuderia(false));
  rutas.post('/escuderias/:id/reactivar', cambiarEstadoDeEscuderia(true));


  rutas.get('/usuarios', (req, res) => {
    const rol = ['FIA', 'ESCUDERIA', 'PUBLICO'].includes(req.query.rol) ? req.query.rol : null;
    const ahora = reloj.ahora();
    const usuarios = listarUsuarios.all(rol, rol).map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      rol: u.rol,
      estado: estadoDeCuenta(u, ahora),
      bloqueadaHasta: u.bloqueado_hasta && new Date(u.bloqueado_hasta) > ahora ? u.bloqueado_hasta : null,
      creadoEn: u.creado_en,
      ultimoAcceso: u.ultimo_acceso,
      escuderias: u.rol === 'ESCUDERIA' ? consultas.escuderiasDeUsuario(u.id) : [],
    }));
    res.json({ usuarios });
  });

  rutas.post('/usuarios-fia', async (req, res) => {
    const datos = req.body ?? {};
    const v = new Validador();
    const nombre = v.requerido('nombre', datos.nombre, 'Nombre', { max: 60 });
    const apellido = v.requerido('apellido', datos.apellido, 'Apellido', { max: 60 });
    const email = v.email('email', datos.email);
    v.lanzarSiHayErrores();
    if (usuarioPorEmail.get(email))
      throw errores.conflicto('EMAIL_DUPLICADO', 'Ya existe una cuenta con ese correo electrónico.');

    const ahora = reloj.ahora();
    let usuarioId;
    let enlace;
    enTransaccion(db, () => {
      usuarioId = insertarUsuarioInterno.run(email, nombre, apellido, 'FIA', ahora.toISOString(), req.usuario.id).lastInsertRowid;
      enlace = nuevoEnlaceDeActivacion(usuarioId, ahora);
      auditoria.registrar({
        usuario: req.usuario,
        accion: 'USUARIO_ALTA',
        entidad: 'usuario',
        entidadId: usuarioId,
        detalle: { email, rol: 'FIA' },
        ip: req.ip,
      });
    });
    const usuario = usuarioPorId.get(usuarioId);
    const envio = await enviarCredenciales(usuario, enlace);
    res
      .status(201)
      .json({
        usuario: { id: usuarioId, email, nombre, apellido, rol: 'FIA', estado: 'PENDIENTE_ACTIVACION' },
        correo: { enviado: envio.enviado, para: email },
      });
  });

  function usuarioExistente(req) {
    const usuario = usuarioPorId.get(idDe(req.params.id));
    if (!usuario) throw errores.noEncontrado('No existe ese usuario.');
    return usuario;
  }

  rutas.post('/usuarios/:id/baja', (req, res) => {
    const usuario = usuarioExistente(req);
    if (usuario.id === req.usuario.id) throw errores.validacion({ id: 'No podés dar de baja tu propia cuenta.' });
    cambiarEstadoUsuario.run(0, usuario.id);
    sesiones.cerrarTodasDeUsuario(usuario.id, 'CUENTA_DESHABILITADA');
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'USUARIO_BAJA',
      entidad: 'usuario',
      entidadId: usuario.id,
      detalle: { email: usuario.email },
      ip: req.ip,
    });
    res.json({ mensaje: `Se dio de baja la cuenta de ${usuario.email}.` });
  });

  rutas.post('/usuarios/:id/reactivar', (req, res) => {
    const usuario = usuarioExistente(req);
    cambiarEstadoUsuario.run(1, usuario.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'USUARIO_REACTIVACION',
      entidad: 'usuario',
      entidadId: usuario.id,
      detalle: { email: usuario.email },
      ip: req.ip,
    });
    res.json({ mensaje: `Se reactivó la cuenta de ${usuario.email}.` });
  });

  rutas.post('/usuarios/:id/desbloquear', (req, res) => {
    const usuario = usuarioExistente(req);
    desbloquear.run(usuario.id);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'USUARIO_DESBLOQUEO',
      entidad: 'usuario',
      entidadId: usuario.id,
      detalle: { email: usuario.email },
      ip: req.ip,
    });
    res.json({ mensaje: `Se desbloqueó la cuenta de ${usuario.email}.` });
  });

  rutas.post('/usuarios/:id/reenviar-activacion', async (req, res) => {
    const usuario = usuarioExistente(req);
    if (usuario.password_hash) throw errores.conflicto('CUENTA_YA_ACTIVADA', 'Esa cuenta ya está activada.');
    if (usuario.rol === 'PUBLICO')
      throw new ErrorDeNegocio(400, 'NO_CORRESPONDE', 'Las cuentas del público no usan enlace de activación.');
    const enlace = nuevoEnlaceDeActivacion(usuario.id, reloj.ahora());
    const envio = await enviarCredenciales(usuario, enlace);
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'ACTIVACION_REENVIADA',
      entidad: 'usuario',
      entidadId: usuario.id,
      detalle: { email: usuario.email },
      ip: req.ip,
    });
    res.json({ correo: { enviado: envio.enviado, para: usuario.email } });
  });


  rutas.get('/auditoria', (req, res) => {
    const accion = typeof req.query.accion === 'string' && req.query.accion ? texto(req.query.accion).toUpperCase() : null;
    const limite = Math.min(Math.max(Number(req.query.limite) || 200, 1), 1000);
    const registros = listarAuditoria.all(accion, accion, limite).map((r) => ({
      id: r.id,
      fechaHora: r.fecha_hora,
      usuarioId: r.usuario_id,
      usuarioEmail: r.usuario_email,
      accion: r.accion,
      entidad: r.entidad,
      entidadId: r.entidad_id,
      detalle: r.detalle ? JSON.parse(r.detalle) : null,
    }));
    res.json({ registros, acciones: accionesAuditadas.all().map((a) => a.accion) });
  });

  rutas.get('/correos', (req, res) => {
    const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 500);
    res.json({
      transporte: config.correo.transporte,
      correos: listarCorreos.all(limite).map((c) => ({
        id: c.id,
        para: c.para,
        asunto: c.asunto,
        cuerpo: c.cuerpo,
        transporte: c.transporte,
        estado: c.estado,
        error: c.error,
        enviadoEn: c.enviado_en,
      })),
    });
  });

  return rutas;
}
