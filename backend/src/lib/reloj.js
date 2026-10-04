

export const relojDelSistema = {
  ahora: () => new Date(),
};

export function sumarMinutos(fecha, minutos) {
  return new Date(fecha.getTime() + minutos * 60_000);
}
