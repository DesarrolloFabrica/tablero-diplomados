import { useMemo, useRef, useState } from 'react'
import { Chart } from 'react-chartjs-2'
import { WEEKLY_FLOW, SEMAFORO, LABEL_DATOS_NEGRO, pagoBandColor } from '../data'

const dangerZonePlugin = {
  id: 'dangerZone',
  afterDraw(chart) {
    const { ctx, chartArea: { left, right }, scales: { y2 } } = chart
    const yPos = y2.getPixelForValue(50)
    ctx.save()
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = 'rgba(185,28,28,.4)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(left, yPos); ctx.lineTo(right, yPos); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(185,28,28,.5)'
    ctx.font = "bold 8.5px 'IBM Plex Mono'"
    ctx.textAlign = 'right'
    ctx.fillText('umbral crítico 50%', right - 4, yPos - 4)
    ctx.restore()
  },
}

export default function WeeklyFlow() {
  const { labels, counts, pagos } = WEEKLY_FLOW
  const scaledCounts = counts

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Inscritos',
        data: scaledCounts,
        backgroundColor: `${SEMAFORO.referencia}d0`,
        borderRadius: 4,
        yAxisID: 'y',
        datalabels: {
          anchor: 'end', align: 'top',
          color: LABEL_DATOS_NEGRO,
          font: { size: 10, weight: '700', family: "'IBM Plex Mono', monospace" },
          formatter: (v) => v,
        },
      },
      {
        type: 'line',
        label: '% Pago',
        data: pagos,
        borderColor: SEMAFORO.referencia,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: pagos.map((p) => pagoBandColor(p)),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.3,
        yAxisID: 'y2',
        datalabels: {
          anchor: 'end', align: 'top', offset: 3,
          color: (c) => {
            const i = c && Number.isFinite(c.dataIndex) ? c.dataIndex : -1
            const pct = i >= 0 ? pagos[i] : undefined
            return pct != null ? pagoBandColor(pct) : LABEL_DATOS_NEGRO
          },
          font: { size: 9.5, weight: '700', family: "'IBM Plex Mono', monospace" },
          formatter: (v) => `${v}%`,
          backgroundColor: 'rgba(255,255,255,.9)',
          borderRadius: 3,
          padding: { top: 1, bottom: 1, left: 2, right: 2 },
        },
      },
    ],
  }), [labels, scaledCounts, pagos])

  const yBarMax = useMemo(() => {
    const mx = scaledCounts.reduce((m, v) => Math.max(m, v), 0)
    const ceil = Math.max(48, Math.ceil((mx || 1) * 1.15 / 20) * 20)
    return Math.min(560, ceil)
  }, [scaledCounts])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 24, bottom: 2 } },
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { display: false },
      },
      y: {
        beginAtZero: true,
        max: yBarMax,
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { display: false },
        title: { display: false },
      },
      y2: {
        position: 'right',
        min: Math.min(25, Math.floor((Math.min(100, ...WEEKLY_FLOW.pagos) - 5) / 5) * 5),
        max: Math.max(95, Math.ceil((Math.max(0, ...WEEKLY_FLOW.pagos) + 5) / 5) * 5),
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { display: false },
        title: { display: false },
      },
    },
  }), [yBarMax])

  const [barCenterPct, setBarCenterPct] = useState(null)
  const lastAlignSigRef = useRef('')

  const alignXPlugin = useMemo(
    () => ({
      id: 'weeklyFlowBarCenterAlign',
      afterRender(chart) {
        const meta = chart.getDatasetMeta(0)
        if (!meta?.data?.length || meta.hidden) return
        const { width } = chart
        if (!width) return
        const pcts = meta.data.map((el) => {
          if (!el || el.skip) return null
          const cx =
            typeof el.getCenterPoint === 'function'
              ? el.getCenterPoint().x
              : typeof el?.x === 'number'
                ? el.x
                : null
          if (cx == null || Number.isNaN(cx)) return null
          return (cx / width) * 100
        })
        if (pcts.some((p) => p == null || Number.isNaN(p))) return
        const sig = pcts.map((p) => p.toFixed(4)).join(',')
        if (sig === lastAlignSigRef.current) return
        lastAlignSigRef.current = sig
        queueMicrotask(() => setBarCenterPct(pcts))
      },
    }),
    [],
  )

  const nCats = labels.length

  return (
    <div className="card">
      <div className="ct">Volumen de inscripciones y tasa de pago por corte temporal</div>
      <div className="cs">
        Nuevas matrículas por semana de creación de la orden (barras) · Tasa de pago por cohorte de registro (línea)
      </div>
      <div className="leg" style={{ flexWrap: 'wrap', gap: '8px 12px', rowGap: 6 }}>
        <div className="ldot">
          <div className="ldr" style={{ background: SEMAFORO.referencia }} />
          Inscritos nuevos (barras · azul)
        </div>
        {[
          [SEMAFORO.critico, '<55%'],
          [SEMAFORO.alerta, '55–65%'],
          [SEMAFORO.normal, '65–75%'],
          [SEMAFORO.optimo, '>75%'],
        ].map(([c, t]) => (
          <div key={t} className="ldot">
            <div className="ldr" style={{ background: c }} />
            Punto % cohorte ({t})
          </div>
        ))}
        <div className="ldot">
          <div className="ldr" style={{ height: 3, marginTop: 2, background: SEMAFORO.referencia }} />
          Tendencia % (línea)
        </div>
      </div>
      <div
        className="weekly-chart-stack"
        style={{
          position: 'relative',
          width: '100%',
          height: 292,
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 56,
            zIndex: 1,
          }}
        >
          <Chart key={labels.join('|')} type="bar" data={chartData} options={options} plugins={[dangerZonePlugin, alignXPlugin]} />
        </div>
        <div
          className="weekly-chart-x-axis"
          role="list"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 2,
            zIndex: 3,
            minHeight: 52,
            backgroundColor: '#ffffff',
            pointerEvents: 'none',
          }}
        >
          {labels.map((lbl, i) => {
            const left = barCenterPct?.[i]
            const key = `wf-${i}-${String(lbl).slice(0, 8)}`
            return (
              <span
                key={key}
                role="listitem"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: left != null ? `${left}%` : '-9999px',
                  transform: 'translateX(-50%)',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#0f172a',
                  lineHeight: 1.2,
                  textAlign: 'center',
                  whiteSpace: 'pre-line',
                  maxWidth: `${Math.max(92 / Math.max(nCats, 1), 10)}%`,
                }}
              >
                {lbl}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
