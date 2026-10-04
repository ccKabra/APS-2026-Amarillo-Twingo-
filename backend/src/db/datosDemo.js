import { asociarResponsable, crearEscuderia, crearPiloto, crearUsuarioActivo } from './altas.js';
import { crearServicioDeCorreo } from '../lib/correo.js';
import { crearConsultas } from '../lib/consultas.js';
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
    for (const piloto of escuderia.pilotos) crearPiloto(db, escuderiaId, piloto, ahora);
  }

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
  ).run(marca, JSON.stringify({ escuderias: ESCUDERIAS.length + 1 }));
  return { enlace };
}
