import { Fragment } from 'react'
import { formatarNumeroOS, formatarDataHora, calcularTempoTotal, type Atendimento, type EmpresaConfig, type TipoOS, type ItemPecaUsada } from '@flowops/types'
import s from './OrdemServicoDocumento.module.css'

/** Mínimo de linhas de atendimento na impressão (preenche o A4). Ajuste aqui. */
const MIN_LINHAS_IMPRESSAO = 8

export interface OSDocumentoData {
  numero?: number
  tipo: TipoOS
  parceiroNome: string
  lojaNumero?: string
  lojaNome: string
  cidade: string
  estado: string
  solicitante: string
  dataAbertura: Date | null
  entrada: string
  saida: string
  tecnicoNome: string
  atendimentos: Atendimento[]
  comentarios: string
  descricaoServicoRealizado: string
  solicitacaoMaterial: string
  pecasUsadas?: ItemPecaUsada[]
  assinaturaClienteUrl?: string
  assinaturaClienteBase64?: string
  nomeLegivel: string
  matriculaCliente: string
  assinaturaTecnicoUrl?: string
  assinaturaTecnicoBase64?: string
  rgTecnico: string
}

function Cx({ on }: { on: boolean }) {
  return <span className={s.cx}>{on ? '☑' : '☐'}</span>
}

export function OrdemServicoDocumento({ os, empresa, orientacao }: {
  os: OSDocumentoData
  empresa?: EmpresaConfig
  orientacao?: 'retrato' | 'paisagem'
}) {
  const dataFmt = os.dataAbertura ? os.dataAbertura.toLocaleDateString('pt-BR') : '___/___/______'
  const atendimentos = os.atendimentos ?? []
  const linhasVazias = Math.max(0, MIN_LINHAS_IMPRESSAO - atendimentos.length)

  const infoLinha = [
    empresa?.cnpj      ? `CNPJ: ${empresa.cnpj}` : null,
    empresa?.registro  ? `Reg.: ${empresa.registro}` : null,
  ].filter(Boolean).join(' | ')

  const telLinha = [
    empresa?.telefone1,
    empresa?.telefone2,
    empresa?.email,
  ].filter(Boolean).join(' | ')

  return (
    <div className={`${s.documento} ${orientacao === 'paisagem' ? s.documentoLandscape : ''}`}>

      {/* ── CABEÇALHO ─────────────────────────────────────────────────────── */}
      <div className={s.cabecalho}>
        <div className={s.empresa}>
          {empresa?.logoUrl && <img src={empresa.logoUrl} alt="" className={s.logo} />}
          <strong className={s.empresaNome}>{empresa?.nomeEmpresa || 'FlowOps'}</strong>
          {infoLinha && <span>{infoLinha}</span>}
          {telLinha  && <span>{telLinha}</span>}
          {empresa?.endereco && <span>{empresa.endereco}</span>}
        </div>
        <div className={s.osNumero}>
          <span className={s.osLabel}>ORDEM DE SERVIÇO (OS)</span>
          <span className={s.osValor}>Nº&nbsp;{formatarNumeroOS(os.numero)}</span>
        </div>
      </div>

      {/* ── TIPO / PARCEIRO / DATA / SOLICITANTE ─────────────────────────── */}
      <div className={s.linha}>
        <div className={s.campoTipo}>
          <span className={s.rot}>TIPO:</span>
          <span><Cx on={os.tipo === 'corretiva'} /> Corretiva</span>
          <span><Cx on={os.tipo === 'preventiva'} /> Preventiva</span>
          <span><Cx on={os.tipo === 'emergencia'} /> Emergência</span>
        </div>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>PARCEIRO</span>
          <span className={s.val}>{os.parceiroNome || ' '}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '28mm' }}>
          <span className={s.rot}>DATA</span>
          <span className={s.val}>{dataFmt}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '36mm' }}>
          <span className={s.rot}>SOLICITANTE</span>
          <span className={s.val}>{os.solicitante || ' '}</span>
        </div>
      </div>

      {/* ── CIDADE / UF / LOJA / ENTRADA / SAÍDA / TÉCNICO ───────────────── */}
      <div className={s.linha}>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>CIDADE</span>
          <span className={s.val}>{os.cidade || ' '}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '13mm' }}>
          <span className={s.rot}>UF</span>
          <span className={s.val}>{os.estado || ' '}</span>
        </div>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>LOJA</span>
          <span className={s.val}>{os.lojaNumero ? `${os.lojaNumero} - ${os.lojaNome}` : os.lojaNome || ' '}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '22mm' }}>
          <span className={s.rot}>ENTRADA</span>
          <span className={s.val}>{formatarDataHora(os.entrada) || ' '}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '22mm' }}>
          <span className={s.rot}>SAÍDA</span>
          <span className={s.val}>{formatarDataHora(os.saida) || ' '}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '22mm' }}>
          <span className={s.rot}>TEMPO TOTAL</span>
          <span className={s.val}>{calcularTempoTotal(os.entrada, os.saida) || ' '}</span>
        </div>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>TÉCNICO</span>
          <span className={s.val}>{os.tecnicoNome || ' '}</span>
        </div>
      </div>

      {/* ── TABELA CENTRAL (corpo principal da OS) ────────────────────────── */}
      <div className={s.secaoTitulo}>DESCRIÇÃO DO ATENDIMENTO</div>
      <div className={s.tabelaContainer}>
        <table className={s.tabela}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '9%'  }} />
            <col style={{ width: '9%'  }} />
            <col style={{ width: '6%'  }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%'  }} />
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Chamado</th>
              <th>Modelo</th>
              <th>N.º Série</th>
              <th>Setor</th>
              <th>Mau Uso</th>
              <th>N.º INMETRO</th>
              <th>Selo INMETRO</th>
              <th>Selo Atual</th>
              <th>Portaria</th>
              <th>Etq. Reparado</th>
            </tr>
          </thead>
          <tbody>
            {/* Linhas reais */}
            {atendimentos.map((at, i) => (
              <Fragment key={i}>
                <tr className={s.trDados}>
                  <td>{at.chamado}</td>
                  <td>{at.modelo}</td>
                  <td>{at.nSerie}</td>
                  <td>{at.setor}</td>
                  <td className={s.centro}><Cx on={at.mauUso} /></td>
                  <td>{at.nInmetro}</td>
                  <td>{at.seloInmetro}</td>
                  <td>{at.seloAtual}</td>
                  <td>{at.portaria}</td>
                  <td>{typeof at.etqReparado === 'string' ? at.etqReparado : (at.etqReparado ? 'Sim' : '')}</td>
                </tr>
                <tr className={s.trDescricao}>
                  <td colSpan={10}>
                    <span className={s.descLabel}>DESCRIÇÃO DO PROBLEMA RELATADO PELO CLIENTE:&nbsp;</span>
                    <span className={s.descValor}>{at.descricaoIntervencao || ''}</span>
                  </td>
                </tr>
              </Fragment>
            ))}

            {/* Linhas vazias — ocultas na tela, visíveis na impressão para preencher o A4 */}
            {Array.from({ length: linhasVazias }).map((_, i) => (
              <Fragment key={`v${i}`}>
                <tr className={`${s.trDados} ${s.linhaVazia}`}>
                  {Array.from({ length: 10 }).map((__, j) => <td key={j}>&nbsp;</td>)}
                </tr>
                <tr className={`${s.trDescricao} ${s.linhaVazia}`}>
                  <td colSpan={10}>
                    <span className={s.descLabel}>DESCRIÇÃO DO PROBLEMA RELATADO:</span>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── DESCRIÇÃO DO PROBLEMA / SERVIÇO REALIZADO ─────────────────────── */}
      <div className={s.blocosInferiores}>
        <div className={s.bloco}>
          <div className={s.blocoTitulo}>DESCRIÇÃO DO PROBLEMA</div>
          <div className={s.blocoConteudo}>{os.comentarios || ' '}</div>
        </div>
        <div className={s.bloco}>
          <div className={s.blocoTitulo}>DESCRIÇÃO DO SERVIÇO REALIZADO</div>
          <div className={s.blocoConteudo}>{os.descricaoServicoRealizado || ' '}</div>
        </div>
      </div>

      <div className={s.blocosInferiores}>
        <div className={s.bloco}>
          <div className={s.blocoTitulo}>SOLICITAÇÃO DE MATERIAL</div>
          <div className={s.blocoConteudo}>{os.solicitacaoMaterial || ' '}</div>
        </div>
        <div className={s.bloco}>
          <div className={s.blocoTitulo}>PEÇAS UTILIZADAS</div>
          <div className={s.blocoConteudo}>
            {os.pecasUsadas?.length
              ? os.pecasUsadas.map((item, i) => (
                  <span key={i}>{item.nome} x{item.quantidade}{i < os.pecasUsadas!.length - 1 ? ', ' : ''}</span>
                ))
              : ' '}
          </div>
        </div>
      </div>

      {/* ── ASSINATURAS ───────────────────────────────────────────────────── */}
      <div className={s.assinaturas}>
        <div className={s.assinaturaBloco}>
          <div className={s.blocoTitulo}>ASSINATURA DO CLIENTE / RESPONSÁVEL</div>
          <div className={s.assinaturaArea}>
            {(os.assinaturaClienteBase64 || os.assinaturaClienteUrl) &&
              <img src={os.assinaturaClienteBase64 ?? os.assinaturaClienteUrl} alt="Assinatura" className={s.assinaturaImg} />}
          </div>
          <div className={s.assinaturaRodape}>
            <span><span className={s.rot}>NOME: </span>{os.nomeLegivel || ' '}</span>
            <span><span className={s.rot}>MATRÍCULA: </span>{os.matriculaCliente || ' '}</span>
          </div>
        </div>
        <div className={s.assinaturaBloco}>
          <div className={s.blocoTitulo}>ASSINATURA DO TÉCNICO</div>
          <div className={s.assinaturaArea}>
            {(os.assinaturaTecnicoBase64 || os.assinaturaTecnicoUrl) &&
              <img src={os.assinaturaTecnicoBase64 ?? os.assinaturaTecnicoUrl} alt="Assinatura técnico" className={s.assinaturaImg} />}
          </div>
          <div className={s.assinaturaRodape}>
            <span><span className={s.rot}>TÉCNICO: </span>{os.tecnicoNome || ' '}</span>
            {empresa?.regInmetro && <span><span className={s.rot}>REG. INMETRO: </span>{empresa.regInmetro}</span>}
            <span><span className={s.rot}>RG: </span>{os.rgTecnico || ' '}</span>
          </div>
        </div>
      </div>

    </div>
  )
}
