# FlowOps

Sistema de **Ordem de Serviço (OS) digital** para a Hightec Manutenção Eletrônica LTDA — manutenção de balanças. Substitui o formulário de OS em papel por web (painel do gestor) + app mobile (técnico em campo).

> Domínio regulado: envolve selos do INMETRO. Integridade e trilha de auditoria dos dados são requisitos, não opcionais.

---

## White-label

O sistema é **white-label**: nenhuma string da empresa operadora está hardcoded no código.
- Dados da empresa (nome, CNPJ, contato, logo) são lidos de `config/empresa` no Firestore.
- O documento de OS usa esses dados no cabeçalho; fallback: "FlowOps".
- Admin configura via `/configuracoes`.
- A tela de login exibe o `nomeEmpresa` como subtítulo (vazio se não configurado).

---

## Stack

- **Firebase** como backend (plano **Spark/Free** — sem Cloud Functions):
  - **Firestore** — banco de dados + persistência offline (requisito crítico)
  - **Firebase Auth** — login/senha, recuperação de senha, roles via custom claims
  - ~~Storage~~ — **NÃO usar Firebase Storage** (passou a exigir plano Blaze; ver seção abaixo)
- **Web (painel do gestor):** React + Vite + TypeScript — **hosting via Vercel** (deploy contínuo a partir do GitHub, plano free sem cartão; NÃO usar Firebase Hosting que exige Blaze)
- **App (técnico):** Expo (React Native) + TypeScript + `@react-native-firebase/firestore`
- **Versionamento:** Git / GitHub (repo: adrianoraki/FlowOps)

Web e app compartilham React + TypeScript → reaproveitar tipos, validações e lógica sempre que possível.

---

## Offline-first (requisito crítico)

O técnico preenche a OS **sem internet** no campo (galpões, lojas com sinal ruim). A OS deve salvar localmente e sincronizar sozinha quando a conexão voltar.

- Mobile: `@react-native-firebase/firestore` com persistência habilitada (SQLite local).
- Web: SDK do Firebase com `enableIndexedDbPersistence` (IndexedDB).
- **Não escrever lógica de sincronização manual** — o Firestore já faz isso. Apenas habilitar e respeitar a persistência.

---

## Perfis de acesso (campo `role` em `users/{uid}`)

| Role | Acesso |
|---|---|
| `tecnico` | Vê apenas OSs dos estados que cobre e as que criou. Cria e edita OS. **Acessa o site** (visão restrita: Minhas OSs + Meu Estoque) e o app mobile. |
| `gestor` | Vê e gerencia tudo dos estados que cobre (OSs e técnicos) + dashboard regional. |
| `admin` | Visão global de todos os estados, dashboard consolidado, cadastros e relatórios. |

## Regiões e Estados

- As **5 regiões do Brasil são fixas no código** (`REGIOES_BRASIL` em `packages/types`) — não é mais um cadastro manual no Firestore. A tela `/regioes` só exibe essa estrutura como referência (somente leitura).
- Cada técnico/gestor cobre um ou mais **estados (UF)**: campo `estados: string[]` em `users/{uid}` (ex: `['SP', 'RJ']`). Um usuário pode cobrir vários estados, de regiões diferentes se necessário.
- Cada OS acontece em **um único estado**: campo `estado: string` em `ordens_servico/{id}`.
- Security Rules e queries filtram por `estado` ∈ `estados` do usuário + `role` (ver `meusEstados()` em `firestore.rules`).

## Setores (white-label)

- Coleção `setores/{id}`: `{ nome: string, ativo?: boolean }` — cadastro próprio de cada empresa (diferente das 5 regiões, que são fixas globalmente).
- Gerenciado em `/configuracoes` (somente admin): listar, adicionar, remover. Na primeira vez que a coleção está vazia, é populada automaticamente com os setores padrão (`SETORES_PADRAO` em `packages/types`): Açougue, Hortifruti, Perecíveis, Empório Frios, FLV, Autoatendimento, PDV.
- Usado como dropdown na coluna "Setor" da tabela de atendimentos da OS (`Atendimento.setor: string`), entre "N.º Série" e "Mau Uso". Web e app carregam a lista via `onSnapshot`.
- Leitura liberada para qualquer usuário autenticado; escrita restrita a `admin`.

## Modelos de balança (white-label)

- Coleção `modelos/{id}`: `{ nome: string, ativo?: boolean }` — catálogo próprio de cada empresa, mesmo padrão dos setores (sem lista padrão pré-populada).
- Gerenciado em `/configuracoes` (admin/gestor), na seção "Modelos de balança": listar, adicionar, remover.
- Usado como dropdown na coluna "Modelo" da tabela de atendimentos da OS (`Atendimento.modelo: string`). Web e app carregam a lista via `onSnapshot`.
- Leitura liberada para qualquer usuário autenticado; escrita para `admin` ou `gestor`.

## Balanças / Equipamentos (FUNDAÇÃO — sem telas ainda)

> **Status atual: só existe a fundação** — tipo `Balanca` (`packages/types`), coleção `balancas` e a Security Rule. **Não há telas de cadastro/edição/listagem.** Não construir essas telas até que seja pedido explicitamente.

- Objetivo: cadastrar o parque de balanças de cada loja (ex: Assaí 305 tem 36 balanças), em vez de o técnico digitar os dados do equipamento a cada atendimento.
- Coleção `balancas/{id}`: `{ lojaId, parceiroId, numeroSerie, numeroInmetro, modelo, setor?, portaria, seloInmetro, ativo, empresaId?, createdAt }` — campos espelham `Atendimento` (mesmo padrão de nomes: `modelo`/`setor` referenciam os catálogos `modelos`/`setores`) para que uma futura tela de OS possa pré-preencher o atendimento a partir de uma `Balanca` escolhida.
- `empresaId` é reservado para uma eventual arquitetura multi-empresa — hoje o sistema é single-tenant (white-label de uma empresa por deploy, ver `config/empresa`); nenhuma tela lê/grava esse campo ainda.
- Security Rules: leitura para qualquer autenticado, escrita `admin`/`gestor` (mesmo padrão de `modelos`/`setores`/`pecas`). Testado em `firestore.rules.test.js` (describe "balancas: fundação do parque de equipamentos por loja").
- **Plano futuro (não implementar agora):**
  1. Telas de cadastro/edição/listagem de balanças por loja (provável local: dentro da tela de Lojas, em `/parceiros`).
  2. Na criação da OS, poder selecionar uma `Balanca` já cadastrada da loja (autocompletando `numeroSerie`/`numeroInmetro`/`modelo`/`setor`/`portaria`/`seloInmetro` no atendimento) em vez de digitar tudo.
  3. Contagem de balanças por loja/parceiro — base para precificação por equipamento.

## Parceiros e Lojas (Rede > Lojas)

- Um **parceiro** é `'rede'` (várias lojas) ou `'unico'` (uma loja só). O estado/cidade/região ficam na **loja**, nunca no parceiro — uma rede pode ter lojas em vários estados.
- Cadastro em `/parceiros` (admin/gestor):
  - `tipo: 'unico'` → o formulário já pede os dados da loja única (número opcional, nome, estado, cidade) e cria parceiro + loja juntos (`writeBatch`). Não precisa "entrar" na rede para isso.
  - `tipo: 'rede'` → o botão "Lojas" na listagem abre uma **tela cheia dedicada** (não um slide-over) com tabela confortável (número, nome, cidade, UF, status, ações); adicionar/editar uma loja abre um slide-over compacto só com o formulário. Campos: número (obrigatório), nome, estado (dropdown 27 UFs), cidade (dropdown carregado do estado).
- **Município e região são automáticos**: dropdown de cidade carrega de `MUNICIPIOS_POR_UF` (dataset embutido, `packages/types/src/municipios.ts` — 27 estados, 5570 municípios, sem dependência de rede); região é derivada do estado via `regiaoDoEstado()`. Nunca digitados à mão.
- **Criação de OS**: seleciona-se o parceiro e depois a loja (`numero - nome - cidade/UF`). Ao escolher a loja, `estado`, `cidade` e `regiao` da OS são preenchidos automaticamente (read-only) — isso também alimenta o filtro de técnicos por estado. `parceiroId`, `parceiroNome`, `lojaId`, `lojaNumero`, `lojaNome` ficam gravados na OS (denormalizados, evita joins nas listas/relatórios/impressão).
- Security Rules de `lojas/{id}`: leitura para qualquer autenticado, escrita admin/gestor (igual a `parceiros`). A regra de `ordens_servico` continua baseada só em `estado` (`estado in meusEstados()`) — não muda com essa reestruturação, pois a loja é só quem alimenta esse campo.

## Modelo de dados (Firestore)

```
config/empresa          // white-label — dados da empresa operadora do sistema
  nomeEmpresa, cnpj, registro, telefone1, telefone2, email, site, endereco, logoUrl
  regInmetro?     // registro ÚNICO da oficina autorizada no INMETRO (ex: "73000171") — editável só por admin em /configuracoes; exibido na área de assinatura do técnico em toda OS impressa/PDF, o mesmo valor para qualquer técnico

setores/{id}            // white-label — cadastro de setores desta empresa
  nome, ativo?: boolean

modelos/{id}            // white-label — catálogo de modelos de balança desta empresa
  nome, ativo?: boolean

users/{uid}
  nome, email, role: 'tecnico'|'gestor'|'admin', matricula, rg
  cpf?            // CPF do técnico (com máscara 000.000.000-00), cadastrado em /tecnicos (web) com validação de dígito verificador — ver formatarCPF/validarCPF em packages/types
  regInmetro?     // @deprecated — era o registro INMETRO por técnico, erro de modelagem (o registro é único da empresa, ver config/empresa.regInmetro acima). Mantido só nos docs de técnicos cadastrados antes da correção (2026-07); NÃO ler/escrever em código novo. /tecnicos (web) sinaliza com um aviso quem tem esse campo preenchido e ainda não tem `cpf` — precisa recadastrar
  estados: string[] // UFs cobertas (técnico) ou geridas (gestor) — ver REGIOES_BRASIL em packages/types
  ativo: boolean  // default true; false = desativado. Remover do Auth exige Admin SDK (TODO)

parceiros/{id}        // empresa-cliente que contrata a manutenção — rede ou loja única
  nome, tipo: 'rede' | 'unico'

lojas/{id}             // uma loja pertence a um parceiro (1 loja se 'unico', N se 'rede')
  parceiroId, numero?: string, nome, cidade, estado
  regiao               // derivada do estado (regiaoDoEstado) — só para relatórios/exibição

pecas/{id}
  nome, codigo, unidade, ativo: boolean

movimentacoes/{id}
  tipo              // 'envio' | 'devolucao'
  tecnicoId         // destinatário (envio) ou remetente (devolução)
  itens: [{ pecaId, quantidade }]
  status            // 'pendente' | 'confirmada' | 'divergencia'
  criadoPorId, confirmadoPorId, observacao
  createdAt, confirmadoEm

estoque_tecnico/{id}
  tecnicoId, pecaId, quantidade   // saldo calculado; NUNCA editar à mão

selos/{id}              // controle de lacres INMETRO — um documento por selo físico (ver seção "Controle de Selos")
  numeroSerie, status: 'disponivel' | 'enviado' | 'usado'
  tecnicoId?, dataEnvio?, createdAt

solicitacoesSelo/{id}   // pedido de reposição de selos feito pelo técnico
  tecnicoId, quantidade, status: 'pendente' | 'atendida'
  createdAt, atendidaPorId?, atendidaEm?

ordens_servico/{id}
  numero            // ex: 0137 — atribuído via transação client-side em counters/ordens
  tipo              // 'corretiva' | 'preventiva' | 'emergencia'
  parceiroId, parceiroNome, lojaId, lojaNumero?, lojaNome  // preenchidos ao escolher a loja — não digitados
  cidade            // vem da loja escolhida
  estado            // vem da loja escolhida — usado pelas Security Rules e pela atribuição de técnico
  regiao            // derivada do estado da loja — só para relatórios/exibição
  solicitante       // nome de quem abriu o chamado (era "veículo")
  dataAbertura, entrada, saida
  criadoPorId       // uid do admin/gestor que criou/despachou a OS
  tecnicoId         // uid do técnico atribuído
  atendimentos: [   // tabela central da OS
    {
      chamado,        // n.º do chamado desta balança — opcional; finalizar a OS só avisa se faltar, não bloqueia
      modelo,         // nome do modelo (ver coleção modelos) — dropdown, texto livre no dado
      nSerie,
      setor,          // nome do setor (ver coleção setores) — dropdown, texto livre no dado
      mauUso,
      nInmetro, seloInmetro, seloAtual,
      portaria,
      etqReparado,    // texto livre (era boolean até 2026-07) — o técnico descreve a etiqueta de reparo. OS antigas ainda têm boolean gravado: sempre passar atendimentos lidos do Firestore por `normalizarAtendimentos()` (packages/types) antes de exibir/imprimir/gerar PDF — sem isso, `true`/`false` legado derruba a geração do PDF (esc() chama .replace num boolean) e some silenciosamente na impressão web (React não renderiza boolean).
      descricaoIntervencao   // rótulo "Descrição do problema relatado pelo cliente:" (renomeado de "Descrição do problema Relatado:" em 2026-07) — o que o CLIENTE/solicitante relatou para ESTA balança (por atendimento, não confundir com `comentarios` abaixo, que é da OS inteira). Preenchido como textarea (não input de 1 linha) na web, limitado a 20 linhas via `limitarLinhas()` (packages/types); exibido em negrito (label e valor) na web, no app (somente-leitura) e no PDF/impressão nos dois
    }
  ]
  comentarios                  // rótulo "Descrição do Problema" — o que o TÉCNICO diagnosticou/identificou (nível da OS)
  descricaoServicoRealizado    // rótulo "Descrição do Serviço Realizado" — o que o TÉCNICO fez (nível da OS)
  solicitacaoMaterial          // rótulo "Solicitação de Material" — preenchido quando falta peça
  pecasUsadas: [{ pecaId, nome, quantidade }]   // catálogo de peças (coleção pecas) + quantidade — campo em destaque na tela da OS do app; admin/gestor também podem editar na web enquanto a OS estiver aberta
  assinaturaClienteUrl, nomeLegivel, matriculaCliente
  assinaturaTecnicoUrl, rgTecnico
  status            // 'aberta' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada'
  aguardandoPecaDesde   // setado ao entrar em 'aguardando_peca' — usado pela aba "Aguardando Peça" (app/web) para mostrar desde quando
  createdAt, updatedAt, fechadaEm
```

> **Os 4 campos de descrição da OS — não confundir (histórico de confusão, cuidado ao mexer):**
>
> | Campo | Rótulo na tela | Nível | Preenchido por | Conteúdo |
> |---|---|---|---|---|
> | `atendimentos[].descricaoIntervencao` | "Descrição do problema relatado pelo cliente:" — **negrito**, textarea maior, máx. 20 linhas (web) | por balança | quem despacha, a partir do relato do cliente | o que o **CLIENTE/solicitante** relatou para aquela balança específica |
> | `comentarios` | Web: "Descrição do Problema". App: seção "Descrição do Problema", campo **"Serviço Realizado"** | da OS | técnico | o que o **TÉCNICO** diagnosticou/identificou |
> | `descricaoServicoRealizado` | Web: "Descrição do Serviço Realizado". App: seção **"Comentários"**, campo "O que foi feito pelo técnico" (+ ajuda: "Use para registrar irregularidades encontradas, seja no chamado, na infraestrutura, etc.") | da OS | técnico | o que o **TÉCNICO** fez |
> | `solicitacaoMaterial` | "Solicitação de Material" (igual nos dois; no app + ajuda: "Use apenas quando for necessário pedir peças. Isso deixa o chamado pendente de conclusão.") | da OS | técnico | preenchido quando falta peça |
>
> ⚠️ Desde 2026-07, os rótulos visíveis no **app** para `comentarios` e `descricaoServicoRealizado` foram trocados a pedido do usuário (mantendo as mesmas chaves no Firestore) e **divergem dos rótulos da web**, que não foram alterados — só o app do técnico foi escopo desse ajuste. Ver `apps/mobile/app/os/[id].tsx`.

---

## Módulo de Estoque

| Coleção | Responsabilidade |
|---|---|
| `pecas` | Catálogo de peças (admin/gestor gerencia) |
| `movimentacoes` | Registro de envios e devoluções de peças a técnicos |
| `estoque_tecnico` | Saldo atual por técnico/peça — leitura apenas |

**Regras de saldo (sem Cloud Functions):**
- Saldo atualizado via **transação Firestore** quando o RECEBEDOR confirma.
- `envio` confirmado pelo **técnico** → soma quantidade em `estoque_tecnico`.
- `devolucao` confirmada pelo **admin/gestor** → subtrai quantidade em `estoque_tecnico`.
- **Quem lança nunca confirma** (admin/gestor lança envio; técnico confirma).
- Status `divergencia` quando quantidade recebida ≠ quantidade enviada.

> **Dívida técnica conhecida — `estoque_tecnico`:** no plano Free (sem Cloud Functions), as Security Rules não garantem que a escrita do saldo ocorra *apenas* via transação de confirmação. Um técnico com acesso técnico poderia, em tese, alterar o próprio saldo diretamente no banco. Risco aceito na fase atual (estoque é controle interno). Mitigação definitiva: mover a atualização de saldo para Cloud Function ao migrar para o plano Blaze.

---

## Controle de Selos

Estoque de lacres/selos INMETRO — módulo próprio, independente do Módulo de Estoque (peças). Web: `apps/web/src/pages/Selos/Selos.tsx`, único componente para os dois perfis (mesmo padrão de `Estoque.tsx`: um `isGestor = role === 'admin' || role === 'gestor'` decide o que renderiza). Rota `/selos`, nav "Selos" (admin/gestor) ou "Meus Selos" (técnico) — gestor tem os mesmos poderes de admin nesse módulo (decisão explícita do usuário, consistente com o resto do app).

| Coleção | Responsabilidade |
|---|---|
| `selos/{id}` | Um selo físico individual — `numeroSerie`, `status: 'disponivel' \| 'enviado' \| 'usado'`, `tecnicoId?`, `dataEnvio?`, `createdAt` |
| `solicitacoesSelo/{id}` | Pedido de reposição feito pelo técnico — `tecnicoId`, `quantidade`, `status: 'pendente' \| 'atendida'`, `createdAt`, `atendidaPorId?`, `atendidaEm?` |

**Sem contador agregado (decisão deliberada):** ao contrário do que foi cogitado (`counters/selos`), os totais (disponível, enviado por técnico) são **calculados no cliente** a partir da mesma coleção `selos` já carregada pra listagem — não existe um documento de contador pra manter sincronizado. Motivo: no plano Spark (sem Cloud Functions), um contador agregado exigiria atualização via transação em todo caminho que muda o status de um selo, criando o mesmo risco de dessincronização já documentado pra `estoque_tecnico`. Como `selos` é uma coleção de documentos individuais (não somas por técnico como `estoque_tecnico`), simplesmente contar os documentos já carregados é mais simples e não pode ficar dessincronizado.

**Fluxo:**
- **Cadastro** (admin/gestor): uma única textarea, um número de série por linha — serve tanto pra um selo só quanto pra um lote grande. Duplicados (já cadastrados ou repetidos na própria lista colada) são ignorados automaticamente, com aviso de quantos foram pulados. Grava via `writeBatch` (até 500 por lote, fatiado se a lista colada for maior).
- **Envio** (admin/gestor): escolhe um técnico + um ou mais selos com `status == 'disponivel'` (lista com checkbox); `writeBatch` marca todos como `enviado`, grava `tecnicoId` e `dataEnvio`.
- **Uso**: não há tela de "usar selo" ainda — isso pertence à integração futura com o atendimento da OS (fora do escopo desta tarefa, ver nota abaixo). Por ora, admin/gestor pode marcar manualmente um selo `enviado` como `usado` (ou reverter `usado`→`disponivel`, limpando `tecnicoId`/`dataEnvio`) direto na listagem — necessário pra existir algum caminho até esse status e pro filtro por status fazer sentido.
- **Solicitação de reposição** (técnico): botão "Solicitar mais selos" grava `solicitacoesSelo` com `status: 'pendente'`. Admin/gestor vê a lista (aba "Solicitações") e marca manualmente como `atendida` — **não há vínculo automático** entre a solicitação e um envio; admin usa a tela de Envio separadamente e depois marca a solicitação como atendida.
- Técnico só lê os próprios selos (`tecnicoId == uid`) e as próprias solicitações; não vê o estoque disponível nem selos/solicitações de outros técnicos (Security Rules, não só UI).

> **Módulo isolado de propósito:** não há nenhuma integração com `OrdemServico`/`Atendimento` ainda (o campo `seloInmetro`/`seloAtual` do atendimento continua sendo texto livre, independente deste controle de estoque). Essa integração — descontar um selo do estoque do técnico quando ele é aplicado numa OS — é um passo futuro, deliberadamente fora desta tarefa.

**Security Rules** (`selos/{id}`, `solicitacoesSelo/{id}`): admin/gestor leitura+escrita total; técnico só lê selos onde `tecnicoId == seu uid`; técnico cria solicitação só pra si mesmo com `status` inicial `'pendente'`, lê as próprias, **não edita nem apaga nenhuma** (nem a própria — só admin/gestor marca como atendida). Testado em `firestore.rules.test.js` (describes "selos: controle de estoque de lacres INMETRO" e "solicitacoesSelo: pedido de reposição pelo técnico").

> A query do técnico em `solicitacoesSelo` combina `where('tecnicoId','==', uid)` com `orderBy('createdAt','desc')` — mesma situação de `movimentacoes` (`Estoque.tsx`), que exige índice composto. **Descoberto em 2026-07**: nenhum índice composto existia em produção (`firebase firestore:indexes` retornava vazio) — a aba "Movimentações" do técnico em `Estoque.tsx` ficava silenciosamente vazia (erro engolido pelo `onSnapshot`), provavelmente há bastante tempo. Corrigido com `firestore.indexes.json` (agora referenciado em `firebase.json`) + `firebase deploy --only firestore:indexes`, cobrindo `movimentacoes` e `solicitacoesSelo`. **Ao adicionar uma nova query `where` + `orderBy` em campos diferentes, sempre adicionar o índice em `firestore.indexes.json` e fazer o deploy** — não depender só do link de erro do Firestore no console.

---

## Dispatch e Atribuição

**Ciclo de status da OS:**
`aberta` → `em_andamento` → `concluida` (caminho principal)
Desvios: `aguardando_peca` (pausada por falta de material, retomável) · `cancelada` (encerrada sem conclusão)

**Fluxo "Aguardando Peça" (pausar/retomar) — app e web:**
- Botão "Aguardando Peça" disponível quando `status == 'em_andamento'`: muda para `aguardando_peca` e grava `aguardandoPecaDesde` (serverTimestamp) + `updatedAt`/`atualizadoPorId`. Quem pode: técnico dono OU admin/gestor. Pede confirmação antes ("Confirma que essa OS vai aguardar peça?") — app via `Alert.alert` (`confirmarAguardandoPeca()`), web via `window.confirm()`; cancelar não muda nada.
- OS em `aguardando_peca` **não pode ser finalizada** (botão "Finalizar" só aparece com `status === 'em_andamento'`) mas continua editável (não é um status de `STATUS_READONLY`) — o técnico pode registrar a peça necessária em `solicitacaoMaterial` enquanto espera.
- Botão "Retomar atendimento" disponível quando `status == 'aguardando_peca'`: volta para `em_andamento`. Quem pode: técnico dono OU admin/gestor (mesma regra). Também pede confirmação antes ("Confirma que a peça chegou e o atendimento vai continuar?") — mesmo padrão acima (`confirmarRetomarAtendimento()` no app).
- 3ª aba "Aguardando Peça" (entre "Ativas" e "Histórico") no app (`apps/mobile/app/index.tsx`) e na web (`apps/web/src/pages/Ordens/Ordens.tsx`) lista as OSs com esse status, respeitando o filtro por perfil (técnico: só as suas/dos estados que cobre; admin/gestor: todas). Ordenada por `aguardandoPecaDesde` desc; exibe "Aguardando desde".
- `STATUS_ATIVOS` (`packages/types`) não inclui mais `aguardando_peca` — usar `STATUS_AGUARDANDO_PECA` para a aba própria.
- Security Rules: nenhuma regra nova — o `update` de `ordens_servico` já permite qualquer transição de status para o técnico dono ou admin/gestor enquanto o status atual não é `concluida`/`cancelada` (ver comentário em `firestore.rules`). Coberto por testes em `firestore.rules.test.js` (describe "OS: aguardando peça").

**App: contador e indicador de novidade nas abas (`apps/mobile/app/index.tsx` + `useMinhasOS.ts`):**
- Cada aba mostra a contagem atual entre parênteses — "Ativas (5)", "Aguardando Peça (2)", "Histórico (34)" — direto de `ativas.length`/`aguardando.length`/`historico.length`.
- Bolinha vermelha na aba quando há OS ali que o técnico ainda não viu **naquela aba** — mecanismo separado do `seenIds`/`newIds` já existente (que é por OS individual, usado no card "NOVA" e no toast "🔔 Nova OS recebida"). Uma OS que muda de aba (ex: sai de "Ativas" e entra em "Aguardando Peça") conta como novidade na aba nova, mesmo já tendo sido vista antes em outra.
- Persistido em `AsyncStorage` (`@flowops/seenTabIds`, um Set de IDs por aba). `marcarAbaVista(aba)` sobrescreve o Set da aba com os IDs atuais dela — chamado num `useEffect` que reage a `[aba, listaDaAbaAtual]`, então a bolinha nunca acende na aba que já está aberta (mesmo se chegar algo novo enquanto o técnico está olhando) e apaga assim que ele troca de aba.
- Primeira execução do app (nada gravado ainda): inicializa o Set de cada aba com o estado atual, pra não notificar sobre OSs pré-existentes — mesmo padrão já usado pelo `seenIds` original.

**App: campos bloqueados até "Iniciar atendimento":**
- Enquanto `status === 'aberta'`, a tela da OS no app (`apps/mobile/app/os/[id].tsx`) é toda somente-leitura — só o botão "Iniciar atendimento" aparece (nem "Salvar"). Controlado por `podeEditarCampos = !readOnly && os.status !== 'aberta'`.
- Após iniciar (`em_andamento`), os campos do técnico liberam normalmente.
- `atendimentos[].descricaoIntervencao` ("Descrição do problema relatado pelo cliente:") é **sempre** somente-leitura para o técnico no app, mesmo depois de iniciar — é o relato do cliente, não algo que o técnico edita. Só admin/gestor edita esse campo (na web, ao montar/editar a OS).
- Offline: `iniciarAtendimento()` usa o mesmo `.update()` do Firestore que todo o resto do app — resolve contra o cache local na hora (ver comentário em `apps/mobile/src/lib/firebase.ts`), então funciona sem sinal; sincroniza sozinho quando a conexão volta.

**Datas da OS — abertura / início / finalização (não confundir):**
- `dataAbertura` (Timestamp): definida pelo admin/gestor ao criar a OS. **Nunca** é tocada pelos fluxos de "Iniciar"/"Finalizar" do técnico.
- `entrada` (string, datetime ISO completo): gravada automaticamente com a data/hora atual quando o técnico toca **"Iniciar atendimento"** (`iniciarAtendimento()` no app, `iniciar()` na web) — junto com `status: 'em_andamento'`. Não é editável nesse momento; é só um registro automático.
- `saida` (string, datetime ISO completo): **não** é mais gravada automaticamente ao finalizar. Tocar em "Finalizar" abre um modal de confirmação ("Confirmar finalização") com a data/hora atual como valor padrão, editável pelo técnico antes de confirmar — só ao confirmar é que a OS muda para `status: 'concluida'` e `saida` é gravada com o valor escolhido (`fechadaEm` continua sendo `serverTimestamp()`, o instante real da escrita, distinto de `saida`). App: `apps/mobile/app/os/[id].tsx` (estados `finalizarModalAberto`/`dataFinalizacao`, reaproveita o mesmo `DateTimePicker` dos campos `entrada`/`saida`/`dataAbertura` via `CampoPicker = '...' | 'finalizacao'`). Web: `apps/web/src/pages/OrdemServico/OrdemServicoVer.tsx` (`SlideOver` com `<input type="datetime-local">`).
- Os três campos (`dataAbertura`, `entrada`, `saida`) ficam visíveis na tela de detalhe (`OrdemServicoVer.tsx`, barra do topo) e no PDF/impressão (`OrdemServicoDocumento.tsx` web, `gerarPdfOS.ts` app) — os campos ENTRADA/SAÍDA mostram data completa (`formatarDataHora`), não só hora, porque uma OS pausada em "Aguardando Peça" pode ser retomada e finalizada em outro dia.
- ⚠️ **Formato legado ainda existe:** `OrdemServicoForm.tsx` (admin/gestor editando a OS na web) ainda tem campos `<input type="time">` para `entrada`/`saida` que gravam só `"HH:MM"` (sem data) — não fazem parte do fluxo do técnico e não foram alterados. `formatarHora`/`formatarDataHora`/`calcularTempoTotal` (`packages/types`) aceitam os dois formatos.

**Assinatura do técnico/cliente no app — salva sozinha, sem botão "Salvar" (2026-07):**
- Ao confirmar o traço no `SignaturePad`, `salvarAssinaturaCliente()`/`salvarAssinaturaTecnico()` (`apps/mobile/app/os/[id].tsx`) atualizam o estado local (`sigCliente`/`sigTecnico`) **e** gravam só aquele campo no Firestore na hora — não é preciso tocar em "Salvar" antes de finalizar.
- `handleFinalizar()` valida `sigCliente`/`sigTecnico` (estado local), não `os.assinaturaClienteBase64`/`os.assinaturaTecnicoBase64` (o snapshot do Firestore). **Motivo:** `os` só reflete a assinatura depois do round-trip do `onSnapshot`; checar `os` direto causava um falso "É necessário coletar as assinaturas antes de finalizar" mesmo com as duas assinaturas já capturadas — o estado local é a fonte de verdade imediata (é setado tanto no load inicial quanto na captura). `os.assinaturaClienteUrl`/`os.assinaturaTecnicoUrl` entram como fallback só pra OS antigas gravadas antes do formato base64.

**Técnico ativo/inativo:**
- Campo `ativo: boolean` em `users/{uid}` (default `true`).
- Desativar: seta `ativo = false` via Firestore. O login Firebase Auth permanece (remover exige Admin SDK — TODO).
- Listas de técnicos e o seletor de técnico na OS filtram `ativo !== false`.
- Admin pode reativar a qualquer momento setando `ativo = true`.

**Quem faz o quê:**
- `admin` / `gestor`: cria a OS e atribui um técnico (`tecnicoId`). O campo `criadoPorId` registra quem despachou.
- `tecnico`: executa a OS (muda para `em_andamento`) e fecha após assinatura.

**Atribuição de técnico ao criar a OS:**
- Por padrão, lista técnicos cujo array `estados` contém o `estado` da OS (`array-contains`).
- Toggle "todos os estados" permite atribuição cross-estado (admin/gestor decide).

**Security Rule — técnico:** pode ler/editar OSs onde `estado in seus estados` **OU** `tecnicoId == seu uid`.

---

## Decisões de arquitetura (plano Spark)

O projeto **permanece no plano Free (Spark)** do Firebase. Cloud Functions não estão disponíveis sem o plano Blaze. As soluções abaixo substituem o que seria feito em Functions:

### Acesso do técnico — Modelo A (email real)

O técnico usa seu **e-mail real** como login. Não há senhas geradas ou distribuídas pelo admin.

**Fluxo de cadastro:**
1. Admin informa nome, e-mail, estados atendidos (multi-seleção agrupada por região) e matrícula na tela `/tecnicos`.
2. O sistema cria a conta Firebase Auth via **instância secundária** (`initializeApp(config, 'Secondary')`) — sem deslogar o admin.
3. Grava `users/{uid}` no Firestore com `role: 'tecnico'` e os dados do perfil.
4. Dispara `sendPasswordResetEmail` — o técnico recebe um link e **define a própria senha**. O admin nunca vê nem define senha.
5. A instância secundária faz `signOut` e é descartada.

**Recuperação de senha:** self-service pelo link "Esqueci minha senha" na tela de login — o Firebase envia o e-mail de redefinição diretamente ao técnico, sem envolvimento do admin.

### Numeração sequencial da OS (sem Cloud Functions) — IMPLEMENTADO
- Documento `counters/ordens` no Firestore: `{ proximo: number }`.
- Criação da OS é feita apenas no **web** (`OrdemServicoForm.tsx`, admin/gestor). Dentro de uma única `runTransaction`: lê `counters/ordens.proximo` (1 se o doc ainda não existir), grava a nova OS com `numero = proximo` e incrementa o contador — tudo atômico, sem número duplicado mesmo com criações simultâneas (o Firestore serializa/retenta a transação em caso de conflito).
- Transação exige conexão (não roda puramente do cache); se o admin/gestor estiver offline ao criar a OS, a operação falha e é exibido erro para tentar novamente — não há criação de OS offline hoje (só o app do técnico é offline-first, e ele não cria OS).
- Security Rules de `counters/{id}`: `create`/`update` liberados para `admin` e `gestor` (mesma regra de quem cria `ordens_servico`), cobrindo tanto o primeiro uso (doc ainda não existe) quanto incrementos seguintes.
- Formatação: `formatarNumeroOS(numero)` em `packages/types` — 4 dígitos com zero à esquerda (`"0001"`), `"S/N"` se ausente. Usado em todas as telas que exibem o número (web e mobile).

**Helpers compartilhados de exibição da OS (`packages/types`) — usar sempre, não duplicar:**
- `formatarHora(v)` — só a hora; entrada/saída aceitam `"HH:MM"` (web, legado) OU datetime ISO completo (app).
- `formatarDataHora(v)` — data + hora (`"DD/MM/AAAA HH:MM"`); usado no PDF/impressão e no detalhe da OS pros campos `entrada`/`saida`, já que podem cair num dia diferente da `dataAbertura`. Pro formato legado `"HH:MM"` (sem data), retorna só a hora.
- `calcularTempoTotal(entrada, saida)` — duração formatada (`"1h 30min"`), mesma tolerância de formato.
- `normalizarAtendimentos(atendimentos)` — ver nota do `etqReparado` acima.

### Security Rules como única linha de defesa
- Sem backend, as **Security Rules são a única barreira** de controle de acesso.
- Apenas `admin` pode criar documentos em `users/` e definir o campo `role`.
- OS com `status: 'fechada'` é somente-leitura para todos (trilha de auditoria INMETRO).
- **As Security Rules são prioridade antes de qualquer nova feature.**

---

## Pontos de atenção (constraints)

1. **Numeração sequencial.** Implementada via transação em `counters/ordens` (ver acima). Sem Cloud Functions. Só o web cria OS (com conexão); o app do técnico só lê/edita OS já numeradas.

2. **Firestore é NoSQL.** Atendimentos como array dentro da OS. Planejar índices para relatórios do gestor.

3. **Security Rules (INMETRO).** Técnico edita apenas as próprias OSs com `status: 'aberta'`. OS com `status: 'fechada'` é **somente-leitura** (trilha de auditoria). Roles controlam acesso de leitura/escrita.

---

## Armazenamento de Mídia (plano Free — sem Firebase Storage)

O Firebase Storage passou a exigir o plano Blaze. No plano Spark, a mídia é gerenciada assim:

| Tipo | Estratégia | Campo no Firestore |
|---|---|---|
| **Assinatura do cliente** | Capturada no app via signature pad; salva como string base64/SVG | `ordens_servico/{id}.assinaturaClienteUrl` |
| **Assinatura do técnico** | Idem | `ordens_servico/{id}.assinaturaTecnicoUrl` |
| **Fotos (balança/selo)** | Upload para **Cloudinary** (unsigned upload preset — sem cartão); o app salva apenas a URL retornada | campo por atendimento |

**Por que Cloudinary:** aceita unsigned uploads gratuitos sem necessidade de cartão de crédito ou conta paga.

> **Roadmap:** ao migrar para o plano Blaze (com cliente pagante), consolidar toda a mídia no Firebase Storage e eliminar a dependência do Cloudinary.

---

## Estratégia de Sustentabilidade e Escala

### Modelo financeiro
- O projeto **permanece no Firebase Spark (Free)**. O plano Spark **nunca gera cobrança**: ao exceder os limites, o serviço pausa ou limita — sem fatura, sem risco de dívida.
- Migração para o **plano Blaze (pago) só quando houver receita de cliente que cubra o custo**. Nunca pagar infraestrutura do próprio bolso sem receita confirmada.

### Roadmap de escala
| Fase | Gatilho | Ação |
|---|---|---|
| **Fase 1 — atual** | Firebase Spark, sem cliente | Desenvolver com zero custo |
| **Fase 2** | Primeiro cliente pagante | Migrar para Blaze; habilitar Cloud Functions |
| **Fase 3** | Receita recorrente estabelecida | Reavaliar arquitetura (banco, infra, SLA) |

### Camada de repositórios (preparação para escala futura)
**Não trocar de banco agora.** Quando houver motivo real, isolar todo acesso a dados em repositórios em `src/repositories/` (ex: `ordensRepo.ts`, `tecnicosRepo.ts`). As telas chamam apenas os repositórios; uma migração futura (Postgres, Supabase, etc.) reescreve só os repositórios, sem tocar nas telas.

> **Situação atual:** as telas acessam o Firestore diretamente. Extrair a camada de repositórios é uma refatoração planejada — fazer quando o escopo estiver estável.

---

## Convenções

- TypeScript em tudo, `strict: true`.
- Tipos do modelo de dados em um pacote/pasta compartilhada entre web e app.
- Não commitar segredos do Firebase fora do `.env` (usar `.env.example`).
- Commits pequenos e descritivos.

---

## Roadmap

1. [x] Scaffold do projeto (estrutura de pastas, configs, tipos)
2. [x] Setup do Firebase (Auth + Firestore + Storage) e Security Rules iniciais
3. [x] Autenticação (login/senha + roles)
4. [ ] Security Rules completas (prioridade antes das próximas features)
5. [x] Web: CRUD de parceiros e técnicos (painel do gestor)
6. [ ] Cadastro de técnico via instância secundária do Auth (client-side)
7. [x] Numeração sequencial via transação em `counters/ordens` (client-side)
8. [ ] Formulário da OS (web) espelhando o formulário em papel
9. [x] App: formulário da OS com offline + assinatura + fotos
10. [x] Geração de PDF idêntico à OS física — app mobile: `expo-print` + `expo-sharing` (compartilhamento nativo); layout HTML espelha `OrdemServicoDocumento.tsx` (web)
11. [x] Relatórios (`/relatorios`, web) — status, técnico, parceiro/loja, peças usadas, tempo médio; export CSV + PDF (impressão); admin/gestor veem tudo, técnico só as próprias OSs
12. [x] Controle de Selos (`/selos`, web) — cadastro em lote, envio por técnico, listagem com filtro, solicitação de reposição pelo técnico; ver seção "Controle de Selos". Integração com o atendimento da OS fica pro backlog.

### Backlog futuro (não implementar agora)

- **Integrar Controle de Selos ao atendimento da OS** — descontar um selo do estoque do técnico (status `enviado` → `usado`) automaticamente quando ele é aplicado numa balança durante o atendimento, em vez de exigir marcação manual do admin. Também: envio automático ao atender uma `solicitacaoSelo` (hoje é 100% manual).
- **Migração para Cloud Functions** (requer plano Blaze) — mover cadastro de técnico, numeração e geração de PDF para o servidor.
- **Push Notifications (app fechado)** — requer Firebase Cloud Messaging acionado por Cloud Function quando uma OS é criada/atribuída. **Não disponível no plano Spark** (sem Cloud Functions). No plano atual, a comunicação em tempo real usa `onSnapshot` (só com app aberto) + avisos visuais internos. Push fica para a fase Blaze.
- **Consolidação de mídia no Firebase Storage** (requer plano Blaze) — substituir base64 + Cloudinary por Storage nativo do Firebase.
- **Mapa visual do Brasil** no dashboard — depende de biblioteca de mapas.
- **Otimização de rota** via API externa (Google Maps / Mapbox) — depende de internet e tem custo por requisição.
- **Telas de cadastro de balanças/equipamentos por loja** — fundação já existe (tipo `Balanca`, coleção `balancas`, Security Rule; ver seção "Balanças / Equipamentos"). Falta: CRUD por loja, seleção de balança já cadastrada ao criar OS, contagem por loja/parceiro para precificação.
