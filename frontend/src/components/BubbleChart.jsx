import { useMemo } from 'react'
import { Bubble } from 'react-chartjs-2'
import { BUBBLE_DATA, COLORS, AVG_PAGO, SEMAFORO, LABEL_DATOS_NEGRO, pagoBandColor } from '../data'

// Rangos de ejes: mismos valores que el legacy cuando los datos caben; se amplían si no.
function bubbleXMax() {
  const mx = BUBBLE_DATA.reduce((m, p) => Math.max(m, p.x), 0)
  return Math.max(10, Math.ceil((mx * 1.1) / 10) * 10)
}
/** Corte vertical de cuadrantes = mediana de inscritos por programa (datos reales). */
function bubbleXSplit() {
  const xs = BUBBLE_DATA.map((p) => p.x).sort((a, b) => a - b)
  if (!xs.length) return 0
  const m = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2
}
function bubbleYMin() {
  const mn = BUBBLE_DATA.reduce((m, p) => Math.min(m, p.y), 100)
  return Math.min(40, Math.floor((mn - 5) / 10) * 10)
}

function hexToRgb(hex, alpha) {
  const h = hex.replace('#', '')
  const n = parseInt(h.slice(0, 6), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

// Plugin que dibuja cuadrantes sutiles en tonos del semáforo y líneas guía (sin DIPLOMADO_COLORS)
const quadrantPlugin = {
  id: 'quadrants',
  beforeDraw(chart) {
    const { ctx, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart
    const xMid = x.getPixelForValue(bubbleXSplit())
    const yMid = y.getPixelForValue(AVG_PAGO)
    ctx.save()
    const zones = [
      { x1: xMid, x2: right, y1: top, y2: yMid, c: hexToRgb(SEMAFORO.optimo, 0.06) },
      { x1: left, x2: xMid, y1: top, y2: yMid, c: hexToRgb(SEMAFORO.optimo, 0.04) },
      { x1: xMid, x2: right, y1: yMid, y2: bottom, c: hexToRgb(SEMAFORO.critico, 0.07) },
      { x1: left, x2: xMid, y1: yMid, y2: bottom, c: hexToRgb(SEMAFORO.critico, 0.04) },
    ]
    zones.forEach((z) => {
      ctx.fillStyle = z.c
      ctx.fillRect(z.x1, z.y1, z.x2 - z.x1, z.y2 - z.y1)
    })
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath(); ctx.moveTo(xMid, top); ctx.lineTo(xMid, bottom); ctx.stroke()
    ctx.strokeStyle = SEMAFORO.referencia
    ctx.globalAlpha = 0.75
    ctx.beginPath(); ctx.moveTo(left, yMid); ctx.lineTo(right, yMid); ctx.stroke()
    ctx.globalAlpha = 1
    ctx.setLineDash([])
    ctx.font = "bold 9px 'IBM Plex Sans'"
    ctx.fillStyle = hexToRgb(SEMAFORO.optimo, 0.85)
    ctx.fillText('ÓPTIMO', xMid + 6, top + 14)
    ctx.fillStyle = hexToRgb(SEMAFORO.critico, 0.85)
    ctx.fillText('RIESGO CRÍTICO', xMid + 6, bottom - 8)
    ctx.fillStyle = 'rgba(71,85,105,.62)'
    ctx.fillText('PEQUEÑOS', left + 6, bottom - 8)
    ctx.restore()
  },
}

export default function BubbleChart() {
  const filt = useMemo(() => {
    return BUBBLE_DATA
  }, [])

  const chartData = useMemo(() => {
    const maxC = filt.length ? Math.max(...filt.map((p) => p.c)) : 1
    return {
      datasets: [{
        data: filt.map((p) => ({
          x: p.x,
          y: p.y,
          r: 7 + (p.c / maxC) * 22,
        })),
        backgroundColor: filt.map((p) => pagoBandColor(p.y) + 'bb'),
        borderColor: filt.map((p) => pagoBandColor(p.y)),
        borderWidth: 1.5,
      }],
    }
  }, [filt])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 10, right: 10, bottom: 5, left: 5 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const p = filt[ctx.dataIndex]
            if (!p) return []
            return [`  ${p.l}`, `  Inscritos: ${p.x}`, `  Pago: ${p.y}%`, `  Cartera: $${p.c}M`]
          },
        },
      },
      datalabels: {
        display: (ctx) => filt.length && ctx.dataIndex < 8,
        color: LABEL_DATOS_NEGRO,
        font: { size: 9, weight: '600', family: "'IBM Plex Mono', monospace" },
        formatter: (_, ctx) => (filt[ctx.dataIndex] ? filt[ctx.dataIndex].l : ''),
        anchor: 'end', align: 'end', offset: 2,
        backgroundColor: 'rgba(255,255,255,.85)',
        borderRadius: 3,
        padding: { top: 1, bottom: 1, left: 3, right: 3 },
      },
    },
    scales: {
      x: {
        min: 0, max: bubbleXMax(),
        title: { display: true, text: 'Matrículas (órdenes)', font: { size: 10 }, color: COLORS.gray },
        grid: { color: COLORS.grid }, border: { display: false },
        ticks: { font: { size: 10 } },
      },
      y: {
        min: bubbleYMin(), max: 100,
        title: { display: true, text: 'Tasa de pago financiero (%)', font: { size: 10 }, color: COLORS.gray },
        grid: { color: COLORS.grid }, border: { display: false },
        ticks: { font: { size: 10 }, callback: (v) => `${v}%` },
      },
    },
  }), [filt])

  return (
    <div className="card">
      <div className="ct">Mapa comparativo de programas con cuadrantes de referencia</div>
      <div className="cs">Cada burbuja = 1 programa · X = matrículas (órdenes) · Y = % pago · Tamaño = cartera pendiente ($M COP) · Corte vertical = mediana de matrículas</div>
      <div className="leg">
        {[
          [SEMAFORO.critico, '<55% (crítico)'],
          [SEMAFORO.alerta, '55–65% (alerta)'],
          [SEMAFORO.normal, '65–75% (normal)'],
          [SEMAFORO.optimo, '>75% (óptimo)'],
        ].map(([c, t]) => (
          <div key={t} className="ldot"><div className="lds" style={{ background: c }} />{t}</div>
        ))}
      </div>
      <div className="cwrap" style={{ height: 240 }}>
        {filt.length === 0 ? (
          <p style={{ padding: '48px 12px', textAlign: 'center', color: 'var(--gray)', fontSize: 12 }}>
            No hay registros para la combinación de filtros seleccionados.
          </p>
        ) : (
          <Bubble data={chartData} options={options} plugins={[quadrantPlugin]} />
        )}
      </div>
    </div>
  )
}
