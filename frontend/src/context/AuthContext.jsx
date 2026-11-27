import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)
export const UNAUTHORIZED = 'tablero:unauthorized'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const [cfgRes, meRes] = await Promise.all([
        fetch('/api/auth/config', { credentials: 'same-origin', headers: { Accept: 'application/json' } }),
        fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } }),
      ])
      const cfg = await readJson(cfgRes)
      setConfig(cfg)
      if (meRes.ok) {
        setUser(await meRes.json())
        setStatus('in')
        return
      }
      setUser(null)
      setStatus('out')
      if (cfg.reason) setError(cfg.reason)
    } catch (e) {
      setUser(null)
      setStatus('out')
      setError(e instanceof Error ? e.message : 'No se pudo contactar el servidor.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onOut = () => {
      setUser(null)
      setStatus('out')
    }
    window.addEventListener(UNAUTHORIZED, onOut)
    return () => window.removeEventListener(UNAUTHORIZED, onOut)
  }, [])

  const loginWithCredential = useCallback(async (credential) => {
    setError('')
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const body = await readJson(res)
    if (!res.ok) {
      const detail = typeof body.detail === 'string' ? body.detail : 'No se pudo iniciar sesión.'
      setError(detail)
      throw new Error(detail)
    }
    setUser(body)
    setStatus('in')
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect()
    setUser(null)
    setStatus('out')
  }, [])

  const value = useMemo(
    () => ({ status, user, config, error, loginWithCredential, logout, reload: load }),
    [status, user, config, error, loginWithCredential, logout, load],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
