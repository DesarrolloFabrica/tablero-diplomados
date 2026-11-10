import type { Filtros, Linea, Tablero } from './types'

// Siempre ruta relativa: en local la resuelve el proxy de Vite y en Cloud Run el proxy de nginx.
const BASE = '/api'

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json()).detail ?? ''
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(detail || `Error ${res.status} al consultar ${path}`)
  }
  return res.json() as Promise<T>
}

export const fetchFiltros = (signal?: AbortSignal) => get<Filtros>('/filtros', signal)

export function fetchTablero(linea: Linea | null, periodo: string | null, signal?: AbortSignal) {
  const q = new URLSearchParams()
  if (linea) q.set('linea', linea)
  if (periodo) q.set('periodo', periodo)
  const qs = q.toString()
  return get<Tablero>(`/tablero${qs ? `?${qs}` : ''}`, signal)
}
