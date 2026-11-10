import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { GENDER_DATA } from '../data'

const MUJER = '#FF4FA3'
const HOMBRE = '#2563EB'

/** Línea vertical en x = 0 (eje centro). */
const centerLinePlugin = {
  id: 'centerLineGender',
  afterDraw(chart) {
    const { ctx, chartArea: { top, bottom }, scales: { x } } = chart
    const x0 = x.getPixelForValue(0)
    ctx.save()
    ctx.strokeStyle = 'rgba(71,85,105,.38)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x0, top)
    ctx.lineTo(x0, bottom)
    ctx.stroke()
    ctx.restore()
  },
}

export default function GenderPyramid() {
  const rows = useMemo(() => {
    return GENDER_DATA
  }, [])

  const bounds = useMemo(() => {
    if (!rows.length) return { min: -1, max: 1 }
    let maxF = 0
    let maxM = 0
    rows.forEach((r) => {
      maxF = Math.max(maxF, r.f)
      maxM = Math.max(maxM, r.m)
    })
    const padF = Math.max(14, Math.ceil(maxF * 0.06))
    const padM = Math.max(14, Math.ceil(maxM * 0.06))
    return { min: -(maxF + padF), max: maxM + padM }
  }, [rows])

  const chartData = useMemo(
    () => ({
      labels: rows.map((d) => d.l),
      datasets: [
        {
          label: 'Mujer',
          data: rows.map((d) => -d.f),
          backgroundColor: MUJER,
          borderWidth: 0,
          borderSkipped: false,
          borderRadius: { topLeft: 6, bottomLeft: 6, topRight: 0, bottomRight: 0 },
          datalabels: {
            anchor: 'start',
            align: 'start',
            offset: -2,
            clip: false,
            color: MUJER,
            font: { size: 9.5, weight: '600', family: "'IBM Plex Mono', monospace" },
            formatter: (v) => (Math.abs(v) > 0 ? Math.abs(Math.round(v)) : ''),
          },
        },
        {
          label: 'Hombre',
          data: rows.map((d) => d.m),
          backgroundColor: HOMBRE,
          borderWidth: 0,
          borderSkipped: false,
          borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 6, bottomRight: 6 },
          datalabels: {
            anchor: 'end',
            align: 'end',
            offset: 4,
            clip: false,
            color: HOMBRE,
            font: { size: 9.5, weight: '600', family: "'IBM Plex Mono', monospace" },
            formatter: (v) => (v > 0 ? Math.round(v) : ''),
          },
        },
      ],
    }),
    [rows]
  )

  const options = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 30, right: 30 } },
      datasets: {
        bar: {
          grouped: false,
          /** Producto alto = barras llenan la franja (pegadas). ~0.5 deja hueco vertical claro entre programas (misma altura total del chart). */
          categoryPercentage: 0.52,
          barPercentage: 0.92,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => {
              const d = rows[ctx.dataIndex]
              if (!d) return ''
              const isMale = ctx.datasetIndex === 1
              const v = isMale ? d.m : d.f
              return ` ${isMale ? 'Hombre' : 'Mujer'}: ${v} (${Math.round((v / (d.f + d.m)) * 100)}%)`
            },
          },
        },
      },
      scales: {
        x: {
          min: bounds.min,
          max: bounds.max,
          grid: { display: false, drawBorder: false },
          border: { display: false },
          ticks: { display: false },
        },
        y: {
          stacked: false,
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 10.5 } },
        },
      },
    }),
    [rows, bounds.min, bounds.max]
  )

  return (
    <div className="card">
      <div className="ct">Composición de género por programa</div>
      <div className="cs">Matrículas por género en los 8 programas con más matrículas · Izquierda = Mujer · Derecha = Hombre</div>
      <div className="leg">
        <div className="ldot">
          <div className="ldr" style={{ background: MUJER }} />
          Mujer (F)
        </div>
        <div className="ldot">
          <div className="ldr" style={{ background: HOMBRE }} />
          Hombre (M)
        </div>
      </div>
      <div className="cwrap" style={{ height: 220 }}>
        {rows.length === 0 ? (
          <p style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--gray)', fontSize: 12 }}>
            No hay registros para la combinación de filtros seleccionados.
          </p>
        ) : (
          <Bar data={chartData} options={options} plugins={[centerLinePlugin]} />
        )}
      </div>
    </div>
  )
}
