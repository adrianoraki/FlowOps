import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useEmpresa } from '../../lib/useEmpresa'
import { OrdemServicoDocumento, type OSDocumentoData } from './OrdemServicoDocumento'
import type { TipoOS } from '@flowops/types'
import s from './OrdemServicoImprimir.module.css'

interface OSRaw {
  numero?: number
  tipo: TipoOS
  clienteId: string
  cidade: string
  estado: string
  loja: string
  veiculo: string
  dataAbertura: Timestamp | null
  entrada: string
  saida: string
  tecnicoId: string
  atendimentos: OSDocumentoData['atendimentos']
  comentarios: string
  solicitacaoMaterial: string
  assinaturaClienteUrl?: string
  nomeLegivel: string
  matriculaCliente: string
  assinaturaTecnicoUrl?: string
  assinaturaClienteBase64?: string
  assinaturaTecnicoBase64?: string
  rgTecnico: string
}

export function OrdemServicoImprimir() {
  const { id } = useParams<{ id: string }>()
  const { empresa } = useEmpresa()
  const [docData,   setDocData]  = useState<OSDocumentoData | null>(null)
  const [erro,      setErro]     = useState('')
  const [loading,   setLoading]  = useState(true)
  const [paisagem,  setPaisagem] = useState(false)

  function handlePrint() {
    if (paisagem) {
      const style = document.createElement('style')
      style.id = 'fo-print-orient'
      style.textContent = '@page { size: A4 landscape; margin: 10mm 15mm; }'
      document.head.appendChild(style)
      window.print()
      document.getElementById('fo-print-orient')?.remove()
    } else {
      window.print()
    }
  }

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'ordens_servico', id))
      .then(async snap => {
        if (!snap.exists()) { setErro('OS não encontrada.'); return }
        const raw = snap.data() as OSRaw

        let tecnicoNome = raw.tecnicoId ?? ''
        if (raw.tecnicoId) {
          try {
            const tSnap = await getDoc(doc(db, 'users', raw.tecnicoId))
            if (tSnap.exists()) tecnicoNome = (tSnap.data().nome as string) || tecnicoNome
          } catch { /* fallback ao ID */ }
        }

        setDocData({
          numero: raw.numero,
          tipo: raw.tipo,
          clienteId: raw.clienteId ?? '',
          cidade: raw.cidade ?? '',
          estado: raw.estado ?? '',
          loja: raw.loja ?? '',
          veiculo: raw.veiculo ?? '',
          dataAbertura: raw.dataAbertura instanceof Timestamp ? raw.dataAbertura.toDate() : null,
          entrada: raw.entrada ?? '',
          saida: raw.saida ?? '',
          tecnicoNome,
          atendimentos: raw.atendimentos ?? [],
          comentarios: raw.comentarios ?? '',
          solicitacaoMaterial: raw.solicitacaoMaterial ?? '',
          assinaturaClienteUrl:    raw.assinaturaClienteUrl,
          assinaturaClienteBase64: raw.assinaturaClienteBase64,
          nomeLegivel:             raw.nomeLegivel ?? '',
          matriculaCliente:        raw.matriculaCliente ?? '',
          assinaturaTecnicoUrl:    raw.assinaturaTecnicoUrl,
          assinaturaTecnicoBase64: raw.assinaturaTecnicoBase64,
          rgTecnico:               raw.rgTecnico ?? '',
        })
      })
      .catch(() => setErro('Erro ao carregar OS.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className={s.centralizado}>Carregando…</div>
  if (erro || !docData) return <div className={s.centralizado}>{erro || 'OS não encontrada.'}</div>

  return (
    <div className={s.pagina}>
      <div className={s.acoes}>
        <Link to={`/ordens/${id}/ver`} className={s.btnSecundario}>Visualizar</Link>
        <Link to={`/ordens/${id}`} className={s.btnSecundario}>Editar OS</Link>
        <button
          className={`${s.btnSecundario} ${paisagem ? s.btnOrientacaoAtivo : ''}`}
          onClick={() => setPaisagem(p => !p)}
          title="Alternar orientação"
        >
          {paisagem ? '↔ Paisagem' : '↕ Retrato'}
        </button>
        <button className={s.btnImprimir} onClick={handlePrint}>Imprimir</button>
      </div>
      <OrdemServicoDocumento os={docData} empresa={empresa} orientacao={paisagem ? 'paisagem' : 'retrato'} />
    </div>
  )
}
