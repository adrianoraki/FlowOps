import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import {
  normalizarAtendimentos, chamadoDoAtendimento, tipoDoAtendimento, resumoSpecs,
  type OrdemServico,
} from '@flowops/types'

// Histórico derivado das OSs já existentes — não depende de um cadastro prévio
// do parque de equipamentos. Um equipamento é identificado pelo número de série
// que o técnico digitou no atendimento; o que não tem série cai num grupo à parte
// por loja/tipo/modelo, para não sumir do relatório nem se misturar com os outros.

/** Um atendimento avulso, já achatado com os dados da OS que o contém. */
export interface AtendimentoHistorico {
  osId: string
  numero?: number
  data: Date | null
  status: string
  chamado: string
  tipoEquipamento: string
  modelo: string
  setor: string
  nSerie: string
  ficha: string
  lojaLabel: string
  tecnicoNome: string
  relatoCliente: string
  diagnostico: string
  servicoRealizado: string
}

export interface EquipamentoHistorico {
  chave: string
  nSerie: string
  tipoEquipamento: string
  modelo: string
  setor: string
  lojaLabel: string
  /** Do mais recente para o mais antigo. */
  atendimentos: AtendimentoHistorico[]
}

export interface OSHistorico {
  id: string
  numero?: number
  data: Date | null
  status: string
  tipo: string
  lojaLabel: string
  tecnicoNome: string
  qtdEquipamentos: number
}

interface OSDoc extends OrdemServico { id: string }

function labelLoja(os: Partial<OSDoc>): string {
  const numero = os.lojaNumero ? `${os.lojaNumero} - ` : ''
  return `${numero}${os.lojaNome ?? ''}`.trim() || '—'
}

export function useHistorico(parceiroId: string, lojaId: string) {
  const { user, role } = useAuth()
  const isAdmin   = role === 'admin'
  const isTecnico = role === 'tecnico'

  const [meusEstados, setMeusEstados] = useState<string[] | null>(isAdmin ? [] : null)
  const [ordens, setOrdens] = useState<OSDoc[]>([])
  const [tecnicos, setTecnicos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || isAdmin) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      setMeusEstados((snap.data()?.estados as string[]) ?? [])
    })
  }, [user, isAdmin])

  // A query segue o perfil, não o filtro de parceiro: as Security Rules recusam
  // uma listagem que possa devolver OS fora dos estados do gestor, então filtrar
  // por parceiro é feito no cliente (mesmo padrão de Relatorios.tsx e Mapa.tsx).
  useEffect(() => {
    if (!user) return
    if (isTecnico) {
      return onSnapshot(
        query(collection(db, 'ordens_servico'), where('tecnicoId', '==', user.uid)),
        snap => { setOrdens(snap.docs.map(d => ({ id: d.id, ...d.data() }) as OSDoc)); setLoading(false) },
        () => setLoading(false),
      )
    }
    if (meusEstados === null) return
    if (!isAdmin && meusEstados.length === 0) { setOrdens([]); setLoading(false); return }
    const q = isAdmin
      ? collection(db, 'ordens_servico')
      : query(collection(db, 'ordens_servico'), where('estado', 'in', meusEstados))
    return onSnapshot(q,
      snap => { setOrdens(snap.docs.map(d => ({ id: d.id, ...d.data() }) as OSDoc)); setLoading(false) },
      () => setLoading(false),
    )
  }, [user?.uid, isAdmin, isTecnico, meusEstados])

  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'tecnico')))
      .then(s => setTecnicos(Object.fromEntries(s.docs.map(d => [d.id, d.data().nome as string]))))
      .catch(() => setTecnicos({}))
  }, [])

  const doParceiro = useMemo(() => ordens.filter(os => {
    if (parceiroId && os.parceiroId !== parceiroId) return false
    if (lojaId && os.lojaId !== lojaId) return false
    return os.status !== 'cancelada' // OS cancelada não é histórico de manutenção
  }), [ordens, parceiroId, lojaId])

  const ordensCliente = useMemo<OSHistorico[]>(() => doParceiro
    .map(os => ({
      id: os.id,
      numero: os.numero,
      data: os.dataAbertura?.toDate?.() ?? null,
      status: os.status,
      tipo: os.tipo,
      lojaLabel: labelLoja(os),
      tecnicoNome: tecnicos[os.tecnicoId] ?? '',
      qtdEquipamentos: normalizarAtendimentos(os.atendimentos).length,
    }))
    .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0)),
  [doParceiro, tecnicos])

  const equipamentos = useMemo<EquipamentoHistorico[]>(() => {
    const grupos = new Map<string, EquipamentoHistorico>()
    for (const os of doParceiro) {
      const data = os.dataAbertura?.toDate?.() ?? null
      for (const at of normalizarAtendimentos(os.atendimentos)) {
        const serie = (at.nSerie ?? '').trim().toUpperCase()
        const tipo = tipoDoAtendimento(at)
        // Sem número de série não há como distinguir um equipamento de outro:
        // agrupa por loja/tipo/modelo e o rótulo diz que a série está faltando.
        const chave = serie || `sem-serie|${os.lojaId}|${tipo}|${at.modelo ?? ''}`
        let grupo = grupos.get(chave)
        if (!grupo) {
          grupo = {
            chave,
            nSerie: serie,
            tipoEquipamento: tipo,
            modelo: at.modelo ?? '',
            setor: at.setor ?? '',
            lojaLabel: labelLoja(os),
            atendimentos: [],
          }
          grupos.set(chave, grupo)
        }
        grupo.atendimentos.push({
          osId: os.id,
          numero: os.numero,
          data,
          status: os.status,
          chamado: chamadoDoAtendimento(os, at),
          tipoEquipamento: tipo,
          modelo: at.modelo ?? '',
          setor: at.setor ?? '',
          nSerie: at.nSerie ?? '',
          ficha: resumoSpecs(at),
          lojaLabel: labelLoja(os),
          tecnicoNome: tecnicos[os.tecnicoId] ?? '',
          relatoCliente: at.descricaoIntervencao ?? '',
          diagnostico: os.comentarios ?? '',
          servicoRealizado: os.descricaoServicoRealizado ?? '',
        })
      }
    }
    for (const g of grupos.values()) {
      g.atendimentos.sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))
    }
    return [...grupos.values()].sort((a, b) => {
      const porQtd = b.atendimentos.length - a.atendimentos.length
      return porQtd !== 0 ? porQtd : a.nSerie.localeCompare(b.nSerie)
    })
  }, [doParceiro, tecnicos])

  return { loading, equipamentos, ordensCliente }
}
