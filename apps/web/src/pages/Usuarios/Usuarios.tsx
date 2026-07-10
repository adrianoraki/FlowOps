import { useEffect, useState, type FormEvent } from 'react'
import {
  collection, doc, setDoc, updateDoc,
  onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import type { UserRole } from '@flowops/types'
import { auth, db } from '../../lib/firebase'
import { authSecundario } from '../../lib/secondaryAuth'
import { SlideOver } from '../../components/SlideOver/SlideOver'
import { EstadosPicker } from '../../components/EstadosPicker/EstadosPicker'
import c from '../../components/CrudPage/CrudPage.module.css'

type RoleGestao = Exclude<UserRole, 'tecnico'>

interface UsuarioDoc {
  id: string
  nome: string
  email: string
  role: RoleGestao
  estados?: string[]
  ativo?: boolean
}

interface Form {
  nome: string
  email: string
  role: RoleGestao
  estados: string[]
}

const VAZIO: Form = { nome: '', email: '', role: 'gestor', estados: [] }

const ROLE_LABELS: Record<RoleGestao, string> = { admin: 'Admin', gestor: 'Gestor' }

const ERROS_AUTH: Record<string, string> = {
  'auth/email-already-in-use': 'E-mail já cadastrado no sistema.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/weak-password': 'Erro interno ao gerar senha. Tente novamente.',
  'auth/network-request-failed': 'Sem conexão. Verifique a internet.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
}

const ERROS_REENVIO: Record<string, string> = {
  'auth/user-not-found':         'Usuário não encontrado no sistema de autenticação.',
  'auth/invalid-email':          'E-mail inválido.',
  'auth/network-request-failed': 'Sem conexão. Verifique a internet.',
  'auth/too-many-requests':      'Muitas tentativas. Aguarde e tente novamente.',
}

function gerarSenha(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
  return Array.from(
    { length: 16 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('')
}

export function Usuarios() {
  const [items, setItems] = useState<UsuarioDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<UsuarioDoc | null>(null)
  const [form, setForm] = useState<Form>(VAZIO)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [enviandoSenhaId, setEnviandoSenhaId] = useState<string | null>(null)
  const [feedbackSenha, setFeedbackSenha] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'gestor']))
    return onSnapshot(q,
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as UsuarioDoc))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  const visiveis = mostrarInativos
    ? items
    : items.filter(u => u.ativo !== false)

  function abrirNovo() {
    setEditando(null); setForm(VAZIO); setErro(''); setAberto(true)
  }

  function abrirEditar(u: UsuarioDoc) {
    setEditando(u)
    setForm({ nome: u.nome ?? '', email: u.email ?? '', role: u.role, estados: u.estados ?? [] })
    setErro('')
    setAberto(true)
  }

  function fechar() { setAberto(false) }

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function desativar(u: UsuarioDoc) {
    if (!confirm(`Desativar "${u.nome}"? A pessoa não conseguirá mais acessar o sistema.`)) return
    // TODO: remover o login do Firebase Auth exige Admin SDK (plano Blaze + Cloud Functions)
    await updateDoc(doc(db, 'users', u.id), { ativo: false, updatedAt: serverTimestamp() })
  }

  async function reativar(u: UsuarioDoc) {
    await updateDoc(doc(db, 'users', u.id), { ativo: true, updatedAt: serverTimestamp() })
  }

  async function reenviarSenha(u: UsuarioDoc) {
    if (!u.email) {
      setFeedbackSenha({ tipo: 'erro', msg: 'Este usuário não tem e-mail cadastrado.' })
      return
    }
    setEnviandoSenhaId(u.id)
    setFeedbackSenha(null)
    try {
      await sendPasswordResetEmail(auth, u.email)
      setFeedbackSenha({
        tipo: 'sucesso',
        msg: `E-mail de redefinição enviado para ${u.email}. ⚠️ Peça pra verificar também a caixa de SPAM.`,
      })
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      setFeedbackSenha({
        tipo: 'erro',
        msg: ERROS_REENVIO[code] ?? 'Erro ao enviar e-mail. Tente novamente.',
      })
    } finally {
      setEnviandoSenhaId(null)
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome.trim()) { setErro('Informe o nome.'); return }
    if (!editando && !form.email.trim()) { setErro('Informe o e-mail.'); return }
    if (form.role === 'gestor' && form.estados.length === 0) { setErro('Selecione ao menos um estado.'); return }

    setSalvando(true)
    try {
      if (editando) {
        await updateDoc(doc(db, 'users', editando.id), {
          nome: form.nome,
          estados: form.role === 'gestor' ? form.estados : [],
          updatedAt: serverTimestamp(),
        })
      } else {
        const senha = gerarSenha()
        const cred = await createUserWithEmailAndPassword(authSecundario, form.email, senha)
        const uid = cred.user.uid
        try {
          await setDoc(doc(db, 'users', uid), {
            uid,
            nome: form.nome,
            email: form.email,
            role: form.role,
            ativo: true,
            estados: form.role === 'gestor' ? form.estados : [],
            rg: '',
            createdAt: serverTimestamp(),
          })
          await sendPasswordResetEmail(authSecundario, form.email)
        } finally {
          await signOut(authSecundario)
        }
      }
      fechar()
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      setErro(ERROS_AUTH[code] ?? 'Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const ativos = items.filter(u => u.ativo !== false)

  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className={c.contagem}>{ativos.length} ativos · {items.length - ativos.length} inativos</span>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={e => setMostrarInativos(e.target.checked)}
              style={{ accentColor: '#4f6ef7' }}
            />
            Mostrar inativos
          </label>
        </div>
        <button className={c.botaoNovo} onClick={abrirNovo}>+ Novo usuário</button>
      </div>

      <p className={c.dica} style={{ marginBottom: '0.75rem' }}>
        Contas de admin/gestor pra gerir o sistema (ex: quando alugar pra outra empresa) — cada uma com
        login e senha próprios, sem precisar compartilhar a sua. Técnicos são cadastrados em "Técnicos".
      </p>

      {feedbackSenha && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px',
          marginBottom: '0.75rem',
          background:  feedbackSenha.tipo === 'sucesso' ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${feedbackSenha.tipo === 'sucesso' ? '#bbf7d0' : '#fecaca'}`,
          color:   feedbackSenha.tipo === 'sucesso' ? '#15803d' : '#dc2626',
          fontSize: '0.85rem', lineHeight: 1.5,
        }}>
          <span>{feedbackSenha.msg}</span>
          <button
            onClick={() => setFeedbackSenha(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}
            aria-label="Fechar"
          >✕</button>
        </div>
      )}

      {loading && <p className={c.info}>Carregando…</p>}
      {!loading && visiveis.length === 0 && <p className={c.info}>Nenhum usuário encontrado.</p>}
      {!loading && visiveis.length > 0 && (
        <div className={c.tabelaScroll}>
          <table className={c.tabela}>
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Estados</th><th></th></tr>
            </thead>
            <tbody>
              {visiveis.map(u => (
                <tr key={u.id} style={u.ativo === false ? { opacity: 0.45 } : undefined}>
                  <td>{u.nome || '—'}</td>
                  <td className={c.truncar}>{u.email || '—'}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td className={c.mono}>{(u.estados ?? []).join(', ') || (u.role === 'admin' ? 'Todos' : '—')}</td>
                  <td>
                    <div className={c.acoes}>
                      {u.ativo !== false ? (
                        <>
                          <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => abrirEditar(u)}>Editar</button>
                          <button
                            className={`${c.botaoAcao} ${c.botaoEditar}`}
                            onClick={() => reenviarSenha(u)}
                            disabled={enviandoSenhaId === u.id}
                            style={{ opacity: enviandoSenhaId === u.id ? 0.6 : 1 }}
                          >
                            {enviandoSenhaId === u.id ? 'Enviando…' : 'Reenviar senha'}
                          </button>
                          <button className={`${c.botaoAcao} ${c.botaoExcluir}`} onClick={() => desativar(u)}>Desativar</button>
                        </>
                      ) : (
                        <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => reativar(u)}>Reativar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver aberto={aberto} titulo={editando ? 'Editar usuário' : 'Novo usuário'} onFechar={fechar}>
        <form onSubmit={salvar} noValidate className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Nome *</label>
            <input className={c.input} value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
          <div className={c.campo}>
            <label className={c.label}>E-mail {!editando && '*'}</label>
            <input
              className={c.input}
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              readOnly={Boolean(editando)}
              placeholder={editando ? undefined : 'pessoa@empresa.com'}
            />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Perfil</label>
            <select
              className={c.input}
              value={form.role}
              onChange={e => set('role', e.target.value as RoleGestao)}
              disabled={Boolean(editando)}
            >
              <option value="gestor">Gestor — gerencia os estados atribuídos</option>
              <option value="admin">Admin — acesso global ao sistema</option>
            </select>
            {editando && (
              <p className={c.dica}>
                O perfil não pode ser trocado por aqui. Pra promover/rebaixar alguém, desative esta conta
                e crie uma nova com o perfil correto.
              </p>
            )}
          </div>
          {form.role === 'gestor' && (
            <div className={c.campo}>
              <label className={c.label}>Estados geridos {form.estados.length > 0 && `(${form.estados.length})`}</label>
              <EstadosPicker
                key={editando?.id ?? 'novo'}
                estados={form.estados}
                onChange={estados => set('estados', estados)}
              />
            </div>
          )}
          {!editando && (
            <p className={c.dica}>
              Uma senha temporária será gerada automaticamente. A pessoa receberá um e-mail para definir a
              própria senha — você nunca precisa compartilhar a sua.
            </p>
          )}
          {erro && <p className={c.erro}>{erro}</p>}
          <div className={c.rodapeForm}>
            <button type="button" className={c.botaoCancelar} onClick={fechar}>Cancelar</button>
            <button type="submit" className={c.botaoSalvar} disabled={salvando}>
              {salvando
                ? editando ? 'Salvando…' : 'Criando conta…'
                : editando ? 'Salvar' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  )
}
