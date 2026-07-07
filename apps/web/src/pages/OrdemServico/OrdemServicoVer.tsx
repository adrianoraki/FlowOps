import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { useEmpresa } from '../../lib/useEmpresa'
import { OrdemServicoDocumento, type OSDocumentoData } from './OrdemServicoDocumento'
import type { StatusOS, TipoOS, ItemPecaUsada } from '@flowops/types'
import s from './OrdemServicoVer.module.css'

interface OSRaw {
  numero?: number
  tipo: TipoOS
  parceiroNome: string
  lojaNumero?: string
  lojaNome: string
  cidade: string
  estado: string
  solicitante: string
  dataAbertura: Timestamp | null
  entrada: string
  saida: string
  tecnicoId: string
  atendimentos: OSDocumentoData['atendimentos']
  comentarios: string
  descricaoServicoRealizado: string
  solicitacaoMaterial: string
  pecasUsadas?: ItemPecaUsada[]
  assinaturaClienteUrl?: string
  nomeLegivel: string
  matriculaCliente: string
  assinaturaTecnicoUrl?: string
  assinaturaClienteBase64?: string
  assinaturaTecnicoBase64?: string
  rgTecnico: string
  status: StatusOS
}

export function OrdemServicoVer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const { empresa } = useEmpresa()
  const [docData, setDocData] = useState<OSDocumentoData | null>(null)
  const [status,      setStatus]      = useState<StatusOS | null>(null)
  const [tecnicoId,   setTecnicoId]   = useState('')
  const [entrada,     setEntrada]     = useState('')
  const [saida,       setSaida]       = useState('')
  const [temSigCli,   setTemSigCli]   = useState(false)
  const [temSigTec,   setTemSigTec]   = useState(false)
  const [salvando,    setSalvando]    = useState(false)
  const [erro,        setErro]        = useState('')
  const [loading,     setLoading]     = useState(true)

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

        setStatus(raw.status)
        setTecnicoId(raw.tecnicoId ?? '')
        setEntrada(raw.entrada ?? '')
        setSaida(raw.saida ?? '')
        setTemSigCli(!!(raw.assinaturaClienteBase64 || raw.assinaturaClienteUrl))
        setTemSigTec(!!(raw.assinaturaTecnicoBase64 || raw.assinaturaTecnicoUrl))

        setDocData({
          numero: raw.numero,
          tipo: raw.tipo,
          parceiroNome: raw.parceiroNome ?? '',
          lojaNumero: raw.lojaNumero ?? '',
          lojaNome: raw.lojaNome ?? '',
          cidade: raw.cidade ?? '',
          estado: raw.estado ?? '',
          solicitante: raw.solicitante ?? '',
          dataAbertura: raw.dataAbertura instanceof Timestamp ? raw.dataAbertura.toDate() : null,
          entrada: raw.entrada ?? '',
          saida: raw.saida ?? '',
          tecnicoNome,
          atendimentos: raw.atendimentos ?? [],
          comentarios: raw.comentarios ?? '',
          descricaoServicoRealizado: raw.descricaoServicoRealizado ?? '',
          solicitacaoMaterial: raw.solicitacaoMaterial ?? '',
          pecasUsadas: raw.pecasUsadas ?? [],
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

  const encerrada = status === 'concluida' || status === 'cancelada'
  const podeEditar = !encerrada && (
    role === 'admin' || role === 'gestor' ||
    (role === 'tecnico' && tecnicoId === user?.uid)
  )
  const podeIniciarFinalizar = !encerrada && (
    role === 'admin' || role === 'gestor' ||
    (role === 'tecnico' && tecnicoId === user?.uid)
  )

  function calcularTempo(e: string, s2: string): string {
    if (!e || !s2) return ''
    const [eh, em] = e.split(':').map(Number)
    const [sh, sm] = s2.split(':').map(Number)
    const total = (sh * 60 + sm) - (eh * 60 + em)
    if (total <= 0) return ''
    const h = Math.floor(total / 60), m = total % 60
    return h > 0 ? `${h}h ${m}min` : `${m}min`
  }

  async function iniciar() {
    if (!id || !user) return
    const agora = new Date()
    const hora = `${agora.getHours().toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'ordens_servico', id), {
        status: 'em_andamento',
        entrada: hora,
        updatedAt: serverTimestamp(),
        atualizadoPorId: user.uid,
      })
      setStatus('em_andamento')
      setEntrada(hora)
    } catch { /* ignore */ }
    finally { setSalvando(false) }
  }

  async function finalizar() {
    if (!temSigCli || !temSigTec) {
      alert('É necessário coletar as assinaturas antes de finalizar.')
      return
    }
    if (!window.confirm('Finalizar a OS? Ela não poderá mais ser editada.')) return
    const agora = new Date()
    const hora = `${agora.getHours().toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'ordens_servico', id!), {
        status: 'concluida',
        saida: hora,
        fechadaEm: serverTimestamp(),
        updatedAt: serverTimestamp(),
        atualizadoPorId: user?.uid ?? '',
      })
      setStatus('concluida')
      setSaida(hora)
    } catch { alert('Erro ao finalizar. Tente novamente.') }
    finally { setSalvando(false) }
  }

  if (loading) return <div className={s.centralizado}>Carregando…</div>
  if (erro || !docData) return <div className={s.centralizado}>{erro || 'OS não encontrada.'}</div>

  const tempo = calcularTempo(entrada, saida)

  return (
    <div className={s.pagina}>
      <div className={s.topo}>
        <button className={s.btnVoltar} onClick={() => navigate('/ordens')}>
          ← Voltar
        </button>
        <div className={s.acoes}>
          {/* Tempo total */}
          {entrada && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontFamily: 'monospace' }}>
              {entrada}{saida ? ` → ${saida}` : ''}{tempo ? ` · ${tempo}` : ''}
            </span>
          )}

          {/* Iniciar / Finalizar */}
          {podeIniciarFinalizar && status === 'aberta' && (
            <button className={s.btnEditar} onClick={iniciar} disabled={salvando}>
              {salvando ? 'Salvando…' : '▶ Iniciar'}
            </button>
          )}
          {podeIniciarFinalizar && status === 'em_andamento' && (
            <button
              className={s.btnImprimir}
              style={{ background: '#15803d' }}
              onClick={finalizar}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : '✓ Finalizar'}
            </button>
          )}

          {/* Editar / Somente leitura */}
          {podeEditar
            ? <button className={s.btnEditar} onClick={() => navigate(`/ordens/${id}`)}>Editar OS</button>
            : <span className={s.avisoLeitura}>Somente leitura</span>
          }
          <button className={s.btnImprimir} onClick={() => navigate(`/ordens/${id}/imprimir`)}>
            Imprimir
          </button>
        </div>
      </div>

      <div className={s.conteudo}>
        <OrdemServicoDocumento os={docData} empresa={empresa} />
      </div>
    </div>
  )
}
