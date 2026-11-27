import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { WATERFALL_BARS, COLORS, waterfallBarColor, SEMAFORO, LABEL_DATOS_NEGRO } from '../data'

export default function WaterfallChart() {
  const scaledBars = WATERFALL_BARS
  const tope = scaledBars.length ? scaledBars[0].v[1] : 1
  const piso = scaledBars.length
    ? Math.min(...scaledBars.slice(1).map((b) => (b.v[0] > 0 ? b.v[0] : b.v[1])))
    : 0
  const yMin = Math.max(0, Math.floor(piso * 0.93))
  const yMax = Math.ceil(tope * 1.06)

  const chartData = useMemo(
    () => ({
      labels: scaledBars.map((b) => b.l),
      datasets: [
        {
          data: scaledBars.map((b) => b.v),
          backgroundColor: scaledBars.map((b) => `${waterfallBarColor(b.kind)}ee`),
          borderWidth: 0,
          borderRadius: 3,
          borderSkipped: false,
          datalabels: {
            anchor: 'center',
            align: 'center',
            offset: 0,
            clip: false,
            color: LABEL_DATOS_NEGRO,
            font: { size: 8.75, weight: '700', family: "'IBM Plex Mono', monospace" },
            formatter: (_, ctx) => scaledBars[ctx.dataIndex].lbl,
          },
        },
      ],
    }),
    [scaledBars],
  )

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const [lo, hi] = scaledBars[ctx.dataIndex].v
              const diff = hi - lo
              return ` ${diff > 0 ? '+' : ''}$${Math.abs(diff).toFixed(1)}M COP`
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 9 }, color: COLORS.gray } },
        y: {
          // Igual que el legacy: eje "con zoom" para que se lean los escalones pendientes.
          min: yMin,
          max: yMax,
          grid: { display: false, drawBorder: false },
          border: { display: false },
          ticks: { display: false },
        },
      },
    }),
    [scaledBars],
  )

  return (
    <div className="card">
      <div className="ct">Pasos desde facturación hasta recaudo</div>
      <div className="cs">Valor de las órdenes · barras intermedias = órdenes sin pagar por programa (rojo: tasa de pago {'<'}65%) · Millones COP</div>
      <div className="leg" style={{ flexWrap: 'wrap', gap: '8px 12px', rowGap: 6 }}>
        {[
          [SEMAFORO.referencia, 'Facturado potencial'],
          [SEMAFORO.critico, 'Pendiente crítico'],
          [SEMAFORO.alerta, 'Pendiente moderado'],
          [SEMAFORO.normal, 'Pendiente otros'],
          [SEMAFORO.optimo_max, 'Pagado (órdenes pagas)'],
        ].map(([c, t]) => (
          <div key={t} className="ldot">
            <div className="ldr" style={{ background: c }} />
            {t}
          </div>
        ))}
      </div>
      <div className="chart-scroll">
        <div className="cwrap" style={{ height: 210, minWidth: Math.max(620, scaledBars.length * 72) }}>
          <Bar data={chartData} options={options} />
        </div>
      </div>
    </div>
  )
}
