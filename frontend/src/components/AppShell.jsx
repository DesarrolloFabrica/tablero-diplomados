import { useAuth } from '../context/AuthContext'
import { useVentasState } from '../context/VentasFiltersContext'

/** Barra global CUN + franja de título (idéntica a dashboard_compacto.html del legacy). */
export default function AppShell() {
  const { status } = useVentasState()
  const { user, logout } = useAuth()
  const name = user?.name || user?.email || 'Usuario'
  return (
    <div className="app-top-chrome">
      <header className="app-shell-bar" role="banner">
        <div className="app-shell-inner">
          <a className="app-shell-brand" href="/" aria-label="CUN · Dirección de Operaciones">
            <span className="app-shell-brand-crop">
              <img className="app-shell-brand-img" src="/logo.png" alt="Dirección de Operaciones" decoding="async" />
            </span>
          </a>
          <nav className="app-shell-tabwrap" aria-hidden="true" />
          <div className="app-shell-user" aria-label={`Sesión de ${name}`}>
            <div className="app-shell-user-avatar" aria-hidden="true">
              {user?.picture ? (
                <img src={user.picture} alt="" referrerPolicy="no-referrer" />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </div>
            <div className="app-shell-user-lines">
              <span className="app-shell-user-name">{name}</span>
              <span className="app-shell-user-role">{user?.email || 'Cuenta institucional'}</span>
            </div>
            <button type="button" className="app-shell-logout" onClick={logout}>Salir</button>
          </div>
        </div>
      </header>

      <div className="dash-subnav-stack">
        <header className="app-header-dash">
          <div className="app-header-sub">
            <div className="app-header-sub-inner">
              <div className="app-header-sub-top">
                <div className="app-header-title-wrap">
                  <h1 className="app-header-title">Educación continuada</h1>
                </div>
                <span className="app-source-badge" title="PostgreSQL en Cloud SQL · core.ventas_ec">
                  <span className="app-source-dot" aria-hidden="true" style={status === 'error' ? { background: '#b91c1c' } : undefined} />
                  <span>Fuente de datos: Cloud SQL</span>
                </span>
              </div>
            </div>
          </div>
        </header>
      </div>
    </div>
  )
}
