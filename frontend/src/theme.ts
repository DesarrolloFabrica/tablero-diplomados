import { useCallback, useEffect, useState } from 'react'

export type Mode = 'light' | 'dark'
export type Preference = Mode | 'system'

const KEY = 'tablero-diplomados:tema'

function readPref(): Preference {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemMode(): Mode {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Tokens de gráficos leídos de las variables CSS (una sola fuente de verdad: styles.css). */
export interface ChartTokens {
  surface: string
  ink: string
  ink2: string
  muted: string
  grid: string
  axis: string
  series: string[]
  seqLight: string
}

export function readTokens(): ChartTokens {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string) => cs.getPropertyValue(n).trim()
  return {
    surface: v('--surface-1'),
    ink: v('--text-primary'),
    ink2: v('--text-secondary'),
    muted: v('--text-muted'),
    grid: v('--grid'),
    axis: v('--axis'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--series-${i}`)),
    seqLight: v('--seq-light'),
  }
}

export function useTheme() {
  const [pref, setPref] = useState<Preference>(readPref)
  const [mode, setMode] = useState<Mode>(() => (pref === 'system' ? systemMode() : pref))

  useEffect(() => {
    const root = document.documentElement
    if (pref === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', pref)
    try {
      if (pref === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, pref)
    } catch {
      /* almacenamiento no disponible */
    }
    setMode(pref === 'system' ? systemMode() : pref)
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setMode(systemMode())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  const toggle = useCallback(() => setPref((p) => ((p === 'system' ? systemMode() : p) === 'dark' ? 'light' : 'dark')), [])

  return { mode, toggle }
}
