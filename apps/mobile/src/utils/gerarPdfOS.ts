import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { formatarNumeroOS, formatarHora, calcularTempoTotal, type Atendimento, type EmpresaConfig, type ItemPecaUsada } from '@flowops/types'

export interface OSPdfData {
  numero?: number
  tipo: string
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
  pecasUsadas: ItemPecaUsada[]
  assinaturaClienteUrl?: string
  assinaturaClienteBase64?: string
  nomeLegivel: string
  matriculaCliente: string
  assinaturaTecnicoUrl?: string
  assinaturaTecnicoBase64?: string
  rgTecnico: string
  regInmetroTecnico?: string
}

function esc(v: unknown): string {
  if (v === undefined || v === null || v === '') return ''
  // String(v) por segurança: campos legados podem chegar com tipo antigo (ex: etqReparado
  // era boolean) — sem isso, .replace() num boolean derruba a geração do PDF inteiro.
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function montarHtml(os: OSPdfData, empresa: EmpresaConfig): string {
  const dataFmt = os.dataAbertura ? os.dataAbertura.toLocaleDateString('pt-BR') : ''
  const infoLinha = [
    empresa.cnpj ? `CNPJ: ${esc(empresa.cnpj)}` : '',
    empresa.registro ? `Reg.: ${esc(empresa.registro)}` : '',
  ].filter(Boolean).join(' | ')
  const telLinha = [empresa.telefone1, empresa.telefone2, empresa.email]
    .filter(Boolean).map(esc).join(' | ')

  const linhasAtendimento = os.atendimentos.map(at => `
    <tr class="dados">
      <td>${esc(at.chamado)}</td>
      <td>${esc(at.modelo)}</td>
      <td>${esc(at.nSerie)}</td>
      <td>${esc(at.setor)}</td>
      <td class="centro">${at.mauUso ? '☑' : '☐'}</td>
      <td>${esc(at.nInmetro)}</td>
      <td>${esc(at.seloInmetro)}</td>
      <td>${esc(at.seloAtual)}</td>
      <td>${esc(at.portaria)}</td>
      <td>${esc(at.etqReparado)}</td>
    </tr>
    <tr class="descricao">
      <td colspan="10"><span class="descLabel">DESCRIÇÃO DO PROBLEMA RELATADO:</span> ${esc(at.descricaoIntervencao)}</td>
    </tr>
  `).join('')

  const pecasTxt = os.pecasUsadas.length
    ? os.pecasUsadas.map(p => `${esc(p.nome)} x${p.quantidade}`).join(', ')
    : ''

  const sigCliente = os.assinaturaClienteBase64 || os.assinaturaClienteUrl || ''
  const sigTecnico = os.assinaturaTecnicoBase64 || os.assinaturaTecnicoUrl || ''

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; border: 1.5px solid #000; padding: 6px 9px; }
  .empresa { display: flex; flex-direction: column; gap: 1.5px; }
  .logo { max-height: 36px; max-width: 120px; object-fit: contain; margin-bottom: 2px; }
  .empresaNome { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
  .osNumero { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
  .osLabel { font-size: 9px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  .osValor { font-size: 20px; font-weight: 700; line-height: 1.1; letter-spacing: -0.5px; }
  .linha { display: flex; border: 1.5px solid #000; border-top: none; }
  .campo { display: flex; flex-direction: column; padding: 2px 5px; border-right: 1px solid #000; min-height: 22px; justify-content: center; }
  .campo:last-child { border-right: none; }
  .campoTipo { display: flex; align-items: center; gap: 9px; padding: 2px 8px; border-right: 1px solid #000; white-space: nowrap; font-size: 10px; }
  .grow { flex: 1; min-width: 0; }
  .rot { font-weight: 700; font-size: 7.5px; text-transform: uppercase; color: #444; white-space: nowrap; line-height: 1.2; }
  .val { font-size: 10px; line-height: 1.3; min-height: 12px; }
  .secaoTitulo { background: #d0d0d0; font-weight: 700; font-size: 9px; padding: 3px 7px; border: 1.5px solid #000; border-top: none; text-transform: uppercase; letter-spacing: 0.06em; }
  table.tabela { width: 100%; border-collapse: collapse; }
  .tabela th { background: #e4e4e4; border: 1px solid #000; padding: 3px 4px; font-weight: 700; text-align: center; font-size: 8.5px; white-space: nowrap; }
  .tabela tr.dados td { border: 1px solid #000; padding: 2px 4px; font-size: 9.5px; vertical-align: middle; height: 16px; }
  .tabela tr.descricao td { border: 1px solid #000; border-top: 1px dashed #999; padding: 2px 6px; font-size: 9.5px; vertical-align: top; background: #fbfbfb; }
  .descLabel { font-weight: 700; font-size: 7.5px; text-transform: uppercase; color: #444; }
  .centro { text-align: center; }
  .blocosInferiores { display: flex; border: 1.5px solid #000; border-top: none; }
  .bloco { flex: 1; border-right: 1px solid #000; }
  .bloco:last-child { border-right: none; }
  .blocoTitulo { background: #d0d0d0; font-weight: 700; font-size: 8.5px; padding: 2px 6px; border-bottom: 1px solid #000; text-transform: uppercase; letter-spacing: 0.04em; }
  .blocoConteudo { padding: 5px 6px; min-height: 40px; font-size: 9.5px; white-space: pre-wrap; }
  .assinaturas { display: flex; border: 1.5px solid #000; border-top: none; }
  .assinaturaBloco { flex: 1; border-right: 1px solid #000; display: flex; flex-direction: column; }
  .assinaturaBloco:last-child { border-right: none; }
  .assinaturaArea { height: 58px; border-bottom: 1px solid #000; display: flex; align-items: center; justify-content: center; padding: 4px; }
  .assinaturaImg { max-height: 50px; max-width: 100%; object-fit: contain; }
  .assinaturaRodape { padding: 3px 7px; display: flex; gap: 16px; font-size: 9.5px; }
</style>
</head>
<body>
  <div class="cabecalho">
    <div class="empresa">
      ${empresa.logoUrl ? `<img class="logo" src="${esc(empresa.logoUrl)}" />` : ''}
      <strong class="empresaNome">${esc(empresa.nomeEmpresa) || 'FlowOps'}</strong>
      ${infoLinha ? `<span>${infoLinha}</span>` : ''}
      ${telLinha ? `<span>${telLinha}</span>` : ''}
      ${empresa.endereco ? `<span>${esc(empresa.endereco)}</span>` : ''}
    </div>
    <div class="osNumero">
      <span class="osLabel">ORDEM DE SERVIÇO (OS)</span>
      <span class="osValor">Nº&nbsp;${esc(formatarNumeroOS(os.numero))}</span>
    </div>
  </div>

  <div class="linha">
    <div class="campoTipo">
      <span class="rot">TIPO:</span>
      <span>${os.tipo === 'corretiva' ? '☑' : '☐'} Corretiva</span>
      <span>${os.tipo === 'preventiva' ? '☑' : '☐'} Preventiva</span>
      <span>${os.tipo === 'emergencia' ? '☑' : '☐'} Emergência</span>
    </div>
    <div class="campo grow">
      <span class="rot">PARCEIRO</span>
      <span class="val">${esc(os.parceiroNome)}</span>
    </div>
    <div class="campo" style="flex-basis: 28mm">
      <span class="rot">DATA</span>
      <span class="val">${esc(dataFmt)}</span>
    </div>
    <div class="campo" style="flex-basis: 36mm">
      <span class="rot">SOLICITANTE</span>
      <span class="val">${esc(os.solicitante)}</span>
    </div>
  </div>

  <div class="linha">
    <div class="campo grow">
      <span class="rot">CIDADE</span>
      <span class="val">${esc(os.cidade)}</span>
    </div>
    <div class="campo" style="flex-basis: 13mm">
      <span class="rot">UF</span>
      <span class="val">${esc(os.estado)}</span>
    </div>
    <div class="campo grow">
      <span class="rot">LOJA</span>
      <span class="val">${os.lojaNumero ? `${esc(os.lojaNumero)} - ` : ''}${esc(os.lojaNome)}</span>
    </div>
    <div class="campo" style="flex-basis: 22mm">
      <span class="rot">ENTRADA</span>
      <span class="val">${esc(formatarHora(os.entrada))}</span>
    </div>
    <div class="campo" style="flex-basis: 22mm">
      <span class="rot">SAÍDA</span>
      <span class="val">${esc(formatarHora(os.saida))}</span>
    </div>
    <div class="campo" style="flex-basis: 22mm">
      <span class="rot">TEMPO TOTAL</span>
      <span class="val">${esc(calcularTempoTotal(os.entrada, os.saida))}</span>
    </div>
    <div class="campo grow">
      <span class="rot">TÉCNICO</span>
      <span class="val">${esc(os.tecnicoNome)}</span>
    </div>
  </div>

  <div class="secaoTitulo">DESCRIÇÃO DO ATENDIMENTO</div>
  <table class="tabela">
    <colgroup>
      <col style="width:10%" /><col style="width:12%" /><col style="width:9%" />
      <col style="width:9%" /><col style="width:6%" /><col style="width:11%" />
      <col style="width:11%" /><col style="width:10%" /><col style="width:9%" /><col style="width:13%" />
    </colgroup>
    <thead>
      <tr>
        <th>Chamado</th><th>Modelo</th><th>N.º Série</th><th>Setor</th><th>Mau Uso</th>
        <th>N.º INMETRO</th><th>Selo INMETRO</th><th>Selo Atual</th><th>Portaria</th><th>Etq. Reparado</th>
      </tr>
    </thead>
    <tbody>${linhasAtendimento}</tbody>
  </table>

  <div class="blocosInferiores">
    <div class="bloco">
      <div class="blocoTitulo">Descrição do Problema</div>
      <div class="blocoConteudo">${esc(os.comentarios)}</div>
    </div>
    <div class="bloco">
      <div class="blocoTitulo">Descrição do Serviço Realizado</div>
      <div class="blocoConteudo">${esc(os.descricaoServicoRealizado)}</div>
    </div>
  </div>
  <div class="blocosInferiores">
    <div class="bloco">
      <div class="blocoTitulo">Solicitação de Material</div>
      <div class="blocoConteudo">${esc(os.solicitacaoMaterial)}</div>
    </div>
    <div class="bloco">
      <div class="blocoTitulo">Peças Utilizadas</div>
      <div class="blocoConteudo">${esc(pecasTxt)}</div>
    </div>
  </div>

  <div class="assinaturas">
    <div class="assinaturaBloco">
      <div class="blocoTitulo">Assinatura do Cliente / Responsável</div>
      <div class="assinaturaArea">${sigCliente ? `<img class="assinaturaImg" src="${sigCliente}" />` : ''}</div>
      <div class="assinaturaRodape">
        <span><span class="rot">NOME: </span>${esc(os.nomeLegivel)}</span>
        <span><span class="rot">MATRÍCULA: </span>${esc(os.matriculaCliente)}</span>
      </div>
    </div>
    <div class="assinaturaBloco">
      <div class="blocoTitulo">Assinatura do Técnico</div>
      <div class="assinaturaArea">${sigTecnico ? `<img class="assinaturaImg" src="${sigTecnico}" />` : ''}</div>
      <div class="assinaturaRodape">
        <span><span class="rot">TÉCNICO: </span>${esc(os.tecnicoNome)}</span>
        ${os.regInmetroTecnico ? `<span><span class="rot">REG. INMETRO: </span>${esc(os.regInmetroTecnico)}</span>` : ''}
        <span><span class="rot">RG: </span>${esc(os.rgTecnico)}</span>
      </div>
    </div>
  </div>
</body>
</html>
`
}

/** Gera o PDF da OS e abre o compartilhamento nativo do dispositivo. */
export async function gerarECompartilharPdfOS(os: OSPdfData, empresa: EmpresaConfig): Promise<void> {
  const html = montarHtml(os, empresa)
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  const podeCompartilhar = await Sharing.isAvailableAsync()
  if (podeCompartilhar) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `OS ${formatarNumeroOS(os.numero)}`,
    })
  }
}
