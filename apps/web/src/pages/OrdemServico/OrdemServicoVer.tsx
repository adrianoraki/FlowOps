import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { useEmpresa } from '../../lib/useEmpresa'
import { OrdemServicoDocumento, type OSDocumentoData } from './OrdemServicoDocumento'
import { SlideOver } from '../../components/SlideOver/SlideOver'
import { normalizarAtendimentos, formatarDataHora, calcularTempoTotal, paraDatetimeLocal, type StatusOS, type TipoOS, type ItemPecaUsada } from '@flowops/types'
import s from './OrdemServicoVer.module.css'
import c from '../../components/CrudPage/CrudPage.module.css'

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
  aguardandoPecaDesde?: Timestamp
}

export function OrdemServicoVer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const { empresa } = useEmpresa()
  const [docData, setDocData] = useState<OSDocumentoData | null>(null)
  const [status,      setStatus]      = useState<StatusOS | null>(null)
  const [aguardandoPecaDesde, setAguardandoPecaDesde] = useState<Date | null>(null)
  const [tecnicoId,   setTecnicoId]   = useState('')
  const [entrada,     setEntrada]     = useState('')
  const [saida,       setSaida]       = useState('')
  const [temSigCli,   setTemSigCli]   = useState(false)
  const [temSigTec,   setTemSigTec]   = useState(false)
  const [salvando,    setSalvando]    = useState(false)
  const [erro,        setErro]        = useState('')
  const [loading,     setLoading]     = useState(true)
  const [finalizarAberto, setFinalizarAberto] = useState(false)
  const [dataFinalizacaoInput, setDataFinalizacaoInput] = useState('')

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'ordens_servico', id))
      .then(async snap => {
        if (!snap.exists()) { setErro('OS não encontrada.'); return }
        const raw = snap.data() as OSRaw

        let tecnicoNome = raw.tecnicoId ?? ''
        let regInmetroTecnico = ''
        let cpfTecnico = ''
        if (raw.tecnicoId) {
          try {
            const tSnap = await getDoc(doc(db, 'users', raw.tecnicoId))
            if (tSnap.exists()) {
              const tData = tSnap.data()
              tecnicoNome = (tData.nome as string) || tecnicoNome
              regInmetroTecnico = (tData.regInmetro as string) || ''
              cpfTecnico = (tData.cpf as string) || ''
            }
          } catch { /* fallback ao ID */ }
        }

        setStatus(raw.status)
        setAguardandoPecaDesde(raw.aguardandoPecaDesde instanceof Timestamp ? raw.aguardandoPecaDesde.toDate() : null)
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
          regInmetroTecnico,
          cpfTecnico,
          atendimentos: normalizarAtendimentos(raw.atendimentos),
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

  async function iniciar() {
    if (!id || !user) return
    const iso = new Date().toISOString()
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'ordens_servico', id), {
        status: 'em_andamento',
        entrada: iso,
        updatedAt: serverTimestamp(),
        atualizadoPorId: user.uid,
      })
      setStatus('em_andamento')
      setEntrada(iso)
    } catch { /* ignore */ }
    finally { setSalvando(false) }
  }

  async function marcarAguardandoPeca() {
    if (!id || !user) return
    if (!window.confirm('Confirma que essa OS vai aguardar peça?')) return
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'ordens_servico', id), {
        status: 'aguardando_peca',
        aguardandoPecaDesde: serverTimestamp(),
        updatedAt: serverTimestamp(),
        atualizadoPorId: user.uid,
      })
      setStatus('aguardando_peca')
      setAguardandoPecaDesde(new Date())
    } catch { alert('Erro ao marcar como aguardando peça.') }
    finally { setSalvando(false) }
  }

  async function retomarAtendimento() {
    if (!id || !user) return
    if (!window.confirm('Confirma que a peça chegou e o atendimento vai continuar?')) return
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'ordens_servico', id), {
        status: 'em_andamento',
        updatedAt: serverTimestamp(),
        atualizadoPorId: user.uid,
      })
      setStatus('em_andamento')
    } catch { alert('Erro ao retomar o atendimento.') }
    finally { setSalvando(false) }
  }

  function abrirFinalizar() {
    if (!temSigCli || !temSigTec) {
      alert('É necessário coletar as assinaturas antes de finalizar.')
      return
    }
    setDataFinalizacaoInput(paraDatetimeLocal(new Date()))
    setFinalizarAberto(true)
  }

  async function confirmarFinalizar() {
    if (!id || !user || !dataFinalizacaoInput) return
    const escolhida = new Date(dataFinalizacaoInput)
    if (isNaN(escolhida.getTime())) return
    setSalvando(true)
    try {
      const iso = escolhida.toISOString()
      await updateDoc(doc(db, 'ordens_servico', id), {
        status: 'concluida',
        saida: iso,
        fechadaEm: serverTimestamp(),
        updatedAt: serverTimestamp(),
        atualizadoPorId: user.uid,
      })
      setStatus('concluida')
      setSaida(iso)
      setFinalizarAberto(false)
    } catch { alert('Erro ao finalizar. Tente novamente.') }
    finally { setSalvando(false) }
  }

  if (loading) return <div className={s.centralizado}>Carregando…</div>
  if (erro || !docData) return <div className={s.centralizado}>{erro || 'OS não encontrada.'}</div>

  const tempo = calcularTempoTotal(entrada, saida)

  return (
    <div className={s.pagina}>
      <div className={s.topo}>
        <button className={s.btnVoltar} onClick={() => navigate('/ordens')}>
          ← Voltar
        </button>
        <div className={s.acoes}>
          {/* Início / finalização */}
          {entrada && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontFamily: 'monospace' }}>
              {formatarDataHora(entrada)}{saida ? ` → ${formatarDataHora(saida)}` : ''}{tempo ? ` · ${tempo}` : ''}
            </span>
          )}

          {/* Aguardando peça: desde quando */}
          {status === 'aguardando_peca' && aguardandoPecaDesde && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
              Aguardando desde {aguardandoPecaDesde.toLocaleDateString('pt-BR')} {aguardandoPecaDesde.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {/* Iniciar / Aguardando Peça / Retomar / Finalizar */}
          {podeIniciarFinalizar && status === 'aberta' && (
            <button className={s.btnEditar} onClick={iniciar} disabled={salvando}>
              {salvando ? 'Salvando…' : '▶ Iniciar'}
            </button>
          )}
          {podeIniciarFinalizar && status === 'em_andamento' && (
            <button
              className={s.btnEditar}
              style={{ background: '#ffedd5', color: '#c2410c' }}
              onClick={marcarAguardandoPeca}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : '⏸ Aguardando Peça'}
            </button>
          )}
          {podeIniciarFinalizar && status === 'em_andamento' && (
            <button
              className={s.btnImprimir}
              style={{ background: '#15803d' }}
              onClick={abrirFinalizar}
              disabled={salvando}
            >
              ✓ Finalizar
            </button>
          )}
          {podeIniciarFinalizar && status === 'aguardando_peca' && (
            <button className={s.btnEditar} onClick={retomarAtendimento} disabled={salvando}>
              {salvando ? 'Salvando…' : '▶ Retomar atendimento'}
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

      <SlideOver aberto={finalizarAberto} titulo="Confirmar finalização" onFechar={() => setFinalizarAberto(false)}>
        <div className={c.form}>
          <p className={c.dica}>
            Confira ou ajuste a data e hora de finalização antes de concluir. Depois de finalizada,
            a OS não poderá mais ser editada.
          </p>
          <div className={c.campo}>
            <label className={c.label}>Data e hora de finalização</label>
            <input
              type="datetime-local"
              className={c.input}
              value={dataFinalizacaoInput}
              onChange={e => setDataFinalizacaoInput(e.target.value)}
            />
          </div>
          <div className={c.rodapeForm}>
            <button type="button" className={c.botaoCancelar} onClick={() => setFinalizarAberto(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className={c.botaoSalvar}
              onClick={confirmarFinalizar}
              disabled={salvando || !dataFinalizacaoInput}
            >
              {salvando ? 'Finalizando…' : 'Finalizar OS'}
            </button>
          </div>
        </div>
      </SlideOver>
    </div>
  )
}
