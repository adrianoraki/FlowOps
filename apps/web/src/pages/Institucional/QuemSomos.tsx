// AVISO: texto-base automático. Requer REVISÃO JURÍDICA antes de produção, especialmente identificação do responsável, distinção controlador/operador e base legal.
import { PublicLayout } from '../../components/PublicLayout/PublicLayout'
import { RESPONSAVEL } from '../../lib/responsavel'
import s from './QuemSomos.module.css'

export function QuemSomos() {
  return (
    <PublicLayout>
      <h1 className={s.titulo}>Quem Somos</h1>
      <p className={s.subtitulo}>
        O FlowOps é um projeto de autoria individual, desenvolvido e operado por{' '}
        <span className={s.placeholder}>{RESPONSAVEL.nome}</span>.
      </p>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>O que é o FlowOps</h2>
        <p className={s.paragrafo}>
          O FlowOps é um sistema digital de Ordem de Serviço (OS) desenvolvido especificamente para empresas
          que prestam serviços de manutenção em instrumentos de medição regulados pelo INMETRO — como balanças
          comerciais e industriais. Ele substitui o formulário de OS em papel por uma solução integrada composta
          por um painel web (para gestores e administradores) e um aplicativo móvel Android (para o técnico em
          campo).
        </p>
        <p className={s.paragrafo}>
          Do momento em que um chamado é aberto até a emissão do documento final em PDF assinado digitalmente
          pelo cliente e pelo técnico, todo o fluxo da OS — dados do equipamento, número de série, selo do
          INMETRO, peças utilizadas, descrição do problema e do serviço realizado — é registrado de forma
          estruturada, rastreável e auditável.
        </p>
      </section>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>Para quem é</h2>
        <p className={s.paragrafo}>
          O FlowOps é voltado a empresas de manutenção e assistência técnica de instrumentos regulados —
          tipicamente oficinas autorizadas que atendem redes de varejo (supermercados, açougues, hortifrútis e
          demais estabelecimentos que operam balanças comerciais) em múltiplos estados. O sistema é oferecido no
          modelo <strong>white-label</strong>: cada empresa-cliente utiliza o FlowOps com sua própria identidade
          (nome, logotipo e dados de contato), sem qualquer referência a quem desenvolve o sistema aparecendo no
          produto final entregue ao cliente do técnico.
        </p>
      </section>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>O problema que resolvemos</h2>
        <p className={s.paragrafo}>
          A manutenção de instrumentos regulados pelo INMETRO exige controle rigoroso: cada atendimento precisa
          ficar documentado, com trilha de auditoria íntegra, para eventual fiscalização. O processo tradicional
          em papel é lento, sujeito a extravio, difícil de consolidar em relatórios gerenciais e não oferece
          nenhuma garantia de integridade dos registros ao longo do tempo.
        </p>
        <p className={s.paragrafo}>
          O FlowOps digitaliza esse processo de ponta a ponta, com um diferencial essencial para quem atua em
          campo: o aplicativo do técnico funciona <strong>offline</strong>. Em galpões, subsolos e lojas com
          sinal de internet ruim ou inexistente, o técnico preenche a OS normalmente — os dados ficam salvos no
          próprio aparelho e sincronizam automaticamente assim que a conexão é restabelecida, sem intervenção
          manual e sem risco de perda de informação.
        </p>
      </section>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>Missão</h2>
        <p className={s.paragrafo}>
          Dar às empresas de manutenção de instrumentos regulados uma ferramenta simples, confiável e acessível
          para digitalizar sua operação de campo, elevando o padrão de controle e conformidade sem exigir
          investimento em infraestrutura complexa.
        </p>
      </section>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>O que oferecemos</h2>
        <div className={s.destaqueBox}>
          <div className={s.destaqueItem}>
            <span className={s.destaqueItemTitulo}>Painel do gestor (web)</span>
            <span className={s.destaqueItemTexto}>
              Cadastro de parceiros, lojas, técnicos e peças; dashboard regional; relatórios de status, tempo
              médio de atendimento e peças utilizadas.
            </span>
          </div>
          <div className={s.destaqueItem}>
            <span className={s.destaqueItemTitulo}>App do técnico (Android)</span>
            <span className={s.destaqueItemTexto}>
              Preenchimento completo da OS em campo, com funcionamento offline, assinatura digital do cliente e
              do técnico, e geração de PDF idêntico ao formulário físico.
            </span>
          </div>
          <div className={s.destaqueItem}>
            <span className={s.destaqueItemTitulo}>Controle de estoque</span>
            <span className={s.destaqueItemTexto}>
              Movimentação de peças entre almoxarifado e técnicos, com confirmação de recebimento e saldo por
              técnico.
            </span>
          </div>
          <div className={s.destaqueItem}>
            <span className={s.destaqueItemTitulo}>White-label</span>
            <span className={s.destaqueItemTexto}>
              Identidade visual e dados de contato configuráveis por empresa-cliente, sem custo de licenciamento
              de marca.
            </span>
          </div>
        </div>
      </section>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>Diferenciais</h2>
        <ul className={s.lista}>
          <li>Funcionamento offline-first no app do técnico, com sincronização automática.</li>
          <li>Numeração sequencial de OS sem duplicidade, mesmo com múltiplos usuários simultâneos.</li>
          <li>Trilha de auditoria: OS concluída torna-se somente leitura, preservando o histórico.</li>
          <li>Controle de acesso por perfil (técnico, gestor, admin) e por estado de cobertura.</li>
          <li>Geração de PDF da OS assinada, pronta para envio ao cliente final.</li>
        </ul>
      </section>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>Contato</h2>
        <div className={s.contatoBox}>
          <div>Responsável: <span className={s.placeholder}>{RESPONSAVEL.nome}</span></div>
          <div>E-mail: <span className={s.placeholder}>{RESPONSAVEL.email}</span></div>
          <div>Site: <span className={s.placeholder}>{RESPONSAVEL.dominio}</span></div>
          <div>CNPJ: <span className={s.placeholder}>{RESPONSAVEL.cnpj}</span></div>
        </div>
      </section>
    </PublicLayout>
  )
}
