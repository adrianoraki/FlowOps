import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useEmpresa } from '../../lib/useEmpresa'
import { HistoricoDocumento } from './HistoricoDocumento'
import { useHistorico } from './useHistorico'
import type { Parceiro, Loja } from '@flowops/types'
import s from './Historico.module.css'

// Histórico de manutenção por cliente e por equipamento, montado a partir das
// OSs já registradas — não depende de um cadastro prévio do parque. A mesma
// visão que o gestor vê é a que sai impressa/em PDF para enviar ao cliente
// (rota /historico/imprimir, fora do AppShell, mesmo padrão da OS).

export function Historico() {
  const { empresa } = useEmpresa()
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [lojas, setLojas] = useState<Loja[]>([])
  const [parceiroId, setParceiroId] = useState('')
  const [lojaId, setLojaId] = useState('')

  useEffect(() => {
    getDocs(collection(db, 'parceiros'))
      .then(s => setParceiros(s.docs
        .map(d => ({ id: d.id, ...d.data() }) as Parceiro)
        .sort((a, b) => a.nome.localeCompare(b.nome))))
      .catch(() => setParceiros([]))
  }, [])

  useEffect(() => {
    setLojaId('')
    if (!parceiroId) { setLojas([]); return }
    getDocs(query(collection(db, 'lojas'), where('parceiroId', '==', parceiroId)))
      .then(s => setLojas(s.docs.map(d => ({ id: d.id, ...d.data() }) as Loja)))
      .catch(() => setLojas([]))
  }, [parceiroId])

  const { loading, equipamentos, ordensCliente } = useHistorico(parceiroId, lojaId)

  const parceiroNome = parceiros.find(p => p.id === parceiroId)?.nome ?? ''
  const lojaLabel = useMemo(() => {
    if (!lojaId) return 'Todas as lojas'
    const l = lojas.find(x => x.id === lojaId)
    return l ? `${l.numero ? l.numero + ' - ' : ''}${l.nome} — ${l.cidade}/${l.estado}` : '—'
  }, [lojaId, lojas])

  const urlImprimir = `/historico/imprimir?parceiro=${encodeURIComponent(parceiroId)}`
    + `&loja=${encodeURIComponent(lojaId)}`

  return (
    <div className={s.pagina}>
      <div className={s.filtros}>
        <label className={s.filtro}>
          <span className={s.filtroLabel}>Cliente</span>
          <select className={s.select} value={parceiroId} onChange={e => setParceiroId(e.target.value)}>
            <option value="">Selecione um cliente</option>
            {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className={s.filtro}>
          <span className={s.filtroLabel}>Loja</span>
          <select className={s.select} value={lojaId} onChange={e => setLojaId(e.target.value)} disabled={!parceiroId}>
            <option value="">Todas as lojas</option>
            {lojas.map(l => (
              <option key={l.id} value={l.id}>
                {l.numero ? `${l.numero} - ` : ''}{l.nome} — {l.cidade}/{l.estado}
              </option>
            ))}
          </select>
        </label>
        {parceiroId && (
          <Link className={s.botaoImprimir} to={urlImprimir} target="_blank" rel="noopener">
            Imprimir / PDF
          </Link>
        )}
      </div>

      {!parceiroId && <p className={s.aviso}>Selecione um cliente para ver o histórico.</p>}
      {parceiroId && loading && <p className={s.aviso}>Carregando…</p>}
      {parceiroId && !loading && (
        <div className={s.documentoWrap}>
          <HistoricoDocumento
            dados={{ parceiroNome, lojaLabel, equipamentos, ordens: ordensCliente }}
            empresa={empresa ?? undefined}
          />
        </div>
      )}
    </div>
  )
}
