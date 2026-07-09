import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '@flowops/types'
import s from './AppShell.module.css'

interface NavItem {
  label: string
  to: string
  roles: UserRole[]
}

const GRUPOS: { titulo: string; items: NavItem[] }[] = [
  {
    titulo: 'Operação',
    items: [
      { label: 'Dashboard',         to: '/',          roles: ['gestor', 'admin'] },
      { label: 'Minhas OSs',        to: '/ordens',    roles: ['tecnico'] },
      { label: 'Ordens de Serviço', to: '/ordens',    roles: ['gestor', 'admin'] },
      { label: 'Parceiros',         to: '/parceiros', roles: ['gestor', 'admin'] },
      { label: 'Meu Estoque',       to: '/estoque',   roles: ['tecnico'] },
      { label: 'Estoque',           to: '/estoque',   roles: ['gestor', 'admin'] },
      { label: 'Meus Selos',        to: '/selos',     roles: ['tecnico'] },
      { label: 'Selos',             to: '/selos',     roles: ['gestor', 'admin'] },
    ],
  },
  {
    titulo: 'Gestão',
    items: [
      { label: 'Técnicos',   to: '/tecnicos',   roles: ['gestor', 'admin'] },
      { label: 'Peças',      to: '/pecas',      roles: ['gestor', 'admin'] },
      { label: 'Regiões',       to: '/regioes',       roles: ['admin'] },
      { label: 'Configurações', to: '/configuracoes', roles: ['admin'] },
      { label: 'Relatórios', to: '/relatorios', roles: ['gestor', 'admin', 'tecnico'] },
    ],
  },
]

const PAGE_TITLES: Record<string, string> = {
  '/':           'Dashboard',
  '/ordens':     'Ordens de Serviço',
  '/ordens/nova': 'Nova OS',
  '/parceiros':  'Parceiros',
  '/estoque':    'Estoque',
  '/selos':      'Selos',
  '/tecnicos':   'Técnicos',
  '/pecas':      'Peças',
  '/regioes':        'Regiões',
  '/configuracoes':  'Configurações',
  '/relatorios': 'Relatórios',
}

const ROLE_LABELS: Record<UserRole, string> = {
  tecnico: 'Técnico',
  gestor:  'Gestor',
  admin:   'Admin',
}

// SVG paths (Heroicons outline, viewBox 0 0 24 24)
const ICONS: Record<string, string> = {
  '/':              'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  '/ordens':        'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  '/parceiros':     'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  '/estoque':       'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  '/tecnicos':      'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  '/pecas':         'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
  '/selos':         'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z',
  '/regioes':       'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z',
  '/relatorios':    'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  '/configuracoes': 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

function initials(nome: string): string {
  return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

export function AppShell() {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const nomeUsuario = user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuário'
  const tituloAtual = (() => {
    if (role === 'tecnico') {
      if (location.pathname === '/ordens')  return 'Minhas OSs'
      if (location.pathname === '/estoque') return 'Meu Estoque'
      if (location.pathname === '/selos')   return 'Meus Selos'
    }
    return PAGE_TITLES[location.pathname] ??
      (location.pathname.startsWith('/ordens/') ? 'OS' : 'FlowOps')
  })()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const gruposVisiveis = GRUPOS.map(g => ({
    ...g,
    items: g.items.filter(item => role && item.roles.includes(role)),
  })).filter(g => g.items.length > 0)

  return (
    <div className={s.shell}>
      <div
        className={`${s.overlay} ${sidebarOpen ? s.overlayVisivel : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`${s.sidebar} ${sidebarOpen ? s.sidebarAberta : ''}`}>
        <div className={s.sidebarTopo}>
          <span className={s.logo}>FlowOps</span>
          <button className={s.fecharSidebar} onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
            ×
          </button>
        </div>

        <nav className={s.nav}>
          {gruposVisiveis.length === 0 && (
            <p className={s.semPerfil}>
              Perfil não configurado.
              <br />
              Crie o documento <code>users/{user?.uid}</code> no Firestore com o campo <code>role</code>.
            </p>
          )}
          {gruposVisiveis.map(grupo => (
            <div key={grupo.titulo} className={s.navGrupo}>
              <span className={s.navGrupoTitulo}>{grupo.titulo}</span>
              {grupo.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `${s.navItem} ${isActive ? s.navItemAtivo : ''}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={s.navIcon}>
                    <path d={ICONS[item.to] ?? ''} />
                  </svg>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className={s.principal}>
        <header className={s.header}>
          <div className={s.headerEsquerda}>
            <button
              className={s.menuBotao}
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <h1 className={s.paginaTitulo}>{tituloAtual}</h1>
          </div>

          <div className={s.headerDireita}>
            <div className={s.buscaWrapper}>
              <input
                className={s.busca}
                type="text"
                placeholder="Buscar…"
                readOnly
              />
              <kbd className={s.buscaAtalho}>⌘K</kbd>
            </div>

            <div className={s.tempoReal}>
              <span className={s.pontinho} />
              <span className={s.tempoRealLabel}>Tempo real</span>
            </div>

            <div className={s.usuarioMenuWrapper}>
              <button
                className={s.usuarioMenuBotao}
                onClick={() => setUserMenuOpen(v => !v)}
              >
                <div className={s.avatarPequeno}>{initials(nomeUsuario)}</div>
                <span className={s.usuarioMenuNome}>{nomeUsuario}</span>
                <span className={s.chevron}>▾</span>
              </button>

              {userMenuOpen && (
                <>
                  <div className={s.menuBackdrop} onClick={() => setUserMenuOpen(false)} />
                  <div className={s.usuarioMenu}>
                    <div className={s.usuarioMenuCabecalho}>
                      <span className={s.usuarioMenuNomeCompleto}>{nomeUsuario}</span>
                      <span className={s.usuarioMenuRole}>{role ? ROLE_LABELS[role] : ''}</span>
                    </div>
                    <button className={s.sairBotao} onClick={handleLogout}>
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className={s.conteudo}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
