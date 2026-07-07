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

setores/{id}            // white-label — cadastro de setores desta empresa
  nome, ativo?: boolean

modelos/{id}            // white-label — catálogo de modelos de balança desta empresa
  nome, ativo?: boolean

users/{uid}
  nome, email, role: 'tecnico'|'gestor'|'admin', matricula, rg
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
      etqReparado,    // texto livre (era boolean até 2026-07) — o técnico descreve a etiqueta de reparo
      descricaoIntervencao   // nota de intervenção NESTA balança — não confundir com os 2 campos de descrição da OS abaixo
    }
  ]
  comentarios                  // rótulo "Descrição do Problema" — o que o CLIENTE relatou na abertura (ex: "FALHA DE IMPRESSÃO"); preenchido por quem despacha (admin/gestor), somente leitura para o técnico no app
  descricaoServicoRealizado    // rótulo "Descrição do Serviço Realizado" — o que o TÉCNICO fez, preenchido por ele no app; nunca o problema relatado pelo cliente
  solicitacaoMaterial
  pecasUsadas: [{ pecaId, nome, quantidade }]   // catálogo de peças (coleção pecas) + quantidade — campo em destaque na tela da OS do app; admin/gestor também podem editar na web enquanto a OS estiver aberta
  assinaturaClienteUrl, nomeLegivel, matriculaCliente
  assinaturaTecnicoUrl, rgTecnico
  status            // 'aberta' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada'
  createdAt, updatedAt, fechadaEm
```

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

## Dispatch e Atribuição

**Ciclo de status da OS:**
`aberta` → `em_andamento` → `concluida` (caminho principal)
Desvios: `aguardando_peca` (bloqueada por material) · `cancelada` (encerrada sem conclusão)

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
11. [ ] Relatórios do gestor

### Backlog futuro (não implementar agora)

- **Migração para Cloud Functions** (requer plano Blaze) — mover cadastro de técnico, numeração e geração de PDF para o servidor.
- **Push Notifications (app fechado)** — requer Firebase Cloud Messaging acionado por Cloud Function quando uma OS é criada/atribuída. **Não disponível no plano Spark** (sem Cloud Functions). No plano atual, a comunicação em tempo real usa `onSnapshot` (só com app aberto) + avisos visuais internos. Push fica para a fase Blaze.
- **Consolidação de mídia no Firebase Storage** (requer plano Blaze) — substituir base64 + Cloudinary por Storage nativo do Firebase.
- **Mapa visual do Brasil** no dashboard — depende de biblioteca de mapas.
- **Otimização de rota** via API externa (Google Maps / Mapbox) — depende de internet e tem custo por requisição.
