import { enTransaccion } from '../db/index.js';
import { crearCifrador, obtenerClaveMaestra } from './cifrado.js';

const contextoDeClave = (escuderiaId) => `conversacion:${escuderiaId}`;
const contextoDeMensaje = (m) => `mensaje:${m.conversacion_id}:${m.numero}:${m.emisor_id}:${m.emisor_lado}:${m.enviado_en}`;

export function crearServicioDeMensajeria({ db, config, reloj }) {
  const cifrador = crearCifrador(obtenerClaveMaestra(config));

  const conversacionPorEscuderia = db.prepare('SELECT * FROM conversaciones WHERE escuderia_id = ?');
  const insertarConversacion = db.prepare(
    'INSERT INTO conversaciones (escuderia_id, clave_envuelta, creada_en) VALUES (?, ?, ?)',
  );
  const siguienteNumero = db.prepare('SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM mensajes WHERE conversacion_id = ?');
  const insertarMensaje = db.prepare(`
    INSERT INTO mensajes (conversacion_id, numero, emisor_id, emisor_lado, contenido_cifrado, enviado_en)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const mensajesDeConversacion = db.prepare(`
    SELECT m.*, u.nombre AS emisor_nombre, u.apellido AS emisor_apellido
    FROM mensajes m JOIN usuarios u ON u.id = m.emisor_id
    WHERE m.conversacion_id = ?
    ORDER BY m.numero`);
  const marcarLeidos = db.prepare(`
    UPDATE mensajes SET leido_en = ?, leido_por = ?
    WHERE conversacion_id = ? AND emisor_lado <> ? AND leido_en IS NULL`);
  const bandejaFia = db.prepare(`
    SELECT e.id, e.nombre_oficial, cat.codigo AS categoria, cat.nombre AS categoria_nombre,
           MAX(m.enviado_en) AS ultimo_mensaje_en,
           COUNT(CASE WHEN m.emisor_lado = 'ESCUDERIA' AND m.leido_en IS NULL THEN 1 END) AS no_leidos
    FROM escuderias e
    JOIN categorias cat ON cat.id = e.categoria_id
    LEFT JOIN conversaciones c ON c.escuderia_id = e.id
    LEFT JOIN mensajes m ON m.conversacion_id = c.id
    WHERE e.activa = 1 OR c.id IS NOT NULL
    GROUP BY e.id
    ORDER BY no_leidos > 0 DESC, ultimo_mensaje_en IS NULL, ultimo_mensaje_en DESC, e.nombre_oficial COLLATE NOCASE`);
  const noLeidosFia = db.prepare(`
    SELECT COUNT(*) AS total FROM mensajes WHERE emisor_lado = 'ESCUDERIA' AND leido_en IS NULL`);
  const noLeidosDeUsuario = db.prepare(`
    SELECT c.escuderia_id, COUNT(*) AS cantidad
    FROM usuario_escuderia ue
    JOIN escuderias e ON e.id = ue.escuderia_id
    JOIN conversaciones c ON c.escuderia_id = e.id
    JOIN mensajes m ON m.conversacion_id = c.id
    WHERE ue.usuario_id = ? AND e.activa = 1 AND m.emisor_lado = 'FIA' AND m.leido_en IS NULL
    GROUP BY c.escuderia_id`);

  function conversacionCon(escuderiaId) {
    const existente = conversacionPorEscuderia.get(escuderiaId);
    if (existente) return existente;
    insertarConversacion.run(escuderiaId, cifrador.nuevaClave(contextoDeClave(escuderiaId)), reloj.ahora().toISOString());
    return conversacionPorEscuderia.get(escuderiaId);
  }

  function enviar({ escuderiaId, emisorId, lado, texto }) {
    return enTransaccion(db, () => {
      const conversacion = conversacionCon(escuderiaId);
      const clave = cifrador.abrirClave(conversacion.clave_envuelta, contextoDeClave(escuderiaId));
      const mensaje = {
        conversacion_id: conversacion.id,
        numero: siguienteNumero.get(conversacion.id).numero,
        emisor_id: emisorId,
        emisor_lado: lado,
        enviado_en: reloj.ahora().toISOString(),
      };
      insertarMensaje.run(
        mensaje.conversacion_id,
        mensaje.numero,
        mensaje.emisor_id,
        mensaje.emisor_lado,
        cifrador.cifrar(clave, texto, contextoDeMensaje(mensaje)),
        mensaje.enviado_en,
      );
      return mensaje;
    });
  }

  function claveDe(conversacion) {
    try {
      return cifrador.abrirClave(conversacion.clave_envuelta, contextoDeClave(conversacion.escuderia_id));
    } catch {
      return null;
    }
  }

  function descifrar(clave, fila) {
    if (!clave) return null;
    try {
      return cifrador.descifrar(clave, fila.contenido_cifrado, contextoDeMensaje(fila));
    } catch {
      return null;
    }
  }

  function historial(escuderiaId) {
    const conversacion = conversacionPorEscuderia.get(escuderiaId);
    if (!conversacion) return [];
    const clave = claveDe(conversacion);
    return mensajesDeConversacion.all(conversacion.id).map((fila) => {
      const contenido = descifrar(clave, fila);
      return {
        id: fila.id,
        numero: fila.numero,
        lado: fila.emisor_lado,
        emisor: `${fila.emisor_nombre} ${fila.emisor_apellido}`,
        contenido,
        integro: contenido !== null,
        enviadoEn: fila.enviado_en,
        leidoEn: fila.leido_en ?? null,
      };
    });
  }

  function marcarComoLeidos({ escuderiaId, lectorId, lado }) {
    const conversacion = conversacionPorEscuderia.get(escuderiaId);
    if (!conversacion) return 0;
    return Number(marcarLeidos.run(reloj.ahora().toISOString(), lectorId, conversacion.id, lado).changes);
  }

  function noLeidosDeEscuderias(usuarioId) {
    const filas = noLeidosDeUsuario.all(usuarioId);
    return {
      total: filas.reduce((suma, f) => suma + f.cantidad, 0),
      porEscuderia: Object.fromEntries(filas.map((f) => [f.escuderia_id, f.cantidad])),
    };
  }

  return {
    enviar,
    historial,
    marcarComoLeidos,
    bandejaFia: () => bandejaFia.all(),
    noLeidosFia: () => noLeidosFia.get().total,
    noLeidosDeEscuderias,
  };
}
