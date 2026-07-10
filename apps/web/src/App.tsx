import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell/AppShell'
import { Login } from './pages/Login/Login'
import { Dashboard } from './pages/Dashboard/Dashboard'
import { Ordens } from './pages/Ordens/Ordens'
import { OrdemServicoForm } from './pages/OrdemServico/OrdemServicoForm'
import { OrdemServicoVer } from './pages/OrdemServico/OrdemServicoVer'
import { OrdemServicoImprimir } from './pages/OrdemServico/OrdemServicoImprimir'
import { Parceiros } from './pages/Parceiros/Parceiros'
import { Tecnicos } from './pages/Tecnicos/Tecnicos'
import { Usuarios } from './pages/Usuarios/Usuarios'
import { Regioes } from './pages/Regioes/Regioes'
import { Configuracoes } from './pages/Configuracoes/Configuracoes'
import { Estoque } from './pages/Estoque/Estoque'
import { Pecas } from './pages/Pecas/Pecas'
import { Selos } from './pages/Selos/Selos'
import { Relatorios } from './pages/Relatorios/Relatorios'
import { QuemSomos } from './pages/Institucional/QuemSomos'
import { Privacidade } from './pages/Institucional/Privacidade'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/quem-somos" element={<QuemSomos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/ordens"      element={<Ordens />} />
              <Route path="/ordens/nova" element={<OrdemServicoForm />} />
              <Route path="/ordens/:id"  element={<OrdemServicoForm />} />
              <Route path="/parceiros"   element={<Parceiros />} />
              <Route path="/tecnicos"    element={<Tecnicos />} />
              <Route path="/usuarios"    element={<Usuarios />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/estoque"      element={<Estoque />} />
              <Route path="/pecas"       element={<Pecas />} />
              <Route path="/selos"       element={<Selos />} />
              <Route path="/regioes"     element={<Regioes />} />
              <Route path="/relatorios"  element={<Relatorios />} />
            </Route>
            {/* Fora do AppShell: ver e imprimir sem sidebar/header */}
            <Route path="/ordens/:id/ver"      element={<OrdemServicoVer />} />
            <Route path="/ordens/:id/imprimir" element={<OrdemServicoImprimir />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
