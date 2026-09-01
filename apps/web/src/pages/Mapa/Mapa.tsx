import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, LabelList, ResponsiveContainer,
} from 'recharts'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { MapaChamados, type PontoMapa } from '../../components/MapaChamados/MapaChamados'
import {
  coordenadaDaOS, criticidadeDaOS, formatarNumeroOS, regiaoDoEstado, REGIOES_BRASIL,
  type Criticidade, type OrdemServico, type Loja,
} from '@flowops/types'
import s from './Mapa.module.css'

// Cor única das bolhas: com 5 regiões nomeadas diretamente na bolha, a identidade
// vem do rótulo, não da cor — então uma paleta categórica de 5 tons só adicionaria
// ruído (e tons 4+ não passam nos limiares de daltonismo em gráficos de dispersão).
const COR_BOLHA = '#2a78d6'

const PERIODOS = [
  { id: '30',    label: 'Últimos 30 dias', dias: 30 },
  { id: '90',    label: 'Últimos 90 dias', dias: 90 },
  { id: 'todos', label: 'Todo o período',  dias: 0  },
] as const

type PeriodoId = typeof PERIODOS[number]['id']

interface OSMapa extends Pick<OrdemServico,
  'id' | 'numero' | 'status' | 'estado' | 'cidade' | 'regiao' | 'lojaId' |
  'lojaNome' | 'lojaNumero' | 'parceiroNome' | 'dataAbertura' | 'checkinGeo'> {
  atendimentos?: unknown[]
}

export function Mapa() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const isAdmin   = role === 'admin'
  const isTecnico = role === 'tecnico'

  const [meusEstados, setMeusEstados] = useState<string[] | null>(isAdmin ? [] : null)
  const [ordens, setOrdens] = useState<OSMapa[]>([])
  const [lojas,  setLojas]  = useState<Record<string, Loja>>({})
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<PeriodoId>('90')
  const [criticidadeFiltro, setCriticidadeFiltro] = useState<Criticidade | ''>('')

  // Estados cobertos — mesma lógica de Relatorios.tsx (gestor/técnico veem só o seu).
  useEffect(() => {
    if (!user || isAdmin) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      setMeusEstados((snap.data()?.estados as string[]) ?? [])
    })
  }, [user, isAdmin])

  // OSs em tempo real — admin: todas; gestor: dos estados que cobre; técnico: só as suas.
  useEffect(() => {
    if (!user) return
    if (isTecnico) {
      return onSnapshot(
        query(collection(db, 'ordens_servico'), where('tecnicoId', '==', user.uid)),
        snap => { setOrdens(snap.docs.map(d => ({ id: d.id, ...d.data() }) as OSMapa)); setLoading(false) },
        () => setLoading(false),
      )
    }
    if (meusEstados === null) return
    if (!isAdmin && meusEstados.length === 0) { setOrdens([]); setLoading(false); return }
    const q = isAdmin
      ? collection(db, 'ordens_servico')
      : query(collection(db, 'ordens_servico'), where('estado', 'in', meusEstados))
    return onSnapshot(q,
      snap => { setOrdens(snap.docs.map(d => ({ id: d.id, ...d.data() }) as OSMapa)); setLoading(false) },
      () => setLoading(false),
    )
  }, [user?.uid, isAdmin, isTecnico, meusEstados])

  // Lojas: só para o fallback de coordenada quando a OS não tem GPS de check-in.
  useEffect(() => {
    getDocs(collection(db, 'lojas')).then(snap => {
      setLojas(Object.fromEntries(snap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Loja])))
    }).catch(() => setLojas({}))
  }, [])

  const ordensFiltradas = useMemo(() => {
    const dias = PERIODOS.find(p => p.id === periodo)?.dias ?? 0
    const limite = dias > 0 ? Date.now() - dias * 86_400_000 : null
    return ordens.filter(os => {
      if (limite !== null) {
        const abertura = os.dataAbertura?.toDate?.()
        if (!abertura || abertura.getTime() < limite) return false
      }
      if (criticidadeFiltro && criticidadeDaOS(os) !== criticidadeFiltro) return false
      return true
    })
  }, [ordens, periodo, criticidadeFiltro])

  const pontos = useMemo<PontoMapa[]>(() => {
    const out: PontoMapa[] = []
    for (const os of ordensFiltradas) {
      const criticidade = criticidadeDaOS(os)
      if (!criticidade) continue // OS cancelada não entra no semáforo
      const coord = coordenadaDaOS(os, os.lojaId ? lojas[os.lojaId] : null)
      if (!coord) continue       // sem UF conhecida não há onde plotar
      const qtd = os.atendimentos?.length ?? 0
      out.push({
        id: os.id,
        lat: coord.lat,
        lng: coord.lng,
        fonte: coord.fonte,
        criticidade,
        titulo: `OS ${formatarNumeroOS(os.numero)}`,
        linhas: [
          `${os.parceiroNome ?? ''} — ${os.lojaNumero ? os.lojaNumero + ' ' : ''}${os.lojaNome ?? ''}`.trim(),
          `${os.cidade ?? ''}/${os.estado ?? ''}`,
          `${qtd} ${qtd === 1 ? 'equipamento' : 'equipamentos'}`,
        ].filter(l => l && l !== '/'),
      })
    }
    return out
  }, [ordensFiltradas, lojas])

  // Agregado por região para o gráfico de bolha.
  const porRegiao = useMemo(() => {
    const base = REGIOES_BRASIL.map(r => ({ regiao: r.nome, os: 0, equipamentos: 0 }))
    const idx = Object.fromEntries(base.map((b, i) => [b.regiao, i]))
    for (const os of ordensFiltradas) {
      const nome = os.regiao || regiaoDoEstado(os.estado)
      const i = nome ? idx[nome] : undefined
      if (i === undefined) continue
      base[i].os += 1
      base[i].equipamentos += os.atendimentos?.length ?? 0
    }
    return base
      .filter(b => b.os > 0)
      .map(b => ({ ...b, media: +(b.equipamentos / b.os).toFixed(2) }))
  }, [ordensFiltradas])

  if (loading) return <p className={s.aviso}>Carregando…</p>

  return (
    <div className={s.pagina}>
      <div className={s.filtros}>
        <label className={s.filtro}>
          <span className={s.filtroLabel}>Período</span>
          <select className={s.select} value={periodo} onChange={e => setPeriodo(e.target.value as PeriodoId)}>
            {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className={s.filtro}>
          <span className={s.filtroLabel}>Situação</span>
          <select
            className={s.select}
            value={criticidadeFiltro}
            onChange={e => setCriticidadeFiltro(e.target.value as Criticidade | '')}
          >
            <option value="">Todas</option>
            <option value="verde">Concluídas</option>
            <option value="amarelo">Em aberto no prazo</option>
            <option value="vermelho">Atrasadas ou aguardando peça</option>
          </select>
        </label>
        <span className={s.contador}>
          {pontos.length} {pontos.length === 1 ? 'chamado' : 'chamados'} no mapa
        </span>
      </div>

      <section className={s.bloco}>
        <h2 className={s.titulo}>Chamados no mapa</h2>
        {pontos.length === 0
          ? <p className={s.aviso}>Nenhum chamado no período e situação selecionados.</p>
          : <MapaChamados pontos={pontos} onSelecionar={id => navigate(`/ordens/${id}/ver`)} />}
      </section>

      <section className={s.bloco}>
        <h2 className={s.titulo}>Atendimentos por região</h2>
        <p className={s.subtitulo}>
          Cada bolha é uma região. Posição horizontal: quantas OS. Posição vertical: quantos
          equipamentos por OS, em média. Tamanho da bolha: total de equipamentos atendidos.
        </p>
        {porRegiao.length === 0
          ? <p className={s.aviso}>Sem dados no período selecionado.</p>
          : (
            <>
              <div className={s.grafico}>
                <ResponsiveContainer width="100%" height={330}>
                  <ScatterChart margin={{ top: 24, right: 40, bottom: 40, left: 8 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                    <XAxis
                      type="number" dataKey="os" name="OS"
                      tick={{ fontSize: 12, fill: '#52514e' }}
                      stroke="#d1d5db" allowDecimals={false}
                      label={{ value: 'Ordens de serviço', position: 'insideBottom', offset: -18, fontSize: 12, fill: '#52514e' }}
                    />
                    <YAxis
                      type="number" dataKey="media" name="Equipamentos por OS"
                      tick={{ fontSize: 12, fill: '#52514e' }}
                      stroke="#d1d5db"
                      label={{ value: 'Equip./OS', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#52514e' }}
                    />
                    <ZAxis type="number" dataKey="equipamentos" range={[220, 1500]} name="Equipamentos" />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as typeof porRegiao[number]
                        return (
                          <div className={s.tooltip}>
                            <strong>{d.regiao}</strong>
                            <div>{d.os} {d.os === 1 ? 'OS' : 'OSs'}</div>
                            <div>{d.equipamentos} equipamentos</div>
                            <div>{d.media} por OS (média)</div>
                          </div>
                        )
                      }}
                    />
                    <Scatter data={porRegiao} fill={COR_BOLHA} fillOpacity={0.7} stroke="#ffffff" strokeWidth={2}>
                      {/* Rótulo direto em cada bolha: são só 5, e é o rótulo — não a cor —
                          que identifica a região (paleta única, ver COR_BOLHA). */}
                      <LabelList dataKey="regiao" position="top" style={{ fontSize: 12, fill: '#0b0b0b' }} />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <table className={s.tabela}>
                <caption className={s.tabelaCaption}>Mesmos dados em números</caption>
                <thead>
                  <tr><th>Região</th><th>Ordens</th><th>Equipamentos</th><th>Média por OS</th></tr>
                </thead>
                <tbody>
                  {porRegiao.map(r => (
                    <tr key={r.regiao}>
                      <td>{r.regiao}</td>
                      <td className={s.num}>{r.os}</td>
                      <td className={s.num}>{r.equipamentos}</td>
                      <td className={s.num}>{r.media}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
      </section>
    </div>
  )
}
