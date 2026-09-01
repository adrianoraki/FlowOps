import { formatarNumeroOS, type EmpresaConfig } from '@flowops/types'
import type { EquipamentoHistorico, OSHistorico } from './useHistorico'
import s from './HistoricoDocumento.module.css'

// Documento de histórico — mesmo papel de OrdemServicoDocumento: um componente
// só, usado na tela e na impressão/PDF, para que o que o gestor vê seja
// exatamente o que o cliente recebe.

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta', em_andamento: 'Em andamento', aguardando_peca: 'Aguardando peça',
  concluida: 'Concluída', cancelada: 'Cancelada',
}

const TIPO_LABEL: Record<string, string> = {
  corretiva: 'Corretiva', preventiva: 'Preventiva', emergencia: 'Emergência',
}

function data(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR') : '—'
}

export interface HistoricoDocumentoData {
  parceiroNome: string
  lojaLabel: string
  equipamentos: EquipamentoHistorico[]
  ordens: OSHistorico[]
}

export function HistoricoDocumento({ dados, empresa }: {
  dados: HistoricoDocumentoData
  empresa?: EmpresaConfig
}) {
  const totalAtendimentos = dados.equipamentos.reduce((n, e) => n + e.atendimentos.length, 0)

  const infoLinha = [
    empresa?.cnpj     ? `CNPJ: ${empresa.cnpj}` : null,
    empresa?.registro ? `Reg.: ${empresa.registro}` : null,
  ].filter(Boolean).join(' | ')

  const telLinha = [empresa?.telefone1, empresa?.telefone2, empresa?.email]
    .filter(Boolean).join(' | ')

  return (
    <div className={s.documento}>
      <header className={s.cabecalho}>
        {empresa?.logoUrl && <img src={empresa.logoUrl} alt="" className={s.logo} />}
        <div className={s.cabecalhoTexto}>
          <strong className={s.empresaNome}>{empresa?.nomeEmpresa || 'FlowOps'}</strong>
          {infoLinha && <span className={s.empresaInfo}>{infoLinha}</span>}
          {telLinha && <span className={s.empresaInfo}>{telLinha}</span>}
        </div>
      </header>

      <h1 className={s.titulo}>Histórico de Manutenção</h1>

      <div className={s.identificacao}>
        <div><span className={s.rotulo}>Cliente</span><span className={s.valor}>{dados.parceiroNome || '—'}</span></div>
        <div><span className={s.rotulo}>Loja</span><span className={s.valor}>{dados.lojaLabel}</span></div>
        <div><span className={s.rotulo}>Equipamentos</span><span className={s.valor}>{dados.equipamentos.length}</span></div>
        <div><span className={s.rotulo}>Atendimentos</span><span className={s.valor}>{totalAtendimentos}</span></div>
        <div><span className={s.rotulo}>Emitido em</span><span className={s.valor}>{new Date().toLocaleDateString('pt-BR')}</span></div>
      </div>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>Histórico por equipamento</h2>
        {dados.equipamentos.length === 0 && <p className={s.vazio}>Nenhum equipamento atendido no filtro selecionado.</p>}
        {dados.equipamentos.map(eq => (
          <div key={eq.chave} className={s.equipamento}>
            <div className={s.equipamentoCabecalho}>
              <strong className={s.equipamentoTitulo}>
                {eq.tipoEquipamento}
                {eq.modelo && ` ${eq.modelo}`}
                {' — '}
                {eq.nSerie ? `Série ${eq.nSerie}` : 'sem n.º de série'}
              </strong>
              <span className={s.equipamentoMeta}>
                {eq.lojaLabel}{eq.setor && ` · ${eq.setor}`} · {eq.atendimentos.length}{' '}
                {eq.atendimentos.length === 1 ? 'atendimento' : 'atendimentos'}
              </span>
            </div>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Data</th><th>OS</th><th>Chamado</th><th>Técnico</th>
                  <th>Problema relatado</th><th>Serviço realizado</th><th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {eq.atendimentos.map((at, i) => (
                  <tr key={`${at.osId}-${i}`}>
                    <td className={s.nowrap}>{data(at.data)}</td>
                    <td className={s.nowrap}>{formatarNumeroOS(at.numero)}</td>
                    <td>{at.chamado || '—'}</td>
                    <td>{at.tecnicoNome || '—'}</td>
                    <td>{at.relatoCliente || '—'}</td>
                    <td>{at.servicoRealizado || at.diagnostico || '—'}</td>
                    <td className={s.nowrap}>{STATUS_LABEL[at.status] ?? at.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {eq.atendimentos[0]?.ficha && (
              <p className={s.ficha}><span className={s.rotulo}>Ficha:</span> {eq.atendimentos[0].ficha}</p>
            )}
          </div>
        ))}
      </section>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>Ordens de serviço do cliente</h2>
        {dados.ordens.length === 0 && <p className={s.vazio}>Nenhuma OS no filtro selecionado.</p>}
        {dados.ordens.length > 0 && (
          <table className={s.tabela}>
            <thead>
              <tr><th>Data</th><th>OS</th><th>Loja</th><th>Tipo</th><th>Técnico</th><th>Equip.</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {dados.ordens.map(os => (
                <tr key={os.id}>
                  <td className={s.nowrap}>{data(os.data)}</td>
                  <td className={s.nowrap}>{formatarNumeroOS(os.numero)}</td>
                  <td>{os.lojaLabel}</td>
                  <td>{TIPO_LABEL[os.tipo] ?? os.tipo}</td>
                  <td>{os.tecnicoNome || '—'}</td>
                  <td className={s.nowrap}>{os.qtdEquipamentos}</td>
                  <td className={s.nowrap}>{STATUS_LABEL[os.status] ?? os.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
