import { useEffect, useMemo, useState } from 'react'
import { fetchFiltros, fetchTablero } from './api'
import { Card } from './components/Card'
import { EChart } from './components/EChart'
import {
  edadOption,
  evolucionOption,
  movimientoOption,
  programasOption,
  regionesOption,
  serieKey,
  type MetricaEvolucion,
} from './charts'
import { fmtFecha, fmtInt, fmtMoney, fmtMoneyFull, fmtPct, lineaLabel, lineaPlural, ratio } from './format'
import { readTokens, useTheme } from './theme'
import type { Filtros, Linea, Tablero } from './types'

type Estado<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ok'; data: T }

export default function App() {
  const { mode, toggle } = useTheme()
  const [filtros, setFiltros] = useState<Estado<Filtros>>({ status: 'loading' })
  const [linea, setLinea] = useState<Linea | null>(null)
  const [periodo, setPeriodo] = useState<string | null>(null)
  const [tablero, setTablero] = useState<Estado<Tablero>>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [metrica, setMetrica] = useState<MetricaEvolucion>('pagadas')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const ctl = new AbortController()
    fetchFiltros(ctl.signal)
      .then((data) => setFiltros({ status: 'ok', data }))
      .catch((e) => !ctl.signal.aborted && setFiltros({ status: 'error', error: String(e.message ?? e) }))
    return () => ctl.abort()
  }, [retry])

  useEffect(() => {
    const ctl = new AbortController()
    setRefreshing(true)
    fetchTablero(linea, periodo, ctl.signal)
      .then((data) => setTablero({ status: 'ok', data }))
      .catch((e) => !ctl.signal.aborted && setTablero({ status: 'error', error: String(e.message ?? e) }))
      .finally(() => !ctl.signal.aborted && setRefreshing(false))
    return () => ctl.abort()
  }, [linea, periodo, retry])

  const periodos = filtros.status === 'ok' ? filtros.data.periodos : []
  const periodosVisibles = periodos.filter((p) => !linea || p.linea === linea)

  // El color sigue al periodo (entidad), nunca a su posición: filtrar no repinta.
  const colorDe = useMemo(() => {
    const orden = [...periodos].sort((a, b) => a.primer_corte.localeCompare(b.primer_corte)).map((p) => p.periodo)
    return (p: string) => {
      const tokens = readTokens()
      const i = orden.indexOf(p)
      return tokens.series[(i < 0 ? 0 : i) % tokens.series.length]
    }
    // mode: los tokens cambian con el tema
  }, [periodos, mode])

  const onLinea = (l: Linea | null) => {
    setLinea(l)
    if (periodo && l && !periodos.some((p) => p.periodo === periodo && p.linea === l)) setPeriodo(null)
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="Dirección de Operaciones" className="brand-logo" />
          <div>
            <h1>Ventas de educación continua</h1>
            <p className="brand-sub">Órdenes de matrícula por corte semanal · Diplomados y especializaciones</p>
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={toggle} aria-label={mode === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}>
          {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <div className="filters" role="toolbar" aria-label="Filtros">
        <div className="segmented" role="radiogroup" aria-label="Línea">
          {([null, 'Diplomado', 'Especializacion'] as const).map((l) => (
            <button key={l ?? 'todas'} type="button" role="radio" aria-checked={linea === l} className={linea === l ? 'on' : ''} onClick={() => onLinea(l)}>
              {l ? lineaPlural(l) : 'Todas'}
            </button>
          ))}
        </div>
        <label className="select">
          <span>Periodo</span>
          <select value={periodo ?? ''} onChange={(e) => setPeriodo(e.target.value || null)} disabled={filtros.status !== 'ok'}>
            <option value="">Todos los periodos</option>
            {periodosVisibles.map((p) => (
              <option key={`${p.linea}-${p.periodo}`} value={p.periodo}>
                {p.periodo} · {lineaLabel(p.linea)} ({fmtFecha(p.primer_corte)} – {fmtFecha(p.ultimo_corte)})
              </option>
            ))}
          </select>
        </label>
        {refreshing && tablero.status === 'ok' && <span className="updating">Actualizando…</span>}
      </div>

      {tablero.status === 'loading' && <Skeleton />}
      {tablero.status === 'error' && (
        <div className="notice error" role="alert">
          <strong>No se pudieron cargar los datos.</strong> {tablero.error}
          <button type="button" className="link-btn" onClick={() => setRetry((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {tablero.status === 'ok' && (
        <Dashboard data={tablero.data} metrica={metrica} setMetrica={setMetrica} colorDe={colorDe} mode={mode} />
      )}

      <footer className="footer">
        Fuente: Cloud SQL · <code>core.ventas_ec</code> (reportes de órdenes financieras SINU).
        {tablero.status === 'ok' && <> Consultado {new Date(tablero.data.generado).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}.</>}
      </footer>
    </div>
  )
}

function Dashboard({
  data,
  metrica,
  setMetrica,
  colorDe,
  mode,
}: {
  data: Tablero
  metrica: MetricaEvolucion
  setMetrica: (m: MetricaEvolucion) => void
  colorDe: (p: string) => string
  mode: string
}) {
  const t = useMemo(() => readTokens(), [mode])
  const k = data.kpis
  const unico = data.alcance.length === 1 ? data.alcance[0] : null
  const prev = unico && data.kpis_anterior ? data.kpis_anterior : null

  const evo = useMemo(() => evolucionOption(t, data.evolucion, metrica, colorDe), [t, data, metrica, colorDe])
  const mov = useMemo(() => movimientoOption(t, data.evolucion), [t, data])
  const prog = useMemo(() => programasOption(t, data.programas, !data.filtros.linea), [t, data])
  const edad = useMemo(() => edadOption(t, data.edad), [t, data])
  const reg = useMemo(() => regionesOption(t, data.regiones), [t, data])

  if (k.ordenes === 0) {
    return <div className="notice">No hay órdenes para los filtros seleccionados.</div>
  }

  const corteTxt = unico
    ? `Corte del ${fmtFecha(unico.ultimo_corte, true)}${unico.corte_anterior ? ` · comparado con el ${fmtFecha(unico.corte_anterior)}` : ''}`
    : `Último corte de cada periodo: ${data.alcance.map((a) => `${a.periodo} ${fmtFecha(a.ultimo_corte)}`).join(' · ')}`

  const totalGenero = data.genero.reduce((s, g) => s + g.estudiantes, 0)

  return (
    <main className="grid">
      <section className="kpis" aria-label="Indicadores principales">
        <div className="hero">
          <span className="kpi-label">Valor vendido (órdenes pagadas)</span>
          <span className="hero-value" title={fmtMoneyFull(k.vendido)}>{fmtMoney(k.vendido)}</span>
          <Delta now={k.vendido} prev={prev?.vendido} money />
          <span className="kpi-foot">{corteTxt}</span>
        </div>
        <div className="tiles">
          <Tile label="Órdenes registradas" value={fmtInt(k.ordenes)} now={k.ordenes} prev={prev?.ordenes} foot={`${fmtInt(k.nuevos)} de estudiantes nuevos`} />
          <Tile label="Órdenes pagadas" value={fmtInt(k.pagadas)} now={k.pagadas} prev={prev?.pagadas} foot={`Conversión ${fmtPct(ratio(k.pagadas, k.ordenes))}`} />
          <Tile label="Estudiantes" value={fmtInt(k.estudiantes)} now={k.estudiantes} prev={prev?.estudiantes} foot="Documentos únicos" />
          <Tile label="Ingreso neto" value={fmtMoney(k.ingreso_neto)} title={fmtMoneyFull(k.ingreso_neto)} now={k.ingreso_neto} prev={prev?.ingreso_neto} money foot="Vendido menos becas y descuentos" />
          <Tile label="Becas y descuentos" value={fmtMoney(k.becas)} title={fmtMoneyFull(k.becas)} foot={`${fmtPct(ratio(k.becas, k.vendido))} del valor vendido`} />
          <Tile label="Por convertir" value={fmtMoney(k.por_convertir)} title={fmtMoneyFull(k.por_convertir)} foot={`${fmtInt(k.no_pagadas)} órdenes sin pagar`} />
        </div>
      </section>

      <Card
        className="span-2"
        title="Avance por corte"
        subtitle="Acumulado de cada periodo en cada corte semanal"
        actions={
          <div className="segmented small" role="radiogroup" aria-label="Métrica">
            {(
              [
                ['pagadas', 'Pagadas'],
                ['ordenes', 'Registradas'],
                ['vendido', 'Valor vendido'],
              ] as const
            ).map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={metrica === m} className={metrica === m ? 'on' : ''} onClick={() => setMetrica(m)}>
                {label}
              </button>
            ))}
          </div>
        }
        table={{
          columns: ['Corte', 'Periodo', 'Registradas', 'Pagadas', 'Conversión', 'Valor vendido'],
          rows: data.evolucion.map((p) => [fmtFecha(p.fecha_corte, true), serieKey(p), fmtInt(p.ordenes), fmtInt(p.pagadas), fmtPct(ratio(p.pagadas, p.ordenes)), fmtMoney(p.vendido)]),
        }}
      >
        <EChart option={evo} height={320} ariaLabel="Evolución por corte semanal" />
      </Card>

      <Card
        title="Movimiento entre cortes"
        subtitle="Órdenes que aparecen por primera vez y órdenes que pasan de «no pago» a «pago»"
        table={{
          columns: ['Corte', 'Periodo', 'Órdenes nuevas', 'Pasan a pago'],
          rows: data.evolucion.map((p) => [fmtFecha(p.fecha_corte, true), serieKey(p), fmtInt(p.nuevas), fmtInt(p.pasan_a_pago)]),
        }}
      >
        <EChart option={mov} height={300} ariaLabel="Movimiento de órdenes entre cortes" />
      </Card>

      <Card
        title="Asesores comerciales"
        subtitle="Órdenes creadas por asesor en el corte actual"
      >
        <AsesoresTable data={data} />
      </Card>

      <Card
        className="span-2"
        title={`Órdenes por programa (${data.programas.length})`}
        subtitle="Pagadas y sin pagar en el corte actual · total al final de cada barra"
        table={{
          columns: ['Programa', 'Línea', 'Registradas', 'Pagadas', 'Conversión', 'Valor vendido', 'Por convertir'],
          rows: data.programas.map((p) => [p.nombre, lineaLabel(p.linea), fmtInt(p.ordenes), fmtInt(p.pagadas), fmtPct(ratio(p.pagadas, p.ordenes)), fmtMoney(p.vendido), fmtMoney(p.por_convertir)]),
        }}
      >
        <div className="legend-inline">
          <span><i style={{ background: t.series[0] }} /> Pagadas</span>
          <span><i style={{ background: t.seqLight }} /> Sin pagar</span>
        </div>
        <EChart option={prog} height={Math.max(160, data.programas.length * 28 + 24)} ariaLabel="Órdenes por programa" />
      </Card>

      <Card
        title="Edad y género"
        subtitle="Estudiantes del corte actual"
        table={{ columns: ['Rango de edad', 'Mujeres', 'Hombres'], rows: data.edad.map((e) => [e.rango, fmtInt(e.F), fmtInt(e.M)]) }}
      >
        <div className="segbar" role="img" aria-label={data.genero.map((g) => `${generoLabel(g.genero)} ${fmtPct(ratio(g.estudiantes, totalGenero))}`).join(', ')}>
          {data.genero.map((g) => {
            const share = ratio(g.estudiantes, totalGenero)
            return (
              <div
                key={g.genero}
                className="seg"
                style={{ flexGrow: g.estudiantes, background: g.genero === 'F' ? t.series[1] : g.genero === 'M' ? t.series[0] : t.muted }}
                title={`${generoLabel(g.genero)}: ${fmtInt(g.estudiantes)} (${fmtPct(share)})`}
              >
                {share > 0.12 && <span>{generoLabel(g.genero)} {fmtPct(share)}</span>}
              </div>
            )
          })}
        </div>
        <EChart option={edad} height={240} ariaLabel="Distribución de edad por género" />
      </Card>

      <Card
        title="Procedencia"
        subtitle="Departamento de residencia de los estudiantes"
        table={{ columns: ['Región', 'Estudiantes'], rows: data.regiones.map((r) => [r.region, fmtInt(r.estudiantes)]) }}
      >
        <EChart option={reg} height={Math.max(160, data.regiones.length * 30)} ariaLabel="Estudiantes por región" />
      </Card>
    </main>
  )
}

const generoLabel = (g: string) => (g === 'F' ? 'Mujeres' : g === 'M' ? 'Hombres' : 'Otro')

function AsesoresTable({ data }: { data: Tablero }) {
  const max = Math.max(...data.asesores.map((a) => a.ordenes), 1)
  return (
    <div className="table-wrap">
      <table className="data-table asesores">
        <thead>
          <tr>
            <th>Asesor</th>
            <th className="num">Órdenes</th>
            <th className="num">Pagadas</th>
            <th className="num">Conversión</th>
            <th className="num">Vendido</th>
          </tr>
        </thead>
        <tbody>
          {data.asesores.map((a) => (
            <tr key={a.asesor}>
              <td>
                <div className="asesor-name">{a.asesor}</div>
                <div className="meter" aria-hidden="true">
                  <span className="meter-total" style={{ width: `${(a.ordenes / max) * 100}%` }}>
                    <span className="meter-fill" style={{ width: `${ratio(a.pagadas, a.ordenes) * 100}%` }} />
                  </span>
                </div>
              </td>
              <td className="num">{fmtInt(a.ordenes)}</td>
              <td className="num">{fmtInt(a.pagadas)}</td>
              <td className="num">{fmtPct(ratio(a.pagadas, a.ordenes))}</td>
              <td className="num">{fmtMoney(a.vendido)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Tile({ label, value, foot, now, prev, money, title }: { label: string; value: string; foot?: string; now?: number; prev?: number; money?: boolean; title?: string }) {
  return (
    <div className="tile">
      <span className="kpi-label">{label}</span>
      <span className="tile-value" title={title}>{value}</span>
      {now != null && <Delta now={now} prev={prev} money={money} />}
      {foot && <span className="kpi-foot">{foot}</span>}
    </div>
  )
}

function Delta({ now, prev, money }: { now: number; prev?: number; money?: boolean }) {
  if (prev == null) return null
  const diff = now - prev
  if (Math.abs(diff) < 0.5) return <span className="delta flat">Sin cambio vs corte anterior</span>
  const up = diff > 0
  const txt = money ? fmtMoney(Math.abs(diff)) : fmtInt(Math.abs(diff))
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {up ? '+' : '−'}
      {txt} <span className="delta-ctx">vs corte anterior</span>
    </span>
  )
}

function Skeleton() {
  return (
    <div className="grid" aria-busy="true" aria-label="Cargando">
      <div className="kpis">
        <div className="hero skeleton" />
        <div className="tiles">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="tile skeleton" />
          ))}
        </div>
      </div>
      <div className="card span-2 skeleton" style={{ height: 380 }} />
      <div className="card skeleton" style={{ height: 360 }} />
      <div className="card skeleton" style={{ height: 360 }} />
    </div>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

