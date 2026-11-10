/**
 * Constructores de opciones ECharts. Specs: líneas 2px, marcadores 8px con anillo de superficie,
 * barras ≤ 24px con extremo redondeado de 4px, rejilla hairline, un solo eje Y por gráfico.
 */
import type { EChartsCoreOption } from 'echarts/core'
import type { ChartTokens } from './theme'
import type { Programa, PuntoEvolucion } from './types'
import { fmtFecha, fmtInt, fmtMoney, fmtMoneyAxis, fmtPct, lineaLabel, ratio } from './format'

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

function base(t: ChartTokens): EChartsCoreOption {
  return {
    animationDuration: 400,
    textStyle: { fontFamily: FONT, color: t.ink2 },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.grid,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: t.ink, fontFamily: FONT, fontSize: 13 },
      extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,.12); border-radius: 8px;',
    },
    legend: {
      top: 0,
      left: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
      textStyle: { color: t.ink2, fontSize: 12 },
    },
  }
}

const axisLabel = (t: ChartTokens) => ({ color: t.muted, fontSize: 11 })
const splitLine = (t: ChartTokens) => ({ lineStyle: { color: t.grid, width: 1 } })
const axisLine = (t: ChartTokens) => ({ lineStyle: { color: t.axis } })

function dot(name: string, color: string) {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${name}`
}

export type MetricaEvolucion = 'pagadas' | 'ordenes' | 'vendido'

export function serieKey(p: { linea: string; periodo: string }) {
  return `${p.periodo} · ${lineaLabel(p.linea)}`
}

export function evolucionOption(
  t: ChartTokens,
  puntos: PuntoEvolucion[],
  metrica: MetricaEvolucion,
  colorDe: (periodo: string) => string,
): EChartsCoreOption {
  const fechas = [...new Set(puntos.map((p) => p.fecha_corte))].sort()
  const series = new Map<string, { periodo: string; data: (number | null)[] }>()
  for (const p of puntos) {
    const k = serieKey(p)
    if (!series.has(k)) series.set(k, { periodo: p.periodo, data: fechas.map(() => null) })
    series.get(k)!.data[fechas.indexOf(p.fecha_corte)] = p[metrica]
  }
  const money = metrica === 'vendido'
  const fmt = money ? fmtMoney : fmtInt
  return {
    ...base(t),
    grid: { left: 8, right: 72, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: t.axis, width: 1 } },
      formatter: (items: { seriesName: string; value: number | null; color: string; axisValue: string }[]) => {
        const rows = items
          .filter((i) => i.value != null)
          .map((i) => `<div style="display:flex;justify-content:space-between;gap:16px">${dot(i.seriesName, i.color)}<b>${fmt(i.value!)}</b></div>`)
        return `<div style="color:${t.ink2};margin-bottom:4px">Corte ${fmtFecha(items[0].axisValue, true)}</div>${rows.join('')}`
      },
    },
    xAxis: {
      type: 'category',
      data: fechas,
      boundaryGap: false,
      axisLabel: { ...axisLabel(t), formatter: (v: string) => fmtFecha(v) },
      axisLine: axisLine(t),
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { ...axisLabel(t), formatter: money ? fmtMoneyAxis : (v: number) => fmtInt(v) },
      splitLine: splitLine(t),
    },
    series: [...series.entries()].map(([name, s]) => {
      const color = colorDe(s.periodo)
      return {
        name,
        type: 'line',
        data: s.data,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 9,
        lineStyle: { width: 2, color, cap: 'round', join: 'round' },
        itemStyle: { color, borderColor: t.surface, borderWidth: 2 },
        emphasis: { focus: 'series', scale: 1.4 },
        endLabel: {
          show: series.size <= 4,
          formatter: (p: { value: number }) => fmt(p.value),
          color: t.ink2,
          fontSize: 12,
          fontWeight: 600,
          distance: 8,
        },
        labelLayout: { moveOverlap: 'shiftY' },
      }
    }),
  }
}

export function movimientoOption(t: ChartTokens, puntos: PuntoEvolucion[]): EChartsCoreOption {
  const porFecha = new Map<string, { nuevas: number; pasan: number }>()
  for (const p of puntos) {
    const acc = porFecha.get(p.fecha_corte) ?? { nuevas: 0, pasan: 0 }
    acc.nuevas += p.nuevas
    acc.pasan += p.pasan_a_pago
    porFecha.set(p.fecha_corte, acc)
  }
  const fechas = [...porFecha.keys()].sort()
  const bar = (name: string, color: string, data: number[]) => ({
    name,
    type: 'bar',
    data,
    barMaxWidth: 20,
    barGap: '15%',
    itemStyle: { color, borderRadius: [4, 4, 0, 0] },
    emphasis: { focus: 'series' },
  })
  return {
    ...base(t),
    grid: { left: 8, right: 8, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.4 } },
      formatter: (items: { seriesName: string; value: number; color: string; axisValue: string }[]) =>
        `<div style="color:${t.ink2};margin-bottom:4px">Corte ${fmtFecha(items[0].axisValue, true)}</div>` +
        items.map((i) => `<div style="display:flex;justify-content:space-between;gap:16px">${dot(i.seriesName, i.color)}<b>${fmtInt(i.value)}</b></div>`).join(''),
    },
    xAxis: {
      type: 'category',
      data: fechas,
      axisLabel: { ...axisLabel(t), formatter: (v: string) => fmtFecha(v) },
      axisLine: axisLine(t),
      axisTick: { show: false },
    },
    yAxis: { type: 'value', axisLabel: axisLabel(t), splitLine: splitLine(t), minInterval: 1 },
    series: [
      bar('Órdenes nuevas', t.series[0], fechas.map((f) => porFecha.get(f)!.nuevas)),
      bar('Pasan a pago', t.series[2], fechas.map((f) => porFecha.get(f)!.pasan)),
    ],
  }
}

export function programasOption(t: ChartTokens, programas: Programa[], mostrarLinea: boolean): EChartsCoreOption {
  const rows = [...programas].sort((a, b) => a.ordenes - b.ordenes) // ascendente: el mayor queda arriba
  const nombre = (p: Programa) => (mostrarLinea && p.linea === 'Especializacion' ? `${p.nombre} (esp.)` : p.nombre)
  const cats = rows.map(nombre)
  return {
    ...base(t),
    legend: { show: false },
    grid: { left: 8, right: 56, top: 8, bottom: 4, containLabel: true },
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.4 } },
      formatter: (items: { dataIndex: number }[]) => {
        const p = rows[items[0].dataIndex]
        return `<div style="font-weight:600;margin-bottom:4px">${nombre(p)}</div>
          <div style="display:flex;justify-content:space-between;gap:16px">${dot('Pagadas', t.series[0])}<b>${fmtInt(p.pagadas)}</b></div>
          <div style="display:flex;justify-content:space-between;gap:16px">${dot('Sin pagar', t.seqLight)}<b>${fmtInt(p.ordenes - p.pagadas)}</b></div>
          <div style="color:${t.ink2};margin-top:4px">Conversión ${fmtPct(ratio(p.pagadas, p.ordenes))} · Vendido ${fmtMoney(p.vendido)}</div>`
      },
    },
    xAxis: { type: 'value', axisLabel: axisLabel(t), splitLine: splitLine(t), minInterval: 1 },
    yAxis: {
      type: 'category',
      data: cats,
      axisLabel: { color: t.ink2, fontSize: 12, width: 220, overflow: 'truncate' },
      axisLine: axisLine(t),
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Pagadas',
        type: 'bar',
        stack: 'o',
        data: rows.map((p) => p.pagadas),
        barMaxWidth: 18,
        itemStyle: { color: t.series[0], borderColor: t.surface, borderWidth: 1 },
      },
      {
        name: 'Sin pagar',
        type: 'bar',
        stack: 'o',
        data: rows.map((p) => p.ordenes - p.pagadas),
        barMaxWidth: 18,
        itemStyle: { color: t.seqLight, borderRadius: [0, 4, 4, 0], borderColor: t.surface, borderWidth: 1 },
        label: {
          show: true,
          position: 'right',
          color: t.ink2,
          fontSize: 11,
          formatter: (p: { dataIndex: number }) => fmtInt(rows[p.dataIndex].ordenes),
        },
      },
    ],
  }
}

export function edadOption(t: ChartTokens, edad: { rango: string; F: number; M: number }[]): EChartsCoreOption {
  const bar = (name: string, key: 'F' | 'M', color: string) => ({
    name,
    type: 'bar',
    data: edad.map((e) => e[key]),
    barMaxWidth: 18,
    barGap: '15%',
    itemStyle: { color, borderRadius: [4, 4, 0, 0] },
    emphasis: { focus: 'series' },
  })
  return {
    ...base(t),
    grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.4 } },
      formatter: (items: { seriesName: string; value: number; color: string; axisValue: string }[]) =>
        `<div style="color:${t.ink2};margin-bottom:4px">${items[0].axisValue} años</div>` +
        items.map((i) => `<div style="display:flex;justify-content:space-between;gap:16px">${dot(i.seriesName, i.color)}<b>${fmtInt(i.value)}</b></div>`).join(''),
    },
    xAxis: { type: 'category', data: edad.map((e) => e.rango), axisLabel: axisLabel(t), axisLine: axisLine(t), axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: axisLabel(t), splitLine: splitLine(t), minInterval: 1 },
    series: [bar('Mujeres', 'F', t.series[1]), bar('Hombres', 'M', t.series[0])],
  }
}

export function regionesOption(t: ChartTokens, regiones: { region: string; estudiantes: number }[]): EChartsCoreOption {
  const rows = [...regiones].reverse()
  const total = regiones.reduce((s, r) => s + r.estudiantes, 0)
  return {
    ...base(t),
    legend: { show: false },
    grid: { left: 8, right: 64, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const r = rows[p.dataIndex]
        return `<b>${r.region}</b><br/>${fmtInt(r.estudiantes)} estudiantes · ${fmtPct(ratio(r.estudiantes, total))}`
      },
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.region),
      axisLabel: { color: t.ink2, fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => r.estudiantes),
        barMaxWidth: 16,
        itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          color: t.ink2,
          fontSize: 11,
          formatter: (p: { value: number }) => `${fmtInt(p.value)} · ${fmtPct(ratio(p.value, total))}`,
        },
      },
    ],
  }
}
