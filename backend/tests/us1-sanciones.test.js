import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCUDERIAS_DEMO, escucharEventos, idsDemo, iniciarServidor } from './ayudantes.js';

function sancionValida(extra = {}) {
  return {
    tipoInfraccion: 'VELOCIDAD_EN_BOXES',
    fechaInfraccion: '2026-09-27',
    penalizacion: 'Multa de 2.000 €',
    descripcion: 'Superó el límite de velocidad en la calle de boxes durante la clasificación.',
    ...extra,
  };
}

describe('US1 · La FIA crea, guarda y publica sanciones asociadas a un piloto o a una escudería', () => {
  let s;
  let tokenFia;
  let ids;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    ids = await idsDemo(s);
  });
  after(() => s.cerrar());

  test('guarda una sanción como borrador asociada a un piloto, sin publicarla todavía', async () => {
    const piloto = ids.piloto('F1', 12);
    const r = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.andes.id, pilotoId: piloto.id }),
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.sancion.estado, 'BORRADOR');
    assert.equal(r.body.sancion.piloto.id, piloto.id);
    assert.equal(r.body.sancion.escuderia.id, ids.andes.id);
    assert.equal(r.body.sancion.notificacion, null);
    const publico = await s.api('GET', '/api/publico/sanciones');
    assert.ok(publico.body.sanciones.every((x) => x.id !== r.body.sancion.id), 'un borrador no es visible');
  });

  test('modifica un borrador y después lo publica', async () => {
    const alta = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.atlantico.id }),
    });
    const id = alta.body.sancion.id;
    const cambio = await s.api('PUT', `/api/fia/sanciones/${id}`, {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.atlantico.id, penalizacion: 'Multa de 3.000 €' }),
    });
    assert.equal(cambio.status, 200);
    assert.equal(cambio.body.sancion.penalizacion, 'Multa de 3.000 €');
    const publicacion = await s.api('POST', `/api/fia/sanciones/${id}/publicar`, { token: tokenFia });
    assert.equal(publicacion.status, 200);
    assert.equal(publicacion.body.sancion.estado, 'PUBLICADA');
    assert.ok(publicacion.body.sancion.publicadaEn);
  });

  test('crea y publica en un solo paso una sanción a toda la escudería', async () => {
    const r = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.pampaF3.id, tipoInfraccion: 'NEUMATICOS', publicar: true }),
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.sancion.estado, 'PUBLICADA');
    assert.equal(r.body.sancion.piloto, null);
    assert.equal(r.body.sancion.categoria.codigo, 'F3');
  });

  test('valida los datos obligatorios antes de guardar', async () => {
    const r = await s.api('POST', '/api/fia/sanciones', { token: tokenFia, body: {} });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.detalles).sort(), [
      'descripcion',
      'escuderiaId',
      'fechaInfraccion',
      'penalizacion',
      'tipoInfraccion',
    ]);
  });

  test('rechaza un tipo de infracción inexistente, una fecha futura y un piloto de otra escudería', async () => {
    const r = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({
        escuderiaId: ids.andes.id,
        pilotoId: ids.piloto('F1', 7).id,
        tipoInfraccion: 'NO_EXISTE',
        fechaInfraccion: '2026-12-01',
      }),
    });
    assert.equal(r.status, 400);
    assert.ok(r.body.detalles.pilotoId);
    assert.ok(r.body.detalles.tipoInfraccion);
    assert.ok(r.body.detalles.fechaInfraccion);
  });

  test('una sanción publicada no se puede modificar ni eliminar', async () => {
    const { body } = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.aurora.id, publicar: true }),
    });
    const id = body.sancion.id;
    const put = await s.api('PUT', `/api/fia/sanciones/${id}`, {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.aurora.id }),
    });
    assert.equal(put.status, 409);
    assert.equal((await s.api('DELETE', `/api/fia/sanciones/${id}`, { token: tokenFia })).status, 409);
    assert.equal((await s.api('POST', `/api/fia/sanciones/${id}/publicar`, { token: tokenFia })).status, 409);
  });

  test('un borrador se puede eliminar', async () => {
    const { body } = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.aurora.id }),
    });
    assert.equal((await s.api('DELETE', `/api/fia/sanciones/${body.sancion.id}`, { token: tokenFia })).status, 204);
    const lista = await s.api('GET', '/api/fia/sanciones', { token: tokenFia });
    assert.ok(lista.body.sanciones.every((x) => x.id !== body.sancion.id));
  });

  test('las altas y publicaciones quedan registradas en la auditoría', () => {
    const acciones = s.db
      .prepare("SELECT accion FROM auditoria WHERE accion LIKE 'SANCION_%'")
      .all()
      .map((a) => a.accion);
    for (const accion of ['SANCION_ALTA', 'SANCION_MODIFICACION', 'SANCION_PUBLICACION', 'SANCION_ELIMINADA']) {
      assert.ok(acciones.includes(accion), accion);
    }
  });

  test('solo la FIA puede crear sanciones, ni la escudería ni el público', async () => {
    const tokenEscuderia = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    const tokenPublico = await s.loginPublico();
    const body = sancionValida({ escuderiaId: ids.atlantico.id });
    assert.equal((await s.api('POST', '/api/fia/sanciones', { token: tokenEscuderia, body })).status, 403);
    assert.equal((await s.api('POST', '/api/fia/sanciones', { token: tokenPublico, body })).status, 403);
    assert.equal((await s.api('POST', '/api/fia/sanciones', { body })).status, 401);
  });
});

describe('US1 · Al publicar una sanción es visible en todos los perfiles', () => {
  let s;
  let tokenFia;
  let ids;
  let sancion;
  let aviso;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    ids = await idsDemo(s);
    const escucha = await escucharEventos(s.base);
    const r = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.andes.id, pilotoId: ids.piloto('F1', 31).id, publicar: true }),
    });
    sancion = r.body.sancion;
    aviso = await escucha.esperar(/event: sanciones/);
  });
  after(() => s.cerrar());

  test('la ve el público general, incluso sin iniciar sesión', async () => {
    const anonimo = await s.api('GET', '/api/publico/sanciones');
    assert.ok(anonimo.body.sanciones.some((x) => x.id === sancion.id));
    const tokenPublico = await s.loginPublico();
    const publico = await s.api('GET', '/api/publico/sanciones', { token: tokenPublico });
    assert.ok(publico.body.sanciones.some((x) => x.id === sancion.id));
  });

  test('la ve la escudería sancionada en su panel y las demás escuderías en la vista pública', async () => {
    const tokenAndes = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    const propia = await s.api('GET', `/api/escuderia/${ids.andes.id}/sanciones`, { token: tokenAndes });
    assert.equal(propia.status, 200);
    assert.ok(propia.body.sanciones.some((x) => x.id === sancion.id));
    const tokenAtlantico = await s.loginEscuderia('sofia.pereyra@atlanticogp.test');
    const ajena = await s.api('GET', '/api/publico/sanciones', { token: tokenAtlantico });
    assert.ok(ajena.body.sanciones.some((x) => x.id === sancion.id));
  });

  test('la ve la FIA en su listado', async () => {
    const r = await s.api('GET', '/api/fia/sanciones', { token: tokenFia });
    assert.ok(r.body.sanciones.some((x) => x.id === sancion.id && x.estado === 'PUBLICADA'));
  });

  test('la escudería no ve los borradores de la FIA', async () => {
    const borrador = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.andes.id }),
    });
    const tokenAndes = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    const r = await s.api('GET', `/api/escuderia/${ids.andes.id}/sanciones`, { token: tokenAndes });
    assert.ok(r.body.sanciones.every((x) => x.id !== borrador.body.sancion.id));
  });

  test('se avisa por correo a los responsables de la escudería', () => {
    const correo = s.ultimoCorreoPara(ESCUDERIAS_DEMO.andes.email);
    assert.match(correo.asunto, /Notificación de sanción/);
    assert.match(correo.cuerpo, /No enterado/);
    assert.match(correo.cuerpo, /Facundo Ibarra/);
  });

  test('las vistas abiertas reciben un aviso en vivo', () => {
    assert.match(aviso, /event: sanciones/);
    assert.match(aviso, /"accion":"publicacion"/);
  });
});

describe('US1 · La sanción figura como «no enterado» hasta que la escudería la firma', () => {
  let s;
  let tokenFia;
  let tokenAndes;
  let ids;
  let sancion;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    tokenAndes = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    ids = await idsDemo(s);
    const r = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.andes.id, publicar: true }),
    });
    sancion = r.body.sancion;
  });
  after(() => s.cerrar());

  test('al publicarse figura como no enterado en todos los perfiles', async () => {
    assert.equal(sancion.notificacion.estado, 'NO_ENTERADO');
    const publico = await s.api('GET', '/api/publico/sanciones');
    assert.equal(publico.body.sanciones.find((x) => x.id === sancion.id).notificacion.estado, 'NO_ENTERADO');
    const propia = await s.api('GET', `/api/escuderia/${ids.andes.id}/sanciones`, { token: tokenAndes });
    assert.equal(propia.body.sanciones.find((x) => x.id === sancion.id).notificacion.firmadaEn, null);
  });

  test('otra escudería no puede firmarla', async () => {
    const tokenAtlantico = await s.loginEscuderia('sofia.pereyra@atlanticogp.test');
    const conSuEscuderia = await s.api('POST', `/api/escuderia/${ids.atlantico.id}/sanciones/${sancion.id}/firmar`, {
      token: tokenAtlantico,
    });
    assert.equal(conSuEscuderia.status, 404);
    const conLaAjena = await s.api('POST', `/api/escuderia/${ids.andes.id}/sanciones/${sancion.id}/firmar`, {
      token: tokenAtlantico,
    });
    assert.equal(conLaAjena.status, 403);
  });

  test('la firma es una acción reservada a la escudería: la FIA y el público no pueden firmar', async () => {
    const ruta = `/api/escuderia/${ids.andes.id}/sanciones/${sancion.id}/firmar`;
    assert.equal((await s.api('POST', ruta, { token: tokenFia })).status, 403);
    assert.equal((await s.api('POST', ruta, { token: await s.loginPublico() })).status, 403);
  });

  test('la escudería firma y pasa a figurar como enterada', async () => {
    const r = await s.api('POST', `/api/escuderia/${ids.andes.id}/sanciones/${sancion.id}/firmar`, { token: tokenAndes });
    assert.equal(r.status, 200);
    assert.equal(r.body.sancion.notificacion.estado, 'ENTERADO');
    assert.equal(r.body.sancion.notificacion.firmadaPor, 'Martín Ríos');
    const publico = await s.api('GET', '/api/publico/sanciones');
    const vista = publico.body.sanciones.find((x) => x.id === sancion.id);
    assert.equal(vista.notificacion.estado, 'ENTERADO');
    assert.ok(vista.notificacion.firmadaEn);
    const fia = await s.api('GET', '/api/fia/sanciones', { token: tokenFia });
    assert.equal(fia.body.sanciones.find((x) => x.id === sancion.id).notificacion.firmadaPor, 'Martín Ríos');
  });

  test('no se puede firmar dos veces y la firma queda auditada', async () => {
    const r = await s.api('POST', `/api/escuderia/${ids.andes.id}/sanciones/${sancion.id}/firmar`, { token: tokenAndes });
    assert.equal(r.status, 409);
    const firma = s.db.prepare("SELECT * FROM auditoria WHERE accion = 'SANCION_FIRMA' AND entidad_id = ?").get(sancion.id);
    assert.equal(firma.usuario_email, ESCUDERIAS_DEMO.andes.email);
  });

  test('un borrador no se puede firmar', async () => {
    const borrador = await s.api('POST', '/api/fia/sanciones', {
      token: tokenFia,
      body: sancionValida({ escuderiaId: ids.andes.id }),
    });
    const r = await s.api('POST', `/api/escuderia/${ids.andes.id}/sanciones/${borrador.body.sancion.id}/firmar`, {
      token: tokenAndes,
    });
    assert.equal(r.status, 404);
  });
});

describe('US1 · Filtro de sanciones por escudería y piloto', () => {
  let s;
  let tokenFia;
  let ids;
  before(async () => {
    s = await iniciarServidor();
    tokenFia = await s.loginFia();
    ids = await idsDemo(s);
    for (const [escuderia, piloto] of [
      [ids.andes, ids.piloto('F1', 12)],
      [ids.andes, null],
      [ids.atlantico, ids.piloto('F1', 23)],
    ]) {
      await s.api('POST', '/api/fia/sanciones', {
        token: tokenFia,
        body: sancionValida({ escuderiaId: escuderia.id, pilotoId: piloto?.id ?? null, publicar: true }),
      });
    }
  });
  after(() => s.cerrar());

  test('filtra por escudería', async () => {
    const { body } = await s.api('GET', `/api/publico/sanciones?escuderia=${ids.andes.id}`);
    assert.ok(body.sanciones.length >= 3);
    assert.ok(body.sanciones.every((x) => x.escuderia.id === ids.andes.id));
    const total = s.db
      .prepare("SELECT COUNT(*) AS n FROM sanciones WHERE escuderia_id = ? AND estado = 'PUBLICADA'")
      .get(ids.andes.id).n;
    assert.equal(body.sanciones.length, total);
  });

  test('filtra por piloto', async () => {
    const piloto = ids.piloto('F1', 12);
    const { body } = await s.api('GET', `/api/publico/sanciones?piloto=${piloto.id}`);
    assert.equal(body.sanciones.length, 1);
    assert.equal(body.sanciones[0].piloto.id, piloto.id);
  });

  test('combina escudería y piloto, y filtra por categoría', async () => {
    const combinado = await s.api('GET', `/api/publico/sanciones?escuderia=${ids.atlantico.id}&piloto=${ids.piloto('F1', 12).id}`);
    assert.equal(combinado.body.sanciones.length, 0);
    const f2 = await s.api('GET', '/api/publico/sanciones?categoria=F2');
    assert.ok(f2.body.sanciones.length > 0);
    assert.ok(f2.body.sanciones.every((x) => x.categoria.codigo === 'F2'));
  });

  test('la FIA además filtra por estado (borradores y publicadas)', async () => {
    const borradores = await s.api('GET', '/api/fia/sanciones?estado=BORRADOR', { token: tokenFia });
    assert.ok(borradores.body.sanciones.length > 0);
    assert.ok(borradores.body.sanciones.every((x) => x.estado === 'BORRADOR'));
    const publicadas = await s.api('GET', `/api/fia/sanciones?estado=PUBLICADA&escuderia=${ids.atlantico.id}`, {
      token: tokenFia,
    });
    assert.ok(publicadas.body.sanciones.every((x) => x.estado === 'PUBLICADA' && x.escuderia.id === ids.atlantico.id));
  });

  test('la escudería filtra sus sanciones por piloto', async () => {
    const token = await s.loginEscuderia(ESCUDERIAS_DEMO.andes.email);
    const piloto = ids.piloto('F1', 12);
    const { body } = await s.api('GET', `/api/escuderia/${ids.andes.id}/sanciones?piloto=${piloto.id}`, { token });
    assert.ok(body.sanciones.length > 0);
    assert.ok(body.sanciones.every((x) => x.piloto?.id === piloto.id));
  });
});
