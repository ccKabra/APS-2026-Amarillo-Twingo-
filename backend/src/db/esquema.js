
export const CATEGORIAS = [
  { codigo: 'F1', nombre: 'Fórmula 1', orden: 1 },
  { codigo: 'F2', nombre: 'Fórmula 2', orden: 2 },
  { codigo: 'F3', nombre: 'Fórmula 3', orden: 3 },
  { codigo: 'F1A', nombre: 'F1 Academy', orden: 4 },
];

export const TIPOS_INFRACCION = [
  { codigo: 'PESO_MINIMO', nombre: 'Peso mínimo del vehículo', clase: 'TECNICA' },
  { codigo: 'DIMENSIONES', nombre: 'Dimensiones o carrocería fuera de reglamento', clase: 'TECNICA' },
  { codigo: 'UNIDAD_DE_POTENCIA', nombre: 'Unidad de potencia no homologada', clase: 'TECNICA' },
  { codigo: 'COMBUSTIBLE', nombre: 'Combustible fuera de especificación', clase: 'TECNICA' },
  { codigo: 'NEUMATICOS', nombre: 'Uso irregular de neumáticos', clase: 'TECNICA' },
  { codigo: 'VELOCIDAD_EN_BOXES', nombre: 'Exceso de velocidad en boxes', clase: 'CARRERA' },
  { codigo: 'LIMITES_DE_PISTA', nombre: 'Exceder los límites de pista', clase: 'CARRERA' },
  { codigo: 'COLISION', nombre: 'Provocar una colisión', clase: 'CARRERA' },
  { codigo: 'SALIDA_ANTICIPADA', nombre: 'Salida anticipada', clase: 'CARRERA' },
  { codigo: 'BANDERAS', nombre: 'No respetar las banderas', clase: 'CARRERA' },
  { codigo: 'CONDUCTA_ANTIDEPORTIVA', nombre: 'Conducta antideportiva', clase: 'CARRERA' },
];

export const TIPOS_INSPECCION = [
  'PRE_CARRERA',
  'POST_CARRERA',
  'PESO',
  'DIMENSIONES',
  'UNIDAD_DE_POTENCIA',
  'COMBUSTIBLE',
  'SEGURIDAD',
];
export const ESTADOS_TECNICOS = ['APROBADO', 'OBSERVADO', 'RECHAZADO'];
export const TIPOS_EVENTO = ['CARRERA', 'CLASIFICACION', 'PRACTICA', 'PRUEBA', 'OTRO'];

const lista = (valores) => valores.map((v) => `'${v}'`).join(', ');

export const ESQUEMA = `
CREATE TABLE IF NOT EXISTS categorias (
  id      INTEGER PRIMARY KEY,
  codigo  TEXT NOT NULL UNIQUE,
  nombre  TEXT NOT NULL,
  orden   INTEGER NOT NULL
);

-- US9: usuarios y roles. password_hash NULL = cuenta pendiente de activación.
CREATE TABLE IF NOT EXISTS usuarios (
  id                 INTEGER PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre             TEXT NOT NULL,
  apellido           TEXT NOT NULL,
  rol                TEXT NOT NULL CHECK (rol IN ('FIA', 'ESCUDERIA', 'PUBLICO')),
  password_hash      TEXT,
  activo             INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  intentos_fallidos  INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta    TEXT,
  creado_en          TEXT NOT NULL,
  creado_por         INTEGER REFERENCES usuarios(id),
  activado_en        TEXT,
  ultimo_acceso      TEXT
);

-- US9: sesiones. Se guarda solo el hash SHA-256 del token, nunca el token.
CREATE TABLE IF NOT EXISTS sesiones (
  id                 INTEGER PRIMARY KEY,
  usuario_id         INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash         TEXT NOT NULL UNIQUE,
  plataforma         TEXT NOT NULL CHECK (plataforma IN ('web', 'movil')),
  creada_en          TEXT NOT NULL,
  ultima_actividad   TEXT NOT NULL,
  expira_en          TEXT NOT NULL,
  revocada_en        TEXT,
  motivo_revocacion  TEXT
);
CREATE INDEX IF NOT EXISTS ix_sesiones_usuario ON sesiones(usuario_id);

-- US8: enlaces de activación de las cuentas creadas por la FIA (de un solo uso y con vencimiento).
CREATE TABLE IF NOT EXISTS tokens_activacion (
  id          INTEGER PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  creado_en   TEXT NOT NULL,
  expira_en   TEXT NOT NULL,
  usado_en    TEXT,
  anulado_en  TEXT
);

-- US8: escuderías. El nombre oficial no se puede repetir dentro de una categoría.
CREATE TABLE IF NOT EXISTS escuderias (
  id                  INTEGER PRIMARY KEY,
  nombre_oficial      TEXT NOT NULL,
  nombre_normalizado  TEXT NOT NULL,
  categoria_id        INTEGER NOT NULL REFERENCES categorias(id),
  pais                TEXT NOT NULL,
  sede                TEXT,
  activa              INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  creada_en           TEXT NOT NULL,
  creada_por          INTEGER NOT NULL REFERENCES usuarios(id),
  actualizada_en      TEXT NOT NULL,
  UNIQUE (nombre_normalizado, categoria_id)
);

-- US8/US2: una cuenta de escudería puede tener asociadas varias escuderías
-- (por ejemplo, el mismo equipo en F2 y en F3) y elige con cuál trabajar.
CREATE TABLE IF NOT EXISTS usuario_escuderia (
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  escuderia_id  INTEGER NOT NULL REFERENCES escuderias(id) ON DELETE CASCADE,
  asignado_en   TEXT NOT NULL,
  asignado_por  INTEGER REFERENCES usuarios(id),
  PRIMARY KEY (usuario_id, escuderia_id)
);

-- US2: nómina de pilotos. categoria_id se copia de la escudería para poder
-- garantizar en la base que el número no se repita dentro de la categoría.
CREATE TABLE IF NOT EXISTS pilotos (
  id                INTEGER PRIMARY KEY,
  escuderia_id      INTEGER NOT NULL REFERENCES escuderias(id),
  categoria_id      INTEGER NOT NULL REFERENCES categorias(id),
  nombre            TEXT NOT NULL,
  apellido          TEXT NOT NULL,
  nacionalidad      TEXT NOT NULL,
  fecha_nacimiento  TEXT NOT NULL,
  numero            INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 99),
  rol               TEXT NOT NULL CHECK (rol IN ('TITULAR', 'SUPLENTE')),
  activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en         TEXT NOT NULL,
  actualizado_en    TEXT NOT NULL,
  dado_de_baja_en   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pilotos_categoria_numero
  ON pilotos(categoria_id, numero) WHERE activo = 1;
CREATE INDEX IF NOT EXISTS ix_pilotos_escuderia ON pilotos(escuderia_id);

-- US8: registro de auditoría (usuario, fecha y hora de cada alta y cambio).
CREATE TABLE IF NOT EXISTS auditoria (
  id             INTEGER PRIMARY KEY,
  fecha_hora     TEXT NOT NULL,
  usuario_id     INTEGER REFERENCES usuarios(id),
  usuario_email  TEXT,
  accion         TEXT NOT NULL,
  entidad        TEXT,
  entidad_id     INTEGER,
  detalle        TEXT,
  ip             TEXT
);
CREATE INDEX IF NOT EXISTS ix_auditoria_fecha ON auditoria(fecha_hora);

-- Bandeja de salida de correos. En modo desarrollo guarda el cuerpo para poder mostrarlo en la demo;
-- con SMTP solo guarda los metadatos del envío.
CREATE TABLE IF NOT EXISTS correos (
  id          INTEGER PRIMARY KEY,
  para        TEXT NOT NULL,
  asunto      TEXT NOT NULL,
  cuerpo      TEXT,
  transporte  TEXT NOT NULL,
  estado      TEXT NOT NULL,
  error       TEXT,
  enviado_en  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tipos_infraccion (
  id      INTEGER PRIMARY KEY,
  codigo  TEXT NOT NULL UNIQUE,
  nombre  TEXT NOT NULL,
  clase   TEXT NOT NULL CHECK (clase IN ('TECNICA', 'CARRERA'))
);

CREATE TABLE IF NOT EXISTS sanciones (
  id                  INTEGER PRIMARY KEY,
  escuderia_id        INTEGER NOT NULL REFERENCES escuderias(id),
  piloto_id           INTEGER REFERENCES pilotos(id),
  categoria_id        INTEGER NOT NULL REFERENCES categorias(id),
  tipo_infraccion_id  INTEGER NOT NULL REFERENCES tipos_infraccion(id),
  fecha_infraccion    TEXT NOT NULL,
  penalizacion        TEXT NOT NULL,
  descripcion         TEXT NOT NULL,
  estado              TEXT NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'PUBLICADA')),
  creada_en           TEXT NOT NULL,
  creada_por          INTEGER NOT NULL REFERENCES usuarios(id),
  actualizada_en      TEXT NOT NULL,
  publicada_en        TEXT,
  publicada_por       INTEGER REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS ix_sanciones_escuderia ON sanciones(escuderia_id);
CREATE INDEX IF NOT EXISTS ix_sanciones_piloto ON sanciones(piloto_id);

CREATE TABLE IF NOT EXISTS notificaciones_sancion (
  id             INTEGER PRIMARY KEY,
  sancion_id     INTEGER NOT NULL UNIQUE REFERENCES sanciones(id) ON DELETE CASCADE,
  escuderia_id   INTEGER NOT NULL REFERENCES escuderias(id),
  notificada_en  TEXT NOT NULL,
  firmada_en     TEXT,
  firmada_por    INTEGER REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS inspecciones (
  id              INTEGER PRIMARY KEY,
  escuderia_id    INTEGER NOT NULL REFERENCES escuderias(id),
  piloto_id       INTEGER NOT NULL REFERENCES pilotos(id),
  categoria_id    INTEGER NOT NULL REFERENCES categorias(id),
  fecha           TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN (${lista(TIPOS_INSPECCION)})),
  estado_tecnico  TEXT NOT NULL CHECK (estado_tecnico IN (${lista(ESTADOS_TECNICOS)})),
  observaciones   TEXT,
  creada_en       TEXT NOT NULL,
  creada_por      INTEGER NOT NULL REFERENCES usuarios(id),
  actualizada_en  TEXT NOT NULL,
  actualizada_por INTEGER NOT NULL REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS ix_inspecciones_escuderia ON inspecciones(escuderia_id);

CREATE TABLE IF NOT EXISTS eventos_calendario (
  id                INTEGER PRIMARY KEY,
  categoria_id      INTEGER NOT NULL REFERENCES categorias(id),
  nombre            TEXT NOT NULL,
  tipo              TEXT NOT NULL CHECK (tipo IN (${lista(TIPOS_EVENTO)})),
  circuito          TEXT NOT NULL,
  pais              TEXT NOT NULL,
  fecha             TEXT NOT NULL,
  hora              TEXT,
  estado            TEXT NOT NULL DEFAULT 'ESPECULATIVA' CHECK (estado IN ('ESPECULATIVA', 'OFICIAL')),
  creado_en         TEXT NOT NULL,
  creado_por        INTEGER NOT NULL REFERENCES usuarios(id),
  actualizado_en    TEXT NOT NULL,
  oficializado_en   TEXT,
  oficializado_por  INTEGER REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS ix_eventos_calendario_fecha ON eventos_calendario(fecha);
`;
