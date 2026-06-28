import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../../hooks/useAuth'
import { useEmpresa } from '../../lib/useEmpresa'
import s from './Login.module.css'

const ERROS_FIREBASE: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha inválidos.',
  'auth/user-not-found': 'Usuário não encontrado.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Usuário desativado. Fale com o administrador.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
}

export function Login() {
  const { user, loading: authLoading, login } = useAuth()
  const { empresa } = useEmpresa()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && user) navigate('/', { replace: true })
  }, [user, authLoading, navigate])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro('')

    if (!email.trim()) { setErro('Informe o e-mail.'); return }
    if (!senha) { setErro('Informe a senha.'); return }

    setLoading(true)
    try {
      await login(email, senha)
      navigate('/', { replace: true })
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      setErro(ERROS_FIREBASE[code] ?? 'Erro ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.root}>
      <div className={s.card}>
        <h1 className={s.titulo}>FlowOps</h1>
        {empresa.nomeEmpresa && <p className={s.subtitulo}>{empresa.nomeEmpresa}</p>}

        <form onSubmit={handleSubmit} noValidate className={s.form}>
          <div className={s.campo}>
            <label htmlFor="email" className={s.label}>E-mail</label>
            <input
              id="email"
              type="email"
              className={s.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className={s.campo}>
            <label htmlFor="senha" className={s.label}>Senha</label>
            <input
              id="senha"
              type="password"
              className={s.input}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {erro && <p className={s.erro} role="alert">{erro}</p>}

          <button type="submit" className={s.botao} disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <button type="button" className={s.linkSenha}>
          Esqueci minha senha
        </button>
      </div>
    </div>
  )
}
