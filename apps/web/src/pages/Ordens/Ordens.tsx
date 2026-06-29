import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import type { TipoOS } from '@flowops/types'
import { StatusBadge } from '../../components/StatusBadge/StatusBadge'
import c from '../../components/CrudPage/CrudPage.module.css'

// TODO: com alto volume, substituir por queries Firestore com índices compostos

interface OSItem {
  id: string
  numero?: number
  tipo: TipoOS
  status: string
  clienteId: string
  tecnicoId: string
  regiao: string
  dataAbertura?: { toDate(): Date }
  createdAt?: { toDate(): Date }
}

const TIPO_LABEL: Record<TipoOS, string> = {
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  emergencia: 'Emergência',
}

const cls = (c as Record<string, string>)

export function Ordens() {
  const { user, role, regiao } = useAuth()
  const [byTecnico, setByTecnico] = useState<Map<string, OSItem>>(new Map())
  const [byRegiao,  setByRegiao]  = useState<Map<string, OSItem>>(new Map())
  const [loading,   setLoading]   = useState(true)
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

  // Segunda query para técnico: OSs da mesma região (cross-region assignments)
  useEffect(() => {
    if (!isTecnico || !regiao) return
    const q = query(collection(db, 'ordens_servico'), where('regiao', '==', regiao))
    return onSnapshot(q,
      snap => {
        const m = new Map<string, OSItem>()
        snap.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() } as OSItem))
        setByRegiao(m)
      },
      () => {},
    )
  }, [isTecnico, regiao])

  const items = useMemo(() => {
    const merged = new Map<string, OSItem>([...byTecnico, ...byRegiao])
    return Array.from(merged.values()).sort((a, b) => {
      const ta = a.createdAt?.toDate().getTime() ?? a.dataAbertura?.toDate().getTime() ?? 0
      const tb = b.createdAt?.toDate().getTime() ?? b.dataAbertura?.toDate().getTime() ?? 0
      return tb - ta
    })
  }, [byTecnico, byRegiao])

  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <span className={c.contagem}>{items.length} {isTecnico ? 'OSs' : 'ordens'}</span>
        {!isTecnico && (
          <Link to="/ordens/nova" className={c.botaoNovo}>+ Nova OS</Link>
        )}
      </div>

      {loading && <p className={c.info}>Carregando…</p>}
      {!loading && items.length === 0 && (
        <p className={c.info}>
          {isTecnico ? 'Nenhuma OS atribuída a você no momento.' : 'Nenhuma OS encontrada.'}
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
                <th>Cliente</th>
                <th>Abertura</th>
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
                  <td className={c.mono}>
                    {os.numero ? `#${os.numero}` : <span className={c.pendente}>—</span>}
                  </td>
                  <td>
                    <span className={`${c.badge} ${cls[`badge_${os.tipo}`] ?? ''}`}>
                      {TIPO_LABEL[os.tipo] ?? os.tipo}
                    </span>
                  </td>
                  <td><StatusBadge status={os.status} /></td>
                  <td className={c.truncar}>{os.clienteId || '—'}</td>
                  <td>{os.dataAbertura?.toDate().toLocaleDateString('pt-BR') ?? '—'}</td>
                  <td>
                    {!isTecnico && (
                      <div className={c.acoes} onClick={e => e.stopPropagation()}>
                        <button
                          className={`${c.botaoAcao} ${c.botaoEditar}`}
                          onClick={() => navigate(`/ordens/${os.id}`)}
                        >
                          Editar
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
    </div>
  )
}
