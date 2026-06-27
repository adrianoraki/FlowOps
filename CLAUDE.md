# FlowOps

Sistema de **Ordem de Serviço (OS) digital** para a Hightec Manutenção Eletrônica LTDA — manutenção de balanças. Substitui o formulário de OS em papel por web (painel do gestor) + app mobile (técnico em campo).

> Domínio regulado: envolve selos do INMETRO. Integridade e trilha de auditoria dos dados são requisitos, não opcionais.

---

## Stack

- **Firebase** como backend:
  - **Firestore** — banco de dados + persistência offline (requisito crítico)
  - **Firebase Auth** — login/senha, recuperação de senha, roles via custom claims
  - **Storage** — assinaturas e fotos de balanças/selos
  - **Cloud Functions** — numeração sequencial da OS, geração de PDF, regras de negócio
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

## Modelo de dados (Firestore)

```
users/{uid}
  nome, email, role: 'tecnico'|'gestor'|'admin', matricula, rg

clientes/{id}
  nome, cidade, estado, loja

ordens_servico/{id}
  numero            // ex: 137430 — gerado no SERVIDOR (ver gotcha #1)
  tipo              // 'corretiva' | 'preventiva' | 'emergencia'
  clienteId, cidade, estado, loja, veiculo
  dataAbertura, entrada, saida
  tecnicoId
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
  status            // 'aberta' | 'fechada'
  createdAt, updatedAt, fechadaEm
```

---

## Pontos de atenção (constraints)

1. **Numeração sequencial + offline.** O número oficial da OS (137430, 137431...) NÃO pode ser gerado no cliente offline (risco de duplicidade). A OS nasce com ID local temporário; o número oficial é atribuído por uma **Cloud Function na sincronização**.

2. **Firestore é NoSQL.** Atendimentos como array/subcoleção da OS. Planejar índices para os relatórios do gestor.

3. **Security Rules (INMETRO).** Técnico edita apenas as próprias OSs com `status: 'aberta'`. OS com `status: 'fechada'` é **somente-leitura** (trilha de auditoria). Roles controlam acesso de leitura/escrita.

---

## Convenções

- TypeScript em tudo, `strict: true`.
- Tipos do modelo de dados em um pacote/pasta compartilhada entre web e app.
- Não commitar segredos do Firebase fora do `.env` (usar `.env.example`).
- Commits pequenos e descritivos.

---

## Roadmap

1. [ ] Scaffold do projeto (estrutura de pastas, configs, tipos)
2. [ ] Setup do Firebase (Auth + Firestore + Storage) e Security Rules iniciais
3. [ ] Autenticação (login/senha + roles)
4. [ ] Web: CRUD de clientes e técnicos (painel do gestor)
5. [ ] Formulário da OS (web) espelhando o formulário em papel
6. [ ] App: formulário da OS com offline + assinatura + fotos
7. [ ] Cloud Function: numeração sequencial na sincronização
8. [ ] Geração de PDF idêntico à OS física
9. [ ] Relatórios do gestor
