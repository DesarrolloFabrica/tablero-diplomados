import { useEffect } from 'react'
import AppShell     from './components/AppShell'
import VentasFilterBar from './components/VentasFilterBar'
import KPIRow       from './components/KPIRow'
import BubbleChart  from './components/BubbleChart'
import DivergingChart from './components/DivergingChart'
import HeatmapTable from './components/HeatmapTable'
import GenderPyramid from './components/GenderPyramid'
import WaterfallChart from './components/WaterfallChart'
import AgeChart     from './components/AgeChart'
import SlopeChart   from './components/SlopeChart'
import WeeklyFlow   from './components/WeeklyFlow'
import Footer       from './components/Footer'
import { useAuth } from './context/AuthContext'
import { VentasFiltersProvider, useVentasState } from './context/VentasFiltersContext'
import LoginScreen from './components/LoginScreen'

export default function App() {
  const { status, user } = useAuth()
  if (status !== 'in' || !user) return <LoginScreen />
  return (
    <VentasFiltersProvider>
      <Dashboard />
    </VentasFiltersProvider>
  )
}

function Dashboard() {
  const { status, data, error, reload } = useVentasState()

  useEffect(() => {
    // Mismo layout que el tablero legacy (ancho útil 1700px).
    document.body.classList.add('is-embedded')
    const bump = () => window.dispatchEvent(new Event('resize'))
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(bump)
      ro.observe(document.body)
    }
    return () => ro && ro.disconnect()
  }, [])

  const ready = data && !data.vacio

  return (
    <div className="dashboard">
      {/* ── Barra CUN + título ───────────────────────────────── */}
      <AppShell />

      <VentasFilterBar />

      {status === 'loading' && !data && <div className="ventas-estado">Cargando datos desde Cloud SQL…</div>}
      {status === 'error' && (
        <div className="ventas-estado err" role="alert">
          No se pudieron cargar los datos: {error}
          <button type="button" className="ventas-btn-clear" onClick={reload}>Reintentar</button>
        </div>
      )}
      {data && data.vacio && (
        <div className="ventas-estado">No hay órdenes para la combinación de filtros seleccionada.</div>
      )}

      {ready && (
        // key: se vuelven a montar los gráficos con cada respuesta de la API.
        <div className="main" key={data.meta.generado} style={status === 'refreshing' ? { opacity: 0.6 } : undefined}>
          {/* ── KPIs ──────────────────────────────────────────────── */}
          <KPIRow />

          {/* ── Row 1: Bubble + Diverging ─────────────────────────── */}
          <div className="row3">
            <BubbleChart />
            <DivergingChart />
          </div>

          {/* ── Row 2: Edad + Gender Pyramid ─────────────────────── */}
          <div className="row2">
            <AgeChart />
            <GenderPyramid />
          </div>

          {/* ── Row 3: Waterfall + Heatmap programa/semana ─────────── */}
          <div className="row2">
            <WaterfallChart />
            <HeatmapTable />
          </div>

          <div className="row2">
            <SlopeChart />
            <WeeklyFlow />
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────── */}
      <Footer />
    </div>
  )
}
