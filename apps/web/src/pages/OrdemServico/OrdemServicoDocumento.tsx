import { Fragment } from 'react'
import type { Atendimento, EmpresaConfig, TipoOS } from '@flowops/types'
import s from './OrdemServicoDocumento.module.css'

/** Mínimo de linhas de atendimento na impressão (preenche o A4). Ajuste aqui. */
const MIN_LINHAS_IMPRESSAO = 8

export interface OSDocumentoData {
  numero?: number
  tipo: TipoOS
  clienteId: string
  cidade: string
  estado: string
  loja: string
  veiculo: string
  dataAbertura: Date | null
  entrada: string
  saida: string
  tecnicoNome: string
  atendimentos: Atendimento[]
  comentarios: string
  solicitacaoMaterial: string
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
          <span className={s.osValor}>Nº&nbsp;{os.numero ?? '___________'}</span>
        </div>
      </div>

      {/* ── TIPO / CLIENTE / DATA / VEÍCULO ───────────────────────────────── */}
      <div className={s.linha}>
        <div className={s.campoTipo}>
          <span className={s.rot}>TIPO:</span>
          <span><Cx on={os.tipo === 'corretiva'} /> Corretiva</span>
          <span><Cx on={os.tipo === 'preventiva'} /> Preventiva</span>
          <span><Cx on={os.tipo === 'emergencia'} /> Emergência</span>
        </div>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>CLIENTE</span>
          <span className={s.val}>{os.clienteId || ' '}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '28mm' }}>
          <span className={s.rot}>DATA</span>
          <span className={s.val}>{dataFmt}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '36mm' }}>
          <span className={s.rot}>VEÍCULO</span>
          <span className={s.val}>{os.veiculo || ' '}</span>
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
          <span className={s.val}>{os.loja || ' '}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '22mm' }}>
          <span className={s.rot}>ENTRADA</span>
          <span className={s.val}>{os.entrada || ' '}</span>
        </div>
        <div className={s.campo} style={{ flexBasis: '22mm' }}>
          <span className={s.rot}>SAÍDA</span>
          <span className={s.val}>{os.saida || ' '}</span>
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
            <col style={{ width: '11%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '7%'  }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Chamado</th>
              <th>Modelo</th>
              <th>N.º Série</th>
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
                  <td className={s.centro}><Cx on={at.mauUso} /></td>
                  <td>{at.nInmetro}</td>
                  <td>{at.seloInmetro}</td>
                  <td>{at.seloAtual}</td>
                  <td>{at.portaria}</td>
                  <td className={s.centro}><Cx on={at.etqReparado} /></td>
                </tr>
                <tr className={s.trDescricao}>
                  <td colSpan={9}>
                    <span className={s.descLabel}>DESCRIÇÃO DAS INTERVENÇÕES REALIZADAS:&nbsp;</span>
                    {at.descricaoIntervencao || ''}
                  </td>
                </tr>
              </Fragment>
            ))}

            {/* Linhas vazias — ocultas na tela, visíveis na impressão para preencher o A4 */}
            {Array.from({ length: linhasVazias }).map((_, i) => (
              <Fragment key={`v${i}`}>
                <tr className={`${s.trDados} ${s.linhaVazia}`}>
                  {Array.from({ length: 9 }).map((__, j) => <td key={j}>&nbsp;</td>)}
                </tr>
                <tr className={`${s.trDescricao} ${s.linhaVazia}`}>
                  <td colSpan={9}>
                    <span className={s.descLabel}>DESCRIÇÃO DAS INTERVENÇÕES REALIZADAS:</span>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── COMENTÁRIOS / SOLICITAÇÃO DE MATERIAL ─────────────────────────── */}
      <div className={s.blocosInferiores}>
        <div className={s.bloco}>
          <div className={s.blocoTitulo}>COMENTÁRIOS</div>
          <div className={s.blocoConteudo}>{os.comentarios || ' '}</div>
        </div>
        <div className={s.bloco}>
          <div className={s.blocoTitulo}>SOLICITAÇÃO DE MATERIAL</div>
          <div className={s.blocoConteudo}>{os.solicitacaoMaterial || ' '}</div>
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
            <span><span className={s.rot}>RG: </span>{os.rgTecnico || ' '}</span>
          </div>
        </div>
      </div>

    </div>
  )
}
