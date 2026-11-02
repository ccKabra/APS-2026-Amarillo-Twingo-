import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCUDERIAS_DEMO, escucharEventos, iniciarServidor } from './ayudantes.js';

const pdf = (texto) => Buffer.from(`%PDF-1.4\n${texto}\n%%EOF\n`, 'latin1');

function publicar(s, token, { categoria = 'F3', tipo = 'TECNICO', titulo = 'Reglamento Técnico F3', cuerpo = pdf('v1') } = {}) {
  const consulta = new URLSearchParams({ categoria, tipo, titulo });
  return fetch(`${s.base}/api/fia/reglamentos?${consulta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/pdf', ...(token && { authorization: `Bearer ${token}` }) },
    body: cuerpo,
  });
}

describe('US12 · La FIA carga y actualiza los reglamentos de cada categoría', () => {
  let s;
  let tokenFia;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
  });
  after(() => s.cerrar());

  test('publica un reglamento nuevo para una categoría', async () => {
    const respuesta = await publicar(s, tokenFia);
    const { reglamento } = await respuesta.json();
    assert.equal(respuesta.status, 201);
    assert.equal(reglamento.version, 1);
    assert.equal(reglamento.vigente, true);
    assert.equal(reglamento.publicadoPor, 'Laura Méndez');
    assert.ok(s.db.prepare("SELECT 1 FROM auditoria WHERE accion = 'REGLAMENTO_PUBLICADO'").get());
  });

  test('al actualizar se numera una versión nueva', async () => {
    const { reglamento } = await (await publicar(s, tokenFia, { cuerpo: pdf('v2'), titulo: 'Técnico F3 rev. 2' })).json();
    assert.equal(reglamento.version, 2);
  });

  test('la versión de cada tipo y categoría es independiente', async () => {
    const otraCategoria = await (await publicar(s, tokenFia, { categoria: 'F1A' })).json();
    const otroTipo = await (await publicar(s, tokenFia, { categoria: 'F2', tipo: 'DEPORTIVO' })).json();
    assert.equal(otraCategoria.reglamento.version, 1);
    assert.equal(otroTipo.reglamento.version, 1);
  });

  test('solo acepta documentos PDF', async () => {
    const r = await publicar(s, tokenFia, { cuerpo: Buffer.from('<html>no soy un pdf</html>') });
    assert.equal(r.status, 400);
    assert.ok((await r.json()).detalles.documento);
  });

  test('valida categoría, tipo y título', async () => {
    const r = await publicar(s, tokenFia, { categoria: 'GT3', tipo: 'OTRO', titulo: ' ' });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys((await r.json()).detalles).sort(), ['categoria', 'tipo', 'titulo']);
  });

  test('rechaza un documento de más de 10 MB', async () => {
    const r = await publicar(s, tokenFia, { cuerpo: Buffer.concat([pdf('x'), Buffer.alloc(10 * 1024 * 1024 + 1)]) });
    assert.equal(r.status, 413);
  });

  test('solo la FIA puede publicar', async () => {
    assert.equal((await publicar(s, await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email))).status, 403);
    assert.equal((await publicar(s, await s.loginPublico())).status, 403);
    assert.equal((await publicar(s, null)).status, 401);
  });
});

describe('US12 · El sistema muestra solo la versión oficial vigente', () => {
  let s;
  let tokenFia;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    await publicar(s, tokenFia, { cuerpo: pdf('version-uno'), titulo: 'Primera edición' });
    await publicar(s, tokenFia, { cuerpo: pdf('version-dos'), titulo: 'Segunda edición' });
  });
  after(() => s.cerrar());

  const vigentesF3 = async () => (await s.api('GET', '/api/publico/reglamentos?categoria=F3')).body.reglamentos;

  test('la lista pública muestra solo la última versión', async () => {
    const lista = (await vigentesF3()).filter((r) => r.tipo === 'TECNICO');
    assert.equal(lista.length, 1);
    assert.equal(lista[0].titulo, 'Segunda edición');
    assert.equal(lista[0].version, 2);
  });

  test('el mismo enlace público entrega siempre el documento vigente', async () => {
    const respuesta = await fetch(`${s.base}/api/publico/reglamentos/F3/TECNICO/documento`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get('content-type'), 'application/pdf');
    assert.match(await respuesta.text(), /version-dos/);
  });

  test('la base garantiza una sola versión vigente', () => {
    const { n } = s.db
      .prepare(
        "SELECT COUNT(*) AS n FROM reglamentos r JOIN categorias c ON c.id = r.categoria_id WHERE c.codigo = 'F3' AND r.tipo = 'TECNICO' AND r.vigente = 1",
      )
      .get();
    assert.equal(n, 1);
    assert.throws(() => s.db.prepare("UPDATE reglamentos SET vigente = 1 WHERE titulo = 'Primera edición'").run(), /UNIQUE/);
  });

  test('la FIA conserva el historial y puede abrir versiones anteriores', async () => {
    const { body } = await s.api('GET', '/api/fia/reglamentos?categoria=F3', { token: tokenFia });
    const anterior = body.reglamentos.find((r) => r.titulo === 'Primera edición');
    assert.equal(anterior.vigente, false);
    assert.ok(anterior.reemplazadoEn);
    const respuesta = await fetch(`${s.base}/api/fia/reglamentos/${anterior.id}/documento`, {
      headers: { authorization: `Bearer ${tokenFia}` },
    });
    assert.match(await respuesta.text(), /version-uno/);
  });

  test('una versión anterior no es accesible fuera de la FIA', async () => {
    const { body } = await s.api('GET', '/api/fia/reglamentos?categoria=F3', { token: tokenFia });
    const anterior = body.reglamentos.find((r) => !r.vigente);
    const token = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    assert.equal((await s.api('GET', `/api/fia/reglamentos/${anterior.id}/documento`, { token })).status, 403);
    assert.equal((await s.api('GET', `/api/fia/reglamentos/${anterior.id}/documento`)).status, 401);
  });

  test('si falla la publicación, sigue vigente la versión anterior', async () => {
    await publicar(s, tokenFia, { cuerpo: Buffer.from('dañado') });
    assert.equal((await vigentesF3()).find((r) => r.tipo === 'TECNICO').titulo, 'Segunda edición');
  });

  test('la lista trae el enlace al documento y no su contenido', async () => {
    assert.ok((await vigentesF3()).every((r) => r.documento.startsWith('/api/publico/reglamentos/F3/')));
  });
});

describe('US12 · Escuderías y público acceden a los reglamentos', () => {
  let s;
  let aviso;
  before(async () => {
    s = await iniciarServidor();
    const escucha = await escucharEventos(s.base);
    await publicar(s, await s.loginFia(), { categoria: 'F1A', titulo: 'Reglamento Técnico F1 Academy' });
    aviso = await escucha.esperar(/event: reglamentos/);
  });
  after(() => s.cerrar());

  test('el público lo consulta sin iniciar sesión', async () => {
    const { status, body } = await s.api('GET', '/api/publico/reglamentos');
    assert.equal(status, 200);
    assert.ok(body.reglamentos.some((r) => r.titulo === 'Reglamento Técnico F1 Academy'));
    assert.ok(body.reglamentos.every((r) => !('publicadoPor' in r)));
  });

  test('lo consulta una escudería', async () => {
    const token = await s.loginEscuderia(ESCUDERIAS_DEMO.pampa.email);
    const { body } = await s.api('GET', '/api/publico/reglamentos?categoria=F1A', { token });
    assert.equal(body.reglamentos.length, 1);
  });

  test('una combinación sin reglamento devuelve 404', async () => {
    assert.equal((await s.api('GET', '/api/publico/reglamentos/F1A/DEPORTIVO/documento')).status, 404);
  });

  test('el aviso en vivo lo hace disponible de inmediato en las vistas abiertas', () => {
    assert.match(aviso, /"categoria":"F1A"/);
  });
});
