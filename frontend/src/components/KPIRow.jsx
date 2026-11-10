import { KPIS } from '../data'

export default function KPIRow() {
  return (
    <div>
      <div className="kpis">
        {KPIS.map((k) => (
          <div key={k.label} className={`kpi ${k.color}`}>
            <div className="kpi-lbl">{k.label}</div>
            <div className="kpi-val">{k.value}</div>
            <div className={`kpi-delta ${k.deltaType}`}>{k.delta}</div>
            <div className="kpi-ctx">{k.ctx}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
