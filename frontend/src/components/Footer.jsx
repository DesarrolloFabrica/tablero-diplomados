import { VENTAS_GCP_META } from '../data'

const SOURCE_LABEL = 'Fuente de datos: Cloud SQL'

export default function Footer() {
  const corte = VENTAS_GCP_META?.corte || '—'
  const ultima = VENTAS_GCP_META?.ultima_semana || '—'
  const fuente = VENTAS_GCP_META?.fuente || 'core.ventas_ec'
  return (
    <div className="ftr">
      <div className="ftr-l">
        CUN · Dirección de Operaciones · BI &nbsp;|&nbsp; {SOURCE_LABEL}
      </div>
      <div className="ftr-r">
        Corte: {corte} &nbsp;·&nbsp; Última semana: {ultima} &nbsp;·&nbsp; {fuente}
      </div>
    </div>
  )
}
