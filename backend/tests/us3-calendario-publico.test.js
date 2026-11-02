import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor } from './ayudantes.js';

describe('US3 · Consulta y descarga del calendario', () => {
  let s;
  before(async () => {
    s = await iniciarServidor();
  });
  after(() => s.cerrar());

  async function descargar(consulta = '') {
    const respuesta = await fetch(`${s.base}/api/publico/calendario/descargar${consulta}`);
    return { respuesta, texto: await respuesta.text() };
  }

  test('el público ve todas las carreras y eventos sin iniciar sesión', async () => {
    const { status, body } = await s.api('GET', '/api/publico/calendario');
    const total = s.db.prepare('SELECT COUNT(*) AS n FROM eventos_calendario').get().n;
    assert.equal(status, 200);
    assert.equal(body.eventos.length, total);
  });

  test('filtra por rango de fechas, incluyendo los extremos', async () => {
    const { body } = await s.api('GET', '/api/publico/calendario?desde=2026-11-07&hasta=2026-11-15');
    assert.deepEqual(
      body.eventos.map((e) => e.fecha),
      ['2026-11-07', '2026-11-08', '2026-11-15'],
    );
  });

  test('el rango se combina con la categoría', async () => {
    const { body } = await s.api('GET', '/api/publico/calendario?desde=2026-11-07&hasta=2026-11-15&categoria=F3');
    assert.deepEqual(
      body.eventos.map((e) => e.categoria.codigo),
      ['F3'],
    );
  });

  test('rechaza fechas inválidas y un rango invertido', async () => {
    const invalida = await s.api('GET', '/api/publico/calendario?desde=ayer');
    assert.equal(invalida.status, 400);
    assert.ok(invalida.body.detalles.desde);
    const invertido = await s.api('GET', '/api/publico/calendario?desde=2026-12-01&hasta=2026-11-01');
    assert.equal(invertido.status, 400);
    assert.ok(invertido.body.detalles.hasta);
  });

  test('descarga el calendario en formato iCalendar sin iniciar sesión', async () => {
    const { respuesta, texto } = await descargar();
    assert.equal(respuesta.status, 200);
    assert.match(respuesta.headers.get('content-type'), /^text\/calendar/);
    assert.match(respuesta.headers.get('content-disposition'), /attachment; filename="calendario-fia\.ics"/);
    assert.ok(texto.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(texto.endsWith('END:VCALENDAR\r\n'));
    const total = s.db.prepare('SELECT COUNT(*) AS n FROM eventos_calendario').get().n;
    assert.equal(texto.match(/BEGIN:VEVENT/g).length, total);
  });

  test('la descarga distingue fechas oficiales, especulativas y sin hora', async () => {
    const { texto } = await descargar();
    assert.match(texto, /DTSTART:20261108T140000/);
    assert.match(texto, /STATUS:CONFIRMED/);
    assert.match(texto, /DTSTART;VALUE=DATE:20261209/);
    assert.match(texto, /STATUS:TENTATIVE/);
  });

  test('la descarga respeta los filtros aplicados', async () => {
    const { texto } = await descargar('?categoria=F3&mes=2026-11');
    assert.equal(texto.match(/BEGIN:VEVENT/g).length, 1);
    assert.match(texto, /Termas de Río Hondo/);
  });

  test('las líneas del archivo respetan el límite de 75 octetos', async () => {
    const { texto } = await descargar();
    for (const linea of texto.split('\r\n')) assert.ok(Buffer.byteLength(linea) <= 75, linea);
  });
});
