import { useMemo, useEffect, useRef } from 'react'
import { Line } from 'react-chartjs-2'
import { SLOPE_DATA, SEM_AVGS, SLOPE_WEEK_LABELS, VENTAS_GCP_META } from '../data'

const SIDE_FONT = "600 10px 'IBM Plex Sans','Segoe UI',system-ui,sans-serif"
const LABEL_GAP_PX = 13
/** Márgenes fijos solicitados para Sem1/Sem3 sin recortes. */
const LAYOUT_PADDING = { top: 30, bottom: 50, left: 130, right: 160 }

/** Si >12 caracteres: máx 12 + "." */
function abbrevProgName(name) {
  const t = String(name ?? '').trim()
  if (t.length <= 12) return t
  return `${t.slice(0, 12)}.`
}

/**
 * Orden físico índices 0..n = valores Y descendente (arriba → abajo).
 * Separación ≥ gap; pasadas pares corrigen →; impares corrigen ← (alternancia arriba/abajo).
 */
function antiOverlapBidirectionalBands(positionsAscTopToBottom, anchorsAsc, vmin, vmax, gap, maxPasses) {
  const n = positionsAscTopToBottom.length
  const pos = [...positionsAscTopToBottom]
  const maxPull = Math.max(96, gap * (n + 8))
  const clampAnch = (i, v) => {
    const low = Math.max(vmin, anchorsAsc[i] - maxPull)
    const high = Math.min(vmax, anchorsAsc[i] + maxPull)
    return Math.min(Math.max(v, low), high)
  }

  maxPasses = maxPasses ?? 24
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false

    if (pass % 2 === 0) {
      for (let i = 1; i < n; i++) {
        if (pos[i] - pos[i - 1] < gap) {
          const need = gap - (pos[i] - pos[i - 1])
          const nv = clampAnch(i, pos[i] + need)
          if (nv !== pos[i]) {
            pos[i] = nv
            changed = true
          }
        }
      }
    } else {
      for (let i = n - 2; i >= 0; i--) {
        if (pos[i + 1] - pos[i] < gap) {
          const need = gap - (pos[i + 1] - pos[i])
          const nv = clampAnch(i, pos[i] - need)
          if (nv !== pos[i]) {
            pos[i] = nv
            changed = true
          }
        }
      }
    }

    if (!changed) break
  }
  return pos
}

function buildSideLabelsPlugin(rows) {
  const id = 'slopeSideLabels'
  const plugin = {
    id,
    afterDraw(chart) {
      const { ctx, chartArea } = chart
      const scales = chart.scales
      const y = scales?.y
      if (!chart.getDatasetMeta(0) || rows.length === 0 || !y) return

      const vyMin = chartArea.top + 10
      const vyMax = chartArea.bottom - 10
      const OFF = 6

      ctx.save()
      SEM_AVGS.forEach(({ val, lbl, color }, i) => {
        const yPos = y.getPixelForValue(val)
        if (Number.isFinite(yPos) && yPos >= chartArea.top && yPos <= chartArea.bottom) {
          ctx.setLineDash([4, 3])
          ctx.strokeStyle = color
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(chartArea.left, yPos)
          ctx.lineTo(chartArea.right, yPos)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = color
          ctx.font = "bold 8.5px 'IBM Plex Mono'"
          ctx.textAlign = i === 2 ? 'right' : 'left'
          ctx.fillText(`${lbl} ${val}%`, i === 2 ? chartArea.right - 4 : chartArea.left + 4, yPos - 4)
        }
      })
      ctx.restore()

      ctx.save()
      ctx.font = SIDE_FONT

      const leftItems = rows
        .map((p, dsi) => {
          const meta = chart.getDatasetMeta(dsi)
          const el = meta?.data?.[0]
          if (!el || p.s1 == null) return null
          const py = typeof el.getProps === 'function' ? el.getProps(['y'], true).y : el.y
          const caption = `${abbrevProgName(p.l)} · ${p.s1}%`
          return { p, dsi, x: el.x, pyAnchor: py, yVal: p.s1, caption }
        })
        .filter(Boolean)
        .sort((a, b) => b.yVal - a.yVal)

      const leftAnch = leftItems.map((it) => it.pyAnchor)
      const leftY = antiOverlapBidirectionalBands(leftAnch, leftAnch, vyMin, vyMax, LABEL_GAP_PX)

      leftItems.forEach((it, j) => {
        ctx.fillStyle = it.p.c
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(it.caption, it.x - OFF, leftY[j])
      })

      const rightItems = rows
        .map((p, dsi) => {
          const meta = chart.getDatasetMeta(dsi)
          const lastIx = p.s3 != null ? 2 : 1
          const el = meta?.data?.[lastIx]
          if (!el) return null
          const pts = []
          pts.push(meta.data?.[0], meta.data?.[1])
          if (p.s3 != null && meta.data?.[2]) pts.push(meta.data[2])
          const lastPx = pts[pts.length - 1]?.x ?? el.x
          const vy = pts[pts.length - 1]
          const py = vy && typeof vy.getProps === 'function' ? vy.getProps(['y'], true).y : el.y
          const finalVal = p.s3 !== null ? p.s3 : p.s2
          const delta = finalVal != null ? finalVal - p.s1 : null
          if (delta == null || finalVal == null) return null
          const ppTxt = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp`
          const caption = `${abbrevProgName(p.l)} · ${finalVal}% (${ppTxt})`
          return {
            dsi,
            x: lastPx + OFF,
            pyAnchor: py,
            yVal: finalVal,
            caption,
            color: p.c,
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.yVal - a.yVal)

      const rightAnch = rightItems.map((it) => it.pyAnchor)
      const rightY = antiOverlapBidirectionalBands(rightAnch, rightAnch, vyMin, vyMax, LABEL_GAP_PX)

      rightItems.forEach((it, j) => {
        ctx.fillStyle = it.color
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(it.caption, it.x, rightY[j])
      })

      ctx.restore()
    },
  }
  return plugin
}

export default function SlopeChart() {
  const wrapRef = useRef(null)
  const chartRef = useRef(null)

  const rows = useMemo(() => {
    return SLOPE_DATA
  }, [])

  const weekLabels = useMemo(() => {
    const lbls = (SLOPE_WEEK_LABELS || []).map((d, i) => `Sem ${i + 1}  (${d})`)
    while (lbls.length < 3) lbls.push(`Sem ${lbls.length + 1}  (—)`)
    return lbls
  }, [])

  const { yMin, yMax } = useMemo(() => {
    const nums = []
    rows.forEach((r) => {
      if (r.s1 != null) nums.push(r.s1)
      if (r.s2 != null) nums.push(r.s2)
      if (r.s3 != null) nums.push(r.s3)
    })
    if (!nums.length) return { yMin: 0, yMax: 100 }
    const minValor = Math.min(...nums)
    const maxValor = Math.max(...nums)
    let yMinCalc = Math.floor((minValor - 8) / 5) * 5
    let yMaxCalc = Math.ceil((maxValor + 8) / 5) * 5
    SEM_AVGS.forEach(({ val }) => {
      while (val < yMinCalc) yMinCalc -= 5
      while (val > yMaxCalc) yMaxCalc += 5
    })
    return { yMin: yMinCalc, yMax: yMaxCalc }
  }, [rows])

  const slopePlugin = useMemo(() => buildSideLabelsPlugin(rows), [rows])

  const chartData = useMemo(
    () => ({
      labels: weekLabels,
      datasets: rows.map((p) => ({
        label: p.l,
        data: p.s3 !== null ? [p.s1, p.s2, p.s3] : [p.s1, p.s2, null],
        borderColor: p.c,
        backgroundColor: p.c,
        borderWidth: 2.2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHitRadius: 10,
        pointBackgroundColor: p.c,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.1,
        fill: false,
        spanGaps: false,
        clip: false,
        datalabels: { display: false },
      })),
    }),
    [rows, weekLabels]
  )

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { ...LAYOUT_PADDING } },
      interaction: {
        mode: 'point',
        intersect: true,
      },
      hover: {
        mode: 'point',
        intersect: true,
      },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const dsi = items[0]?.datasetIndex
              const p = rows[dsi]
              return p ? p.l : ''
            },
            label: (item) => {
              const dsi = item.datasetIndex
              const wi = item.dataIndex
              const v = item.raw
              const p = rows[dsi]
              const wl = weekLabels[wi]
              if (!p) return ''
              if (v == null || v === undefined) return `${wl} · sin dato`
              const num = typeof v === 'number' ? v : Number(v)
              return `${wl} · ${Number.isFinite(num) ? `${num}%` : String(v)}`
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            font: { size: 11, weight: '600' },
            color: '#334155',
            padding: 12,
            maxRotation: 0,
          },
          offset: true,
        },
        y: {
          type: 'linear',
          min: yMin,
          max: yMax,
          beginAtZero: false,
          grace: 0,
          grid: { display: false },
          border: { display: false },
          ticks: { display: false },
        },
      },
    }),
    [rows, weekLabels, yMin, yMax]
  )

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      chartRef.current?.resize?.()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="card">
      <div className="ct">Trayectoria de cobranza por programa entre períodos cortos</div>
      <div className="cs">
        Tasa de pago de todos los programas en los 3 últimos cortes — {SEM_AVGS.map((s) => s.lbl).join(' · ')}
        {VENTAS_GCP_META.slope_periodo ? ` · Periodo ${VENTAS_GCP_META.slope_periodo}` : ''}
      </div>
      <div className="chart-scroll-y chart-scroll-slope">
        <div ref={wrapRef} className="cwrap slope-chart-wrap" style={{ height: Math.max(340, rows.length * 25 + 160) }}>
          {rows.length === 0 ? (
            <p style={{ padding: '48px 12px', textAlign: 'center', color: 'var(--gray)', fontSize: 12 }}>
              No hay registros para la combinación de filtros seleccionados.
            </p>
          ) : (
            <Line ref={chartRef} data={chartData} options={options} plugins={[slopePlugin]} />
          )}
        </div>
      </div>
    </div>
  )
}
