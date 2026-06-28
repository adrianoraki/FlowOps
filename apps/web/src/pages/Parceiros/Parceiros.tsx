import { useEffect, useState, type FormEvent } from 'react'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { SlideOver } from '../../components/SlideOver/SlideOver'
import c from '../../components/CrudPage/CrudPage.module.css'

interface Parceiro {
  id: string
  nome: string
  cidade: string
  estado: string
  loja: string
  regiao: string
}

type Form = Omit<Parceiro, 'id'>

const VAZIO: Form = { nome: '', cidade: '', estado: '', loja: '', regiao: '' }

export function Parceiros() {
  const [items, setItems] = useState<Parceiro[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Parceiro | null>(null)
  const [form, setForm] = useState<Form>(VAZIO)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'parceiros'), orderBy('nome'))
    return onSnapshot(q,
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Parceiro))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  function abrirNovo() {
    setEditando(null); setForm(VAZIO); setErro(''); setAberto(true)
  }

  function abrirEditar(p: Parceiro) {
    setEditando(p)
    setForm({ nome: p.nome, cidade: p.cidade, estado: p.estado, loja: p.loja, regiao: p.regiao })
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
    setSalvando(true)
    try {
      if (editando) {
        await updateDoc(doc(db, 'parceiros', editando.id), { ...form, updatedAt: serverTimestamp() })
      } else {
        await addDoc(collection(db, 'parceiros'), { ...form, createdAt: serverTimestamp() })
      }
      fechar()
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(p: Parceiro) {
    if (!confirm(`Excluir "${p.nome}"?`)) return
    await deleteDoc(doc(db, 'parceiros', p.id))
  }

  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <span className={c.contagem}>{items.length} parceiros</span>
        <button className={c.botaoNovo} onClick={abrirNovo}>+ Novo parceiro</button>
      </div>

      {loading && <p className={c.info}>Carregando…</p>}
      {!loading && items.length === 0 && <p className={c.info}>Nenhum parceiro cadastrado.</p>}
      {!loading && items.length > 0 && (
        <div className={c.tabelaScroll}>
          <table className={c.tabela}>
            <thead>
              <tr><th>Nome</th><th>Cidade</th><th>Estado</th><th>Loja</th><th>Região</th><th></th></tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.cidade || '—'}</td>
                  <td>{p.estado || '—'}</td>
                  <td>{p.loja || '—'}</td>
                  <td className={c.mono}>{p.regiao || '—'}</td>
                  <td>
                    <div className={c.acoes}>
                      <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => abrirEditar(p)}>Editar</button>
                      <button className={`${c.botaoAcao} ${c.botaoExcluir}`} onClick={() => excluir(p)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver aberto={aberto} titulo={editando ? 'Editar parceiro' : 'Novo parceiro'} onFechar={fechar}>
        <form onSubmit={salvar} noValidate className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Nome *</label>
            <input className={c.input} value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Cidade</label>
            <input className={c.input} value={form.cidade} onChange={e => set('cidade', e.target.value)} />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Estado</label>
            <input className={c.input} value={form.estado} onChange={e => set('estado', e.target.value)} maxLength={2} placeholder="UF" />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Loja</label>
            <input className={c.input} value={form.loja} onChange={e => set('loja', e.target.value)} />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Região</label>
            <input className={c.input} value={form.regiao} onChange={e => set('regiao', e.target.value)} placeholder="ID da região" />
          </div>
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
