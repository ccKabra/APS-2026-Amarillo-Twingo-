function escapar(texto) {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// RFC 5545: las líneas no pueden superar los 75 octetos.
function plegar(linea) {
  const partes = [];
  let actual = '';
  let octetos = 0;
  for (const caracter of linea) {
    const tamanio = Buffer.byteLength(caracter);
    if (octetos + tamanio > 75) {
      partes.push(actual);
      actual = ' ';
      octetos = 1;
    }
    actual += caracter;
    octetos += tamanio;
  }
  partes.push(actual);
  return partes.join('\r\n');
}

const compacta = (fecha) => fecha.replaceAll('-', '');
const marcaUtc = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function lineasDeEvento(evento) {
  const inicio = evento.hora
    ? [`DTSTART:${compacta(evento.fecha)}T${evento.hora.replace(':', '')}00`, 'DURATION:PT2H']
    : [`DTSTART;VALUE=DATE:${compacta(evento.fecha)}`];
  const oficial = evento.estado === 'OFICIAL';
  return [
    'BEGIN:VEVENT',
    `UID:evento-${evento.id}@plataforma-fia`,
    `DTSTAMP:${marcaUtc(evento.actualizadoEn)}`,
    ...inicio,
    `SUMMARY:${escapar(`[${evento.categoria.codigo}] ${evento.nombre}`)}`,
    `LOCATION:${escapar(`${evento.circuito}, ${evento.pais}`)}`,
    `DESCRIPTION:${escapar(`${evento.categoria.nombre}. Fecha ${oficial ? 'oficial' : 'especulativa'}.`)}`,
    `STATUS:${oficial ? 'CONFIRMED' : 'TENTATIVE'}`,
    'END:VEVENT',
  ];
}

export function calendarioIcs(eventos) {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plataforma Integral FIA//Calendario//ES',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Calendario FIA',
    ...eventos.flatMap(lineasDeEvento),
    'END:VCALENDAR',
  ];
  return `${lineas.map(plegar).join('\r\n')}\r\n`;
}
