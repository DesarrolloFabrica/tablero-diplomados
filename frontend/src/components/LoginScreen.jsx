import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginScreen() {
  const { status, config, error, loginWithCredential } = useAuth()
  const btnRef = useRef(null)
  const loginRef = useRef(loginWithCredential)
  const [googleError, setGoogleError] = useState('')
  loginRef.current = loginWithCredential

  const clientId = config?.clientId || ''
  const domain = config?.hostedDomain || ''

  useEffect(() => {
    if (status !== 'out' || !clientId || !btnRef.current) return undefined
    let cancelled = false

    const paint = () => {
      if (cancelled || !btnRef.current || !window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => {
          if (resp?.credential) {
            loginRef.current(resp.credential).catch((e) => setGoogleError(String(e.message || e)))
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        ...(domain ? { hd: domain } : {}),
      })
      btnRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(btnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 320,
        locale: 'es',
      })
    }

    const bind = (script) => {
      if (script.dataset.loaded === '1' || window.google?.accounts?.id) paint()
      else script.addEventListener('load', paint, { once: true })
    }

    if (window.google?.accounts?.id) {
      paint()
    } else {
      const existing = document.querySelector('script[data-gsi]')
      if (existing) {
        bind(existing)
      } else {
        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.dataset.gsi = '1'
        script.onload = () => {
          script.dataset.loaded = '1'
          paint()
        }
        script.onerror = () => setGoogleError('No se pudo cargar el botón de Google.')
        document.head.appendChild(script)
      }
    }

    return () => {
      cancelled = true
    }
  }, [status, clientId, domain])

  const checking = status === 'loading'
  const message = googleError || error

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img className="login-logo" src="/logo.png" alt="CUN · Dirección de Operaciones" />
        </div>
        <h1>Educación continuada</h1>
        <p>
          {checking
            ? 'Comprobando la sesión…'
            : 'Entra con una cuenta de Google autorizada.'}
        </p>
        {!checking && clientId && <div className="login-google" ref={btnRef} />}
        {!checking && !clientId && (
          <p className="login-error" role="alert">
            El inicio de sesión todavía no está configurado{message ? `: ${message}` : '.'}
          </p>
        )}
        {message && clientId && (
          <p className="login-error" role="alert">{message}</p>
        )}
      </div>
    </div>
  )
}
