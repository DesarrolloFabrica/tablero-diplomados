const intFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const dec1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dec2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const copFull = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export const fmtInt = (n: number) => intFmt.format(n)

/** $1,52 mil M · $361,5 M · $850 mil */
export function fmtMoney(n: number): string {
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (a >= 1e9) return `${sign}$${dec2.format(a / 1e9)} mil M`
  if (a >= 1e6) return `${sign}$${dec1.format(a / 1e6)} M`
  if (a >= 1e3) return `${sign}$${intFmt.format(Math.round(a / 1e3))} mil`
  return `${sign}$${intFmt.format(a)}`
}

/** Para ejes: $0 · $100 M · $1,5 mil M */
export function fmtMoneyAxis(n: number): string {
  if (n === 0) return '$0'
  if (Math.abs(n) >= 1e9) return `$${dec1.format(n / 1e9).replace(',0', '')} mil M`
  if (Math.abs(n) >= 1e6) return `$${intFmt.format(n / 1e6)} M`
  return `$${intFmt.format(n)}`
}

export const fmtMoneyFull = (n: number) => copFull.format(n)

export const fmtPct = (x: number) => `${dec1.format(x * 100)} %`

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** '2026-10-30' → '30 oct' (o '30 oct 2026' con year=true) */
export function fmtFecha(iso: string, year = false): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MESES[m - 1]}${year ? ` ${y}` : ''}`
}

export const lineaLabel = (l: string) => (l === 'Especializacion' ? 'Especialización' : 'Diplomado')
export const lineaPlural = (l: string) => (l === 'Especializacion' ? 'Especializaciones' : 'Diplomados')

export function ratio(a: number, b: number): number {
  return b > 0 ? a / b : 0
}
