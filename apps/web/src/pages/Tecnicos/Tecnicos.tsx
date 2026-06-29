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
import { auth, db } from '../../lib/firebase'
import { authSecundario } from '../../lib/secondaryAuth'
import { SlideOver } from '../../components/SlideOver/SlideOver'
import c from '../../components/CrudPage/CrudPage.module.css'

interface TecnicoDoc {
  id: string
  nome: string
  email: string
  regiao: string
  matricula: string
  ativo?: boolean
}

interface Form {
  nome: string
  email: string
  regiao: string
  matricula: string
}

const VAZIO: Form = { nome: '', email: '', regiao: '', matricula: '' }

const ERROS_AUTH: Record<string, string> = {
  'auth/email-already-in-use': 'E-mail já cadastrado no sistema.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/weak-password': 'Erro interno ao gerar senha. Tente novamente.',
  'auth/network-request-failed': 'Sem conexão. Verifique a internet.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
}

const ERROS_REENVIO: Record<string, string> = {
  'auth/user-not-found':         'Técnico não encontrado no sistema de autenticação.',
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

export function Tecnicos() {
  const [items, setItems] = useState<TecnicoDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<TecnicoDoc | null>(null)
  const [form, setForm] = useState<Form>(VAZIO)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [enviandoSenhaId, setEnviandoSenhaId] = useState<string | null>(null)
  const [feedbackSenha, setFeedbackSenha] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'tecnico'))
    return onSnapshot(q,
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TecnicoDoc))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  const visiveis = mostrarInativos
    ? items
    : items.filter(t => t.ativo !== false)

  function abrirNovo() {
    setEditando(null); setForm(VAZIO); setErro(''); setAberto(true)
  }

  function abrirEditar(t: TecnicoDoc) {
    setEditando(t)
    setForm({ nome: t.nome ?? '', email: t.email ?? '', regiao: t.regiao ?? '', matricula: t.matricula ?? '' })
    setErro('')
    setAberto(true)
  }

  function fechar() { setAberto(false) }

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function desativar(t: TecnicoDoc) {
    if (!confirm(`Desativar "${t.nome}"? O técnico não conseguirá mais acessar o sistema.`)) return
    // TODO: remover o login do Firebase Auth exige Admin SDK (plano Blaze + Cloud Functions)
    await updateDoc(doc(db, 'users', t.id), { ativo: false, updatedAt: serverTimestamp() })
  }

  async function reativar(t: TecnicoDoc) {
    await updateDoc(doc(db, 'users', t.id), { ativo: true, updatedAt: serverTimestamp() })
  }

  async function reenviarSenha(t: TecnicoDoc) {
    if (!t.email) {
      setFeedbackSenha({ tipo: 'erro', msg: 'Este técnico não tem e-mail cadastrado.' })
      return
    }
    setEnviandoSenhaId(t.id)
    setFeedbackSenha(null)
    try {
      await sendPasswordResetEmail(auth, t.email)
      setFeedbackSenha({
        tipo: 'sucesso',
        msg: `E-mail de redefinição enviado para ${t.email}. ⚠️ Peça ao técnico para verificar também a caixa de SPAM.`,
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

    setSalvando(true)
    try {
      if (editando) {
        await updateDoc(doc(db, 'users', editando.id), {
          nome: form.nome,
          regiao: form.regiao,
          matricula: form.matricula,
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
            role: 'tecnico',
            ativo: true,
            regiao: form.regiao,
            matricula: form.matricula,
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

  const ativos = items.filter(t => t.ativo !== false)

  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className={c.contagem}>{ativos.length} ativos · {items.length - ativos.length} inativos</span>
          <label style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.42)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={e => setMostrarInativos(e.target.checked)}
              style={{ accentColor: '#4f6ef7' }}
            />
            Mostrar inativos
          </label>
        </div>
        <button className={c.botaoNovo} onClick={abrirNovo}>+ Novo técnico</button>
      </div>

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
      {!loading && visiveis.length === 0 && <p className={c.info}>Nenhum técnico encontrado.</p>}
      {!loading && visiveis.length > 0 && (
        <div className={c.tabelaScroll}>
          <table className={c.tabela}>
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Região</th><th>Matrícula</th><th></th></tr>
            </thead>
            <tbody>
              {visiveis.map(t => (
                <tr key={t.id} style={t.ativo === false ? { opacity: 0.45 } : undefined}>
                  <td>{t.nome || '—'}</td>
                  <td className={c.truncar}>{t.email || '—'}</td>
                  <td className={c.mono}>{t.regiao || '—'}</td>
                  <td className={c.mono}>{t.matricula || '—'}</td>
                  <td>
                    <div className={c.acoes}>
                      {t.ativo !== false ? (
                        <>
                          <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => abrirEditar(t)}>Editar</button>
                          <button
                            className={`${c.botaoAcao} ${c.botaoEditar}`}
                            onClick={() => reenviarSenha(t)}
                            disabled={enviandoSenhaId === t.id}
                            style={{ opacity: enviandoSenhaId === t.id ? 0.6 : 1 }}
                          >
                            {enviandoSenhaId === t.id ? 'Enviando…' : 'Reenviar senha'}
                          </button>
                          <button className={`${c.botaoAcao} ${c.botaoExcluir}`} onClick={() => desativar(t)}>Desativar</button>
                        </>
                      ) : (
                        <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => reativar(t)}>Reativar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver aberto={aberto} titulo={editando ? 'Editar técnico' : 'Novo técnico'} onFechar={fechar}>
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
              placeholder={editando ? undefined : 'tecnico@empresa.com'}
            />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Região</label>
            <input className={c.input} value={form.regiao} onChange={e => set('regiao', e.target.value)} placeholder="ID da região" />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Matrícula</label>
            <input className={c.input} value={form.matricula} onChange={e => set('matricula', e.target.value)} />
          </div>
          {!editando && (
            <p className={c.dica}>
              Uma senha temporária será gerada automaticamente. O técnico receberá um e-mail para definir a própria senha.
            </p>
          )}
          {erro && <p className={c.erro}>{erro}</p>}
          <div className={c.rodapeForm}>
            <button type="button" className={c.botaoCancelar} onClick={fechar}>Cancelar</button>
            <button type="submit" className={c.botaoSalvar} disabled={salvando}>
              {salvando
                ? editando ? 'Salvando…' : 'Criando conta…'
                : editando ? 'Salvar' : 'Criar técnico'}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  )
}
