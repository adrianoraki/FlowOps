import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  collection, doc, getDoc, onSnapshot,
  query, where, Timestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { StatusBadge } from '../../components/StatusBadge/StatusBadge'
import s from './Dashboard.module.css'

// ─── Configuração ──────────────────────────────────────────────────────────────
const ALERTA_DIAS_ABERTA = 3

const STATUS_ORDEM: string[] = [
  'aberta', 'em_andamento', 'aguardando_peca', 'concluida', 'cancelada',
]

const STATUS_COLOR: Record<string, { num: string; bg: string; border: string }> = {
  aberta:          { num: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  em_andamento:    { num: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  aguardando_peca: { num: '#c2410c', bg: '#ffedd5', border: '#fed7aa' },
  concluida:       { num: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
  cancelada:       { num: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
}

// ─── Tipos locais ──────────────────────────────────────────────────────────────

interface OSItem {
  id: string
  status: string
  tecnicoId: string
  clienteId: string
  regiao: string
  createdAt?: Timestamp
}

interface MovItem {
  id: string
  tipo: 'envio' | 'devolucao'
  status: string
  tecnicoId: string
  criadoPorId: string
  createdAt?: Timestamp
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const isGestor = role === 'admin' || role === 'gestor'

  const [regiao, setRegiao] = useState<string>('')
  const [ordensByPrincipal, setOrdensByPrincipal] = useState<OSItem[]>([])
  const [ordensByTecnico, setOrdensByTecnico] = useState<OSItem[]>([])
  const [tecnicosNomes, setTecnicosNomes] = useState<Record<string, string>>({})
  const [movsPendentes, setMovsPendentes] = useState<MovItem[]>([])
  const [statusAberto, setStatusAberto] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Região do usuário logado
  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      setRegiao((snap.data()?.regiao as string) ?? '')
    })
  }, [user])

  // Nomes dos técnicos para a tabela de carga
  useEffect(() => {
    if (!isGestor) return
    const q = query(collection(db, 'users'), where('role', '==', 'tecnico'))
    return onSnapshot(q, snap => {
      const mapa: Record<string, string> = {}
      snap.docs.forEach(d => { mapa[d.id] = d.data().nome as string })
      setTecnicosNomes(mapa)
    })
  }, [isGestor])

  // Query principal de OSs (por região ou tudo)
  useEffect(() => {
    if (!user || !role) return
    if (!isGestor && !regiao) return

    let q
    if (role === 'admin') {
      q = collection(db, 'ordens_servico')
    } else if (role === 'gestor') {
      q = query(collection(db, 'ordens_servico'), where('regiao', '==', regiao))
    } else {
      q = query(collection(db, 'ordens_servico'), where('regiao', '==', regiao))
    }

    return onSnapshot(q,
      snap => {
        setOrdensByPrincipal(snap.docs.map(d => ({ id: d.id, ...d.data() }) as OSItem))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user?.uid, role, regiao, isGestor])

  // Técnico: segunda query por tecnicoId (cross-região)
  useEffect(() => {
    if (!user || role !== 'tecnico') return
    const q = query(collection(db, 'ordens_servico'), where('tecnicoId', '==', user.uid))
    return onSnapshot(q, snap => {
      setOrdensByTecnico(snap.docs.map(d => ({ id: d.id, ...d.data() }) as OSItem))
    })
  }, [user?.uid, role])

  // Movimentações pendentes relevantes para o usuário
  useEffect(() => {
    if (!user || !role) return
    let q
    if (isGestor) {
      q = query(
        collection(db, 'movimentacoes'),
        where('tipo', '==', 'devolucao'),
        where('status', '==', 'pendente'),
      )
    } else {
      q = query(
        collection(db, 'movimentacoes'),
        where('tipo', '==', 'envio'),
        where('status', '==', 'pendente'),
        where('tecnicoId', '==', user.uid),
      )
    }
    return onSnapshot(q,
      snap => setMovsPendentes(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MovItem)),
      () => {},
    )
  }, [user?.uid, role, isGestor])

  // ─── Dados derivados ────────────────────────────────────────────────────────

  const ordens = useMemo(() => {
    if (role !== 'tecnico') return ordensByPrincipal
    const ids = new Set(ordensByPrincipal.map(o => o.id))
    return [...ordensByPrincipal, ...ordensByTecnico.filter(o => !ids.has(o.id))]
  }, [role, ordensByPrincipal, ordensByTecnico])

  const contagemStatus = useMemo(() => {
    const c: Record<string, number> = {}
    for (const os of ordens) c[os.status] = (c[os.status] || 0) + 1
    return c
  }, [ordens])

  const cargaTecnico = useMemo(() => {
    const ativas = ordens.filter(os => os.status !== 'concluida' && os.status !== 'cancelada')
    const mapa: Record<string, number> = {}
    for (const os of ativas) {
      if (os.tecnicoId) mapa[os.tecnicoId] = (mapa[os.tecnicoId] || 0) + 1
    }
    return Object.entries(mapa)
      .map(([uid, count]) => ({ uid, nome: tecnicosNomes[uid] || uid, count }))
      .sort((a, b) => b.count - a.count)
  }, [ordens, tecnicosNomes])

  const osAntigas = useMemo(() => {
    const limite = Date.now() - ALERTA_DIAS_ABERTA * 24 * 60 * 60 * 1000
    return ordens
      .filter(os => os.status === 'aberta' && os.createdAt && os.createdAt.toDate().getTime() < limite)
      .map(os => ({
        ...os,
        dias: Math.floor((Date.now() - os.createdAt!.toDate().getTime()) / 86400000),
      }))
      .sort((a, b) => b.dias - a.dias)
  }, [ordens])

  const ordensFiltradas = useMemo(
    () => statusAberto ? ordens.filter(os => os.status === statusAberto) : [],
    [ordens, statusAberto],
  )

  const maxCarga = Math.max(...cargaTecnico.map(t => t.count), 1)

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function toggleStatus(status: string) {
    setStatusAberto(prev => prev === status ? null : status)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className={s.centralizado}>Carregando…</div>
  }

  return (
    <div className={s.dashboard}>

      {/* ── CARTÕES DE STATUS ─────────────────────────────────────── */}
      <div className={s.cards}>
        {STATUS_ORDEM.map(status => {
          const cfg = STATUS_COLOR[status]
          const count = contagemStatus[status] || 0
          const ativo = statusAberto === status
          return (
            <button
              key={status}
              className={`${s.card} ${ativo ? s.cardAtivo : ''}`}
              style={{ borderColor: ativo ? cfg.border : undefined }}
              onClick={() => toggleStatus(status)}
              aria-pressed={ativo}
            >
              <span className={s.cardNumero} style={{ color: cfg.num }}>
                {count}
              </span>
              <StatusBadge status={status} />
            </button>
          )
        })}
      </div>

      {/* ── LISTA EXPANDIDA POR STATUS ────────────────────────────── */}
      {statusAberto && (
        <div className={s.listaExpandida}>
          <div className={s.listaHeader}>
            <span>
              {ordensFiltradas.length} OS{ordensFiltradas.length !== 1 ? 's' : ''} com status{' '}
              <StatusBadge status={statusAberto} />
            </span>
            <button className={s.fecharLista} onClick={() => setStatusAberto(null)}>✕</button>
          </div>
          {ordensFiltradas.length === 0
            ? <p className={s.vazio}>Nenhuma OS encontrada.</p>
            : (
              <table className={s.tabela}>
                <thead>
                  <tr><th>#</th><th>Cliente</th><th>Técnico</th><th>Região</th><th></th></tr>
                </thead>
                <tbody>
                  {ordensFiltradas.map(os => (
                    <tr key={os.id}>
                      <td className={s.mono}>{os.id.slice(-6)}</td>
                      <td>{os.clienteId || '—'}</td>
                      <td>{tecnicosNomes[os.tecnicoId] || os.tecnicoId || '—'}</td>
                      <td className={s.mono}>{os.regiao || '—'}</td>
                      <td>
                        <button
                          className={s.btnLink}
                          onClick={() => navigate(`/ordens/${os.id}`)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* ── COLUNAS ───────────────────────────────────────────────── */}
      <div className={s.colunas}>

        {/* Carga por técnico */}
        <div className={s.secao}>
          <div className={s.secaoHeader}>Carga por técnico</div>
          {cargaTecnico.length === 0
            ? <p className={s.vazio}>Sem dados de carga.</p>
            : (
              <ul className={s.cargaLista}>
                {cargaTecnico.map(t => (
                  <li key={t.uid} className={s.cargaItem}>
                    <span className={s.cargaNome}>{t.nome}</span>
                    <div className={s.cargaBar}>
                      <div
                        className={s.cargaBarFill}
                        style={{ width: `${(t.count / maxCarga) * 100}%` }}
                      />
                    </div>
                    <span className={s.cargaCount}>{t.count}</span>
                  </li>
                ))}
              </ul>
            )
          }
        </div>

        {/* Alertas */}
        <div className={s.secao}>
          <div className={s.secaoHeader}>Alertas</div>

          {/* OSs antigas */}
          <div className={s.alerta}>
            <div className={s.alertaTitulo} style={{ color: '#92400e' }}>
              OSs abertas há +{ALERTA_DIAS_ABERTA} dias
              <span className={s.alertaBadge} style={{ background: '#fef3c7', color: '#92400e' }}>
                {osAntigas.length}
              </span>
            </div>
            {osAntigas.length === 0
              ? <p className={s.vazio}>Nenhuma OS antiga.</p>
              : (
                <ul className={s.alertaLista}>
                  {osAntigas.map(os => (
                    <li key={os.id} className={s.alertaItem}>
                      <div className={s.alertaInfo}>
                        <span className={s.alertaCliente}>{os.clienteId || '—'}</span>
                        <span className={s.alertaMeta}>
                          {tecnicosNomes[os.tecnicoId] || os.tecnicoId || 'sem técnico'} · {os.dias}d
                        </span>
                      </div>
                      <button
                        className={s.btnLink}
                        onClick={() => navigate(`/ordens/${os.id}`)}
                      >
                        Ver
                      </button>
                    </li>
                  ))}
                </ul>
              )
            }
          </div>

          {/* Confirmações pendentes */}
          <div className={`${s.alerta} ${s.alertaBorda}`}>
            <div className={s.alertaTitulo} style={{ color: 'var(--accent)' }}>
              {isGestor ? 'Devoluções a confirmar' : 'Envios a confirmar'}
              <span className={s.alertaBadge} style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                {movsPendentes.length}
              </span>
            </div>
            {movsPendentes.length === 0
              ? <p className={s.vazio}>Nenhuma confirmação pendente.</p>
              : (
                <div className={s.alertaFooter}>
                  <span className={s.alertaMeta}>
                    {movsPendentes.length} movimentaç{movsPendentes.length !== 1 ? 'ões' : 'ão'} aguardando
                  </span>
                  <Link to="/estoque" className={s.btnLink}>
                    Ver estoque →
                  </Link>
                </div>
              )
            }
          </div>

        </div>
      </div>
    </div>
  )
}
