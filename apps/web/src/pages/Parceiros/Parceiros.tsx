import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, writeBatch,
  onSnapshot, orderBy, query, where, getDocs,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { REGIOES_BRASIL, regiaoDoEstado, cidadesDoEstado, type Parceiro, type Loja, type TipoParceiro } from '@flowops/types'
import { SlideOver } from '../../components/SlideOver/SlideOver'
import c from '../../components/CrudPage/CrudPage.module.css'

interface ParceiroForm {
  nome: string
  tipo: TipoParceiro
  // Campos da loja única (só usados quando tipo === 'unico')
  lojaNumero: string
  lojaNome: string
  lojaEstado: string
  lojaCidade: string
}

const PARCEIRO_VAZIO: ParceiroForm = {
  nome: '', tipo: 'unico', lojaNumero: '', lojaNome: '', lojaEstado: '', lojaCidade: '',
}

interface LojaForm {
  numero: string
  nome: string
  estado: string
  cidade: string
  ativo: boolean
}

const LOJA_VAZIA: LojaForm = { numero: '', nome: '', estado: '', cidade: '', ativo: true }

function EstadoSelect({ value, onChange }: { value: string; onChange: (uf: string) => void }) {
  return (
    <select className={c.select} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Selecione um estado</option>
      {REGIOES_BRASIL.map(r => (
        <optgroup key={r.id} label={r.nome}>
          {r.estados.map(uf => <option key={uf} value={uf}>{uf}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

function CidadeSelect({ estado, value, onChange }: { estado: string; value: string; onChange: (v: string) => void }) {
  const cidades = useMemo(() => cidadesDoEstado(estado), [estado])
  return (
    <select className={c.select} value={value} onChange={e => onChange(e.target.value)} disabled={!estado}>
      <option value="">{estado ? 'Selecione uma cidade' : 'Selecione o estado primeiro'}</option>
      {cidades.map(nome => <option key={nome} value={nome}>{nome}</option>)}
    </select>
  )
}

// Firestore rejeita `undefined` em qualquer campo — nunca deixar chegar aqui sem fallback.
function montarLojaPayload(parceiroId: string, dados: { numero: string; nome: string; estado: string; cidade: string }, ativo: boolean) {
  return {
    parceiroId,
    numero: dados.numero?.trim() ?? '',
    nome: dados.nome?.trim() ?? '',
    estado: dados.estado ?? '',
    cidade: dados.cidade ?? '',
    regiao: regiaoDoEstado(dados.estado) ?? '',
    ativo,
  }
}

export function Parceiros() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [lojas, setLojas] = useState<Loja[]>([])
  const [loading, setLoading] = useState(true)

  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Parceiro | null>(null)
  const [form, setForm] = useState<ParceiroForm>(PARCEIRO_VAZIO)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Visualização de lojas: substitui a listagem de parceiros por uma tela cheia
  // dedicada (mais espaço para número, nome, cidade/UF e ações do que um slide-over).
  const [parceiroLojas, setParceiroLojas] = useState<Parceiro | null>(null)
  const [lojaSlideAberto, setLojaSlideAberto] = useState(false)
  const [lojaEditando, setLojaEditando] = useState<Loja | null>(null)
  const [lojaForm, setLojaForm] = useState<LojaForm>(LOJA_VAZIA)
  const [erroLoja, setErroLoja] = useState('')
  const [salvandoLoja, setSalvandoLoja] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'parceiros'), orderBy('nome'))
    return onSnapshot(q,
      snap => {
        setParceiros(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Parceiro))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'lojas'), orderBy('nome'))
    return onSnapshot(q, snap => setLojas(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Loja)), () => {})
  }, [])

  const lojasPorParceiro = useMemo(() => {
    const mapa: Record<string, Loja[]> = {}
    for (const l of lojas) (mapa[l.parceiroId] ??= []).push(l)
    return mapa
  }, [lojas])

  // Mantém a tela de lojas em sincronia com o parceiro selecionado (ex: contagem no título)
  useEffect(() => {
    if (!parceiroLojas) return
    const atualizado = parceiros.find(p => p.id === parceiroLojas.id)
    if (atualizado) setParceiroLojas(atualizado)
  }, [parceiros]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Parceiro: abrir / fechar / salvar ────────────────────────────────────

  function abrirNovo() {
    setEditando(null); setForm(PARCEIRO_VAZIO); setErro(''); setAberto(true)
  }

  function abrirEditar(p: Parceiro) {
    setEditando(p)
    if (p.tipo === 'unico') {
      const loja = (lojasPorParceiro[p.id] ?? [])[0]
      setForm({
        nome: p.nome, tipo: p.tipo,
        lojaNumero: loja?.numero ?? '', lojaNome: loja?.nome ?? '',
        lojaEstado: loja?.estado ?? '', lojaCidade: loja?.cidade ?? '',
      })
    } else {
      setForm({ ...PARCEIRO_VAZIO, nome: p.nome, tipo: p.tipo })
    }
    setErro(''); setAberto(true)
  }

  function fechar() { setAberto(false) }

  function set<K extends keyof ParceiroForm>(k: K, v: ParceiroForm[K]) {
    setForm(prev => ({ ...prev, [k]: v, ...(k === 'lojaEstado' ? { lojaCidade: '' } : {}) }))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome.trim()) { setErro('Informe o nome.'); return }
    if (form.tipo === 'unico') {
      if (!form.lojaNome.trim()) { setErro('Informe o nome da loja.'); return }
      if (!form.lojaEstado)      { setErro('Selecione o estado da loja.'); return }
      if (!form.lojaCidade)      { setErro('Selecione a cidade da loja.'); return }
    }

    setSalvando(true)
    try {
      const batch = writeBatch(db)

      if (editando) {
        batch.update(doc(db, 'parceiros', editando.id), { nome: form.nome, tipo: form.tipo })
        if (form.tipo === 'unico') {
          // Consulta direta (não a lista em memória) para não depender do onSnapshot já ter carregado.
          const existentesSnap = await getDocs(query(collection(db, 'lojas'), where('parceiroId', '==', editando.id)))
          const lojaExistenteId = existentesSnap.docs[0]?.id
          const lojaPayload = montarLojaPayload(editando.id, {
            numero: form.lojaNumero, nome: form.lojaNome, estado: form.lojaEstado, cidade: form.lojaCidade,
          }, true)
          if (lojaExistenteId) batch.update(doc(db, 'lojas', lojaExistenteId), lojaPayload)
          else batch.set(doc(collection(db, 'lojas')), lojaPayload)
        }
      } else {
        const novoParceiroRef = doc(collection(db, 'parceiros'))
        batch.set(novoParceiroRef, { nome: form.nome, tipo: form.tipo })
        if (form.tipo === 'unico') {
          batch.set(
            doc(collection(db, 'lojas')),
            montarLojaPayload(novoParceiroRef.id, {
              numero: form.lojaNumero, nome: form.lojaNome, estado: form.lojaEstado, cidade: form.lojaCidade,
            }, true),
          )
        }
      }

      await batch.commit()
      fechar()
    } catch (err) {
      console.error('[Parceiros] erro ao salvar parceiro/loja:', err)
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(p: Parceiro) {
    if (!confirm(`Excluir "${p.nome}"? As lojas cadastradas não serão removidas automaticamente.`)) return
    await deleteDoc(doc(db, 'parceiros', p.id))
  }

  // ─── Lojas de um parceiro (rede) ───────────────────────────────────────────

  function abrirLojas(p: Parceiro) {
    setParceiroLojas(p)
  }

  function voltarDeLojas() {
    setParceiroLojas(null)
  }

  function abrirNovaLoja() {
    setLojaEditando(null); setLojaForm(LOJA_VAZIA); setErroLoja(''); setLojaSlideAberto(true)
  }

  function abrirEditarLoja(l: Loja) {
    setLojaEditando(l)
    setLojaForm({ numero: l.numero ?? '', nome: l.nome, estado: l.estado, cidade: l.cidade, ativo: l.ativo !== false })
    setErroLoja('')
    setLojaSlideAberto(true)
  }

  function fecharLojaSlide() { setLojaSlideAberto(false) }

  function setLoja<K extends keyof LojaForm>(k: K, v: LojaForm[K]) {
    setLojaForm(prev => ({ ...prev, [k]: v, ...(k === 'estado' ? { cidade: '' } : {}) }))
  }

  async function salvarLoja(e: FormEvent) {
    e.preventDefault()
    setErroLoja('')
    if (!parceiroLojas) return
    if (!lojaForm.numero.trim()) { setErroLoja('Informe o número da loja.'); return }
    if (!lojaForm.nome.trim())   { setErroLoja('Informe o nome da loja.'); return }
    if (!lojaForm.estado)        { setErroLoja('Selecione o estado.'); return }
    if (!lojaForm.cidade)        { setErroLoja('Selecione a cidade.'); return }

    setSalvandoLoja(true)
    try {
      const payload = montarLojaPayload(parceiroLojas.id, lojaForm, lojaForm.ativo)
      if (lojaEditando) await updateDoc(doc(db, 'lojas', lojaEditando.id), payload)
      else await addDoc(collection(db, 'lojas'), payload)
      setLojaSlideAberto(false)
    } catch (err) {
      console.error('[Parceiros] erro ao salvar loja:', err)
      setErroLoja('Erro ao salvar a loja. Tente novamente.')
    } finally {
      setSalvandoLoja(false)
    }
  }

  async function toggleAtivoLoja(l: Loja) {
    await updateDoc(doc(db, 'lojas', l.id), { ativo: l.ativo === false })
  }

  async function excluirLoja(l: Loja) {
    if (!confirm(`Excluir a loja "${l.nome}"?`)) return
    await deleteDoc(doc(db, 'lojas', l.id))
  }

  const lojasDoParceiroAtual = parceiroLojas ? (lojasPorParceiro[parceiroLojas.id] ?? []) : []

  // ─── Tela dedicada de lojas de um parceiro ─────────────────────────────────
  if (parceiroLojas) {
    return (
      <div className={c.pagina}>
        <div className={c.topo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <button className={c.botaoCancelar} onClick={voltarDeLojas}>← Parceiros</button>
            <div>
              <div style={{ fontWeight: 600 }}>{parceiroLojas.nome}</div>
              <span className={c.contagem}>{lojasDoParceiroAtual.length} loja{lojasDoParceiroAtual.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button className={c.botaoNovo} onClick={abrirNovaLoja}>+ Nova loja</button>
        </div>

        {lojasDoParceiroAtual.length === 0 && <p className={c.info}>Nenhuma loja cadastrada.</p>}
        {lojasDoParceiroAtual.length > 0 && (
          <div className={c.tabelaScroll}>
            <table className={c.tabela}>
              <thead>
                <tr><th>Nº</th><th>Nome</th><th>Cidade</th><th>UF</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {lojasDoParceiroAtual.map(l => (
                  <tr key={l.id} style={l.ativo === false ? { opacity: 0.45 } : undefined}>
                    <td className={c.mono}>{l.numero || '—'}</td>
                    <td>{l.nome}</td>
                    <td>{l.cidade}</td>
                    <td className={c.mono}>{l.estado}</td>
                    <td>
                      <span className={`${c.badge} ${l.ativo !== false ? c.badge_aberta : c.badge_fechada}`}>
                        {l.ativo !== false ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td>
                      <div className={c.acoes}>
                        <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => abrirEditarLoja(l)}>Editar</button>
                        <button
                          className={`${c.botaoAcao} ${l.ativo !== false ? c.botaoExcluir : c.botaoEditar}`}
                          onClick={() => toggleAtivoLoja(l)}
                        >
                          {l.ativo !== false ? 'Desativar' : 'Reativar'}
                        </button>
                        <button className={`${c.botaoAcao} ${c.botaoExcluir}`} onClick={() => excluirLoja(l)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <SlideOver aberto={lojaSlideAberto} titulo={lojaEditando ? 'Editar loja' : 'Nova loja'} onFechar={fecharLojaSlide}>
          <form onSubmit={salvarLoja} noValidate className={c.form}>
            <div className={c.campo}>
              <label className={c.label}>Número *</label>
              <input className={c.input} value={lojaForm.numero} onChange={e => setLoja('numero', e.target.value)} />
            </div>
            <div className={c.campo}>
              <label className={c.label}>Nome *</label>
              <input className={c.input} value={lojaForm.nome} onChange={e => setLoja('nome', e.target.value)} placeholder="Ex: Mirante" />
            </div>
            <div className={c.campo}>
              <label className={c.label}>Estado *</label>
              <EstadoSelect value={lojaForm.estado} onChange={v => setLoja('estado', v)} />
            </div>
            <div className={c.campo}>
              <label className={c.label}>Cidade *</label>
              <CidadeSelect estado={lojaForm.estado} value={lojaForm.cidade} onChange={v => setLoja('cidade', v)} />
            </div>
            {erroLoja && <p className={c.erro}>{erroLoja}</p>}
            <div className={c.rodapeForm}>
              <button type="button" className={c.botaoCancelar} onClick={fecharLojaSlide}>Cancelar</button>
              <button type="submit" className={c.botaoSalvar} disabled={salvandoLoja}>
                {salvandoLoja ? 'Salvando…' : lojaEditando ? 'Salvar loja' : '+ Adicionar loja'}
              </button>
            </div>
          </form>
        </SlideOver>
      </div>
    )
  }

  // ─── Lista de parceiros ────────────────────────────────────────────────────
  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <span className={c.contagem}>{parceiros.length} parceiros</span>
        <button className={c.botaoNovo} onClick={abrirNovo}>+ Novo parceiro</button>
      </div>

      {loading && <p className={c.info}>Carregando…</p>}
      {!loading && parceiros.length === 0 && <p className={c.info}>Nenhum parceiro cadastrado.</p>}
      {!loading && parceiros.length > 0 && (
        <div className={c.tabelaScroll}>
          <table className={c.tabela}>
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Lojas</th><th></th></tr>
            </thead>
            <tbody>
              {parceiros.map(p => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.tipo === 'rede' ? 'Rede' : 'Único'}</td>
                  <td className={c.mono}>{(lojasPorParceiro[p.id] ?? []).length}</td>
                  <td>
                    <div className={c.acoes}>
                      <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => abrirEditar(p)}>Editar</button>
                      {p.tipo === 'rede' && (
                        <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => abrirLojas(p)}>Lojas</button>
                      )}
                      <button className={`${c.botaoAcao} ${c.botaoExcluir}`} onClick={() => excluir(p)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Novo / editar parceiro ─────────────────────────────────────────── */}
      <SlideOver aberto={aberto} titulo={editando ? 'Editar parceiro' : 'Novo parceiro'} onFechar={fechar}>
        <form onSubmit={salvar} noValidate className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Nome *</label>
            <input className={c.input} value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
          <div className={c.campo}>
            <label className={c.label}>Tipo *</label>
            <select className={c.select} value={form.tipo} onChange={e => set('tipo', e.target.value as TipoParceiro)}>
              <option value="unico">Único (uma loja)</option>
              <option value="rede">Rede (várias lojas)</option>
            </select>
          </div>

          {form.tipo === 'unico' && (
            <>
              <p className={c.dica}>Dados da loja única — criada junto com o parceiro.</p>
              <div className={c.campo}>
                <label className={c.label}>Número (opcional)</label>
                <input className={c.input} value={form.lojaNumero} onChange={e => set('lojaNumero', e.target.value)} />
              </div>
              <div className={c.campo}>
                <label className={c.label}>Nome da loja *</label>
                <input className={c.input} value={form.lojaNome} onChange={e => set('lojaNome', e.target.value)} placeholder="Ex: Mirante" />
              </div>
              <div className={c.campo}>
                <label className={c.label}>Estado *</label>
                <EstadoSelect value={form.lojaEstado} onChange={v => set('lojaEstado', v)} />
              </div>
              <div className={c.campo}>
                <label className={c.label}>Cidade *</label>
                <CidadeSelect estado={form.lojaEstado} value={form.lojaCidade} onChange={v => set('lojaCidade', v)} />
              </div>
            </>
          )}

          {form.tipo === 'rede' && editando === null && (
            <p className={c.dica}>Depois de criar, adicione as lojas da rede pelo botão "Lojas" na listagem.</p>
          )}

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
