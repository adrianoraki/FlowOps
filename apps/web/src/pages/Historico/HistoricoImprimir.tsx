import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useEmpresa } from '../../lib/useEmpresa'
import { HistoricoDocumento } from './HistoricoDocumento'
import { useHistorico } from './useHistorico'
import s from './HistoricoImprimir.module.css'

// Rota fora do AppShell (igual a /ordens/:id/imprimir): sem menu lateral nem
// cabeçalho da aplicação, o @media print do documento cuida do resto.

export function HistoricoImprimir() {
  const [params] = useSearchParams()
  const parceiroId = params.get('parceiro') ?? ''
  const lojaId = params.get('loja') ?? ''
  const { empresa } = useEmpresa()

  const [parceiroNome, setParceiroNome] = useState('')
  const [lojaLabel, setLojaLabel] = useState('Todas as lojas')

  useEffect(() => {
    if (!parceiroId) return
    getDoc(doc(db, 'parceiros', parceiroId))
      .then(snap => setParceiroNome((snap.data()?.nome as string) ?? ''))
      .catch(() => setParceiroNome(''))
  }, [parceiroId])

  useEffect(() => {
    if (!lojaId) { setLojaLabel('Todas as lojas'); return }
    getDoc(doc(db, 'lojas', lojaId))
      .then(snap => {
        const d = snap.data()
        setLojaLabel(d ? `${d.numero ? d.numero + ' - ' : ''}${d.nome} — ${d.cidade}/${d.estado}` : '—')
      })
      .catch(() => setLojaLabel('—'))
  }, [lojaId])

  const { loading, equipamentos, ordensCliente } = useHistorico(parceiroId, lojaId)

  const dados = useMemo(
    () => ({ parceiroNome, lojaLabel, equipamentos, ordens: ordensCliente }),
    [parceiroNome, lojaLabel, equipamentos, ordensCliente],
  )

  return (
    <div className={s.pagina}>
      <div className={s.acoes}>
        <Link className={s.voltar} to="/historico">← Voltar</Link>
        <button type="button" className={s.imprimir} onClick={() => window.print()} disabled={loading}>
          Imprimir / Salvar PDF
        </button>
      </div>
      {loading
        ? <p className={s.aviso}>Carregando…</p>
        : <HistoricoDocumento dados={dados} empresa={empresa ?? undefined} />}
    </div>
  )
}
