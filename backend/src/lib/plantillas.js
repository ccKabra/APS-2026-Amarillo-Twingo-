const FIRMA = '\n—\nPlataforma Integral FIA\nEste es un mensaje automático, por favor no lo respondas.';

function listaDeEscuderias(escuderias) {
  return escuderias.map((e) => `  • ${e.nombreOficial} (${e.categoriaNombre})`).join('\n');
}

export function credencialesEscuderia({ nombre, email, escuderias, enlace, validezHoras }) {
  return {
    asunto: 'Tus credenciales de acceso a la Plataforma FIA',
    texto: [
      `Hola ${nombre}:`,
      '',
      'La FIA te designó como responsable de:',
      listaDeEscuderias(escuderias),
      '',
      'Tus credenciales de acceso son:',
      `  • Usuario: ${email}`,
      `  • Contraseña: la definís vos desde este enlace (válido por ${validezHoras} horas):`,
      `    ${enlace}`,
      '',
      'Por seguridad, la plataforma nunca envía contraseñas por correo.',
      'Una vez activada la cuenta vas a poder ingresar a la interfaz de escudería y gestionar la nómina de pilotos.',
      FIRMA,
    ].join('\n'),
  };
}

export function credencialesFia({ nombre, email, enlace, validezHoras }) {
  return {
    asunto: 'Tu cuenta de administración en la Plataforma FIA',
    texto: [
      `Hola ${nombre}:`,
      '',
      'Se creó tu cuenta de personal administrativo de la FIA.',
      `  • Usuario: ${email}`,
      `  • Contraseña: la definís vos desde este enlace (válido por ${validezHoras} horas):`,
      `    ${enlace}`,
      '',
      'Por seguridad, la plataforma nunca envía contraseñas por correo.',
      FIRMA,
    ].join('\n'),
  };
}

export function escuderiaAsignada({ nombre, escuderia }) {
  return {
    asunto: `Se te asignó la escudería ${escuderia.nombreOficial}`,
    texto: [
      `Hola ${nombre}:`,
      '',
      `La FIA asoció la escudería ${escuderia.nombreOficial} (${escuderia.categoriaNombre}) a tu cuenta.`,
      'Ya podés seleccionarla desde la interfaz de escudería para gestionar su nómina de pilotos.',
      FIRMA,
    ].join('\n'),
  };
}
