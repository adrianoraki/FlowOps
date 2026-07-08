import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import s from './PublicLayout.module.css'

interface PublicLayoutProps {
  children: ReactNode
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className={s.root}>
      <header className={s.header}>
        <Link to="/" className={s.brand}>FlowOps</Link>
        <nav className={s.nav}>
          <NavLink to="/quem-somos" className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkAtivo : ''}`}>
            Quem Somos
          </NavLink>
          <NavLink to="/privacidade" className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkAtivo : ''}`}>
            Política de Privacidade
          </NavLink>
          <Link to="/login" className={s.entrar}>Entrar</Link>
        </nav>
      </header>

      <main className={s.main}>
        <div className={s.container}>{children}</div>
      </main>

      <footer className={s.footer}>
        <div className={s.footerContent}>
          <span className={s.copy}>© {new Date().getFullYear()} [RAZÃO SOCIAL] — FlowOps</span>
          <div className={s.footerLinks}>
            <Link to="/quem-somos">Quem Somos</Link>
            <Link to="/privacidade">Política de Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
