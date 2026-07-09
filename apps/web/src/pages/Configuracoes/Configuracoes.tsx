import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, addDoc, deleteDoc, onSnapshot, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { EMPRESA_PADRAO } from '../../lib/useEmpresa'
import { SETORES_PADRAO, type EmpresaConfig, type Setor, type Modelo } from '@flowops/types'
import c from '../../components/CrudPage/CrudPage.module.css'

export function Configuracoes() {
  const [form, setForm] = useState<EmpresaConfig>(EMPRESA_PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getDoc(doc(db, 'config', 'empresa')).then(snap => {
      if (snap.exists()) setForm({ ...EMPRESA_PADRAO, ...(snap.data() as EmpresaConfig) })
    })
  }, [])

  // ─── Setores ────────────────────────────────────────────────────────────────
  const [setores, setSetores] = useState<Setor[]>([])
  const [loadingSetores, setLoadingSetores] = useState(true)
  const [novoSetor, setNovoSetor] = useState('')
  const [erroSetor, setErroSetor] = useState('')
  const seedando = useRef(false)

  useEffect(() => {
    const q = query(collection(db, 'setores'), orderBy('nome'))
    return onSnapshot(q,
      snap => {
        setSetores(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Setor))
        setLoadingSetores(false)
      },
      () => setLoadingSetores(false),
    )
  }, [])

  // Popula os setores iniciais na primeira vez que a empresa configura (coleção vazia)
  useEffect(() => {
    if (loadingSetores || setores.length > 0 || seedando.current) return
    seedando.current = true
    Promise.all(
      SETORES_PADRAO.map(nome =>
        addDoc(collection(db, 'setores'), { nome, ativo: true, createdAt: serverTimestamp() })
      )
    ).catch(() => {})
  }, [loadingSetores, setores])

  async function adicionarSetor(e: FormEvent) {
    e.preventDefault()
    setErroSetor('')
    if (!novoSetor.trim()) { setErroSetor('Informe o nome do setor.'); return }
    try {
      await addDoc(collection(db, 'setores'), { nome: novoSetor.trim(), ativo: true, createdAt: serverTimestamp() })
      setNovoSetor('')
    } catch {
      setErroSetor('Erro ao adicionar setor.')
    }
  }

  async function removerSetor(setor: Setor) {
    if (!confirm(`Remover o setor "${setor.nome}"?`)) return
    await deleteDoc(doc(db, 'setores', setor.id))
  }

  // ─── Modelos de balança ─────────────────────────────────────────────────────
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [loadingModelos, setLoadingModelos] = useState(true)
  const [novoModelo, setNovoModelo] = useState('')
  const [erroModelo, setErroModelo] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'modelos'), orderBy('nome'))
    return onSnapshot(q,
      snap => {
        setModelos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Modelo))
        setLoadingModelos(false)
      },
      () => setLoadingModelos(false),
    )
  }, [])

  async function adicionarModelo(e: FormEvent) {
    e.preventDefault()
    setErroModelo('')
    const nome = novoModelo.trim()
    if (!nome) { setErroModelo('Informe o nome do modelo.'); return }
    const jaExiste = modelos.some(m => m.nome.trim().toLowerCase() === nome.toLowerCase())
    if (jaExiste) { setErroModelo('Este modelo já está cadastrado.'); return }
    try {
      const ref = await addDoc(collection(db, 'modelos'), { nome, ativo: true, createdAt: serverTimestamp() })
      console.log('[Configuracoes] modelo salvo com sucesso:', ref.id, nome)
      setNovoModelo('')
    } catch (err) {
      console.error('[Configuracoes] erro ao adicionar modelo:', err)
      setErroModelo('Erro ao adicionar modelo.')
    }
  }

  async function removerModelo(modelo: Modelo) {
    if (!confirm(`Remover o modelo "${modelo.nome}"?`)) return
    await deleteDoc(doc(db, 'modelos', modelo.id))
  }

  function set<K extends keyof EmpresaConfig>(k: K, v: EmpresaConfig[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setSucesso(false)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso(false)
    if (!form.nomeEmpresa.trim()) { setErro('Informe o nome da empresa.'); return }
    setSalvando(true)
    try {
      await setDoc(doc(db, 'config', 'empresa'), { ...form, updatedAt: serverTimestamp() })
      setSucesso(true)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className={c.pagina} style={{ maxWidth: '620px' }}>
      <form onSubmit={salvar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <div className={c.campo}>
          <label className={c.label}>Nome da empresa *</label>
          <input className={c.input} value={form.nomeEmpresa} onChange={e => set('nomeEmpresa', e.target.value)} placeholder="Razão social ou nome fantasia" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className={c.campo}>
            <label className={c.label}>CNPJ</label>
            <input className={c.input} value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Inscrição / Registro</label>
            <input className={c.input} value={form.registro} onChange={e => set('registro', e.target.value)} />
          </div>
        </div>
        <div className={c.campo}>
          <label className={c.label}>Reg. INMETRO da empresa</label>
          <input className={c.input} value={form.regInmetro ?? ''} onChange={e => set('regInmetro', e.target.value)} placeholder="Ex: 73000171" />
          <p className={c.dica} style={{ marginTop: '0.3rem' }}>
            Registro único da oficina autorizada no INMETRO. Aparece na área de assinatura do técnico em toda OS
            impressa/PDF — não é mais cadastrado por técnico individualmente.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className={c.campo}>
            <label className={c.label}>Telefone 1</label>
            <input className={c.input} value={form.telefone1} onChange={e => set('telefone1', e.target.value)} placeholder="(00) 0000-0000" />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Telefone 2</label>
            <input className={c.input} value={form.telefone2} onChange={e => set('telefone2', e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className={c.campo}>
            <label className={c.label}>E-mail</label>
            <input className={c.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Site</label>
            <input className={c.input} value={form.site} onChange={e => set('site', e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className={c.campo}>
          <label className={c.label}>Endereço</label>
          <input className={c.input} value={form.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua, número, bairro, cidade – UF" />
        </div>
        <div className={c.campo}>
          <label className={c.label}>URL do logotipo</label>
          <input className={c.input} value={form.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://..." />
          {/* TODO: upload de arquivo via Firebase Storage */}
          {form.logoUrl && (
            <img
              src={form.logoUrl}
              alt="Logo"
              style={{ marginTop: '0.5rem', maxHeight: '64px', maxWidth: '200px', objectFit: 'contain', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', padding: '4px' }}
            />
          )}
        </div>

        {sucesso && <p style={{ color: '#4ade80', fontSize: '0.85rem' }}>Configurações salvas com sucesso.</p>}
        {erro && <p className={c.erro}>{erro}</p>}

        <div>
          <button type="submit" className={c.botaoSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>
      </form>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <section>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Setores</h2>
        <p className={c.dica} style={{ marginBottom: '1rem' }}>
          Setores usados na tabela de atendimentos da OS. Específicos desta empresa.
        </p>

        <form onSubmit={adicionarSetor} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
          <input
            className={c.input}
            value={novoSetor}
            onChange={e => setNovoSetor(e.target.value)}
            placeholder="Nome do novo setor"
          />
          <button type="submit" className={c.botaoSalvar}>+ Adicionar</button>
        </form>
        {erroSetor && <p className={c.erro} style={{ marginBottom: '1rem' }}>{erroSetor}</p>}

        {loadingSetores && <p className={c.info}>Carregando…</p>}
        {!loadingSetores && setores.length === 0 && <p className={c.info}>Nenhum setor cadastrado.</p>}
        {!loadingSetores && setores.length > 0 && (
          <div className={c.tabelaScroll}>
            <table className={c.tabela}>
              <thead>
                <tr><th>Nome</th><th></th></tr>
              </thead>
              <tbody>
                {setores.map(setor => (
                  <tr key={setor.id}>
                    <td>{setor.nome}</td>
                    <td>
                      <div className={c.acoes}>
                        <button className={`${c.botaoAcao} ${c.botaoExcluir}`} onClick={() => removerSetor(setor)}>
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <section>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Modelos de balança</h2>
        <p className={c.dica} style={{ marginBottom: '1rem' }}>
          Modelos de balança atendidos pela empresa, usados na coluna "Modelo" da tabela de atendimentos da OS.
        </p>

        <form onSubmit={adicionarModelo} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
          <input
            className={c.input}
            value={novoModelo}
            onChange={e => setNovoModelo(e.target.value)}
            placeholder="Nome do novo modelo"
          />
          <button type="submit" className={c.botaoSalvar}>+ Adicionar</button>
        </form>
        {erroModelo && <p className={c.erro} style={{ marginBottom: '1rem' }}>{erroModelo}</p>}

        {loadingModelos && <p className={c.info}>Carregando…</p>}
        {!loadingModelos && modelos.length === 0 && <p className={c.info}>Nenhum modelo cadastrado.</p>}
        {!loadingModelos && modelos.length > 0 && (
          <div className={c.tabelaScroll}>
            <table className={c.tabela}>
              <thead>
                <tr><th>Nome</th><th></th></tr>
              </thead>
              <tbody>
                {modelos.map(modelo => (
                  <tr key={modelo.id}>
                    <td>{modelo.nome}</td>
                    <td>
                      <div className={c.acoes}>
                        <button className={`${c.botaoAcao} ${c.botaoExcluir}`} onClick={() => removerModelo(modelo)}>
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
