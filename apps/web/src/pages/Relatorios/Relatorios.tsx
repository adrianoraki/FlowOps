import { useEffect, useMemo, useState } from 'react'
import {
  collection, doc, getDoc, getDocs,
  onSnapshot, query, where, Timestamp,
} from 'firebase/firestore'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from 'recharts'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { useEmpresa } from '../../lib/useEmpresa'
import { StatusBadge } from '../../components/StatusBadge/StatusBadge'
import s from './Relatorios.module.css'

// ─── Constantes ────────────────────────────────────────────────────────────────

const STATUS_ORDEM = ['aberta', 'em_andamento', 'aguardando_peca', 'concluida', 'cancelada'] as const

const STATUS_LABEL: Record<string, string> = {
  aberta:          'Aberta',
  em_andamento:    'Em andamento',
  aguardando_peca: 'Aguardando peça',
  concluida:       'Concluída',
  cancelada:       'Cancelada',
}

// Cores hardcoded porque recharts não lê variáveis CSS
const STATUS_CORES: Record<string, string> = {
  aberta:          '#fbbf24',
  em_andamento:    '#2563eb',
  aguardando_peca: '#f97316',
  concluida:       '#22c55e',
  cancelada:       '#9ca3af',
}

const TIPO_LABEL: Record<string, string> = {
  corretiva:  'Corretiva',
  preventiva: 'Preventiva',
  emergencia: 'Emergência',
}

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface Filtros {
  dataInicio: string
  dataFim:    string
  tecnicoId:  string
  regiao:     string
  parceiro:   string
  status:     string
  tipo:       string
}

interface OSItem {
  id:           string
  numero?:      number
  tipo:         string
  clienteId:    string
  regiao:       string
  tecnicoId:    string
  status:       string
  dataAbertura?: Timestamp
  createdAt?:   Timestamp
}

interface Ref { id: string; nome: string }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatarMes(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MESES[parseInt(m) - 1]}/${y.slice(2)}`
}

function exportarCSV(ordens: OSItem[], tecnicosMap: Record<string, string>) {
  const headers = ['Nº', 'Data', 'Cliente/Parceiro', 'Região', 'Técnico', 'Tipo', 'Status']
  const rows = ordens.map(os => [
    os.numero ?? '',
    os.dataAbertura instanceof Timestamp ? os.dataAbertura.toDate().toLocaleDateString('pt-BR') : '',
    os.clienteId || '',
    os.regiao || '',
    tecnicosMap[os.tecnicoId] || os.tecnicoId || '',
    TIPO_LABEL[os.tipo] || os.tipo || '',
    STATUS_LABEL[os.status] || os.status || '',
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `relatorio-os-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function Relatorios() {
  const { user, role } = useAuth()
  const { empresa } = useEmpresa()
  const isAdmin = role === 'admin'

  const [minhaRegiao, setMinhaRegiao] = useState<string | null>(isAdmin ? '' : null)
  const [ordens,    setOrdens]    = useState<OSItem[]>([])
  const [tecnicos,  setTecnicos]  = useState<Ref[]>([])
  const [regioes,   setRegioes]   = useState<Ref[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filtros,   setFiltros]   = useState<Filtros>({
    dataInicio: '', dataFim: '', tecnicoId: '',
    regiao: '', parceiro: '', status: '', tipo: '',
  })

  const tecnicosMap = useMemo(
    () => Object.fromEntries(tecnicos.map(t => [t.id, t.nome])),
    [tecnicos],
  )

  // Região do gestor
  useEffect(() => {
    if (!user || isAdmin) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const r = (snap.data()?.regiao as string) || ''
      setMinhaRegiao(r)
      setFiltros(prev => ({ ...prev, regiao: r }))
    })
  }, [user, isAdmin])

  // OSs em tempo real
  // TODO: com alto volume, migrar para queries Firestore com índices compostos em vez de filtrar no cliente
  useEffect(() => {
    if (!user || minhaRegiao === null) return
    const q = isAdmin
      ? collection(db, 'ordens_servico')
      : query(collection(db, 'ordens_servico'), where('regiao', '==', minhaRegiao))
    return onSnapshot(q,
      snap => {
        setOrdens(snap.docs.map(d => ({ id: d.id, ...d.data() }) as OSItem))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user?.uid, isAdmin, minhaRegiao])

  // Dados de referência (uma vez)
  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'tecnico')))
      .then(s => setTecnicos(s.docs.map(d => ({ id: d.id, nome: d.data().nome as string }))))
    getDocs(collection(db, 'regioes'))
      .then(s => setRegioes(s.docs.map(d => ({ id: d.id, nome: d.data().nome as string }))))
  }, [])

  // ─── Dados derivados ──────────────────────────────────────────────────────

  // TODO: com alto volume, substituir filtros cliente por query Firestore com índices compostos
  const ordensFiltradas = useMemo(() => ordens.filter(os => {
    if (filtros.status    && os.status    !== filtros.status)    return false
    if (filtros.tipo      && os.tipo      !== filtros.tipo)      return false
    if (filtros.tecnicoId && os.tecnicoId !== filtros.tecnicoId) return false
    if (filtros.regiao    && os.regiao    !== filtros.regiao)    return false
    if (filtros.parceiro  && !os.clienteId?.toLowerCase().includes(filtros.parceiro.toLowerCase())) return false
    const dt = os.dataAbertura instanceof Timestamp ? os.dataAbertura.toDate() : null
    if (filtros.dataInicio && dt && dt < new Date(filtros.dataInicio + 'T00:00:00')) return false
    if (filtros.dataFim    && dt && dt > new Date(filtros.dataFim    + 'T23:59:59')) return false
    return true
  }), [ordens, filtros])

  const resumoStatus = useMemo(() => {
    const r: Record<string, number> = {}
    STATUS_ORDEM.forEach(st => { r[st] = 0 })
    ordensFiltradas.forEach(os => { if (os.status in r) r[os.status]++ })
    return r
  }, [ordensFiltradas])

  const dadosTecnico = useMemo(() => {
    const mapa: Record<string, number> = {}
    ordensFiltradas.forEach(os => {
      const nome = tecnicosMap[os.tecnicoId] || 'Sem técnico'
      mapa[nome] = (mapa[nome] || 0) + 1
    })
    return Object.entries(mapa)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [ordensFiltradas, tecnicosMap])

  const dadosStatus = useMemo(() =>
    STATUS_ORDEM
      .filter(st => resumoStatus[st] > 0)
      .map(st => ({ name: st, label: STATUS_LABEL[st], value: resumoStatus[st] }))
  , [resumoStatus])

  const dadosMes = useMemo(() => {
    const mapa: Record<string, number> = {}
    ordensFiltradas.forEach(os => {
      const dt = os.dataAbertura instanceof Timestamp ? os.dataAbertura.toDate()
               : os.createdAt      instanceof Timestamp ? os.createdAt.toDate()
               : null
      if (!dt) return
      const chave = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      mapa[chave] = (mapa[chave] || 0) + 1
    })
    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, count]) => ({ mes: formatarMes(mes), count }))
  }, [ordensFiltradas])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function setF<K extends keyof Filtros>(k: K, v: string) {
    setFiltros(prev => ({ ...prev, [k]: v }))
  }

  function limparFiltros() {
    setFiltros(prev => ({
      dataInicio: '', dataFim: '', tecnicoId: '',
      regiao: isAdmin ? '' : prev.regiao,
      parceiro: '', status: '', tipo: '',
    }))
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <div className={s.centralizado}>Carregando dados…</div>

  return (
    <div className={s.pagina}>

      {/* Cabeçalho só para impressão */}
      <div className={s.printHeader}>
        <div className={s.printEmpresa}>{empresa.nomeEmpresa || 'FlowOps'}</div>
        <div>Relatório de Ordens de Serviço · Gerado em {new Date().toLocaleString('pt-BR')}</div>
      </div>

      {/* ── FILTROS ─────────────────────────────────────────────── */}
      <section className={`${s.secao} ${s.noPrint}`}>
        <div className={s.secaoHeader}>Filtros</div>
        <div className={s.filtros}>
          <div className={s.fg}>
            <label className={s.fl}>Data início</label>
            <input type="date" className={s.fi} value={filtros.dataInicio}
              onChange={e => setF('dataInicio', e.target.value)} />
          </div>
          <div className={s.fg}>
            <label className={s.fl}>Data fim</label>
            <input type="date" className={s.fi} value={filtros.dataFim}
              onChange={e => setF('dataFim', e.target.value)} />
          </div>
          <div className={s.fg}>
            <label className={s.fl}>Técnico</label>
            <select className={s.fi} value={filtros.tecnicoId}
              onChange={e => setF('tecnicoId', e.target.value)}>
              <option value="">Todos</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className={s.fg}>
            <label className={s.fl}>Região</label>
            {isAdmin
              ? (
                <select className={s.fi} value={filtros.regiao}
                  onChange={e => setF('regiao', e.target.value)}>
                  <option value="">Todas</option>
                  {regioes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              )
              : <input className={`${s.fi} ${s.fiReadonly}`} value={filtros.regiao} readOnly />
            }
          </div>
          <div className={s.fg}>
            <label className={s.fl}>Cliente/Parceiro</label>
            <input type="text" className={s.fi} placeholder="Buscar…" value={filtros.parceiro}
              onChange={e => setF('parceiro', e.target.value)} />
          </div>
          <div className={s.fg}>
            <label className={s.fl}>Status</label>
            <select className={s.fi} value={filtros.status}
              onChange={e => setF('status', e.target.value)}>
              <option value="">Todos</option>
              {STATUS_ORDEM.map(st => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
            </select>
          </div>
          <div className={s.fg}>
            <label className={s.fl}>Tipo</label>
            <select className={s.fi} value={filtros.tipo}
              onChange={e => setF('tipo', e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className={s.fg} style={{ alignSelf: 'flex-end' }}>
            <button className={s.btnLimpar} onClick={limparFiltros}>Limpar</button>
          </div>
        </div>
      </section>

      {/* ── RESUMO + EXPORTAÇÃO ─────────────────────────────────── */}
      <div className={s.resumoRow}>
        <div className={s.resumoCards}>
          <div className={s.resumoCard}>
            <span className={s.resumoNum}>{ordensFiltradas.length}</span>
            <span className={s.resumoRot}>Total de OSs</span>
          </div>
          {STATUS_ORDEM.filter(st => resumoStatus[st] > 0).map(st => (
            <div key={st} className={s.resumoCard}>
              <span className={s.resumoNum}>{resumoStatus[st]}</span>
              <StatusBadge status={st} />
            </div>
          ))}
        </div>
        <div className={`${s.exportBotoes} ${s.noPrint}`}>
          <button className={s.btnExport}
            onClick={() => exportarCSV(ordensFiltradas, tecnicosMap)}>
            ↓ CSV
          </button>
          <button className={s.btnExport} onClick={() => window.print()}>
            ↓ PDF (imprimir)
          </button>
        </div>
      </div>

      {/* ── GRÁFICOS ─────────────────────────────────────────────── */}
      <div className={`${s.graficos} ${s.noPrint}`}>

        {/* Bar: por técnico */}
        <div className={s.secao}>
          <div className={s.secaoHeader}>OSs por técnico</div>
          <div className={s.graficoWrap}>
            {dadosTecnico.length === 0
              ? <p className={s.vazio}>Sem dados.</p>
              : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={dadosTecnico} margin={{ top: 8, right: 8, left: -24, bottom: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 10, fill: '#6b7280' }}
                      angle={-38} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#eff6ff' }} />
                    <Bar dataKey="count" name="OSs" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

        {/* Donut: por status */}
        <div className={s.secao}>
          <div className={s.secaoHeader}>OSs por status</div>
          <div className={s.graficoWrap}>
            {dadosStatus.length === 0
              ? <p className={s.vazio}>Sem dados.</p>
              : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={dadosStatus} dataKey="value" nameKey="label"
                      cx="50%" cy="45%" innerRadius={52} outerRadius={82}>
                      {dadosStatus.map((e, i) => (
                        <Cell key={i} fill={STATUS_CORES[e.name] || '#9ca3af'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => [`${v} OSs`]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

        {/* Bar: por mês */}
        <div className={s.secao}>
          <div className={s.secaoHeader}>OSs por mês</div>
          <div className={s.graficoWrap}>
            {dadosMes.length === 0
              ? <p className={s.vazio}>Sem dados.</p>
              : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={dadosMes} margin={{ top: 8, right: 8, left: -24, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#eff6ff' }} />
                    <Bar dataKey="count" name="OSs" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

      </div>

      {/* ── TABELA ───────────────────────────────────────────────── */}
      <div className={s.secao}>
        <div className={s.secaoHeader}>
          Ordens de serviço — {ordensFiltradas.length} resultado{ordensFiltradas.length !== 1 ? 's' : ''}
        </div>
        {ordensFiltradas.length === 0
          ? <p className={s.vazio}>Nenhuma OS encontrada com os filtros aplicados.</p>
          : (
            <div className={s.tabelaScroll}>
              <table className={s.tabela}>
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Data</th>
                    <th>Cliente/Parceiro</th>
                    <th>Região</th>
                    <th>Técnico</th>
                    <th>Tipo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ordensFiltradas.map(os => (
                    <tr key={os.id}>
                      <td className={s.mono}>
                        {os.numero || <span className={s.muted}>—</span>}
                      </td>
                      <td className={s.mono}>
                        {os.dataAbertura instanceof Timestamp
                          ? os.dataAbertura.toDate().toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td>{os.clienteId || '—'}</td>
                      <td className={s.mono}>{os.regiao || '—'}</td>
                      <td>{tecnicosMap[os.tecnicoId] || os.tecnicoId || '—'}</td>
                      <td>{TIPO_LABEL[os.tipo] || os.tipo || '—'}</td>
                      <td><StatusBadge status={os.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

    </div>
  )
}
