import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setVentasPayload } from '../data'

/**
 * Filtros + datos del tablero.
 * Los filtros se aplican en el servidor (/api/ventas), así que cada gráfico
 * recibe los datos ya filtrados y solo se encarga de dibujarlos.
 */
const VentasFiltersContext = createContext(null)
const VentasDataContext = createContext(null)

async function getJson(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json()).detail || ''
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(detail || `Error ${res.status} consultando ${url}`)
  }
  return res.json()
}

export function VentasFiltersProvider({ children }) {
  const [linea, setLinea] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [programa, setPrograma] = useState('')
  const [semana, setSemana] = useState('')

  const [opciones, setOpciones] = useState({ lineas: [], periodos: [], programas: [], semanas: [] })
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const [retry, setRetry] = useState(0)

  const clearFilters = useCallback(() => {
    setLinea('')
    setPeriodo('')
    setPrograma('')
    setSemana('')
  }, [])

  useEffect(() => {
    const ctl = new AbortController()
    getJson('/api/ventas/filtros', ctl.signal)
      .then(setOpciones)
      .catch(() => {})
    return () => ctl.abort()
  }, [retry])

  useEffect(() => {
    const ctl = new AbortController()
    const q = new URLSearchParams()
    if (linea) q.set('linea', linea)
    if (periodo) q.set('periodo', periodo)
    if (programa) q.set('programa', programa)
    if (semana) q.set('semana', semana)
    setState((s) => ({ ...s, status: s.data ? 'refreshing' : 'loading' }))
    getJson(`/api/ventas${q.toString() ? `?${q}` : ''}`, ctl.signal)
      .then((data) => {
        if (!data.vacio) setVentasPayload(data)
        setState({ status: 'ok', data, error: null })
      })
      .catch((e) => {
        if (!ctl.signal.aborted) setState((s) => ({ ...s, status: 'error', error: String(e.message || e) }))
      })
    return () => ctl.abort()
  }, [linea, periodo, programa, semana, retry])

  const filters = useMemo(
    () => ({
      linea,
      setLinea,
      periodo,
      setPeriodo,
      programa,
      setPrograma,
      semana,
      setSemana,
      clearFilters,
      opciones,
    }),
    [linea, periodo, programa, semana, clearFilters, opciones],
  )

  const data = useMemo(() => ({ ...state, reload: () => setRetry((n) => n + 1) }), [state])

  return (
    <VentasFiltersContext.Provider value={filters}>
      <VentasDataContext.Provider value={data}>{children}</VentasDataContext.Provider>
    </VentasFiltersContext.Provider>
  )
}

export function useVentasFilters() {
  const ctx = useContext(VentasFiltersContext)
  if (!ctx) throw new Error('useVentasFilters debe usarse dentro de VentasFiltersProvider')
  return ctx
}

/** Estado de carga: { status, data, error, reload } */
export function useVentasState() {
  const ctx = useContext(VentasDataContext)
  if (!ctx) throw new Error('useVentasState debe usarse dentro de VentasFiltersProvider')
  return ctx
}

