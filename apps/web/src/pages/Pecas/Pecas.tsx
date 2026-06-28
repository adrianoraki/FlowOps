import { useEffect, useState, type FormEvent } from 'react'
import {
  collection, doc, addDoc, updateDoc,
  onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { SlideOver } from '../../components/SlideOver/SlideOver'
import c from '../../components/CrudPage/CrudPage.module.css'

interface Peca {
  id: string
  nome: string
  codigo: string
  unidade: string
  ativo?: boolean
}

interface Form {
  nome: string
  codigo: string
  unidade: string
  ativo: boolean
}

const VAZIO: Form = { nome: '', codigo: '', unidade: 'un', ativo: true }

export function Pecas() {
  const [items, setItems] = useState<Peca[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarInativas, setMostrarInativas] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Peca | null>(null)
  const [form, setForm] = useState<Form>(VAZIO)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'pecas'), orderBy('nome'))
    return onSnapshot(q,
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Peca))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  const visiveis = mostrarInativas ? items : items.filter(p => p.ativo !== false)

  function abrirNovo() {
    setEditando(null); setForm(VAZIO); setErro(''); setAberto(true)
  }

  function abrirEditar(p: Peca) {
    setEditando(p)
    setForm({ nome: p.nome, codigo: p.codigo, unidade: p.unidade, ativo: p.ativo !== false })
    setErro('')
    setAberto(true)
  }

  function fechar() { setAberto(false) }

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome.trim()) { setErro('Informe o nome.'); return }
    if (!form.codigo.trim()) { setErro('Informe o código.'); return }
    setSalvando(true)
    try {
      if (editando) {
        await updateDoc(doc(db, 'pecas', editando.id), { ...form, updatedAt: serverTimestamp() })
      } else {
        await addDoc(collection(db, 'pecas'), { ...form, createdAt: serverTimestamp() })
      }
      fechar()
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(p: Peca) {
    const novoAtivo = p.ativo === false
    if (!novoAtivo && !confirm(`Desativar "${p.nome}"?`)) return
    await updateDoc(doc(db, 'pecas', p.id), { ativo: novoAtivo, updatedAt: serverTimestamp() })
  }

  const ativas = items.filter(p => p.ativo !== false)

  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className={c.contagem}>{ativas.length} ativas · {items.length - ativas.length} inativas</span>
          <label style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.42)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={mostrarInativas}
              onChange={e => setMostrarInativas(e.target.checked)}
              style={{ accentColor: '#4f6ef7' }}
            />
            Mostrar inativas
          </label>
        </div>
        <button className={c.botaoNovo} onClick={abrirNovo}>+ Nova peça</button>
      </div>

      {loading && <p className={c.info}>Carregando…</p>}
      {!loading && visiveis.length === 0 && <p className={c.info}>Nenhuma peça encontrada.</p>}
      {!loading && visiveis.length > 0 && (
        <div className={c.tabelaScroll}>
          <table className={c.tabela}>
            <thead>
              <tr><th>Nome</th><th>Código</th><th>Unidade</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {visiveis.map(p => (
                <tr key={p.id} style={p.ativo === false ? { opacity: 0.45 } : undefined}>
                  <td>{p.nome}</td>
                  <td className={c.mono}>{p.codigo}</td>
                  <td>{p.unidade}</td>
                  <td>
                    <span className={`${c.badge} ${p.ativo !== false ? c.badge_aberta : c.badge_fechada}`}>
                      {p.ativo !== false ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td>
                    <div className={c.acoes}>
                      <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => abrirEditar(p)}>Editar</button>
                      <button
                        className={`${c.botaoAcao} ${p.ativo !== false ? c.botaoExcluir : c.botaoEditar}`}
                        onClick={() => toggleAtivo(p)}
                      >
                        {p.ativo !== false ? 'Desativar' : 'Reativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver aberto={aberto} titulo={editando ? 'Editar peça' : 'Nova peça'} onFechar={fechar}>
        <form onSubmit={salvar} noValidate className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Nome *</label>
            <input className={c.input} value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Código *</label>
            <input className={c.input} value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="Ex: PCA-001" />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Unidade</label>
            <input className={c.input} value={form.unidade} onChange={e => set('unidade', e.target.value)} placeholder="un, m, kg, m²…" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={e => set('ativo', e.target.checked)}
              style={{ accentColor: '#4f6ef7', width: '1rem', height: '1rem' }}
            />
            Ativa
          </label>
          {erro && <p className={c.erro}>{erro}</p>}
          <div className={c.rodapeForm}>
            <button type="button" className={c.botaoCancelar} onClick={fechar}>Cancelar</button>
            <button type="submit" className={c.botaoSalvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  )
}
