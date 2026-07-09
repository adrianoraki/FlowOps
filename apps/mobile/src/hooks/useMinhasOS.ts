import { useEffect, useMemo, useRef, useState } from 'react'
import firestore from '@react-native-firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { STATUS_ATIVOS, STATUS_AGUARDANDO_PECA, STATUS_HISTORICO } from '@flowops/types'
import { useAuth } from '../context/AuthContext'
import { computeSyncStatus, type SyncStatus } from '../utils/syncStatus'

interface SnapshotMeta {
  fromCache: boolean
  hasPendingWrites: boolean
}

const SEEN_KEY = '@flowops/seenOSIds'
const SEEN_TABS_KEY = '@flowops/seenTabIds'

export type Aba = 'ativas' | 'aguardando' | 'historico'
const ABAS: Aba[] = ['ativas', 'aguardando', 'historico']

export interface OSItem {
  id: string
  numero?: number
  tipo: string
  status: string
  parceiroNome: string
  lojaNumero?: string
  lojaNome: string
  estado: string
  tecnicoId: string
  createdAt: { toDate(): Date } | null
  dataAbertura: { toDate(): Date } | null
  fechadaEm: { toDate(): Date } | null
  aguardandoPecaDesde: { toDate(): Date } | null
}

export function useMinhasOS() {
  const { user, estados } = useAuth()
  const uid = user?.uid ?? ''

  const [byTecnico, setByTecnico] = useState<Map<string, OSItem>>(new Map())
  const [byEstado,  setByEstado]  = useState<Map<string, OSItem>>(new Map())
  const [seenIds,   setSeenIds]   = useState<Set<string>>(new Set())
  const [seenTabIds, setSeenTabIds] = useState<Record<Aba, Set<string>> | null>(null)
  const [loadingSeenTabs, setLoadingSeenTabs] = useState(true)
  const [loadingSeen,   setLoadingSeen]   = useState(true)
  const [loadingOrdens, setLoadingOrdens] = useState(true)
  const [hasNewArrived, setHasNewArrived] = useState(false)
  const [metaTecnico, setMetaTecnico] = useState<SnapshotMeta | null>(null)
  const [metaEstado,  setMetaEstado]  = useState<SnapshotMeta | null>(null)

  // null = nenhuma snapshot recebida ainda (used to skip notification na carga inicial)
  const prevIds = useRef<Set<string> | null>(null)

  // ── Carregar IDs já vistos do AsyncStorage ──────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then(val => setSeenIds(val ? new Set<string>(JSON.parse(val) as string[]) : new Set()))
      .catch(() => setSeenIds(new Set()))
      .finally(() => setLoadingSeen(false))
  }, [])

  // ── Carregar, por aba, quais OSs já foram vistas (indicador de novidade na aba) ─
  useEffect(() => {
    AsyncStorage.getItem(SEEN_TABS_KEY)
      .then(val => {
        if (!val) { setSeenTabIds(null); return }
        const parsed = JSON.parse(val) as Record<Aba, string[]>
        setSeenTabIds({
          ativas:     new Set(parsed.ativas ?? []),
          aguardando: new Set(parsed.aguardando ?? []),
          historico:  new Set(parsed.historico ?? []),
        })
      })
      .catch(() => setSeenTabIds(null))
      .finally(() => setLoadingSeenTabs(false))
  }, [])

  // ── Ordens mescladas + ordenadas por createdAt desc ──────────────────────
  const ordens = useMemo(() => {
    const merged = new Map<string, OSItem>([...byTecnico, ...byEstado])
    return Array.from(merged.values()).sort((a, b) => {
      const ta = a.createdAt?.toDate().getTime() ?? 0
      const tb = b.createdAt?.toDate().getTime() ?? 0
      return tb - ta
    })
  }, [byTecnico, byEstado])

  // ── Detectar novas OSs e disparar feedback ───────────────────────────────
  useEffect(() => {
    if (loadingSeen) return // espera o AsyncStorage

    const currentIds = new Set(ordens.map(o => o.id))

    if (prevIds.current === null) {
      // Primeira snapshot após carga do AsyncStorage
      // Se o usuário ainda não tem histórico de vistos, inicializar com as OSs atuais
      // para não notificar sobre OSs pré-existentes
      if (seenIds.size === 0 && currentIds.size > 0) {
        setSeenIds(currentIds)
        AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...currentIds])).catch(() => {})
      }
      prevIds.current = currentIds
      return
    }

    // Snapshots subsequentes: detectar chegadas reais
    const arrived = [...currentIds].filter(id => !prevIds.current!.has(id))
    if (arrived.length > 0) {
      setHasNewArrived(true)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }
    prevIds.current = currentIds
  }, [ordens, loadingSeen]) // seenIds intencionalmente fora para evitar loop

  // Auto-dismiss do toast após 4 s
  useEffect(() => {
    if (!hasNewArrived) return
    const t = setTimeout(() => setHasNewArrived(false), 4000)
    return () => clearTimeout(t)
  }, [hasNewArrived])

  // ── Query por tecnicoId ──────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return
    const unsub = firestore()
      .collection('ordens_servico')
      .where('tecnicoId', '==', uid)
      .onSnapshot(
        { includeMetadataChanges: true },
        snap => {
          const m = new Map<string, OSItem>()
          snap.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() } as OSItem))
          setByTecnico(m)
          setMetaTecnico({ fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites })
          setLoadingOrdens(false)
        },
        () => setLoadingOrdens(false),
      )
    return unsub
  }, [uid])

  // ── Query por estado (OSs dos estados cobertos, mesmo que não atribuídas ao técnico) ─
  useEffect(() => {
    if (estados.length === 0) return
    const unsub = firestore()
      .collection('ordens_servico')
      .where('estado', 'in', estados)
      .onSnapshot(
        { includeMetadataChanges: true },
        snap => {
          const m = new Map<string, OSItem>()
          snap.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() } as OSItem))
          setByEstado(m)
          setMetaEstado({ fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites })
        },
        () => {},
      )
    return unsub
  }, [estados])

  // ── Status de conexão/sincronização (derivado dos metadados do onSnapshot) ─
  const syncStatus: SyncStatus = useMemo(
    () => computeSyncStatus([metaTecnico, metaEstado]),
    [metaTecnico, metaEstado],
  )

  // ── IDs não vistos pelo usuário ──────────────────────────────────────────
  const newIds = useMemo(
    () => new Set(ordens.map(o => o.id).filter(id => !seenIds.has(id))),
    [ordens, seenIds],
  )

  // ── Ativas (aberta/em_andamento), Aguardando Peça e Histórico (concluida/cancelada) ─
  const ativas = useMemo(
    () => ordens.filter(o => (STATUS_ATIVOS as string[]).includes(o.status)),
    [ordens],
  )
  const aguardando = useMemo(() => {
    return ordens
      .filter(o => (STATUS_AGUARDANDO_PECA as string[]).includes(o.status))
      .sort((a, b) => {
        const ta = a.aguardandoPecaDesde?.toDate().getTime() ?? 0
        const tb = b.aguardandoPecaDesde?.toDate().getTime() ?? 0
        return tb - ta
      })
  }, [ordens])
  const historico = useMemo(() => {
    return ordens
      .filter(o => (STATUS_HISTORICO as string[]).includes(o.status))
      .sort((a, b) => {
        const ta = a.fechadaEm?.toDate().getTime() ?? a.createdAt?.toDate().getTime() ?? 0
        const tb = b.fechadaEm?.toDate().getTime() ?? b.createdAt?.toDate().getTime() ?? 0
        return tb - ta
      })
  }, [ordens])

  function markSeen(id: string) {
    const next = new Set([...seenIds, id])
    setSeenIds(next)
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...next])).catch(() => {})
  }

  // ── Indicador de novidade por aba (Ativas / Aguardando Peça / Histórico) ──
  //
  // Independente do `seenIds` acima (que é por OS individual, usado no card
  // "NOVA" e no toast). Aqui o que importa é: essa OS já apareceu nessa aba
  // enquanto o técnico estava olhando pra ela? Uma OS que muda de status
  // (ex: em_andamento -> aguardando_peca) conta como novidade na aba nova,
  // mesmo já tendo sido vista antes em outra aba.
  const listasPorAba: Record<Aba, OSItem[]> = { ativas, aguardando, historico }

  // Primeira vez que o app roda (nada gravado ainda): marca o estado atual de
  // cada aba como visto, pra não notificar sobre OSs pré-existentes.
  useEffect(() => {
    if (loadingOrdens || loadingSeenTabs || seenTabIds !== null) return
    const inicial = {} as Record<Aba, Set<string>>
    for (const a of ABAS) inicial[a] = new Set(listasPorAba[a].map(o => o.id))
    setSeenTabIds(inicial)
    AsyncStorage.setItem(
      SEEN_TABS_KEY,
      JSON.stringify({ ativas: [...inicial.ativas], aguardando: [...inicial.aguardando], historico: [...inicial.historico] }),
    ).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingOrdens, loadingSeenTabs, seenTabIds])

  const novidadePorAba: Record<Aba, boolean> = useMemo(() => {
    const vazio = { ativas: false, aguardando: false, historico: false }
    if (!seenTabIds) return vazio
    const resultado = { ...vazio }
    for (const a of ABAS) {
      resultado[a] = listasPorAba[a].some(o => !seenTabIds[a].has(o.id))
    }
    return resultado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seenTabIds, ativas, aguardando, historico])

  // Chamar ao abrir/permanecer numa aba: apaga o indicador dela. Sobrescreve
  // com o conjunto atual (em vez de só somar), então uma OS que sai da aba
  // não fica "presa" no set pra sempre.
  function marcarAbaVista(aba: Aba) {
    if (!seenTabIds) return
    const atuais = new Set(listasPorAba[aba].map(o => o.id))
    const jaIguais = atuais.size === seenTabIds[aba].size && [...atuais].every(id => seenTabIds[aba].has(id))
    if (jaIguais) return
    const next = { ...seenTabIds, [aba]: atuais }
    setSeenTabIds(next)
    AsyncStorage.setItem(
      SEEN_TABS_KEY,
      JSON.stringify({ ativas: [...next.ativas], aguardando: [...next.aguardando], historico: [...next.historico] }),
    ).catch(() => {})
  }

  return {
    ordens,
    ativas,
    aguardando,
    historico,
    newIds,
    hasNewArrived,
    novidadePorAba,
    marcarAbaVista,
    loading: loadingOrdens,
    markSeen,
    syncStatus,
  }
}
