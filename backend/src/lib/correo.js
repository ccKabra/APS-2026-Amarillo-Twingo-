export function crearServicioDeCorreo({ db, config, reloj }) {
  const insertar = db.prepare(`
    INSERT INTO correos (para, asunto, cuerpo, transporte, estado, error, enviado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  let transporteSmtp = null;

  async function enviarPorSmtp({ para, asunto, texto }) {
    if (!transporteSmtp) {
      const { default: nodemailer } = await import('nodemailer');
      const { host, port, secure, user, pass } = config.correo.smtp;
      transporteSmtp = nodemailer.createTransport({ host, port, secure, auth: user ? { user, pass } : undefined });
    }
    await transporteSmtp.sendMail({ from: config.correo.remitente, to: para, subject: asunto, text: texto });
  }

  async function enviar({ para, asunto, texto }) {
    const ahora = reloj.ahora().toISOString();
    if (config.correo.transporte === 'smtp') {
      try {
        await enviarPorSmtp({ para, asunto, texto });
        insertar.run(para, asunto, null, 'smtp', 'ENVIADO', null, ahora);
        return { enviado: true };
      } catch (error) {
        insertar.run(para, asunto, null, 'smtp', 'ERROR', String(error?.message ?? error).slice(0, 500), ahora);
        return { enviado: false, error: 'No se pudo enviar el correo.' };
      }
    }

    insertar.run(para, asunto, texto, 'desarrollo', 'ENVIADO', null, ahora);
    if (!config.silencioso) {
      const cuerpo = texto
        .split('\n')
        .map((linea) => `   ${linea}`)
        .join('\n');
      console.log(`\n✉  [correo de desarrollo] Para: ${para}\n   Asunto: ${asunto}\n${cuerpo}\n`);
    }
    return { enviado: true };
  }

  return { enviar };
}
