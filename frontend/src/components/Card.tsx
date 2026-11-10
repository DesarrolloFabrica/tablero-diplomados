import { useId, useState, type ReactNode } from 'react'

export interface TableSpec {
  columns: string[]
  rows: (string | number)[][]
}

interface Props {
  title: string
  subtitle?: ReactNode
  table?: TableSpec
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function Card({ title, subtitle, table, actions, className, children }: Props) {
  const [showTable, setShowTable] = useState(false)
  const id = useId()
  return (
    <section className={`card ${className ?? ''}`} aria-labelledby={id}>
      <header className="card-head">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
        <div className="card-actions">
          {actions}
          {table && (
            <button type="button" className="link-btn" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}>
              {showTable ? 'Ver gráfico' : 'Ver tabla'}
            </button>
          )}
        </div>
      </header>
      {showTable && table ? <DataTable {...table} /> : children}
    </section>
  )
}

function DataTable({ columns, rows }: TableSpec) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={i > 0 ? 'num' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className={j > 0 ? 'num' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
