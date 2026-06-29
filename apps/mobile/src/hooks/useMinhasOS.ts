import { useEffect, useMemo, useRef, useState } from 'react'
import firestore from '@react-native-firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../context/AuthContext'

const SEEN_KEY = '@flowops/seenOSIds'

export interface OSItem {
  id: string
  tipo: string
  status: string
  clienteId: string
  regiao: string
  tecnicoId: string
  createdAt: { toDate(): Date } | null
  dataAbertura: { toDate(): Date } | null
}

export function useMinhasOS() {
  const { user, regiao } = useAuth()
  const uid = user?.uid ?? ''

  const [byTecnico, setByTecnico] = useState<Map<string, OSItem>>(new Map())
  const [byRegiao,  setByRegiao]  = useState<Map<string, OSItem>>(new Map())
  const [seenIds,   setSeenIds]   = useState<Set<string>>(new Set())
  const [loadingSeen,   setLoadingSeen]   = useState(true)
  const [loadingOrdens, setLoadingOrdens] = useState(true)
  const [hasNewArrived, setHasNewArrived] = useState(false)

  // null = nenhuma snapshot recebida ainda (used to skip notification na carga inicial)
  const prevIds = useRef<Set<string> | null>(null)

  // ── Carregar IDs já vistos do AsyncStorage ──────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then(val => setSeenIds(val ? new Set<string>(JSON.parse(val) as string[]) : new Set()))
      .catch(() => setSeenIds(new Set()))
      .finally(() => setLoadingSeen(false))
  }, [])

  // ── Ordens mescladas + ordenadas por createdAt desc ──────────────────────
  const ordens = useMemo(() => {
    const merged = new Map<string, OSItem>([...byTecnico, ...byRegiao])
    return Array.from(merged.values()).sort((a, b) => {
      const ta = a.createdAt?.toDate().getTime() ?? 0
      const tb = b.createdAt?.toDate().getTime() ?? 0
      return tb - ta
    })
  }, [byTecnico, byRegiao])

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
        snap => {
          const m = new Map<string, OSItem>()
          snap.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() } as OSItem))
          setByTecnico(m)
          setLoadingOrdens(false)
        },
        () => setLoadingOrdens(false),
      )
    return unsub
  }, [uid])

  // ── Query por regiao (OSs da região mesmo que não atribuídas ao técnico) ─
  useEffect(() => {
    if (!regiao) return
    const unsub = firestore()
      .collection('ordens_servico')
      .where('regiao', '==', regiao)
      .onSnapshot(
        snap => {
          const m = new Map<string, OSItem>()
          snap.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() } as OSItem))
          setByRegiao(m)
        },
        () => {},
      )
    return unsub
  }, [regiao])

  // ── IDs não vistos pelo usuário ──────────────────────────────────────────
  const newIds = useMemo(
    () => new Set(ordens.map(o => o.id).filter(id => !seenIds.has(id))),
    [ordens, seenIds],
  )

  function markSeen(id: string) {
    const next = new Set([...seenIds, id])
    setSeenIds(next)
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...next])).catch(() => {})
  }

  return {
    ordens,
    newIds,
    hasNewArrived,
    loading: loadingOrdens,
    markSeen,
  }
}
