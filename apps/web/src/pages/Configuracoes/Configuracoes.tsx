import { useEffect, useState, type FormEvent } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { EMPRESA_PADRAO } from '../../lib/useEmpresa'
import type { EmpresaConfig } from '@flowops/types'
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
    </div>
  )
}
