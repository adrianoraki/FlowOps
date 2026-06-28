import { useEffect, useState, type FormEvent } from 'react'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { SlideOver } from '../../components/SlideOver/SlideOver'
import c from '../../components/CrudPage/CrudPage.module.css'

interface Regiao {
  id: string
  nome: string
  ufs: string[]
  cidades?: string[]
}

interface Form {
  nome: string
  ufsInput: string
  cidadesInput: string
}

const VAZIO: Form = { nome: '', ufsInput: '', cidadesInput: '' }

function parseArray(s: string): string[] {
  return s.split(',').map(v => v.trim().toUpperCase()).filter(Boolean)
}

export function Regioes() {
  const [items, setItems] = useState<Regiao[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Regiao | null>(null)
  const [form, setForm] = useState<Form>(VAZIO)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'regioes'), orderBy('nome'))
    return onSnapshot(q,
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Regiao))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  function abrirNovo() {
    setEditando(null); setForm(VAZIO); setErro(''); setAberto(true)
  }

  function abrirEditar(r: Regiao) {
    setEditando(r)
    setForm({
      nome: r.nome,
      ufsInput: (r.ufs ?? []).join(', '),
      cidadesInput: (r.cidades ?? []).join(', '),
    })
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
    const ufs = parseArray(form.ufsInput)
    if (ufs.length === 0) { setErro('Informe ao menos uma UF.'); return }
    const cidades = parseArray(form.cidadesInput.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()))
    const payload = {
      nome: form.nome.trim(),
      ufs,
      ...(cidades.length > 0 ? { cidades } : {}),
    }
    setSalvando(true)
    try {
      if (editando) {
        await updateDoc(doc(db, 'regioes', editando.id), { ...payload, updatedAt: serverTimestamp() })
      } else {
        await addDoc(collection(db, 'regioes'), { ...payload, createdAt: serverTimestamp() })
      }
      fechar()
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(r: Regiao) {
    if (!confirm(`Excluir região "${r.nome}"?`)) return
    await deleteDoc(doc(db, 'regioes', r.id))
  }

  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <span className={c.contagem}>{items.length} regiões</span>
        <button className={c.botaoNovo} onClick={abrirNovo}>+ Nova região</button>
      </div>

      {loading && <p className={c.info}>Carregando…</p>}
      {!loading && items.length === 0 && <p className={c.info}>Nenhuma região cadastrada.</p>}
      {!loading && items.length > 0 && (
        <div className={c.tabelaScroll}>
          <table className={c.tabela}>
            <thead>
              <tr><th>Nome</th><th>UFs</th><th>Cidades</th><th></th></tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id}>
                  <td>{r.nome}</td>
                  <td className={c.mono}>{(r.ufs ?? []).join(', ') || '—'}</td>
                  <td className={c.truncar}>{(r.cidades ?? []).join(', ') || '—'}</td>
                  <td>
                    <div className={c.acoes}>
                      <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => abrirEditar(r)}>Editar</button>
                      <button className={`${c.botaoAcao} ${c.botaoExcluir}`} onClick={() => excluir(r)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver aberto={aberto} titulo={editando ? 'Editar região' : 'Nova região'} onFechar={fechar}>
        <form onSubmit={salvar} noValidate className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Nome *</label>
            <input className={c.input} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Sudeste" />
          </div>
          <div className={c.campo}>
            <label className={c.label}>UFs * (separadas por vírgula)</label>
            <input className={c.input} value={form.ufsInput} onChange={e => set('ufsInput', e.target.value)} placeholder="SP, RJ, MG, ES" />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Cidades (opcional, separadas por vírgula)</label>
            <textarea className={c.textarea} rows={3} value={form.cidadesInput} onChange={e => set('cidadesInput', e.target.value)} placeholder="São Paulo, Campinas, Rio de Janeiro" />
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
