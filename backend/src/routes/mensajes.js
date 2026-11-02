import { Router } from 'express';
import { errores } from '../lib/errores.js';
import { Validador, idDeRuta } from '../lib/validacion.js';

function sinCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

export function rutasDeMensajes(ctx) {
  const { db, auditoria, mensajeria } = ctx;

  const escuderiaPorId = db.prepare('SELECT id, nombre_oficial, activa FROM escuderias WHERE id = ?');

  function textoDelMensaje(datos) {
    const v = new Validador();
    const texto = v.parrafo('texto', datos.texto, 'Mensaje', { max: 2000 });
    v.lanzarSiHayErrores();
    return texto;
  }

  function enviar(req, res, destino, lado) {
    const texto = textoDelMensaje(req.body ?? {});
    const mensaje = mensajeria.enviar({ escuderiaId: destino.id, emisorId: req.usuario.id, lado, texto });
    auditoria.registrar({
      usuario: req.usuario,
      accion: 'MENSAJE_ENVIADO',
      entidad: 'escuderia',
      entidadId: destino.id,
      detalle: { lado, numero: mensaje.numero },
      ip: req.ip,
    });
    res.status(201).json({ mensajes: mensajeria.historial(destino.id) });
  }

  function escuderiaExistente(id) {
    const fila = escuderiaPorId.get(idDeRuta(id, 'No existe esa escudería.'));
    if (!fila) throw errores.noEncontrado('No existe esa escudería.');
    return fila;
  }

  const fia = Router();
  fia.use(sinCache);

  fia.get('/', (req, res) => {
    res.json({
      conversaciones: mensajeria.bandejaFia().map((f) => ({
        escuderia: { id: f.id, nombreOficial: f.nombre_oficial },
        categoria: { codigo: f.categoria, nombre: f.categoria_nombre },
        noLeidos: f.no_leidos,
        ultimoMensajeEn: f.ultimo_mensaje_en ?? null,
      })),
    });
  });

  fia.get('/:escuderiaId', (req, res) => {
    const destino = escuderiaExistente(req.params.escuderiaId);
    res.json({ mensajes: mensajeria.historial(destino.id) });
  });

  fia.post('/:escuderiaId', (req, res) => {
    const destino = escuderiaExistente(req.params.escuderiaId);
    if (!destino.activa) throw errores.conflicto('ESCUDERIA_DE_BAJA', 'La escudería está dada de baja.');
    enviar(req, res, destino, 'FIA');
  });

  fia.post('/:escuderiaId/leer', (req, res) => {
    const destino = escuderiaExistente(req.params.escuderiaId);
    res.json({ leidos: mensajeria.marcarComoLeidos({ escuderiaId: destino.id, lectorId: req.usuario.id, lado: 'FIA' }) });
  });

  const escuderia = Router();
  escuderia.use(sinCache);

  escuderia.get('/', (req, res) => {
    res.json({ mensajes: mensajeria.historial(req.escuderia.id) });
  });

  escuderia.post('/', (req, res) => {
    enviar(req, res, req.escuderia, 'ESCUDERIA');
  });

  escuderia.post('/leer', (req, res) => {
    res.json({
      leidos: mensajeria.marcarComoLeidos({ escuderiaId: req.escuderia.id, lectorId: req.usuario.id, lado: 'ESCUDERIA' }),
    });
  });

  // Avisos internos: los consulta el navegador solo, por eso no cuentan como actividad de la sesión.
  // No usan el canal SSE porque es público y delataría cuándo se comunica cada escudería.
  const noLeidosFia = [
    sinCache,
    (req, res) => {
      res.json({ total: mensajeria.noLeidosFia() });
    },
  ];
  const noLeidosEscuderia = [
    sinCache,
    (req, res) => {
      res.json(mensajeria.noLeidosDeEscuderias(req.usuario.id));
    },
  ];

  return { fia, escuderia, noLeidosFia, noLeidosEscuderia };
}
