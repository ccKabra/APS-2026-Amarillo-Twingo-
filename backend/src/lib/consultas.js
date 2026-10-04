export function crearConsultas(db) {
  const usuarioPorId = db.prepare('SELECT id, email, nombre, apellido, rol, activo, ultimo_acceso FROM usuarios WHERE id = ?');
  const escuderiasDeUsuario = db.prepare(`
    SELECT e.id, e.nombre_oficial, e.pais, e.sede, e.activa, c.codigo AS categoria, c.nombre AS categoria_nombre
    FROM usuario_escuderia ue
    JOIN escuderias e ON e.id = ue.escuderia_id
    JOIN categorias c ON c.id = e.categoria_id
    WHERE ue.usuario_id = ?
    ORDER BY c.orden, e.nombre_oficial COLLATE NOCASE`);
  const categoriaPorCodigo = db.prepare('SELECT id, codigo, nombre FROM categorias WHERE codigo = ?');
  const categorias = db.prepare('SELECT codigo, nombre FROM categorias ORDER BY orden');

  function perfil(usuarioId) {
    const u = usuarioPorId.get(usuarioId);
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      rol: u.rol,
      escuderias: u.rol === 'ESCUDERIA' ? escuderiasDeUsuario.all(u.id).map(aEscuderia) : [],
    };
  }

  return {
    perfil,
    escuderiasDeUsuario: (id) => escuderiasDeUsuario.all(id).map(aEscuderia),
    categoriaPorCodigo: (codigo) => categoriaPorCodigo.get(codigo),
    categorias: () => categorias.all().map((c) => ({ codigo: c.codigo, nombre: c.nombre })),
    codigosDeCategorias: () => categorias.all().map((c) => c.codigo),
  };
}

export function aEscuderia(fila) {
  return {
    id: fila.id,
    nombreOficial: fila.nombre_oficial,
    categoria: fila.categoria,
    categoriaNombre: fila.categoria_nombre,
    pais: fila.pais,
    sede: fila.sede ?? null,
    activa: fila.activa === 1,
  };
}

export function aPilotoPublico(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    apellido: fila.apellido,
    nacionalidad: fila.nacionalidad,
    numero: fila.numero,
    rol: fila.rol,
    escuderia: { id: fila.escuderia_id, nombreOficial: fila.escuderia_nombre },
    categoria: { codigo: fila.categoria, nombre: fila.categoria_nombre },
  };
}

export function aPilotoCompleto(fila) {
  return {
    ...aPilotoPublico(fila),
    fechaNacimiento: fila.fecha_nacimiento,
    activo: fila.activo === 1,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    dadoDeBajaEn: fila.dado_de_baja_en ?? null,
  };
}

export function estadoDeCuenta(usuario, ahora) {
  if (!usuario.activo) return 'DESHABILITADA';
  if (!usuario.password_hash) return 'PENDIENTE_ACTIVACION';
  if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > ahora) return 'BLOQUEADA';
  return 'ACTIVA';
}
