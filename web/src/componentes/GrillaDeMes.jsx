import { hoyIso } from '../formato.js';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function celdasDelMes(mes) {
  const [anio, numero] = mes.split('-').map(Number);
  const primero = new Date(Date.UTC(anio, numero - 1, 1));
  const cantidad = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  const huecos = (primero.getUTCDay() + 6) % 7;
  const dias = Array.from({ length: cantidad }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
  return [...Array(huecos).fill(null), ...dias];
}

export default function GrillaDeMes({ mes, eventos, diaElegido, alElegir }) {
  const hoy = hoyIso();
  const porDia = new Map();
  for (const evento of eventos) porDia.set(evento.fecha, [...(porDia.get(evento.fecha) ?? []), evento]);

  return (
    <div className="tarjeta grilla-mes">
      <div className="grilla-mes__semana" aria-hidden="true">
        {DIAS.map((dia) => (
          <span key={dia}>{dia}</span>
        ))}
      </div>
      <div className="grilla-mes__dias">
        {celdasDelMes(mes).map((fecha, i) => {
          if (!fecha) return <span key={`hueco-${i}`} className="grilla-mes__hueco" />;
          const delDia = porDia.get(fecha) ?? [];
          const clases = [
            'grilla-mes__dia',
            fecha === hoy && 'grilla-mes__dia--hoy',
            fecha === diaElegido && 'grilla-mes__dia--elegido',
          ];
          return (
            <button
              key={fecha}
              type="button"
              className={clases.filter(Boolean).join(' ')}
              disabled={delDia.length === 0}
              aria-pressed={fecha === diaElegido}
              aria-label={`${fecha}: ${delDia.length} ${delDia.length === 1 ? 'evento' : 'eventos'}`}
              onClick={() => alElegir(fecha === diaElegido ? '' : fecha)}
            >
              <span className="grilla-mes__numero">{Number(fecha.slice(8))}</span>
              {delDia.slice(0, 2).map((e) => (
                <span key={e.id} className={`grilla-mes__evento grilla-mes__evento--${e.estado.toLowerCase()}`}>
                  {e.categoria.codigo} · {e.nombre}
                </span>
              ))}
              {delDia.length > 2 && <span className="grilla-mes__mas">+{delDia.length - 2} más</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
