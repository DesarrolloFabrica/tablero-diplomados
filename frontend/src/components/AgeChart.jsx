import { useMemo, useRef, useState } from 'react'
import { Chart } from 'react-chartjs-2'
import { AGE_DATA, AVG_PAGO, SEMAFORO, LABEL_DATOS_NEGRO, pagoBandColor } from '../data'


export default function AgeChart() {
  const scaledCounts = AGE_DATA.counts
  const totalStudents = scaledCounts.reduce((a, b) => a + b, 0)
  const yBarMax = useMemo(() => {
    const mx = scaledCounts.reduce((m, x) => Math.max(m, x), 0)
    return Math.max(80, Math.ceil((mx * 1.08) / 20) * 20)
  }, [scaledCounts])

  const [barCenterPct, setBarCenterPct] = useState(null)
  const lastAlignSigRef = useRef('')

  const avgLinePlugin = useMemo(
    () => ({
      id: 'avgPayLine',
      afterDraw(chart) {
        const { ctx, chartArea: { left, right }, scales: { y2 } } = chart
        const yPos = y2.getPixelForValue(AVG_PAGO)
        ctx.save()
        ctx.setLineDash([4, 3])
        ctx.strokeStyle = SEMAFORO.referencia
        ctx.globalAlpha = 0.92
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(left, yPos)
        ctx.lineTo(right, yPos)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        ctx.fillStyle = LABEL_DATOS_NEGRO
        ctx.font = "10px 'IBM Plex Mono'"
        ctx.textAlign = 'right'
        ctx.fillText(`avg ${AVG_PAGO}%`, right - 2, yPos - 4)
        ctx.restore()
      },
    }),
    [],
  )

  const alignXPlugin = useMemo(
    () => ({
      id: 'ageBarCenterAlign',
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

  const chartData = useMemo(
    () => ({
      labels: AGE_DATA.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Matrículas',
          data: scaledCounts,
          backgroundColor: `${SEMAFORO.referencia}d9`,
          borderRadius: 3,
          yAxisID: 'y',
          datalabels: {
            anchor: 'end',
            align: 'top',
            color: LABEL_DATOS_NEGRO,
            font: { size: 9, family: "'IBM Plex Mono', monospace" },
            formatter: (v) => v,
          },
        },
        {
          type: 'line',
          label: '% Pago',
          data: AGE_DATA.pagos,
          borderColor: SEMAFORO.referencia,
          backgroundColor: `${SEMAFORO.referencia}22`,
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: AGE_DATA.pagos.map((p) => pagoBandColor(p)),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          fill: false,
          tension: 0.3,
          yAxisID: 'y2',
          datalabels: {
            anchor: 'end',
            align: 'top',
            offset: 2,
            color: (c) => {
              const i = c && Number.isFinite(c.dataIndex) ? c.dataIndex : -1
              const pct = i >= 0 ? AGE_DATA.pagos[i] : undefined
              return pct != null ? pagoBandColor(pct) : LABEL_DATOS_NEGRO
            },
            font: { size: 9.5, weight: '600', family: "'IBM Plex Mono', monospace" },
            formatter: (v) => `${v}%`,
            backgroundColor: 'rgba(255,255,255,.88)',
            borderRadius: 3,
            padding: { top: 1, bottom: 1, left: 2, right: 2 },
          },
        },
      ],
    }),
    [scaledCounts],
  )

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, right: 4, bottom: 4 } },
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
          min: Math.min(40, Math.floor((Math.min(100, ...AGE_DATA.pagos.filter((_, i) => AGE_DATA.counts[i] > 0)) - 5) / 10) * 10),
          max: 100,
          grid: { display: false, drawBorder: false },
          border: { display: false },
          ticks: { display: false },
          title: { display: false },
        },
      },
    }),
    [yBarMax],
  )

  return (
    <div className="card">
      <div className="ct">Perfil por edad y relación con la cobranza</div>
      <div className="cs">
        Matrículas por rango de edad (barras) y tasa de pago (línea){' '}
        {`— ${totalStudents.toLocaleString('es-CO')} con fecha de nacimiento`}
      </div>
      <div className="leg" style={{ flexWrap: 'wrap', gap: '8px 12px', rowGap: 6 }}>
        <div className="ldot">
          <div className="ldr" style={{ background: SEMAFORO.referencia }} />
          Estudiantes (barras · azul)
        </div>
        {[
          [SEMAFORO.critico, '<55%'],
          [SEMAFORO.alerta, '55–65%'],
          [SEMAFORO.normal, '65–75%'],
          [SEMAFORO.optimo, '>75%'],
        ].map(([c, t]) => (
          <div key={t} className="ldot">
            <div className="ldr" style={{ background: c }} />
            Punto línea ({t})
          </div>
        ))}
        <div className="ldot">
          <div className="ldr" style={{ background: SEMAFORO.referencia, height: 3, marginTop: 2 }} />
          Tendencia % pago (línea)
        </div>
      </div>
      <div
        className="age-chart-stack"
        style={{
          position: 'relative',
          width: '100%',
          height: 262,
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 32,
            zIndex: 1,
          }}
        >
          <Chart type="bar" data={chartData} options={options} plugins={[avgLinePlugin, alignXPlugin]} />
        </div>
        <div
          className="age-chart-x-axis"
          role="list"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 2,
            zIndex: 3,
            height: 24,
            backgroundColor: '#ffffff',
            pointerEvents: 'none',
          }}
        >
          {AGE_DATA.labels.map((lbl, i) => {
            const left = barCenterPct?.[i]
            return (
              <span
                key={lbl}
                role="listitem"
                style={{
                  position: 'absolute',
                  top: 2,
                  left: left != null ? `${left}%` : '-9999px',
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0f172a',
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
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
