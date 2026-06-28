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
  - **Storage** — assinaturas e fotos de balanças/selos
- **Web (painel do gestor):** React + Vite + TypeScript
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
| `tecnico` | Vê apenas OSs da sua região e as que criou. Cria e edita OS. |
| `gestor` | Vê e gerencia tudo da sua região (OSs e técnicos) + dashboard regional. |
| `admin` | Visão global de todas as regiões, dashboard consolidado, cadastros e relatórios. |

## Regiões

- Coleção `regioes/{id}`: `{ nome, ufs: string[], cidades?: string[] }`
- Campo `regiao` (id da região) presente em `users/{uid}`, `parceiros/{id}` e em `ordens_servico/{id}`.
- Security Rules filtram acesso por `regiao` + `role`.

## Modelo de dados (Firestore)

```
config/empresa          // white-label — dados da empresa operadora do sistema
  nomeEmpresa, cnpj, registro, telefone1, telefone2, email, site, endereco, logoUrl

regioes/{id}
  nome, ufs: string[], cidades?: string[]

users/{uid}
  nome, email, role: 'tecnico'|'gestor'|'admin', matricula, rg, regiao
  ativo: boolean  // default true; false = desativado. Remover do Auth exige Admin SDK (TODO)

parceiros/{id}        // empresas-cliente que contratam a manutenção
  nome, cidade, estado, loja, regiao

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
  numero            // ex: 137430 — gerado no SERVIDOR (ver gotcha #1)
  tipo              // 'corretiva' | 'preventiva' | 'emergencia'
  parceiroId, cidade, estado, loja, veiculo
  dataAbertura, entrada, saida
  criadoPorId       // uid do admin/gestor que criou/despachou a OS
  tecnicoId         // uid do técnico atribuído
  regiao            // id da região — usado pelas Security Rules
  atendimentos: [   // tabela central da OS
    {
      chamado, modelo, nSerie, mauUso,
      nInmetro, seloInmetro, seloAtual,
      portaria, etqReparado,
      descricaoIntervencao
    }
  ]
  comentarios
  solicitacaoMaterial
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
- Por padrão, lista técnicos cuja `regiao` coincide com a `regiao` da OS.
- Toggle "todas as regiões" permite atribuição cross-região (admin/gestor decide).

**Security Rule — técnico:** pode ler/editar OSs onde `regiao == sua regiao` **OU** `tecnicoId == seu uid`.

---

## Decisões de arquitetura (plano Spark)

O projeto **permanece no plano Free (Spark)** do Firebase. Cloud Functions não estão disponíveis sem o plano Blaze. As soluções abaixo substituem o que seria feito em Functions:

### Acesso do técnico — Modelo A (email real)

O técnico usa seu **e-mail real** como login. Não há senhas geradas ou distribuídas pelo admin.

**Fluxo de cadastro:**
1. Admin informa nome, e-mail, região e matrícula na tela `/tecnicos`.
2. O sistema cria a conta Firebase Auth via **instância secundária** (`initializeApp(config, 'Secondary')`) — sem deslogar o admin.
3. Grava `users/{uid}` no Firestore com `role: 'tecnico'` e os dados do perfil.
4. Dispara `sendPasswordResetEmail` — o técnico recebe um link e **define a própria senha**. O admin nunca vê nem define senha.
5. A instância secundária faz `signOut` e é descartada.

**Recuperação de senha:** self-service pelo link "Esqueci minha senha" na tela de login — o Firebase envia o e-mail de redefinição diretamente ao técnico, sem envolvimento do admin.

### Numeração sequencial da OS (sem Cloud Functions)
- Documento `counters/ordens` no Firestore: `{ proximo: number }`.
- Atribuição via **transação Firestore** client-side quando o dispositivo está online.
- A OS nasce sem número enquanto offline; recebe o número ao sincronizar (transação executada no cliente ao detectar conexão).
- Risco residual: se dois clientes executarem a transação simultaneamente offline e sincronizarem, o Firestore garante atomicidade — apenas um ganha o incremento.

### Security Rules como única linha de defesa
- Sem backend, as **Security Rules são a única barreira** de controle de acesso.
- Apenas `admin` pode criar documentos em `users/` e definir o campo `role`.
- OS com `status: 'fechada'` é somente-leitura para todos (trilha de auditoria INMETRO).
- **As Security Rules são prioridade antes de qualquer nova feature.**

---

## Pontos de atenção (constraints)

1. **Numeração sequencial.** Implementada via transação em `counters/ordens` (ver acima). Sem Cloud Functions.

2. **Firestore é NoSQL.** Atendimentos como array dentro da OS. Planejar índices para relatórios do gestor.

3. **Security Rules (INMETRO).** Técnico edita apenas as próprias OSs com `status: 'aberta'`. OS com `status: 'fechada'` é **somente-leitura** (trilha de auditoria). Roles controlam acesso de leitura/escrita.

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
7. [ ] Numeração sequencial via transação em `counters/ordens` (client-side)
8. [ ] Formulário da OS (web) espelhando o formulário em papel
9. [ ] App: formulário da OS com offline + assinatura + fotos
10. [ ] Geração de PDF idêntico à OS física (client-side, ex: jsPDF)
11. [ ] Relatórios do gestor

### Backlog futuro (não implementar agora)

- **Migração para Cloud Functions** (requer plano Blaze) — mover cadastro de técnico, numeração e geração de PDF para o servidor.
- **Mapa visual do Brasil** no dashboard — depende de biblioteca de mapas.
- **Otimização de rota** via API externa (Google Maps / Mapbox) — depende de internet e tem custo por requisição.
