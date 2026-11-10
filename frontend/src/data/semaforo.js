// Semáforo compartido (cobranza / matrículas · misma familia hex que distribución por notas en Cerre ventas)

export const LABEL_DATOS_NEGRO = '#111111'

export const SEMAFORO = {
  critico: '#E74C3C',
  alerta: '#E67E22',
  normal: '#F1C40F',
  optimo: '#2ECC71',
  optimo_max: '#1A8A4A',
  referencia: '#185FA5',
}

/** Color por banda según % tasa de pago: menor a 55 crítico; 55–64 alerta; 65–75 normal; mayor que 75 óptimo. */
export function pagoBandColor(pct) {
  if (pct < 55) return SEMAFORO.critico
  if (pct < 65) return SEMAFORO.alerta
  if (pct <= 75) return SEMAFORO.normal
  return SEMAFORO.optimo
}

/** Divergencias: sólo dos colores por signo. */
export function divergingBarColor(delta) {
  return delta < 0 ? SEMAFORO.critico : SEMAFORO.optimo_max
}

export const WATERFALL_KIND = /** @type {const} */ ({
  facturado: 'facturado',
  pendiente_critico: 'pendiente_critico',
  pendiente_moderado: 'pendiente_moderado',
  pendiente_otros: 'pendiente_otros',
  recaudo: 'recaudo',
})

export function waterfallBarColor(kind) {
  switch (kind) {
    case WATERFALL_KIND.facturado:
      return SEMAFORO.referencia
    case WATERFALL_KIND.pendiente_critico:
      return SEMAFORO.critico
    case WATERFALL_KIND.pendiente_moderado:
      return SEMAFORO.alerta
    case WATERFALL_KIND.pendiente_otros:
      return SEMAFORO.normal
    case WATERFALL_KIND.recaudo:
      return SEMAFORO.optimo_max
    default:
      return SEMAFORO.referencia
  }
}

/** Texto dentro de barras waterfall: oscuro sólo sobre amarillo/naranja. */
export function waterfallLabelTextColor(backgroundHex) {
  const hex = backgroundHex.replace('#', '').slice(0, 6).toUpperCase()
  const light = [`${SEMAFORO.normal}`.slice(1), `${SEMAFORO.alerta}`.slice(1)]
  const u = hex
  return light.includes(u) ? '#333333' : '#ffffff'
}
