// AVISO: texto-base gerado automaticamente. RECOMENDA-SE REVISÃO JURÍDICA antes de uso em produção, especialmente a distinção controlador/operador e a base legal de cada tratamento.
import { PublicLayout } from '../../components/PublicLayout/PublicLayout'
import s from './Privacidade.module.css'

const ULTIMA_ATUALIZACAO = '[DD/MM/AAAA — DATA DA REVISÃO JURÍDICA]'

export function Privacidade() {
  return (
    <PublicLayout>
      <h1 className={s.titulo}>Política de Privacidade</h1>
      <p className={s.subtitulo}>
        Esta Política de Privacidade descreve como o FlowOps trata dados pessoais no âmbito do sistema de
        Ordem de Serviço digital, em conformidade com a Lei nº 13.709/2018 — Lei Geral de Proteção de Dados
        Pessoais (LGPD).
      </p>
      <p className={s.atualizadoEm}>Última atualização: {ULTIMA_ATUALIZACAO}</p>

      <nav className={s.sumario} aria-label="Sumário">
        <p className={s.sumarioTitulo}>Sumário</p>
        <ol className={s.sumarioLista}>
          <li><a href="#controlador-operador">1. Controlador, operador e encarregado (DPO)</a></li>
          <li><a href="#dados-coletados">2. Dados pessoais coletados</a></li>
          <li><a href="#finalidade-base-legal">3. Finalidade e base legal do tratamento</a></li>
          <li><a href="#compartilhamento">4. Compartilhamento de dados e transferência internacional</a></li>
          <li><a href="#direitos-titular">5. Direitos do titular</a></li>
          <li><a href="#retencao">6. Retenção e eliminação de dados</a></li>
          <li><a href="#seguranca">7. Segurança da informação</a></li>
          <li><a href="#menores">8. Uso por menores de idade</a></li>
          <li><a href="#cookies">9. Cookies e tecnologias similares</a></li>
          <li><a href="#alteracoes">10. Alterações desta política</a></li>
          <li><a href="#contato">11. Canal de contato</a></li>
        </ol>
      </nav>

      <section id="controlador-operador" className={s.secao}>
        <h2 className={s.secaoTitulo}>1. Controlador, operador e encarregado (DPO)</h2>
        <p className={s.paragrafo}>
          <span className={s.placeholder}>[RAZÃO SOCIAL]</span>, inscrita no CNPJ sob o nº{' '}
          <span className={s.placeholder}>[CNPJ]</span>, com sede em{' '}
          <span className={s.placeholder}>[ENDEREÇO]</span> ("FlowOps", "nós"), é a empresa desenvolvedora e
          fornecedora do sistema FlowOps.
        </p>
        <div className={s.caixaAlerta}>
          <strong>Distinção importante — controlador vs. operador (art. 5º, VI e VII da LGPD):</strong>
          <ul className={s.lista} style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            <li>
              O FlowOps é oferecido no modelo SaaS (software as a service), white-label, para empresas de
              manutenção de instrumentos regulados pelo INMETRO ("empresa-cliente", "empresa contratante").
            </li>
            <li>
              Em relação aos dados que a empresa-cliente insere no sistema — dados dos seus técnicos, dos seus
              clientes finais (parceiros e lojas), e das Ordens de Serviço que ela opera —{' '}
              <strong>a empresa-cliente é a CONTROLADORA</strong>, pois é ela quem decide coletar esses dados e
              define a finalidade e a forma do tratamento. O FlowOps atua nesse caso como{' '}
              <strong>OPERADOR</strong>, realizando o tratamento em nome e conforme as instruções da
              empresa-cliente controladora, disponibilizando a infraestrutura técnica (armazenamento, aplicativo,
              geração de documentos) para que ela execute sua operação.
            </li>
            <li>
              Em relação aos dados cadastrais e de contato da própria empresa-cliente (para fins de contratação,
              faturamento e suporte) e a dados de segurança/auditoria da própria plataforma,{' '}
              <strong>o FlowOps ([RAZÃO SOCIAL]) atua como CONTROLADOR</strong>.
            </li>
          </ul>
        </div>
        <p className={s.paragrafo}>
          Encarregado pelo Tratamento de Dados Pessoais (DPO — art. 41 da LGPD):
        </p>
        <div className={s.contatoBox}>
          <div>Nome: <span className={s.placeholder}>[NOME DO ENCARREGADO]</span></div>
          <div>E-mail: <span className={s.placeholder}>[E-MAIL DO ENCARREGADO]</span></div>
        </div>
      </section>

      <section id="dados-coletados" className={s.secao}>
        <h2 className={s.secaoTitulo}>2. Dados pessoais coletados</h2>
        <p className={s.paragrafo}>O FlowOps trata as seguintes categorias de dados pessoais:</p>
        <ul className={s.lista}>
          <li>
            <strong>Dados de cadastro de usuários</strong> (técnicos, gestores e administradores): nome, e-mail,
            perfil de acesso (role), matrícula, RG, número de registro profissional no INMETRO do técnico
            (quando aplicável) e os estados (UF) de cobertura/atuação.
          </li>
          <li>
            <strong>Dados de autenticação:</strong> credenciais de acesso geridas pelo Firebase Authentication
            (e-mail e senha) e metadados técnicos de login (data/hora de acesso).
          </li>
          <li>
            <strong>Dados de parceiros e lojas</strong> (clientes finais da empresa-cliente): nome do parceiro,
            nome, endereço, cidade e estado de cada loja atendida.
          </li>
          <li>
            <strong>Dados das Ordens de Serviço:</strong> descrição do problema relatado e do serviço realizado,
            dados dos equipamentos atendidos (modelo, número de série, número e selo do INMETRO), peças
            utilizadas, datas e horários de abertura, entrada e saída do atendimento, nome e matrícula da pessoa
            que assina como cliente no local.
          </li>
          <li>
            <strong>Assinaturas digitais</strong> do cliente e do técnico, capturadas como imagem no aplicativo
            para formalizar a conclusão do atendimento.
          </li>
        </ul>
        <div className={s.caixaAviso}>
          <strong>Atenção — possível dado sensível (art. 5º, II da LGPD):</strong> a assinatura manuscrita
          capturada digitalmente pode, a depender da técnica de captura e do entendimento da autoridade
          competente, ser qualificada como dado biométrico (dado sensível), mesmo quando o FlowOps armazena
          apenas a imagem final do traço e não os dados dinâmicos da caneta (pressão, velocidade, aceleração).
          Por cautela, recomenda-se tratar esse dado com o mesmo rigor de segurança aplicável a dados sensíveis
          até confirmação jurídica em contrário.
        </div>
      </section>

      <section id="finalidade-base-legal" className={s.secao}>
        <h2 className={s.secaoTitulo}>3. Finalidade e base legal do tratamento</h2>
        <p className={s.paragrafo}>
          Cada tratamento realizado no FlowOps possui uma finalidade específica e se apoia em uma das hipóteses
          legais previstas no art. 7º da LGPD:
        </p>
        <div className={s.tabelaWrapper}>
          <table className={s.tabela}>
            <thead>
              <tr>
                <th>Finalidade</th>
                <th>Base legal (art. 7º, LGPD)</th>
                <th>Papel do FlowOps</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cadastro e autenticação de técnicos, gestores e administradores</td>
                <td>V — execução de contrato de trabalho/prestação de serviço entre a empresa-cliente e o usuário</td>
                <td>Operador</td>
              </tr>
              <tr>
                <td>Registro e execução das Ordens de Serviço (dados do equipamento, atendimento, peças)</td>
                <td>V — execução de contrato; II — cumprimento de obrigação legal/regulatória (auditoria INMETRO)</td>
                <td>Operador</td>
              </tr>
              <tr>
                <td>Captura da assinatura digital do cliente e do técnico</td>
                <td>V — execução de contrato (formalização da conclusão do serviço); II — obrigação legal (comprovação do atendimento)</td>
                <td>Operador</td>
              </tr>
              <tr>
                <td>Funcionamento offline e sincronização automática dos dados do app</td>
                <td>IX — legítimo interesse do controlador na continuidade operacional do atendimento em campo</td>
                <td>Operador</td>
              </tr>
              <tr>
                <td>Geração de relatórios, dashboards e indicadores gerenciais</td>
                <td>IX — legítimo interesse do controlador na gestão do próprio negócio</td>
                <td>Operador</td>
              </tr>
              <tr>
                <td>Cadastro, faturamento e suporte da empresa-cliente contratante do FlowOps</td>
                <td>V — execução do contrato de licenciamento/assinatura do software</td>
                <td>Controlador</td>
              </tr>
              <tr>
                <td>Segurança da plataforma, prevenção a fraude e auditoria de acessos</td>
                <td>II — cumprimento de obrigação legal/regulatória; IX — legítimo interesse</td>
                <td>Controlador / Operador</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={s.paragrafo}>
          <strong>Nota:</strong> a classificação exata de cada base legal — em especial a diferença entre
          execução de contrato, cumprimento de obrigação regulatória (INMETRO) e legítimo interesse — deve ser
          confirmada por assessoria jurídica especializada, considerando o contrato firmado entre{' '}
          <span className={s.placeholder}>[RAZÃO SOCIAL]</span> e cada empresa-cliente.
        </p>
      </section>

      <section id="compartilhamento" className={s.secao}>
        <h2 className={s.secaoTitulo}>4. Compartilhamento de dados e transferência internacional</h2>
        <p className={s.paragrafo}>
          Para operar o FlowOps, contratamos os seguintes suboperadores/prestadores de infraestrutura, que
          tratam dados pessoais em nosso nome e sob nossas instruções:
        </p>
        <ul className={s.lista}>
          <li>
            <strong>Google Firebase</strong> (Firestore e Firebase Authentication) — armazenamento do banco de
            dados e gestão de autenticação de usuários.
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem do painel web do gestor/administrador.
          </li>
          <li>
            <strong>Cloudinary</strong> — armazenamento de fotografias eventualmente anexadas a um atendimento
            (ex.: foto do equipamento ou do selo), quando esse recurso é utilizado.
          </li>
        </ul>
        <p className={s.paragrafo}>
          Esses prestadores operam infraestrutura própria, que pode incluir servidores localizados fora do
          território brasileiro (transferência internacional de dados, art. 33 da LGPD). Nesses casos, buscamos
          contratar apenas prestadores que ofereçam garantias adequadas de proteção — como cláusulas contratuais
          padrão, certificações internacionais de segurança ou adesão a mecanismos reconhecidos pela Autoridade
          Nacional de Proteção de Dados (ANPD).
        </p>
        <p className={s.paragrafo}>
          Não vendemos, alugamos ou comercializamos dados pessoais tratados no FlowOps a terceiros para fins de
          publicidade. Dados podem ainda ser divulgados a autoridades públicas quando exigido por lei, decisão
          judicial ou requisição regulatória (ex.: fiscalização do INMETRO).
        </p>
      </section>

      <section id="direitos-titular" className={s.secao}>
        <h2 className={s.secaoTitulo}>5. Direitos do titular</h2>
        <p className={s.paragrafo}>
          Nos termos do art. 18 da LGPD, o titular dos dados pessoais tem direito a solicitar, mediante
          requisição:
        </p>
        <ul className={s.lista}>
          <li>Confirmação da existência de tratamento de seus dados;</li>
          <li>Acesso aos dados tratados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>
            Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em
            desconformidade com a LGPD;
          </li>
          <li>Portabilidade dos dados a outro fornecedor de serviço ou produto, mediante requisição expressa;</li>
          <li>Eliminação dos dados pessoais tratados com base no consentimento do titular;</li>
          <li>Informação sobre entidades públicas e privadas com as quais os dados foram compartilhados;</li>
          <li>Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;</li>
          <li>Revogação do consentimento, quando o tratamento tiver essa base legal.</li>
        </ul>
        <p className={s.paragrafo}>
          <strong>Como exercer:</strong> solicitações podem ser enviadas ao canal de contato indicado na seção
          11. Caso o dado pessoal em questão tenha sido inserido no sistema por uma empresa-cliente que atua
          como controladora (por exemplo, um técnico ou o cliente final de uma loja atendida), poderemos
          direcionar a solicitação à empresa-cliente responsável ou atuar em conjunto com ela para atendê-la,
          conforme o papel de operador descrito na seção 1.
        </p>
      </section>

      <section id="retencao" className={s.secao}>
        <h2 className={s.secaoTitulo}>6. Retenção e eliminação de dados</h2>
        <p className={s.paragrafo}>
          Dados pessoais são mantidos pelo período necessário ao cumprimento das finalidades descritas nesta
          política, observado o disposto no art. 15 e no art. 16 da LGPD.
        </p>
        <div className={s.caixaAlerta}>
          <strong>Ordens de Serviço concluídas — registro de auditoria:</strong> após finalizada, a Ordem de
          Serviço se torna um registro de auditoria do atendimento a um instrumento regulado pelo INMETRO e
          passa a ser somente leitura no sistema. Esses registros <strong>não são eliminados mediante simples
          solicitação</strong>, pois sua conservação se enquadra na hipótese do art. 16, I, da LGPD (cumprimento
          de obrigação legal ou regulatória pelo controlador), sendo necessários para eventual fiscalização e
          para a própria defesa da empresa-cliente e do FlowOps em caso de disputa sobre o serviço prestado.
        </div>
        <p className={s.paragrafo}>
          Dados de cadastro de usuários que deixam de atuar (por exemplo, um técnico desligado) podem ser
          desativados no sistema, preservando-se o histórico de Ordens de Serviço já vinculado a esse usuário
          pelos mesmos motivos de auditoria. Findas as hipóteses legais de retenção, os dados são eliminados ou
          anonimizados.
        </p>
      </section>

      <section id="seguranca" className={s.secao}>
        <h2 className={s.secaoTitulo}>7. Segurança da informação</h2>
        <p className={s.paragrafo}>
          Adotamos medidas técnicas e administrativas para proteger os dados pessoais tratados no FlowOps,
          incluindo:
        </p>
        <ul className={s.lista}>
          <li>Autenticação individual por usuário via Firebase Authentication (e-mail e senha, sem senhas compartilhadas);</li>
          <li>Controle de acesso por perfil (técnico, gestor, administrador) e por estado (UF) de cobertura, aplicado no nível do banco de dados (Security Rules do Firestore);</li>
          <li>Criptografia em trânsito (HTTPS/TLS) nas comunicações entre os aplicativos e a infraestrutura do Google Firebase, Vercel e Cloudinary;</li>
          <li>Ordens de Serviço concluídas tornam-se somente leitura, preservando a integridade do registro;</li>
          <li>Segregação de dados por estado/região, restringindo o acesso de cada usuário apenas ao escopo necessário à sua função.</li>
        </ul>
        <p className={s.paragrafo}>
          Nenhum sistema é inteiramente livre de risco. Caso ocorra um incidente de segurança que possa acarretar
          risco ou dano relevante aos titulares, comunicaremos o fato à ANPD e aos titulares afetados nos termos
          do art. 48 da LGPD.
        </p>
      </section>

      <section id="menores" className={s.secao}>
        <h2 className={s.secaoTitulo}>8. Uso por menores de idade</h2>
        <p className={s.paragrafo}>
          O FlowOps é um sistema de uso profissional/corporativo, destinado a técnicos, gestores e
          administradores maiores de 18 anos vinculados a empresas de manutenção de instrumentos regulados. Não
          direcionamos o sistema a crianças ou adolescentes e não coletamos intencionalmente dados pessoais de
          menores de idade.
        </p>
      </section>

      <section id="cookies" className={s.secao}>
        <h2 className={s.secaoTitulo}>9. Cookies e tecnologias similares</h2>
        <p className={s.paragrafo}>
          O painel web do FlowOps utiliza cookies e/ou armazenamento local (local storage / IndexedDB)
          estritamente necessários ao funcionamento do sistema, como:
        </p>
        <ul className={s.lista}>
          <li>Manutenção da sessão autenticada do usuário (Firebase Authentication);</li>
          <li>Cache local para persistência offline dos dados (IndexedDB), permitindo o uso do painel mesmo com instabilidade de conexão;</li>
          <li>
            Quando configurado, métricas de uso agregadas via Firebase Analytics/Google Analytics, para
            entendimento geral de uso da plataforma.
          </li>
        </ul>
        <p className={s.paragrafo}>
          Não utilizamos cookies de publicidade ou de rastreamento de terceiros para fins comerciais. O
          aplicativo móvel do técnico não utiliza cookies, por não operar em navegador.
        </p>
      </section>

      <section id="alteracoes" className={s.secao}>
        <h2 className={s.secaoTitulo}>10. Alterações desta política</h2>
        <p className={s.paragrafo}>
          Esta Política de Privacidade pode ser atualizada periodicamente, para refletir mudanças no FlowOps ou
          na legislação aplicável. A data da última atualização está indicada no topo desta página. Alterações
          relevantes serão comunicadas por aviso no painel web e/ou por e-mail aos administradores das
          empresas-clientes, com antecedência razoável antes da entrada em vigor, quando exigido por lei.
        </p>
      </section>

      <section id="contato" className={s.secao}>
        <h2 className={s.secaoTitulo}>11. Canal de contato</h2>
        <p className={s.paragrafo}>
          Dúvidas, solicitações relacionadas a dados pessoais ou exercício dos direitos previstos no art. 18 da
          LGPD podem ser encaminhadas para:
        </p>
        <div className={s.contatoBox}>
          <div><span className={s.placeholder}>[RAZÃO SOCIAL]</span></div>
          <div>Encarregado (DPO): <span className={s.placeholder}>[NOME DO ENCARREGADO]</span></div>
          <div>E-mail: <span className={s.placeholder}>[E-MAIL DO ENCARREGADO]</span></div>
          <div>Endereço: <span className={s.placeholder}>[ENDEREÇO]</span></div>
        </div>
      </section>
    </PublicLayout>
  )
}
