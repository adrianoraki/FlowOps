import { useEffect, useState, useMemo, type FormEvent } from 'react'
import {
  collection, doc, addDoc, getDocs, updateDoc,
  onSnapshot, query, where, orderBy,
  runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { StatusBadge } from '../../components/StatusBadge/StatusBadge'
import { SlideOver } from '../../components/SlideOver/SlideOver'
import c from '../../components/CrudPage/CrudPage.module.css'
import s from './Estoque.module.css'

interface TecnicoRef { id: string; nome: string }
interface PecaRef { id: string; nome: string; codigo: string; unidade: string }
interface SaldoDoc { id: string; tecnicoId: string; pecaId: string; quantidade: number }
interface ItemMov { pecaId: string; quantidade: number }
interface MovDoc {
  id: string
  tipo: 'envio' | 'devolucao'
  tecnicoId: string
  itens: ItemMov[]
  status: 'pendente' | 'confirmada' | 'divergencia'
  criadoPorId: string
  confirmadoPorId?: string
  observacao?: string
  createdAt?: { toDate(): Date }
}

const ITEM_VAZIO: ItemMov = { pecaId: '', quantidade: 1 }

export function Estoque() {
  const { user, role } = useAuth()
  const isGestor = role === 'admin' || role === 'gestor'

  // Dados
  const [tecnicos, setTecnicos] = useState<TecnicoRef[]>([])
  const [pecasLista, setPecasLista] = useState<PecaRef[]>([])
  const [saldo, setSaldo] = useState<SaldoDoc[]>([])
  const [movs, setMovs] = useState<MovDoc[]>([])

  // UI
  const [aba, setAba] = useState<'estoque' | 'movimentacoes'>('estoque')
  const [tecnicoSelecionadoId, setTecnicoSelecionadoId] = useState('')
  const tecnicoAlvoId = isGestor ? tecnicoSelecionadoId : (user?.uid ?? '')

  // Slide-overs
  const [slideEnvio, setSlideEnvio] = useState(false)
  const [slideDev, setSlideDev] = useState(false)
  const [slideDivId, setSlideDivId] = useState<string | null>(null)

  // Forms
  const [tecEnvioId, setTecEnvioId] = useState('')
  const [itensEnvio, setItensEnvio] = useState<ItemMov[]>([{ ...ITEM_VAZIO }])
  const [itensDev, setItensDev] = useState<ItemMov[]>([{ ...ITEM_VAZIO }])
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const pecasMap = useMemo(
    () => Object.fromEntries(pecasLista.map(p => [p.id, p])),
    [pecasLista],
  )
  const tecnicosMap = useMemo(
    () => Object.fromEntries(tecnicos.map(t => [t.id, t.nome])),
    [tecnicos],
  )

  // Carregar técnicos (admin/gestor)
  useEffect(() => {
    if (!isGestor) return
    getDocs(query(collection(db, 'users'), where('role', '==', 'tecnico')))
      .then(snap => setTecnicos(
        snap.docs
          .filter(d => d.data().ativo !== false)
          .map(d => ({ id: d.id, nome: d.data().nome as string })),
      ))
  }, [isGestor])

  // Carregar peças ativas
  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'pecas'), orderBy('nome')),
      snap => setPecasLista(
        snap.docs
          .filter(d => d.data().ativo !== false)
          .map(d => ({
            id: d.id,
            nome: d.data().nome as string,
            codigo: d.data().codigo as string,
            unidade: d.data().unidade as string,
          })),
      ),
    )
  }, [])

  // Carregar saldo do técnico alvo
  useEffect(() => {
    if (!tecnicoAlvoId) { setSaldo([]); return }
    return onSnapshot(
      query(collection(db, 'estoque_tecnico'), where('tecnicoId', '==', tecnicoAlvoId)),
      snap => setSaldo(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SaldoDoc)),
    )
  }, [tecnicoAlvoId])

  // Carregar movimentações
  useEffect(() => {
    const q = isGestor
      ? query(collection(db, 'movimentacoes'), orderBy('createdAt', 'desc'))
      : query(
          collection(db, 'movimentacoes'),
          where('tecnicoId', '==', user?.uid ?? ''),
          orderBy('createdAt', 'desc'),
        )
    return onSnapshot(q,
      snap => setMovs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MovDoc)),
      () => { /* composite index pode não existir ainda */ },
    )
  }, [isGestor, user?.uid])

  // Helpers de itens
  function updateItem(list: ItemMov[], i: number, key: keyof ItemMov, val: string | number): ItemMov[] {
    const next = [...list]
    next[i] = { ...next[i], [key]: val }
    return next
  }

  // ── Salvar envio ────────────────────────────────────────────────────────────
  async function submitEnvio(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!tecEnvioId) { setErro('Selecione o técnico destinatário.'); return }
    if (itensEnvio.some(it => !it.pecaId || it.quantidade < 1)) { setErro('Preencha todos os itens.'); return }
    setSalvando(true)
    try {
      await addDoc(collection(db, 'movimentacoes'), {
        tipo: 'envio',
        tecnicoId: tecEnvioId,
        itens: itensEnvio,
        status: 'pendente',
        criadoPorId: user?.uid ?? '',
        createdAt: serverTimestamp(),
      })
      setSlideEnvio(false); setTecEnvioId(''); setItensEnvio([{ ...ITEM_VAZIO }])
    } catch { setErro('Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  // ── Salvar devolução ─────────────────────────────────────────────────────────
  async function submitDev(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (itensDev.some(it => !it.pecaId || it.quantidade < 1)) { setErro('Preencha todos os itens.'); return }
    setSalvando(true)
    try {
      await addDoc(collection(db, 'movimentacoes'), {
        tipo: 'devolucao',
        tecnicoId: user?.uid ?? '',
        itens: itensDev,
        status: 'pendente',
        criadoPorId: user?.uid ?? '',
        createdAt: serverTimestamp(),
      })
      setSlideDev(false); setItensDev([{ ...ITEM_VAZIO }])
    } catch { setErro('Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  // ── Confirmar (transação) ────────────────────────────────────────────────────
  async function confirmar(mov: MovDoc) {
    setSalvando(true)
    try {
      await runTransaction(db, async t => {
        const movRef = doc(db, 'movimentacoes', mov.id)
        const snap = await t.get(movRef)
        if (!snap.exists() || snap.data().status !== 'pendente') {
          throw new Error('Movimentação já processada.')
        }
        t.update(movRef, {
          status: 'confirmada',
          confirmadoPorId: user?.uid ?? '',
          confirmadoEm: serverTimestamp(),
        })
        for (const item of mov.itens) {
          const estoqueId = `${mov.tecnicoId}_${item.pecaId}`
          const estoqueRef = doc(db, 'estoque_tecnico', estoqueId)
          const estoqueSnap = await t.get(estoqueRef)
          const atual = estoqueSnap.exists() ? (estoqueSnap.data().quantidade as number) : 0
          const delta = mov.tipo === 'envio' ? item.quantidade : -item.quantidade
          if (estoqueSnap.exists()) {
            t.update(estoqueRef, { quantidade: atual + delta })
          } else {
            t.set(estoqueRef, { tecnicoId: mov.tecnicoId, pecaId: item.pecaId, quantidade: atual + delta })
          }
        }
      })
    } catch (err) {
      alert((err as Error).message || 'Erro ao confirmar.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Registrar divergência ────────────────────────────────────────────────────
  async function divergir(movId: string) {
    setErro('')
    if (!obs.trim()) { setErro('Informe a observação.'); return }
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'movimentacoes', movId), {
        status: 'divergencia',
        confirmadoPorId: user?.uid ?? '',
        confirmadoEm: serverTimestamp(),
        observacao: obs,
      })
      setSlideDivId(null); setObs('')
    } catch { setErro('Erro ao registrar.') }
    finally { setSalvando(false) }
  }

  // Quem pode confirmar esta movimentação?
  function podeConfirmar(mov: MovDoc): boolean {
    if (mov.status !== 'pendente') return false
    if (mov.tipo === 'envio') return !isGestor && mov.tecnicoId === user?.uid
    return isGestor // devolucao: admin/gestor confirma
  }

  return (
    <div className={c.pagina}>
      {/* ── SELETOR DE TÉCNICO ─────────────────────────────────────────── */}
      <div className={s.topBar}>
        {isGestor ? (
          <div className={s.seletorTecnico}>
            <span className={c.label}>Técnico:</span>
            <select
              className={c.select}
              value={tecnicoSelecionadoId}
              onChange={e => setTecnicoSelecionadoId(e.target.value)}
              style={{ minWidth: '200px' }}
            >
              <option value="">Selecione um técnico</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        ) : (
          <span className={s.tecnicoLabel}>
            Estoque de: <strong>{user?.displayName ?? user?.email?.split('@')[0] ?? 'você'}</strong>
          </span>
        )}
      </div>

      {/* ── TABS + BOTÕES ──────────────────────────────────────────────── */}
      <div className={s.tabBar}>
        <div className={s.tabs}>
          <button className={`${s.tab} ${aba === 'estoque' ? s.tabAtivo : ''}`} onClick={() => setAba('estoque')}>
            Estoque
          </button>
          <button className={`${s.tab} ${aba === 'movimentacoes' ? s.tabAtivo : ''}`} onClick={() => setAba('movimentacoes')}>
            Movimentações
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isGestor && (
            <button className={c.botaoNovo} onClick={() => { setSlideEnvio(true); setErro('') }}>
              + Novo envio
            </button>
          )}
          {!isGestor && (
            <button className={c.botaoNovo} onClick={() => { setSlideDev(true); setErro('') }}>
              + Nova devolução
            </button>
          )}
        </div>
      </div>

      {/* ── TAB: ESTOQUE ───────────────────────────────────────────────── */}
      {aba === 'estoque' && (
        <>
          {!tecnicoAlvoId && <p className={c.info}>Selecione um técnico acima.</p>}
          {tecnicoAlvoId && saldo.length === 0 && <p className={c.info}>Nenhuma peça em estoque.</p>}
          {saldo.length > 0 && (
            <div className={c.tabelaScroll}>
              <table className={c.tabela}>
                <thead><tr><th>Peça</th><th>Código</th><th>Unidade</th><th style={{ textAlign: 'right' }}>Qtd.</th></tr></thead>
                <tbody>
                  {saldo.map(item => {
                    const peca = pecasMap[item.pecaId]
                    return (
                      <tr key={item.id}>
                        <td>{peca?.nome ?? item.pecaId}</td>
                        <td className={c.mono}>{peca?.codigo ?? '—'}</td>
                        <td>{peca?.unidade ?? '—'}</td>
                        <td className={c.mono} style={{ textAlign: 'right' }}>{item.quantidade}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB: MOVIMENTAÇÕES ─────────────────────────────────────────── */}
      {aba === 'movimentacoes' && (
        <>
          {movs.length === 0 && <p className={c.info}>Nenhuma movimentação.</p>}
          {movs.length > 0 && (
            <div className={c.tabelaScroll}>
              <table className={c.tabela}>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    {isGestor && <th>Técnico</th>}
                    <th>Itens</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {movs.map(mov => (
                    <tr key={mov.id}>
                      <td>
                        <span className={`${c.badge} ${mov.tipo === 'envio' ? c.badge_preventiva : c.badge_corretiva}`}>
                          {mov.tipo === 'envio' ? 'Envio' : 'Devolução'}
                        </span>
                      </td>
                      {isGestor && <td className={c.truncar}>{tecnicosMap[mov.tecnicoId] ?? mov.tecnicoId}</td>}
                      <td>
                        <div className={s.itensCell}>
                          {mov.itens.map((it, i) => (
                            <span key={i} className={s.itemChip}>
                              {pecasMap[it.pecaId]?.nome ?? it.pecaId} ×{it.quantidade}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td><StatusBadge status={mov.status} /></td>
                      <td className={c.mono}>{mov.createdAt?.toDate().toLocaleDateString('pt-BR') ?? '—'}</td>
                      <td>
                        {podeConfirmar(mov) && (
                          <div className={c.acoes}>
                            <button
                              className={`${c.botaoAcao} ${c.botaoEditar}`}
                              onClick={() => confirmar(mov)}
                              disabled={salvando}
                            >
                              Confirmar
                            </button>
                            <button
                              className={`${c.botaoAcao} ${c.botaoExcluir}`}
                              onClick={() => { setSlideDivId(mov.id); setObs(''); setErro('') }}
                            >
                              Divergência
                            </button>
                          </div>
                        )}
                        {mov.status === 'divergencia' && mov.observacao && (
                          <span className={s.obsHint} title={mov.observacao}>obs.</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── SLIDE: NOVO ENVIO ──────────────────────────────────────────── */}
      <SlideOver aberto={slideEnvio} titulo="Novo Envio" onFechar={() => setSlideEnvio(false)}>
        <form onSubmit={submitEnvio} noValidate className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Técnico destinatário *</label>
            <select className={c.select} value={tecEnvioId} onChange={e => setTecEnvioId(e.target.value)}>
              <option value="">Selecione</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className={c.campo}>
            <label className={c.label}>Itens *</label>
            {itensEnvio.map((item, i) => (
              <div key={i} className={s.itemRow}>
                <select
                  className={c.select}
                  value={item.pecaId}
                  onChange={e => setItensEnvio(updateItem(itensEnvio, i, 'pecaId', e.target.value))}
                  style={{ flex: 1 }}
                >
                  <option value="">Peça</option>
                  {pecasLista.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <input
                  type="number"
                  min="1"
                  className={c.input}
                  value={item.quantidade}
                  onChange={e => setItensEnvio(updateItem(itensEnvio, i, 'quantidade', +e.target.value))}
                  style={{ width: '70px' }}
                />
                <button
                  type="button"
                  className={s.btnRemoveItem}
                  onClick={() => setItensEnvio(itensEnvio.filter((_, j) => j !== i))}
                  disabled={itensEnvio.length === 1}
                >×</button>
              </div>
            ))}
            <button type="button" className={s.addItemBtn} onClick={() => setItensEnvio([...itensEnvio, { ...ITEM_VAZIO }])}>
              + item
            </button>
          </div>
          {erro && <p className={c.erro}>{erro}</p>}
          <div className={c.rodapeForm}>
            <button type="button" className={c.botaoCancelar} onClick={() => setSlideEnvio(false)}>Cancelar</button>
            <button type="submit" className={c.botaoSalvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Enviar'}</button>
          </div>
        </form>
      </SlideOver>

      {/* ── SLIDE: NOVA DEVOLUÇÃO ──────────────────────────────────────── */}
      <SlideOver aberto={slideDev} titulo="Nova Devolução" onFechar={() => setSlideDev(false)}>
        <form onSubmit={submitDev} noValidate className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Itens a devolver *</label>
            {itensDev.map((item, i) => (
              <div key={i} className={s.itemRow}>
                <select
                  className={c.select}
                  value={item.pecaId}
                  onChange={e => setItensDev(updateItem(itensDev, i, 'pecaId', e.target.value))}
                  style={{ flex: 1 }}
                >
                  <option value="">Peça</option>
                  {pecasLista.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <input
                  type="number"
                  min="1"
                  className={c.input}
                  value={item.quantidade}
                  onChange={e => setItensDev(updateItem(itensDev, i, 'quantidade', +e.target.value))}
                  style={{ width: '70px' }}
                />
                <button
                  type="button"
                  className={s.btnRemoveItem}
                  onClick={() => setItensDev(itensDev.filter((_, j) => j !== i))}
                  disabled={itensDev.length === 1}
                >×</button>
              </div>
            ))}
            <button type="button" className={s.addItemBtn} onClick={() => setItensDev([...itensDev, { ...ITEM_VAZIO }])}>
              + item
            </button>
          </div>
          {erro && <p className={c.erro}>{erro}</p>}
          <div className={c.rodapeForm}>
            <button type="button" className={c.botaoCancelar} onClick={() => setSlideDev(false)}>Cancelar</button>
            <button type="submit" className={c.botaoSalvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</button>
          </div>
        </form>
      </SlideOver>

      {/* ── SLIDE: REGISTRAR DIVERGÊNCIA ───────────────────────────────── */}
      <SlideOver
        aberto={slideDivId !== null}
        titulo="Registrar Divergência"
        onFechar={() => { setSlideDivId(null); setObs(''); setErro('') }}
      >
        <div className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Observação *</label>
            <textarea
              className={c.textarea}
              rows={4}
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Descreva a divergência encontrada…"
            />
          </div>
          <p className={c.dica}>O estoque NÃO será alterado ao registrar divergência.</p>
          {erro && <p className={c.erro}>{erro}</p>}
          <div className={c.rodapeForm}>
            <button type="button" className={c.botaoCancelar} onClick={() => { setSlideDivId(null); setObs('') }}>
              Cancelar
            </button>
            <button
              type="button"
              className={c.botaoSalvar}
              disabled={salvando}
              onClick={() => slideDivId && divergir(slideDivId)}
            >
              {salvando ? 'Salvando…' : 'Confirmar divergência'}
            </button>
          </div>
        </div>
      </SlideOver>
    </div>
  )
}
