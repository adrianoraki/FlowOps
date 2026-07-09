import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  collection, doc, addDoc, getDocs, updateDoc, deleteField,
  onSnapshot, query, where, orderBy, serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { SlideOver } from '../../components/SlideOver/SlideOver'
import type { StatusSelo, StatusSolicitacaoSelo } from '@flowops/types'
import c from '../../components/CrudPage/CrudPage.module.css'
import s from './Selos.module.css'

interface TecnicoRef { id: string; nome: string }

interface SeloDoc {
  id: string
  numeroSerie: string
  status: StatusSelo
  tecnicoId?: string
  dataEnvio?: { toDate(): Date }
  createdAt?: { toDate(): Date }
}

interface SolicitacaoDoc {
  id: string
  tecnicoId: string
  quantidade: number
  status: StatusSolicitacaoSelo
  createdAt?: { toDate(): Date }
}

const BADGE_STATUS_SELO: Record<StatusSelo, string> = {
  disponivel: c.badge_aberta,
  enviado:    c.badge_preventiva,
  usado:      c.badge_fechada,
}
const LABEL_STATUS_SELO: Record<StatusSelo, string> = {
  disponivel: 'Disponível',
  enviado:    'Enviado',
  usado:      'Usado',
}

const LOTE_MAX_POR_BATCH = 500 // limite de operações por writeBatch do Firestore

export function Selos() {
  const { user, role } = useAuth()
  const isGestor = role === 'admin' || role === 'gestor'

  // ── Dados ────────────────────────────────────────────────────────────────
  const [tecnicos, setTecnicos] = useState<TecnicoRef[]>([])
  const [selos, setSelos] = useState<SeloDoc[]>([])
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoDoc[]>([])
  const [loading, setLoading] = useState(true)

  // ── UI (admin/gestor) ───────────────────────────────────────────────────
  const [aba, setAba] = useState<'estoque' | 'solicitacoes'>('estoque')
  const [filtroStatus, setFiltroStatus] = useState<StatusSelo | ''>('')
  const [filtroTecnico, setFiltroTecnico] = useState('')
  const [mostrarAtendidas, setMostrarAtendidas] = useState(false)

  // ── Slide-overs ──────────────────────────────────────────────────────────
  const [slideCadastro, setSlideCadastro] = useState(false)
  const [slideEnvio, setSlideEnvio] = useState(false)
  const [slideSolicitar, setSlideSolicitar] = useState(false)

  // ── Forms ────────────────────────────────────────────────────────────────
  const [loteTexto, setLoteTexto] = useState('')
  const [tecEnvioId, setTecEnvioId] = useState('')
  const [selosEnvioIds, setSelosEnvioIds] = useState<Set<string>>(new Set())
  const [quantidadeSolicitada, setQuantidadeSolicitada] = useState(10)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const tecnicosMap = useMemo(
    () => Object.fromEntries(tecnicos.map(t => [t.id, t.nome])),
    [tecnicos],
  )

  // ── Carregar técnicos ativos (admin/gestor) ─────────────────────────────
  useEffect(() => {
    if (!isGestor) return
    getDocs(query(collection(db, 'users'), where('role', '==', 'tecnico')))
      .then(snap => setTecnicos(
        snap.docs
          .filter(d => d.data().ativo !== false)
          .map(d => ({ id: d.id, nome: d.data().nome as string })),
      ))
  }, [isGestor])

  // ── Carregar selos ───────────────────────────────────────────────────────
  // Admin/gestor: coleção inteira (filtros aplicados no cliente — mesmo padrão
  // de pecas/estoque_tecnico, sem índice composto pra gerenciar).
  // Técnico: só os seus (Security Rules já restringem, mas o `where` evita
  // um snapshot vazio ficar tentando ler documentos que o técnico não pode ver).
  useEffect(() => {
    const q = isGestor
      ? query(collection(db, 'selos'), orderBy('numeroSerie'))
      : query(collection(db, 'selos'), where('tecnicoId', '==', user?.uid ?? ''))
    return onSnapshot(q,
      snap => {
        setSelos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SeloDoc))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [isGestor, user?.uid])

  // ── Carregar solicitações ────────────────────────────────────────────────
  useEffect(() => {
    const q = isGestor
      ? query(collection(db, 'solicitacoesSelo'), orderBy('createdAt', 'desc'))
      : query(
          collection(db, 'solicitacoesSelo'),
          where('tecnicoId', '==', user?.uid ?? ''),
          orderBy('createdAt', 'desc'),
        )
    return onSnapshot(q,
      snap => setSolicitacoes(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SolicitacaoDoc)),
      () => { /* composite index pode não existir ainda */ },
    )
  }, [isGestor, user?.uid])

  // ── Derivados (admin/gestor) ─────────────────────────────────────────────
  const totalDisponivel = useMemo(() => selos.filter(sel => sel.status === 'disponivel').length, [selos])
  const totalUsado       = useMemo(() => selos.filter(sel => sel.status === 'usado').length, [selos])
  const enviadosPorTecnico = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const sel of selos) {
      if (sel.status !== 'enviado' || !sel.tecnicoId) continue
      mapa.set(sel.tecnicoId, (mapa.get(sel.tecnicoId) ?? 0) + 1)
    }
    return [...mapa.entries()]
      .map(([tecnicoId, qtd]) => ({ tecnicoId, nome: tecnicosMap[tecnicoId] ?? tecnicoId, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
  }, [selos, tecnicosMap])

  const selosDisponiveis = useMemo(() => selos.filter(sel => sel.status === 'disponivel'), [selos])

  const selosFiltrados = useMemo(() => {
    return selos.filter(sel => {
      if (filtroStatus && sel.status !== filtroStatus) return false
      if (filtroTecnico && sel.tecnicoId !== filtroTecnico) return false
      return true
    })
  }, [selos, filtroStatus, filtroTecnico])

  const solicitacoesVisiveis = isGestor
    ? (mostrarAtendidas ? solicitacoes : solicitacoes.filter(sol => sol.status === 'pendente'))
    : solicitacoes

  // ── Derivados (técnico) ──────────────────────────────────────────────────
  const meusSelos = useMemo(
    () => selos.filter(sel => sel.status === 'enviado' && sel.tecnicoId === user?.uid),
    [selos, user?.uid],
  )

  // ── Cadastro em lote ──────────────────────────────────────────────────────
  function abrirCadastro() {
    setLoteTexto(''); setErro(''); setAviso(''); setSlideCadastro(true)
  }

  async function submitCadastro(e: FormEvent) {
    e.preventDefault()
    setErro(''); setAviso('')

    const existentes = new Set(selos.map(sel => sel.numeroSerie.trim().toUpperCase()))
    const linhas = loteTexto
      .split('\n')
      .map(l => l.trim().toUpperCase())
      .filter(Boolean)

    if (linhas.length === 0) { setErro('Informe ao menos um número de série.'); return }

    const novos: string[] = []
    const duplicados: string[] = []
    const vistosNoLote = new Set<string>()
    for (const numeroSerie of linhas) {
      if (existentes.has(numeroSerie) || vistosNoLote.has(numeroSerie)) {
        duplicados.push(numeroSerie)
        continue
      }
      vistosNoLote.add(numeroSerie)
      novos.push(numeroSerie)
    }

    if (novos.length === 0) {
      setErro(`Nenhum selo novo — ${duplicados.length} número(s) de série já cadastrado(s) ou repetido(s) na lista.`)
      return
    }

    setSalvando(true)
    try {
      for (let inicio = 0; inicio < novos.length; inicio += LOTE_MAX_POR_BATCH) {
        const fatia = novos.slice(inicio, inicio + LOTE_MAX_POR_BATCH)
        const batch = writeBatch(db)
        for (const numeroSerie of fatia) {
          batch.set(doc(collection(db, 'selos')), {
            numeroSerie,
            status: 'disponivel' as StatusSelo,
            createdAt: serverTimestamp(),
          })
        }
        await batch.commit()
      }
      setAviso(
        `${novos.length} selo(s) cadastrado(s) com sucesso` +
        (duplicados.length > 0 ? ` — ${duplicados.length} ignorado(s) por já existir(em).` : '.'),
      )
      setLoteTexto('')
    } catch {
      setErro('Erro ao cadastrar selos. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Envio de selos ────────────────────────────────────────────────────────
  function abrirEnvio() {
    setTecEnvioId(''); setSelosEnvioIds(new Set()); setErro(''); setSlideEnvio(true)
  }

  function toggleSeloEnvio(id: string) {
    setSelosEnvioIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function submitEnvio(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!tecEnvioId) { setErro('Selecione o técnico destinatário.'); return }
    if (selosEnvioIds.size === 0) { setErro('Selecione ao menos um selo.'); return }
    setSalvando(true)
    try {
      const batch = writeBatch(db)
      for (const id of selosEnvioIds) {
        batch.update(doc(db, 'selos', id), {
          status: 'enviado' as StatusSelo,
          tecnicoId: tecEnvioId,
          dataEnvio: serverTimestamp(),
        })
      }
      await batch.commit()
      setSlideEnvio(false)
    } catch {
      setErro('Erro ao enviar selos. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Ações rápidas na listagem (admin/gestor) ─────────────────────────────
  async function marcarComoUsado(selo: SeloDoc) {
    if (!confirm(`Marcar o selo ${selo.numeroSerie} como usado?`)) return
    await updateDoc(doc(db, 'selos', selo.id), { status: 'usado' as StatusSelo })
  }

  async function reverterParaDisponivel(selo: SeloDoc) {
    if (!confirm(`Reverter o selo ${selo.numeroSerie} para disponível? Isso desvincula o técnico atual.`)) return
    await updateDoc(doc(db, 'selos', selo.id), {
      status: 'disponivel' as StatusSelo,
      tecnicoId: deleteField(),
      dataEnvio: deleteField(),
    })
  }

  // ── Solicitações ──────────────────────────────────────────────────────────
  async function submitSolicitacao(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!user) return
    if (quantidadeSolicitada < 1) { setErro('Informe uma quantidade válida.'); return }
    setSalvando(true)
    try {
      await addDoc(collection(db, 'solicitacoesSelo'), {
        tecnicoId: user.uid,
        quantidade: quantidadeSolicitada,
        status: 'pendente' as StatusSolicitacaoSelo,
        createdAt: serverTimestamp(),
      })
      setSlideSolicitar(false)
      setQuantidadeSolicitada(10)
    } catch {
      setErro('Erro ao enviar solicitação. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function marcarSolicitacaoAtendida(sol: SolicitacaoDoc) {
    if (!user) return
    await updateDoc(doc(db, 'solicitacoesSelo', sol.id), {
      status: 'atendida' as StatusSolicitacaoSelo,
      atendidaPorId: user.uid,
      atendidaEm: serverTimestamp(),
    })
  }

  // ── Render: técnico ──────────────────────────────────────────────────────
  if (!isGestor) {
    return (
      <div className={c.pagina}>
        <div className={s.resumoCard}>
          <span className={s.resumoNumero}>{meusSelos.length}</span>
          <span className={s.resumoLabel}>
            selo{meusSelos.length === 1 ? '' : 's'} em mãos no momento
          </span>
        </div>

        <div className={c.topo}>
          <span className={c.contagem}>Meus selos</span>
          <button className={c.botaoNovo} onClick={() => { setErro(''); setSlideSolicitar(true) }}>
            + Solicitar mais selos
          </button>
        </div>

        {loading && <p className={c.info}>Carregando…</p>}
        {!loading && meusSelos.length === 0 && <p className={c.info}>Nenhum selo em mãos no momento.</p>}
        {!loading && meusSelos.length > 0 && (
          <div className={c.tabelaScroll}>
            <table className={c.tabela}>
              <thead><tr><th>Número de Série</th><th>Recebido em</th></tr></thead>
              <tbody>
                {meusSelos.map(sel => (
                  <tr key={sel.id}>
                    <td className={c.mono}>{sel.numeroSerie}</td>
                    <td>{sel.dataEnvio?.toDate().toLocaleDateString('pt-BR') ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className={s.subtitulo}>Minhas solicitações</h2>
        {solicitacoes.length === 0 && <p className={c.info}>Nenhuma solicitação feita ainda.</p>}
        {solicitacoes.length > 0 && (
          <div className={c.tabelaScroll}>
            <table className={c.tabela}>
              <thead><tr><th>Quantidade</th><th>Data</th><th>Status</th></tr></thead>
              <tbody>
                {solicitacoes.map(sol => (
                  <tr key={sol.id}>
                    <td className={c.mono}>{sol.quantidade}</td>
                    <td>{sol.createdAt?.toDate().toLocaleDateString('pt-BR') ?? '—'}</td>
                    <td>
                      <span className={`${c.badge} ${sol.status === 'pendente' ? c.badge_emergencia : c.badge_aberta}`}>
                        {sol.status === 'pendente' ? 'Pendente' : 'Atendida'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <SlideOver aberto={slideSolicitar} titulo="Solicitar mais selos" onFechar={() => setSlideSolicitar(false)}>
          <form onSubmit={submitSolicitacao} noValidate className={c.form}>
            <div className={c.campo}>
              <label className={c.label}>Quantidade desejada *</label>
              <input
                type="number"
                min="1"
                className={c.input}
                value={quantidadeSolicitada}
                onChange={e => setQuantidadeSolicitada(+e.target.value)}
              />
            </div>
            <p className={c.dica}>O administrador vê essa solicitação e providencia o envio.</p>
            {erro && <p className={c.erro}>{erro}</p>}
            <div className={c.rodapeForm}>
              <button type="button" className={c.botaoCancelar} onClick={() => setSlideSolicitar(false)}>Cancelar</button>
              <button type="submit" className={c.botaoSalvar} disabled={salvando}>
                {salvando ? 'Enviando…' : 'Solicitar'}
              </button>
            </div>
          </form>
        </SlideOver>
      </div>
    )
  }

  // ── Render: admin/gestor ─────────────────────────────────────────────────
  return (
    <div className={c.pagina}>
      <div className={s.resumoLinha}>
        <div className={s.resumoCard}>
          <span className={s.resumoNumero}>{totalDisponivel}</span>
          <span className={s.resumoLabel}>disponíveis</span>
        </div>
        <div className={s.resumoCard}>
          <span className={s.resumoNumero}>{selos.length - totalDisponivel - totalUsado}</span>
          <span className={s.resumoLabel}>enviados</span>
        </div>
        <div className={s.resumoCard}>
          <span className={s.resumoNumero}>{totalUsado}</span>
          <span className={s.resumoLabel}>usados</span>
        </div>
        {enviadosPorTecnico.length > 0 && (
          <div className={s.resumoPorTecnico}>
            {enviadosPorTecnico.map(item => (
              <span key={item.tecnicoId} className={s.itemChip}>{item.nome}: {item.qtd}</span>
            ))}
          </div>
        )}
      </div>

      <div className={s.tabBar}>
        <div className={s.tabs}>
          <button className={`${s.tab} ${aba === 'estoque' ? s.tabAtivo : ''}`} onClick={() => setAba('estoque')}>
            Estoque de Selos
          </button>
          <button className={`${s.tab} ${aba === 'solicitacoes' ? s.tabAtivo : ''}`} onClick={() => setAba('solicitacoes')}>
            Solicitações
            {solicitacoes.some(sol => sol.status === 'pendente') && <span className={s.tabPonto} />}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={c.botaoNovo} onClick={abrirCadastro}>+ Cadastrar selos</button>
          <button className={c.botaoNovo} onClick={abrirEnvio}>+ Enviar selos</button>
        </div>
      </div>

      {aba === 'estoque' && (
        <>
          <div className={s.filtros}>
            <select className={c.select} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as StatusSelo | '')}>
              <option value="">Todos os status</option>
              <option value="disponivel">Disponível</option>
              <option value="enviado">Enviado</option>
              <option value="usado">Usado</option>
            </select>
            <select className={c.select} value={filtroTecnico} onChange={e => setFiltroTecnico(e.target.value)}>
              <option value="">Todos os técnicos</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          {loading && <p className={c.info}>Carregando…</p>}
          {!loading && selosFiltrados.length === 0 && <p className={c.info}>Nenhum selo encontrado.</p>}
          {!loading && selosFiltrados.length > 0 && (
            <div className={c.tabelaScroll}>
              <table className={c.tabela}>
                <thead>
                  <tr><th>Número de Série</th><th>Status</th><th>Técnico</th><th>Data de Envio</th><th></th></tr>
                </thead>
                <tbody>
                  {selosFiltrados.map(sel => (
                    <tr key={sel.id}>
                      <td className={c.mono}>{sel.numeroSerie}</td>
                      <td>
                        <span className={`${c.badge} ${BADGE_STATUS_SELO[sel.status]}`}>
                          {LABEL_STATUS_SELO[sel.status]}
                        </span>
                      </td>
                      <td className={c.truncar}>{sel.tecnicoId ? (tecnicosMap[sel.tecnicoId] ?? sel.tecnicoId) : '—'}</td>
                      <td>{sel.dataEnvio?.toDate().toLocaleDateString('pt-BR') ?? '—'}</td>
                      <td>
                        <div className={c.acoes}>
                          {sel.status === 'enviado' && (
                            <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => marcarComoUsado(sel)}>
                              Marcar como usado
                            </button>
                          )}
                          {sel.status === 'usado' && (
                            <button className={`${c.botaoAcao} ${c.botaoExcluir}`} onClick={() => reverterParaDisponivel(sel)}>
                              Reverter p/ disponível
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aba === 'solicitacoes' && (
        <>
          <label className={s.checkboxLabel}>
            <input
              type="checkbox"
              checked={mostrarAtendidas}
              onChange={e => setMostrarAtendidas(e.target.checked)}
            />
            Mostrar atendidas
          </label>

          {solicitacoesVisiveis.length === 0 && <p className={c.info}>Nenhuma solicitação {mostrarAtendidas ? '' : 'pendente '}encontrada.</p>}
          {solicitacoesVisiveis.length > 0 && (
            <div className={c.tabelaScroll}>
              <table className={c.tabela}>
                <thead>
                  <tr><th>Técnico</th><th>Quantidade</th><th>Data</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {solicitacoesVisiveis.map(sol => (
                    <tr key={sol.id}>
                      <td className={c.truncar}>{tecnicosMap[sol.tecnicoId] ?? sol.tecnicoId}</td>
                      <td className={c.mono}>{sol.quantidade}</td>
                      <td>{sol.createdAt?.toDate().toLocaleDateString('pt-BR') ?? '—'}</td>
                      <td>
                        <span className={`${c.badge} ${sol.status === 'pendente' ? c.badge_emergencia : c.badge_aberta}`}>
                          {sol.status === 'pendente' ? 'Pendente' : 'Atendida'}
                        </span>
                      </td>
                      <td>
                        {sol.status === 'pendente' && (
                          <div className={c.acoes}>
                            <button className={`${c.botaoAcao} ${c.botaoEditar}`} onClick={() => marcarSolicitacaoAtendida(sol)}>
                              Marcar como atendida
                            </button>
                          </div>
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

      {/* ── SLIDE: CADASTRAR SELOS ─────────────────────────────────────── */}
      <SlideOver aberto={slideCadastro} titulo="Cadastrar Selos" onFechar={() => setSlideCadastro(false)}>
        <form onSubmit={submitCadastro} noValidate className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Números de série *</label>
            <textarea
              className={c.textarea}
              rows={10}
              value={loteTexto}
              onChange={e => setLoteTexto(e.target.value)}
              placeholder={'Um número de série por linha, ex:\nSL-000123\nSL-000124\nSL-000125'}
            />
          </div>
          <p className={c.dica}>
            Cole quantos números quiser, um por linha — funciona tanto pra um selo só quanto pra um lote grande.
            Números já cadastrados são ignorados automaticamente.
          </p>
          {aviso && <p className={c.dica}>{aviso}</p>}
          {erro && <p className={c.erro}>{erro}</p>}
          <div className={c.rodapeForm}>
            <button type="button" className={c.botaoCancelar} onClick={() => setSlideCadastro(false)}>Fechar</button>
            <button type="submit" className={c.botaoSalvar} disabled={salvando}>
              {salvando ? 'Cadastrando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </SlideOver>

      {/* ── SLIDE: ENVIAR SELOS ────────────────────────────────────────── */}
      <SlideOver aberto={slideEnvio} titulo="Enviar Selos" onFechar={() => setSlideEnvio(false)}>
        <form onSubmit={submitEnvio} noValidate className={c.form}>
          <div className={c.campo}>
            <label className={c.label}>Técnico destinatário *</label>
            <select className={c.select} value={tecEnvioId} onChange={e => setTecEnvioId(e.target.value)}>
              <option value="">Selecione</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className={c.campo}>
            <label className={c.label}>Selos disponíveis * ({selosEnvioIds.size} selecionado{selosEnvioIds.size === 1 ? '' : 's'})</label>
            {selosDisponiveis.length === 0 && <p className={c.info}>Nenhum selo disponível em estoque.</p>}
            {selosDisponiveis.length > 0 && (
              <div className={s.listaSelecao}>
                {selosDisponiveis.map(sel => (
                  <label key={sel.id} className={s.itemSelecao}>
                    <input
                      type="checkbox"
                      checked={selosEnvioIds.has(sel.id)}
                      onChange={() => toggleSeloEnvio(sel.id)}
                    />
                    <span className={c.mono}>{sel.numeroSerie}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {erro && <p className={c.erro}>{erro}</p>}
          <div className={c.rodapeForm}>
            <button type="button" className={c.botaoCancelar} onClick={() => setSlideEnvio(false)}>Cancelar</button>
            <button type="submit" className={c.botaoSalvar} disabled={salvando}>
              {salvando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  )
}
