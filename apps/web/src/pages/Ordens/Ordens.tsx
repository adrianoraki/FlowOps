import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { TipoOS } from '@flowops/types'
import { StatusBadge } from '../../components/StatusBadge/StatusBadge'
import c from '../../components/CrudPage/CrudPage.module.css'

interface OSItem {
  id: string
  numero?: number
  tipo: TipoOS
  status: string
  clienteId: string
  dataAbertura?: { toDate(): Date }
}

const TIPO_LABEL: Record<TipoOS, string> = {
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  emergencia: 'Emergência',
}

const cls = (c as Record<string, string>)

export function Ordens() {
  const [items, setItems] = useState<OSItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const q = query(collection(db, 'ordens_servico'), orderBy('createdAt', 'desc'))
    return onSnapshot(q,
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as OSItem))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <span className={c.contagem}>{items.length} ordens</span>
        <Link to="/ordens/nova" className={c.botaoNovo}>+ Nova OS</Link>
      </div>

      {loading && <p className={c.info}>Carregando…</p>}
      {!loading && items.length === 0 && <p className={c.info}>Nenhuma OS encontrada.</p>}
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
                    <div className={c.acoes} onClick={e => e.stopPropagation()}>
                      <button
                        className={`${c.botaoAcao} ${c.botaoEditar}`}
                        onClick={() => navigate(`/ordens/${os.id}`)}
                      >
                        Editar
                      </button>
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
