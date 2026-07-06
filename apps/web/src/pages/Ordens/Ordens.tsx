import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { STATUS_ATIVOS, STATUS_HISTORICO, formatarNumeroOS, type TipoOS } from '@flowops/types'
import { StatusBadge } from '../../components/StatusBadge/StatusBadge'
import c from '../../components/CrudPage/CrudPage.module.css'
import ab from './Ordens.module.css'

// TODO: com alto volume, substituir por queries Firestore com índices compostos

type Aba = 'ativas' | 'historico'

interface OSItem {
  id: string
  numero?: number
  tipo: TipoOS
  status: string
  parceiroNome: string
  lojaNumero?: string
  lojaNome: string
  tecnicoId: string
  estado: string
  dataAbertura?: { toDate(): Date }
  createdAt?: { toDate(): Date }
  fechadaEm?: { toDate(): Date }
}

const TIPO_LABEL: Record<TipoOS, string> = {
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  emergencia: 'Emergência',
}

const cls = (c as Record<string, string>)

export function Ordens() {
  const { user, role, estados } = useAuth()
  const [byTecnico, setByTecnico] = useState<Map<string, OSItem>>(new Map())
  const [byEstado,  setByEstado]  = useState<Map<string, OSItem>>(new Map())
  const [loading,   setLoading]   = useState(true)
  const [aba,       setAba]       = useState<Aba>('ativas')
  const navigate = useNavigate()

  const isTecnico = role === 'tecnico'

  // Query principal: tudo (admin/gestor) ou por tecnicoId (técnico)
  useEffect(() => {
    if (!user) return
    const q = isTecnico
      ? query(collection(db, 'ordens_servico'), where('tecnicoId', '==', user.uid))
      : query(collection(db, 'ordens_servico'), orderBy('createdAt', 'desc'))
    return onSnapshot(q,
      snap => {
        const m = new Map<string, OSItem>()
        snap.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() } as OSItem))
        setByTecnico(m)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user?.uid, isTecnico])

  // Segunda query para técnico: OSs dos estados que ele cobre (cross-estado)
  useEffect(() => {
    if (!isTecnico || estados.length === 0) return
    const q = query(collection(db, 'ordens_servico'), where('estado', 'in', estados))
    return onSnapshot(q,
      snap => {
        const m = new Map<string, OSItem>()
        snap.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() } as OSItem))
        setByEstado(m)
      },
      () => {},
    )
  }, [isTecnico, estados])

  const todas = useMemo(() => {
    const merged = new Map<string, OSItem>([...byTecnico, ...byEstado])
    return Array.from(merged.values())
  }, [byTecnico, byEstado])

  const ativas = useMemo(() => {
    return todas
      .filter(os => (STATUS_ATIVOS as string[]).includes(os.status))
      .sort((a, b) => {
        const ta = a.createdAt?.toDate().getTime() ?? a.dataAbertura?.toDate().getTime() ?? 0
        const tb = b.createdAt?.toDate().getTime() ?? b.dataAbertura?.toDate().getTime() ?? 0
        return tb - ta
      })
  }, [todas])

  const historico = useMemo(() => {
    return todas
      .filter(os => (STATUS_HISTORICO as string[]).includes(os.status))
      .sort((a, b) => {
        const ta = a.fechadaEm?.toDate().getTime() ?? a.createdAt?.toDate().getTime() ?? 0
        const tb = b.fechadaEm?.toDate().getTime() ?? b.createdAt?.toDate().getTime() ?? 0
        return tb - ta
      })
  }, [todas])

  const items = aba === 'ativas' ? ativas : historico

  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <span className={c.contagem}>{items.length} {isTecnico ? 'OSs' : 'ordens'}</span>
        {!isTecnico && (
          <Link to="/ordens/nova" className={c.botaoNovo}>+ Nova OS</Link>
        )}
      </div>

      <div className={ab.abas}>
        <button
          className={`${ab.aba} ${aba === 'ativas' ? ab.abaAtiva : ''}`}
          onClick={() => setAba('ativas')}
        >
          Ativas ({ativas.length})
        </button>
        <button
          className={`${ab.aba} ${aba === 'historico' ? ab.abaAtiva : ''}`}
          onClick={() => setAba('historico')}
        >
          Histórico ({historico.length})
        </button>
      </div>

      {loading && <p className={c.info}>Carregando…</p>}
      {!loading && items.length === 0 && (
        <p className={c.info}>
          {aba === 'historico'
            ? 'Nenhuma OS finalizada ainda.'
            : (isTecnico ? 'Nenhuma OS atribuída a você no momento.' : 'Nenhuma OS encontrada.')}
        </p>
      )}
      {!loading && items.length > 0 && (
        <div className={c.tabelaScroll}>
          <table className={c.tabela}>
            <thead>
              <tr>
                <th>Número</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Parceiro / Loja</th>
                <th>{aba === 'historico' ? 'Conclusão' : 'Abertura'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(os => (
                <tr
                  key={os.id}
                  onClick={() => navigate(`/ordens/${os.id}/ver`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className={c.mono}>{formatarNumeroOS(os.numero)}</td>
                  <td>
                    <span className={`${c.badge} ${cls[`badge_${os.tipo}`] ?? ''}`}>
                      {TIPO_LABEL[os.tipo] ?? os.tipo}
                    </span>
                  </td>
                  <td><StatusBadge status={os.status} /></td>
                  <td className={c.truncar}>{os.parceiroNome} — {os.lojaNumero ? `${os.lojaNumero} ` : ''}{os.lojaNome}</td>
                  <td>
                    {aba === 'historico'
                      ? (os.fechadaEm?.toDate().toLocaleDateString('pt-BR') ?? '—')
                      : (os.dataAbertura?.toDate().toLocaleDateString('pt-BR') ?? '—')}
                  </td>
                  <td>
                    <div className={c.acoes} onClick={e => e.stopPropagation()}>
                      {aba === 'historico' ? (
                        <button
                          className={`${c.botaoAcao} ${c.botaoEditar}`}
                          onClick={() => navigate(`/ordens/${os.id}/imprimir`)}
                        >
                          Imprimir
                        </button>
                      ) : !isTecnico && (
                        <button
                          className={`${c.botaoAcao} ${c.botaoEditar}`}
                          onClick={() => navigate(`/ordens/${os.id}`)}
                        >
                          Editar
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
    </div>
  )
}
