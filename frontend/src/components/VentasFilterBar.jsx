import { useEffect, useMemo } from 'react'
import { useVentasFilters } from '../context/VentasFiltersContext'

export default function VentasFilterBar() {
  const {
    linea, setLinea,
    periodo, setPeriodo,
    programa, setPrograma,
    semana, setSemana,
    clearFilters,
    opciones,
  } = useVentasFilters()

  const periodos = useMemo(
    () => opciones.periodos.filter((p) => !linea || p.linea === linea),
    [opciones.periodos, linea],
  )
  const programas = useMemo(
    () => opciones.programas.filter((p) => !linea || p.linea === linea),
    [opciones.programas, linea],
  )

  // Si cambia la línea y el periodo/programa elegido ya no aplica, se limpia.
  useEffect(() => {
    if (periodo && !periodos.some((p) => p.value === periodo)) setPeriodo('')
    if (programa && !programas.some((p) => p.value === programa)) setPrograma('')
  }, [periodos, programas, periodo, programa, setPeriodo, setPrograma])

  return (
    <div className="ventas-dash-filters">
      <div className="ventas-dash-filters-inner">
        <div className="ventas-fbar" role="search" aria-label="Filtros ventas semanales">
          <span className="ventas-flbl">Filtros</span>
          <select id="vs-f-ciclo-propedeutico" aria-label="Línea" value={linea} onChange={(e) => setLinea(e.target.value)}>
            <option value="">Todas las líneas</option>
            {opciones.lineas.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select id="vs-f-periodo" aria-label="Periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="">Todos los periodos</option>
            {periodos.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select id="vs-f-diplomado" aria-label="Diplomado" value={programa} onChange={(e) => setPrograma(e.target.value)}>
            <option value="">Todos los diplomados</option>
            {programas.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select id="vs-f-semana" aria-label="Semana" value={semana} onChange={(e) => setSemana(e.target.value)}>
            <option value="">Todas las semanas</option>
            {opciones.semanas.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="button" className="ventas-btn-clear" onClick={clearFilters}>
            Limpiar
          </button>
        </div>
      </div>
    </div>
  )
}
