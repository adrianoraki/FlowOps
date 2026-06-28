import { Fragment } from 'react'
import type { Atendimento, EmpresaConfig, TipoOS } from '@flowops/types'
import s from './OrdemServicoDocumento.module.css'

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
  nomeLegivel: string
  matriculaCliente: string
  assinaturaTecnicoUrl?: string
  rgTecnico: string
}

function Caixa({ on }: { on: boolean }) {
  return <span className={s.caixa}>{on ? '☑' : '☐'}</span>
}

export function OrdemServicoDocumento({ os, empresa }: { os: OSDocumentoData; empresa?: EmpresaConfig }) {
  const dataFmt = os.dataAbertura
    ? os.dataAbertura.toLocaleDateString('pt-BR')
    : '—'
  const atendimentos = os.atendimentos ?? []

  return (
    <div className={s.documento}>

      <div className={s.cabecalho}>
        <div className={s.empresa}>
          <strong className={s.empresaNome}>{empresa?.nomeEmpresa || 'FlowOps'}</strong>
          {(empresa?.cnpj || empresa?.registro) && (
            <span>
              {[empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : null, empresa?.registro ? `Reg.: ${empresa.registro}` : null].filter(Boolean).join(' | ')}
            </span>
          )}
          {(empresa?.telefone1 || empresa?.telefone2 || empresa?.email) && (
            <span>{[empresa?.telefone1, empresa?.telefone2, empresa?.email].filter(Boolean).join(' | ')}</span>
          )}
          {empresa?.endereco && <span>{empresa.endereco}</span>}
        </div>
        <div className={s.osNumero}>
          <span className={s.osLabel}>ORDEM DE SERVIÇO (OS)</span>
          <span className={s.osValor}>Nº {os.numero ?? '—'}</span>
        </div>
      </div>

      <div className={s.linha}>
        <div className={s.campoTipo}>
          <span className={s.rot}>TIPO:</span>
          <span><Caixa on={os.tipo === 'corretiva'} /> Corretiva</span>
          <span><Caixa on={os.tipo === 'preventiva'} /> Preventiva</span>
          <span><Caixa on={os.tipo === 'emergencia'} /> Emergência</span>
        </div>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>CLIENTE:</span>
          <span>{os.clienteId}</span>
        </div>
        <div className={s.campo}>
          <span className={s.rot}>DATA:</span>
          <span>{dataFmt}</span>
        </div>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>VEÍCULO:</span>
          <span>{os.veiculo}</span>
        </div>
      </div>

      <div className={s.linha}>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>CIDADE:</span>
          <span>{os.cidade}</span>
        </div>
        <div className={s.campo}>
          <span className={s.rot}>UF:</span>
          <span>{os.estado}</span>
        </div>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>LOJA:</span>
          <span>{os.loja}</span>
        </div>
        <div className={s.campo}>
          <span className={s.rot}>ENTRADA:</span>
          <span>{os.entrada}</span>
        </div>
        <div className={s.campo}>
          <span className={s.rot}>SAÍDA:</span>
          <span>{os.saida}</span>
        </div>
        <div className={`${s.campo} ${s.grow}`}>
          <span className={s.rot}>TÉCNICO:</span>
          <span>{os.tecnicoNome}</span>
        </div>
      </div>

      <div className={s.secaoTitulo}>DESCRIÇÃO DO ATENDIMENTO</div>
      <table className={s.tabela}>
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
            <th>Etq. Rep.</th>
          </tr>
        </thead>
        <tbody>
          {atendimentos.map((at, i) => (
            <Fragment key={i}>
              <tr>
                <td>{at.chamado}</td>
                <td>{at.modelo}</td>
                <td>{at.nSerie}</td>
                <td className={s.centro}><Caixa on={at.mauUso} /></td>
                <td>{at.nInmetro}</td>
                <td>{at.seloInmetro}</td>
                <td>{at.seloAtual}</td>
                <td>{at.portaria}</td>
                <td className={s.centro}><Caixa on={at.etqReparado} /></td>
              </tr>
              <tr className={s.trDesc}>
                <td colSpan={9}>
                  <span className={s.rot}>INTERVENÇÃO REALIZADA: </span>
                  {at.descricaoIntervencao || '—'}
                </td>
              </tr>
            </Fragment>
          ))}
          {atendimentos.length === 0 && (
            <tr><td colSpan={9} className={s.centro}>—</td></tr>
          )}
        </tbody>
      </table>

      <div className={s.blocosInferiores}>
        <div className={s.bloco}>
          <div className={s.blocoTitulo}>COMENTÁRIOS</div>
          <div className={s.blocoConteudo}>{os.comentarios || ' '}</div>
        </div>
        <div className={s.bloco}>
          <div className={s.blocoTitulo}>SOLICITAÇÃO DE MATERIAL</div>
          <div className={s.blocoConteudo}>{os.solicitacaoMaterial || ' '}</div>
        </div>
      </div>

      <div className={s.assinaturas}>
        <div className={s.assinaturaBloco}>
          <div className={s.blocoTitulo}>ASSINATURA DO CLIENTE / RESPONSÁVEL</div>
          <div className={s.assinaturaArea}>
            {os.assinaturaClienteUrl
              ? <img src={os.assinaturaClienteUrl} alt="Assinatura" className={s.assinaturaImg} />
              : null}
          </div>
          <div className={s.assinaturaRodape}>
            <span><span className={s.rot}>Nome: </span>{os.nomeLegivel}</span>
            <span><span className={s.rot}>Matrícula: </span>{os.matriculaCliente}</span>
          </div>
        </div>
        <div className={s.assinaturaBloco}>
          <div className={s.blocoTitulo}>ASSINATURA DO TÉCNICO</div>
          <div className={s.assinaturaArea}>
            {os.assinaturaTecnicoUrl
              ? <img src={os.assinaturaTecnicoUrl} alt="Assinatura técnico" className={s.assinaturaImg} />
              : null}
          </div>
          <div className={s.assinaturaRodape}>
            <span><span className={s.rot}>Técnico: </span>{os.tecnicoNome}</span>
            <span><span className={s.rot}>RG: </span>{os.rgTecnico}</span>
          </div>
        </div>
      </div>

    </div>
  )
}
