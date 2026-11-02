import crypto from 'node:crypto';
import { asociarResponsable, crearEscuderia, crearPiloto, crearUsuarioActivo } from './altas.js';
import { crearServicioDeCorreo } from '../lib/correo.js';
import { crearConsultas } from '../lib/consultas.js';
import { crearServicioDeMensajeria } from '../lib/mensajeria.js';
import { credencialesEscuderia } from '../lib/plantillas.js';
import { generarToken, hashToken } from '../lib/tokens.js';
import { sumarMinutos } from '../lib/reloj.js';

export const CREDENCIALES_DEMO = {
  fia: { email: 'admin@fia.test', password: 'FiaAdmin#2026' },
  escuderia: { password: 'Escuderia#2026' },
  publico: { email: 'publico@demo.test', password: 'Publico#2026' },
};

const ESCUDERIAS = [
  {
    nombreOficial: 'Andes Racing Team',
    categoria: 'F1',
    pais: 'Argentina',
    sede: 'Mendoza',
    responsable: { email: 'martin.rios@andesracing.test', nombre: 'Martín', apellido: 'Ríos' },
    pilotos: [
      {
        nombre: 'Tomás',
        apellido: 'Ferreyra',
        nacionalidad: 'Argentina',
        fechaNacimiento: '2001-03-14',
        numero: 12,
        rol: 'TITULAR',
      },
      {
        nombre: 'Facundo',
        apellido: 'Ibarra',
        nacionalidad: 'Argentina',
        fechaNacimiento: '2000-07-22',
        numero: 31,
        rol: 'TITULAR',
      },
      {
        nombre: 'Mateo',
        apellido: 'Quiroga',
        nacionalidad: 'Argentina',
        fechaNacimiento: '2004-11-03',
        numero: 45,
        rol: 'SUPLENTE',
      },
    ],
  },
  {
    nombreOficial: 'Atlántico Grand Prix',
    categoria: 'F1',
    pais: 'Uruguay',
    sede: 'Montevideo',
    responsable: { email: 'sofia.pereyra@atlanticogp.test', nombre: 'Sofía', apellido: 'Pereyra' },
    pilotos: [
      {
        nombre: 'Santiago',
        apellido: 'Olivera',
        nacionalidad: 'Uruguay',
        fechaNacimiento: '1999-05-30',
        numero: 7,
        rol: 'TITULAR',
      },
      {
        nombre: 'Lucas',
        apellido: 'Benítez',
        nacionalidad: 'Paraguay',
        fechaNacimiento: '2002-01-18',
        numero: 23,
        rol: 'TITULAR',
      },
      {
        nombre: 'Emiliano',
        apellido: 'Duarte',
        nacionalidad: 'Uruguay',
        fechaNacimiento: '2005-09-09',
        numero: 55,
        rol: 'SUPLENTE',
      },
    ],
  },
  {
    nombreOficial: 'Pampa Motorsport',
    categoria: 'F2',
    pais: 'Argentina',
    sede: 'Córdoba',
    responsable: { email: 'diego@pampamotorsport.test', nombre: 'Diego', apellido: 'Salvatierra' },
    pilotos: [
      {
        nombre: 'Joaquín',
        apellido: 'Herrera',
        nacionalidad: 'Argentina',
        fechaNacimiento: '2005-02-11',
        numero: 3,
        rol: 'TITULAR',
      },
      { nombre: 'Nicolás', apellido: 'Paredes', nacionalidad: 'Perú', fechaNacimiento: '2004-08-27', numero: 4, rol: 'TITULAR' },
      {
        nombre: 'Gael',
        apellido: 'Montenegro',
        nacionalidad: 'Argentina',
        fechaNacimiento: '2006-04-05',
        numero: 21,
        rol: 'SUPLENTE',
      },
    ],
  },
  {
    nombreOficial: 'Pampa Motorsport',
    categoria: 'F3',
    pais: 'Argentina',
    sede: 'Córdoba',
    responsable: { email: 'diego@pampamotorsport.test' },
    pilotos: [
      {
        nombre: 'Valentino',
        apellido: 'Sosa',
        nacionalidad: 'Argentina',
        fechaNacimiento: '2007-06-19',
        numero: 12,
        rol: 'TITULAR',
      },
      {
        nombre: 'Thiago',
        apellido: 'Romero',
        nacionalidad: 'Bolivia',
        fechaNacimiento: '2007-10-02',
        numero: 14,
        rol: 'TITULAR',
      },
      {
        nombre: 'Benjamín',
        apellido: 'Aguirre',
        nacionalidad: 'Argentina',
        fechaNacimiento: '2008-01-25',
        numero: 29,
        rol: 'SUPLENTE',
      },
    ],
  },
  {
    nombreOficial: 'Aurora Racing',
    categoria: 'F1A',
    pais: 'España',
    sede: 'Valencia',
    responsable: { email: 'valentina.ortiz@auroraracing.test', nombre: 'Valentina', apellido: 'Ortiz' },
    pilotos: [
      {
        nombre: 'Lucía',
        apellido: 'Fernández',
        nacionalidad: 'España',
        fechaNacimiento: '2007-03-08',
        numero: 5,
        rol: 'TITULAR',
      },
      { nombre: 'Camila', apellido: 'Rojas', nacionalidad: 'Colombia', fechaNacimiento: '2006-12-15', numero: 8, rol: 'TITULAR' },
      {
        nombre: 'Martina',
        apellido: 'Vidal',
        nacionalidad: 'Argentina',
        fechaNacimiento: '2008-05-21',
        numero: 16,
        rol: 'SUPLENTE',
      },
    ],
  },
];

const EVENTOS = [
  ['F1', 'Gran Premio de Singapur', 'CARRERA', 'Circuito Marina Bay', 'Singapur', '2026-10-11', '20:00', true],
  ['F1', 'Gran Premio de Estados Unidos', 'CARRERA', 'Circuito de las Américas', 'Estados Unidos', '2026-10-25', '15:00', true],
  ['F1', 'Gran Premio de México', 'CARRERA', 'Autódromo Hermanos Rodríguez', 'México', '2026-11-01', '14:00', true],
  ['F1', 'Clasificación del Gran Premio de São Paulo', 'CLASIFICACION', 'Autódromo de Interlagos', 'Brasil', '2026-11-07', '15:00', true],
  ['F1', 'Gran Premio de São Paulo', 'CARRERA', 'Autódromo de Interlagos', 'Brasil', '2026-11-08', '14:00', true],
  ['F1', 'Gran Premio de Las Vegas', 'CARRERA', 'Circuito callejero de Las Vegas', 'Estados Unidos', '2026-11-21', '22:00', true],
  ['F1', 'Gran Premio de Abu Dabi', 'CARRERA', 'Circuito Yas Marina', 'Emiratos Árabes Unidos', '2026-12-06', '13:00', false],
  ['F1', 'Prueba de neumáticos de postemporada', 'PRUEBA', 'Circuito Yas Marina', 'Emiratos Árabes Unidos', '2026-12-09', null, false],
  ['F1', 'Gran Premio de Argentina', 'CARRERA', 'Autódromo Oscar y Juan Gálvez', 'Argentina', '2027-03-21', null, false],
  ['F2', 'Ronda de Losail', 'CARRERA', 'Circuito Internacional de Losail', 'Catar', '2026-11-29', '16:00', true],
  ['F2', 'Ronda de Yas Marina', 'CARRERA', 'Circuito Yas Marina', 'Emiratos Árabes Unidos', '2026-12-05', null, false],
  ['F3', 'Ronda de Termas de Río Hondo', 'CARRERA', 'Autódromo Termas de Río Hondo', 'Argentina', '2026-11-15', '11:00', true],
  ['F3', 'Ronda de El Pinar', 'CARRERA', 'Autódromo Víctor Borrat Fabini', 'Uruguay', '2026-12-13', null, false],
  ['F1A', 'Ronda de Las Vegas', 'CARRERA', 'Circuito callejero de Las Vegas', 'Estados Unidos', '2026-11-20', '18:00', false],
];

const SANCIONES = [
  {
    escuderia: 'Andes Racing Team|F1',
    piloto: 'F1#31',
    tipo: 'VELOCIDAD_EN_BOXES',
    fecha: '2026-09-13',
    penalizacion: 'Multa de 5.000 €',
    descripcion: 'Superó el límite de 80 km/h en la calle de boxes durante la segunda práctica libre (registro: 86,4 km/h).',
    estado: 'FIRMADA',
  },
  {
    escuderia: 'Atlántico Grand Prix|F1',
    piloto: 'F1#7',
    tipo: 'COLISION',
    fecha: '2026-09-20',
    penalizacion: 'Penalización de 5 segundos',
    descripcion: 'Provocó un contacto con el auto N° 12 en la curva 1 de la vuelta de apertura.',
    estado: 'PUBLICADA',
  },
  {
    escuderia: 'Pampa Motorsport|F2',
    piloto: null,
    tipo: 'NEUMATICOS',
    fecha: '2026-09-26',
    penalizacion: 'Multa de 10.000 €',
    descripcion: 'La escudería utilizó en la práctica libre un juego de neumáticos que no le había sido asignado.',
    estado: 'PUBLICADA',
  },
  {
    escuderia: 'Aurora Racing|F1A',
    piloto: 'F1A#8',
    tipo: 'LIMITES_DE_PISTA',
    fecha: '2026-09-27',
    penalizacion: 'Advertencia',
    descripcion: 'Excedió los límites de pista en la curva 4 en tres oportunidades durante la carrera.',
    estado: 'BORRADOR',
  },
];

const INSPECCIONES = [
  ['F1#12', '2026-09-12', 'PESO', 'APROBADO', null],
  [
    'F1#31',
    '2026-09-12',
    'DIMENSIONES',
    'OBSERVADO',
    'Alerón trasero en el límite de la tolerancia; se pide un nuevo control en la próxima fecha.',
  ],
  ['F1#7', '2026-09-19', 'PRE_CARRERA', 'APROBADO', null],
  ['F1#23', '2026-09-19', 'COMBUSTIBLE', 'APROBADO', null],
  ['F2#3', '2026-09-26', 'POST_CARRERA', 'RECHAZADO', 'Peso 3 kg por debajo del mínimo reglamentario después de la clasificación.'],
  ['F3#12', '2026-09-26', 'SEGURIDAD', 'APROBADO', null],
  ['F1A#5', '2026-09-26', 'UNIDAD_DE_POTENCIA', 'APROBADO', null],
];

function cargarCalendario(db, adminId, marca) {
  const insertar = db.prepare(`
    INSERT INTO eventos_calendario (categoria_id, nombre, tipo, circuito, pais, fecha, hora, estado, creado_en, creado_por,
                                    actualizado_en, oficializado_en, oficializado_por)
    VALUES ((SELECT id FROM categorias WHERE codigo = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const [categoria, nombre, tipo, circuito, pais, fecha, hora, oficial] of EVENTOS) {
    insertar.run(
      categoria,
      nombre,
      tipo,
      circuito,
      pais,
      fecha,
      hora,
      oficial ? 'OFICIAL' : 'ESPECULATIVA',
      marca,
      adminId,
      marca,
      oficial ? marca : null,
      oficial ? adminId : null,
    );
  }
}

function cargarSanciones(db, adminId, marca, escuderias, pilotos, cuentas) {
  const insertar = db.prepare(`
    INSERT INTO sanciones (escuderia_id, piloto_id, categoria_id, tipo_infraccion_id, fecha_infraccion, penalizacion, descripcion,
                           estado, creada_en, creada_por, actualizada_en, publicada_en, publicada_por)
    VALUES (?, ?, (SELECT categoria_id FROM escuderias WHERE id = ?), (SELECT id FROM tipos_infraccion WHERE codigo = ?),
            ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const notificar = db.prepare(
    'INSERT INTO notificaciones_sancion (sancion_id, escuderia_id, notificada_en, firmada_en, firmada_por) VALUES (?, ?, ?, ?, ?)',
  );
  for (const s of SANCIONES) {
    const escuderiaId = escuderias.get(s.escuderia);
    const publicada = s.estado !== 'BORRADOR';
    const id = insertar.run(
      escuderiaId,
      s.piloto ? pilotos.get(s.piloto) : null,
      escuderiaId,
      s.tipo,
      s.fecha,
      s.penalizacion,
      s.descripcion,
      publicada ? 'PUBLICADA' : 'BORRADOR',
      marca,
      adminId,
      marca,
      publicada ? marca : null,
      publicada ? adminId : null,
    ).lastInsertRowid;
    if (publicada) {
      const firmada = s.estado === 'FIRMADA';
      notificar.run(id, escuderiaId, marca, firmada ? marca : null, firmada ? cuentas.get(s.escuderia) : null);
    }
  }
}

function cargarInspecciones(db, adminId, marca, pilotos) {
  const insertar = db.prepare(`
    INSERT INTO inspecciones (escuderia_id, piloto_id, categoria_id, fecha, tipo, estado_tecnico, observaciones,
                              creada_en, creada_por, actualizada_en, actualizada_por)
    SELECT escuderia_id, id, categoria_id, ?, ?, ?, ?, ?, ?, ?, ? FROM pilotos WHERE id = ?`);
  for (const [piloto, fecha, tipo, estado, observaciones] of INSPECCIONES) {
    insertar.run(fecha, tipo, estado, observaciones, marca, adminId, marca, adminId, pilotos.get(piloto));
  }
}

const PRUEBAS_NEUMATICOS = [
  ['2027-02-24', '09:00', 'Circuito Internacional de Baréin', 'Baréin', 'Mañana: compuestos secos.\nTarde: simulación de carrera.', true],
  ['2027-07-07', null, 'Circuito de Silverstone', 'Reino Unido', null, false],
];

const REGLAMENTOS = [
  ['F1', 'TECNICO', 'Reglamento Técnico de Fórmula 1 2026', 1],
  ['F1', 'TECNICO', 'Reglamento Técnico de Fórmula 1 2026 (revisión 2)', 2],
  ['F1', 'DEPORTIVO', 'Reglamento Deportivo de Fórmula 1 2026', 1],
  ['F2', 'TECNICO', 'Reglamento Técnico de Fórmula 2 2026', 1],
  ['F3', 'DEPORTIVO', 'Reglamento Deportivo de Fórmula 3 2026', 1],
];

const MENSAJES = [
  ['Andes Racing Team|F1', 'ESCUDERIA', 'Solicitamos una aclaración sobre la tolerancia del alerón trasero antes de la próxima fecha.'],
  ['Andes Racing Team|F1', 'FIA', 'Recibido. La comisión técnica responde dentro de las próximas 48 horas.'],
  ['Andes Racing Team|F1', 'ESCUDERIA', 'Gracias. Enviaremos las mediciones del último control en cuanto estén disponibles.'],
  ['Pampa Motorsport|F2', 'FIA', 'Les recordamos presentar el descargo por la sanción de neumáticos.'],
];

function pdfDeDemostracion(titulo) {
  const texto = titulo.normalize('NFD').replace(/[^\x20-\x7e]|[()\\]/g, '');
  const contenido = `BT /F1 18 Tf 72 720 Td (${texto}) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((objeto, i) => {
    const posicion = pdf.length;
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
    return posicion;
  });
  const inicioXref = pdf.length;
  const entradas = posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${entradas}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function cargarPruebasDeNeumaticos(db, adminId, marca) {
  const insertar = db.prepare(`
    INSERT INTO pruebas_neumaticos (anio, numero, fecha, hora, circuito, pais, cronograma, estado, creada_en, creada_por,
                                    actualizada_en, firmada_en, firmada_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  PRUEBAS_NEUMATICOS.forEach(([fecha, hora, circuito, pais, cronograma, firmada], i) => {
    insertar.run(
      Number(fecha.slice(0, 4)),
      i + 1,
      fecha,
      hora,
      circuito,
      pais,
      cronograma,
      firmada ? 'OFICIAL' : 'NO_OFICIAL',
      marca,
      adminId,
      marca,
      firmada ? marca : null,
      firmada ? adminId : null,
    );
  });
}

function cargarReglamentos(db, adminId, marca) {
  const insertar = db.prepare(`
    INSERT INTO reglamentos (categoria_id, tipo, titulo, version, documento, tamanio, sha256, vigente, publicado_en, publicado_por,
                             reemplazado_en)
    VALUES ((SELECT id FROM categorias WHERE codigo = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const [categoria, tipo, titulo, version] of REGLAMENTOS) {
    const documento = pdfDeDemostracion(titulo);
    const reemplazado = REGLAMENTOS.some((r) => r[0] === categoria && r[1] === tipo && r[3] > version);
    insertar.run(
      categoria,
      tipo,
      titulo,
      version,
      documento,
      documento.length,
      crypto.createHash('sha256').update(documento).digest('hex'),
      reemplazado ? 0 : 1,
      marca,
      adminId,
      reemplazado ? marca : null,
    );
  }
}

function cargarMensajes(db, config, ahora, adminId, escuderias, responsableDe) {
  const mensajeria = crearServicioDeMensajeria({ db, config, reloj: { ahora: () => ahora } });
  for (const [escuderia, lado, texto] of MENSAJES) {
    mensajeria.enviar({
      escuderiaId: escuderias.get(escuderia),
      emisorId: lado === 'FIA' ? adminId : responsableDe.get(escuderia),
      lado,
      texto,
    });
  }
}

const ESCUDERIA_PENDIENTE = {
  nombreOficial: 'Cordillera Motorsport',
  categoria: 'F2',
  pais: 'Chile',
  sede: 'Santiago',
  responsable: { email: 'ignacio.vera@cordillera.test', nombre: 'Ignacio', apellido: 'Vera' },
};

export async function cargarDatosDeDemostracion(db, config, ahora = new Date()) {
  const marca = ahora.toISOString();
  const adminId = await crearUsuarioActivo(
    db,
    config,
    {
      email: CREDENCIALES_DEMO.fia.email,
      nombre: 'Laura',
      apellido: 'Méndez',
      rol: 'FIA',
      password: CREDENCIALES_DEMO.fia.password,
    },
    ahora,
  );
  await crearUsuarioActivo(
    db,
    config,
    {
      email: CREDENCIALES_DEMO.publico.email,
      nombre: 'Ana',
      apellido: 'Gómez',
      rol: 'PUBLICO',
      password: CREDENCIALES_DEMO.publico.password,
    },
    ahora,
  );

  const cuentas = new Map();
  const escuderias = new Map();
  const pilotos = new Map();
  const responsableDe = new Map();
  for (const escuderia of ESCUDERIAS) {
    const { email, nombre, apellido } = escuderia.responsable;
    if (!cuentas.has(email)) {
      cuentas.set(
        email,
        await crearUsuarioActivo(
          db,
          config,
          { email, nombre, apellido, rol: 'ESCUDERIA', password: CREDENCIALES_DEMO.escuderia.password },
          ahora,
        ),
      );
    }
    const escuderiaId = crearEscuderia(db, { ...escuderia, creadaPor: adminId }, ahora);
    asociarResponsable(db, cuentas.get(email), escuderiaId, adminId, ahora);
    const clave = `${escuderia.nombreOficial}|${escuderia.categoria}`;
    escuderias.set(clave, escuderiaId);
    responsableDe.set(clave, cuentas.get(email));
    for (const piloto of escuderia.pilotos) {
      pilotos.set(`${escuderia.categoria}#${piloto.numero}`, crearPiloto(db, escuderiaId, piloto, ahora));
    }
  }
  cargarCalendario(db, adminId, marca);
  cargarSanciones(db, adminId, marca, escuderias, pilotos, responsableDe);
  cargarInspecciones(db, adminId, marca, pilotos);
  cargarPruebasDeNeumaticos(db, adminId, marca);
  cargarReglamentos(db, adminId, marca);
  cargarMensajes(db, config, ahora, adminId, escuderias, responsableDe);

  const p = ESCUDERIA_PENDIENTE;
  const pendienteId = db
    .prepare(
      `INSERT INTO usuarios (email, nombre, apellido, rol, password_hash, creado_en, creado_por) VALUES (?, ?, ?, 'ESCUDERIA', NULL, ?, ?)`,
    )
    .run(p.responsable.email, p.responsable.nombre, p.responsable.apellido, marca, adminId).lastInsertRowid;
  const escuderiaPendienteId = crearEscuderia(db, { ...p, creadaPor: adminId }, ahora);
  asociarResponsable(db, pendienteId, escuderiaPendienteId, adminId, ahora);
  const token = generarToken();
  db.prepare('INSERT INTO tokens_activacion (usuario_id, token_hash, creado_en, expira_en) VALUES (?, ?, ?, ?)').run(
    pendienteId,
    hashToken(token),
    marca,
    sumarMinutos(ahora, config.activacion.validezHoras * 60).toISOString(),
  );
  const enlace = `${config.urlPublica}/activar?token=${token}`;
  const mensaje = credencialesEscuderia({
    nombre: p.responsable.nombre,
    email: p.responsable.email,
    escuderias: crearConsultas(db).escuderiasDeUsuario(pendienteId),
    enlace,
    validezHoras: config.activacion.validezHoras,
  });
  await crearServicioDeCorreo({ db, config: { ...config, silencioso: true }, reloj: { ahora: () => ahora } }).enviar({
    para: p.responsable.email,
    asunto: mensaje.asunto,
    texto: mensaje.texto,
  });

  db.prepare(
    `INSERT INTO auditoria (fecha_hora, usuario_id, usuario_email, accion, detalle) VALUES (?, NULL, 'sistema', 'DATOS_DE_DEMOSTRACION', ?)`,
  ).run(
    marca,
    JSON.stringify({
      escuderias: ESCUDERIAS.length + 1,
      eventos: EVENTOS.length,
      sanciones: SANCIONES.length,
      inspecciones: INSPECCIONES.length,
      pruebasDeNeumaticos: PRUEBAS_NEUMATICOS.length,
      reglamentos: REGLAMENTOS.length,
      mensajes: MENSAJES.length,
    }),
  );
  return { enlace };
}
