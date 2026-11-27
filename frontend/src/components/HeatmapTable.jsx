import { useMemo } from 'react'
import { HEATMAP_ROWS, HEATMAP_WEEKS } from '../data'

function hmapColor(v, max = 15) {
  if (v === 0) return { bg: '#f1f5f9', fg: '#94a3b8' }
  const t = v / max
  const r = Math.round(30 + (1 - t) * 195)
  const g = Math.round(80 + (1 - t) * 150)
  const b = Math.round(185 + (1 - t) * 55)
  return { bg: `rgb(${r},${g},${b})`, fg: t > 0.45 ? '#fff' : '#0a1f3c' }
}

export default function HeatmapTable() {

  // La semana se filtra en el servidor: aquí siempre se muestran todas las columnas recibidas.
  const colIndices = useMemo(() => HEATMAP_WEEKS.map((_, i) => i), [])
  const weekLabels = HEATMAP_WEEKS
  const slicedRows = HEATMAP_ROWS

  const maxVal = useMemo(() => {
    if (!slicedRows.length) return 1
    return Math.max(...slicedRows.flatMap((r) => r.data), 1)
  }, [slicedRows])


  return (
    <div className="card">
      <div className="ct">Matrículas nuevas por programa y semana</div>
      <div className="cs">
        Matrículas de todos los programas por semana de creación de la orden · Más oscuro = más registros
      </div>
      <div className="hmap-wrap hmap">
        {slicedRows.length === 0 ? (
          <p style={{ padding: '24px', textAlign: 'center', color: 'var(--gray)', fontSize: 12 }}>
            No hay registros para la combinación de filtros seleccionados.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="prog-h">Diplomado</th>
                {weekLabels.map((w) => <th key={w}>{w}</th>)}
                <th style={{ color: '#1e50d0' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {slicedRows.map((row) => {
                const tot = row.data.reduce((a, b) => a + b, 0)
                return (
                  <tr key={row.l}>
                    <td className="prog-cell">{row.l}</td>
                    {row.data.map((v, i) => {
                      const c = hmapColor(v, maxVal)
                      return (
                        <td key={i} style={{ background: c.bg, color: c.fg, padding: '0 4px' }}>
                          {v || '—'}
                        </td>
                      )
                    })}
                    <td style={{ background: 'transparent', color: '#1e50d0', fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: 11, textAlign: 'center' }}>
                      {tot}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td className="prog-cell" style={{ color: '#94a3b8', fontSize: 9.5 }}>Registros semanales</td>
                {colIndices.map((ciFromOrig, ti) => {
                  const col = slicedRows.reduce((s, r) => s + r.data[ti], 0)
                  return (
                    <td key={ti} style={{ background: 'transparent', color: '#475569', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 600, textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
                      {col}
                    </td>
                  )
                })}
                <td style={{ background: 'transparent', color: '#1e50d0', fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 11, textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
                  {slicedRows.reduce((s, r) => s + r.data.reduce((a, b) => a + b, 0), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
