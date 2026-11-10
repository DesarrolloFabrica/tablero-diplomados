import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { DIVERGING_DATA, AVG_PAGO, SEMAFORO, LABEL_DATOS_NEGRO } from '../data'

/** Verde/rojo mismo semáforo que primera hoja (critico vs optimo_max para barras dirigidas +/-). */
// Rango del eje: el del legacy (−15 / +22) o más amplio si los datos lo exigen.
function divMin() {
  const mn = DIVERGING_DATA.reduce((m, d) => Math.min(m, d.v), 0)
  return Math.min(-15, Math.floor(mn * 1.25))
}
function divMax() {
  const mx = DIVERGING_DATA.reduce((m, d) => Math.max(m, d.v), 0)
  return Math.max(22, Math.ceil(mx * 1.25))
}

function divergingNegFill() {
  return 'rgba(231, 76, 60, .82)'
}
function divergingPosFill() {
  return 'rgba(26, 138, 74, .88)'
}

const zeroLinePlugin = {
  id: 'zeroline',
  afterDraw(chart) {
    const { ctx, chartArea: { top, bottom }, scales: { x } } = chart
    const xZ = x.getPixelForValue(0)
    ctx.save()
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = SEMAFORO.referencia
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(xZ, top); ctx.lineTo(xZ, bottom); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = SEMAFORO.referencia
    ctx.font = "bold 9px 'IBM Plex Mono'"
    ctx.textAlign = 'center'
    ctx.fillText(`${AVG_PAGO}%`, xZ, top - 4)
    ctx.restore()
  },
}

export default function DivergingChart() {
  const sorted = useMemo(() => {
    return [...DIVERGING_DATA]
      .sort((a, b) => a.v - b.v)
  }, [])

  const chartData = useMemo(() => ({
    labels: sorted.map((d) => d.l),
    datasets: [{
      data: sorted.map((d) => d.v),
      backgroundColor: sorted.map((d) => (d.v < 0 ? divergingNegFill() : divergingPosFill())),
      borderColor: sorted.map((d) => (d.v < 0 ? SEMAFORO.critico : SEMAFORO.optimo_max)),
      borderWidth: 1,
      borderSkipped: false,
      borderRadius: (ctx) => {
        const v = sorted[ctx.dataIndex]?.v ?? 0
        if (v < 0) return { topLeft: 6, bottomLeft: 6, topRight: 0, bottomRight: 0 }
        return { topLeft: 0, bottomLeft: 0, topRight: 6, bottomRight: 6 }
      },
      datalabels: {
        anchor: 'center',
        align: 'center',
        clip: false,
        color: LABEL_DATOS_NEGRO,
        font: { size: 9, weight: '700', family: "'IBM Plex Mono', monospace" },
        formatter: (v) => (v > 0 ? '+' : '') + v + 'pp',
      },
    }],
  }), [sorted])

  const options = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 12, left: 2 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => ` Desviación: ${ctx.parsed.x > 0 ? '+' : ''}${ctx.parsed.x}pp vs ${AVG_PAGO}%` },
      },
    },
    scales: {
      x: {
        min: divMin(), max: divMax(),
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { display: false },
      },
      y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10.5 } } },
    },
  }), [])

  return (
    <div className="card">
      <div className="ct">Desviación de la cobranza frente al promedio global</div>
      <div className="cs">Desviación vs tasa de pago general del filtro ({AVG_PAGO}%) · Línea = referencia 0</div>
      <div className="cwrap" style={{ height: 270 }}>
        {sorted.length === 0 ? (
          <p style={{ padding: '48px 12px', textAlign: 'center', color: 'var(--gray)', fontSize: 12 }}>
            No hay registros para la combinación de filtros seleccionados.
          </p>
        ) : (
          <Bar data={chartData} options={options} plugins={[zeroLinePlugin]} />
        )}
      </div>
    </div>
  )
}
