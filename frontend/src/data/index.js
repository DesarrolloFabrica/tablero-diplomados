// ══════════════════════════════════════════════════════════════
//  DATA — Ventas Educación Continua · CUN
//  Mismos nombres que el tablero legacy, pero en vivo desde
//  /api/ventas (Cloud SQL core.ventas_ec). Son *live bindings*:
//  setVentasPayload() los actualiza y la app vuelve a montar los
//  gráficos con cada respuesta (ver App.jsx).
// ══════════════════════════════════════════════════════════════

export {
  SEMAFORO,
  LABEL_DATOS_NEGRO,
  pagoBandColor,
  divergingBarColor,
  waterfallBarColor,
  waterfallLabelTextColor,
  WATERFALL_KIND,
} from './semaforo'

// ── Colores del tema ──────────────────────────────────────────
export const COLORS = {
  navy:  '#0a1f3c',
  blue:  '#1e50d0',
  green: '#0f6b3f',
  red:   '#b91c1c',
  amber: '#a35c00',
  gray:  '#94a3b8',
  grid:  'rgba(203,213,225,.55)',
  white: '#ffffff',
}

// ── Datos en vivo ─────────────────────────────────────────────
export let VENTAS_GCP_META = {}
export let KPIS = []
export let AVG_PAGO = 0
export let BUBBLE_DATA = []
export let DIVERGING_DATA = []
export let GENDER_DATA = []
export let WATERFALL_BARS = []
export let AGE_DATA = { labels: [], counts: [], pagos: [] }
export let HEATMAP_WEEKS = []
export let HEATMAP_ROWS = []
export let WEEKLY_FLOW = { labels: [], counts: [], pagos: [] }
export let SLOPE_DATA = []
export let SEM_AVGS = []
export let SLOPE_WEEK_LABELS = []

export function setVentasPayload(p) {
  VENTAS_GCP_META = p.meta || {}
  KPIS = p.KPIS || []
  AVG_PAGO = p.AVG_PAGO ?? 0
  BUBBLE_DATA = p.BUBBLE_DATA || []
  DIVERGING_DATA = p.DIVERGING_DATA || []
  GENDER_DATA = p.GENDER_DATA || []
  WATERFALL_BARS = p.WATERFALL_BARS || []
  AGE_DATA = p.AGE_DATA || { labels: [], counts: [], pagos: [] }
  HEATMAP_WEEKS = p.HEATMAP_WEEKS || []
  HEATMAP_ROWS = p.HEATMAP_ROWS || []
  WEEKLY_FLOW = p.WEEKLY_FLOW || { labels: [], counts: [], pagos: [] }
  SLOPE_DATA = p.SLOPE_DATA || []
  SEM_AVGS = p.SEM_AVGS || []
  SLOPE_WEEK_LABELS = p.SLOPE_WEEK_LABELS || []
}
