


export function crearCanalDeEventos() {
  const clientes = new Set();

  function suscribir(req, res) {
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    clientes.add(res);
    const latido = setInterval(() => res.write(': latido\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(latido);
      clientes.delete(res);
    });
  }

  function publicar(tipo, datos) {
    const mensaje = `event: ${tipo}\ndata: ${JSON.stringify(datos)}\n\n`;
    for (const res of clientes) res.write(mensaje);
  }

  function cerrarTodo() {
    for (const res of clientes) res.end();
    clientes.clear();
  }

  return {
    suscribir,
    publicar,
    cerrarTodo,
    get cantidad() {
      return clientes.size;
    },
  };
}
