/**
 * Testes das Security Rules do Firestore — FlowOps
 *
 * Pré-requisitos:
 *   npm install -D @firebase/rules-unit-testing firebase jest
 *
 * Rodar:
 *   npx firebase emulators:exec --only firestore "npx jest firestore.rules.test.js"
 *   ou (emulador já rodando):
 *   npx jest firestore.rules.test.js
 */

const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing')
const { doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction } = require('firebase/firestore')
const fs = require('fs')

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PROJECT_ID   = 'flowops-test'
const ADMIN_UID    = 'uid-admin'
const GESTOR_UID   = 'uid-gestor'
const TEC1_UID     = 'uid-tec1'   // técnico SP
const TEC2_UID     = 'uid-tec2'   // técnico RJ
const OS_ABERTA       = 'os-aberta-sp'
const OS_CONCLUIDA    = 'os-concluida-sp'
const OS_EM_ANDAMENTO = 'os-em-andamento-sp'
const MOV_ENVIO       = 'mov-envio-1'

let testEnv

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host:  'localhost',
      port:  8080,
    },
  })

  // Seed com rules desativadas
  await testEnv.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()

    await setDoc(doc(db, 'users', ADMIN_UID),  { role: 'admin',   estados: ['SP'], ativo: true })
    await setDoc(doc(db, 'users', GESTOR_UID), { role: 'gestor',  estados: ['SP'], ativo: true })
    await setDoc(doc(db, 'users', TEC1_UID),   { role: 'tecnico', estados: ['SP'], ativo: true })
    await setDoc(doc(db, 'users', TEC2_UID),   { role: 'tecnico', estados: ['RJ'], ativo: true })

    await setDoc(doc(db, 'ordens_servico', OS_ABERTA), {
      status:      'aberta',
      estado:      'SP',
      tecnicoId:   TEC1_UID,
      criadoPorId: GESTOR_UID,
    })

    await setDoc(doc(db, 'ordens_servico', OS_CONCLUIDA), {
      status:      'concluida',
      estado:      'SP',
      tecnicoId:   TEC1_UID,
      criadoPorId: GESTOR_UID,
    })

    // OS em andamento (para testar finalizar)
    await setDoc(doc(db, 'ordens_servico', OS_EM_ANDAMENTO), {
      status:      'em_andamento',
      estado:      'SP',
      tecnicoId:   TEC1_UID,
      criadoPorId: GESTOR_UID,
      entrada:     '09:00',
    })

    // Movimentação envio: criada pelo gestor, destinada ao tec1
    await setDoc(doc(db, 'movimentacoes', MOV_ENVIO), {
      tipo:         'envio',
      tecnicoId:    TEC1_UID,
      criadoPorId:  GESTOR_UID,
      status:       'pendente',
      itens:        [{ pecaId: 'peca-1', quantidade: 2 }],
    })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function db(uid) {
  return testEnv.authenticatedContext(uid).firestore()
}

// ─── 1. Técnico não lê OS de outro estado ────────────────────────────────────

describe('OS: leitura por estado', () => {
  test('técnico de SP lê OS de SP (estado em seus estados)', async () => {
    await assertSucceeds(getDoc(doc(db(TEC1_UID), 'ordens_servico', OS_ABERTA)))
  })

  test('técnico de RJ NÃO lê OS de SP (sem atribuição)', async () => {
    await assertFails(getDoc(doc(db(TEC2_UID), 'ordens_servico', OS_ABERTA)))
  })

  test('admin lê qualquer OS', async () => {
    await assertSucceeds(getDoc(doc(db(ADMIN_UID), 'ordens_servico', OS_ABERTA)))
  })
})

// ─── 2. Técnico não edita OS concluída ───────────────────────────────────────

describe('OS: imutabilidade de status concluida/cancelada', () => {
  test('técnico NÃO edita OS com status concluida', async () => {
    await assertFails(
      updateDoc(doc(db(TEC1_UID), 'ordens_servico', OS_CONCLUIDA), {
        comentarios: 'tentativa de edição',
      })
    )
  })

  test('gestor NÃO edita OS concluida', async () => {
    await assertFails(
      updateDoc(doc(db(GESTOR_UID), 'ordens_servico', OS_CONCLUIDA), {
        comentarios: 'tentativa gestor',
      })
    )
  })

  test('admin PODE editar OS concluida (correção)', async () => {
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), 'ordens_servico', OS_CONCLUIDA), {
        comentarios: 'correção admin',
      })
    )
  })

  test('técnico atribuído PODE editar OS com status aberta', async () => {
    await assertSucceeds(
      updateDoc(doc(db(TEC1_UID), 'ordens_servico', OS_ABERTA), {
        status: 'em_andamento',
      })
    )
  })
})

// ─── 3. Não-admin não cria usuário ────────────────────────────────────────────

describe('users: controle de criação', () => {
  test('técnico NÃO pode criar outro usuário', async () => {
    await assertFails(
      setDoc(doc(db(TEC1_UID), 'users', 'novo-uid'), {
        role: 'tecnico', estados: ['SP'], ativo: true,
      })
    )
  })

  test('gestor PODE criar usuário técnico', async () => {
    await assertSucceeds(
      setDoc(doc(db(GESTOR_UID), 'users', 'novo-tec-uid'), {
        role: 'tecnico', estados: ['SP'], ativo: true,
      })
    )
  })

  test('gestor NÃO pode alterar o próprio role', async () => {
    await assertFails(
      updateDoc(doc(db(GESTOR_UID), 'users', GESTOR_UID), { role: 'admin' })
    )
  })

  test('gestor NÃO pode criar usuário admin', async () => {
    await assertFails(
      setDoc(doc(db(GESTOR_UID), 'users', 'novo-admin-uid'), {
        role: 'admin', estados: ['SP'], ativo: true,
      })
    )
  })

  test('gestor NÃO pode criar outro usuário gestor', async () => {
    await assertFails(
      setDoc(doc(db(GESTOR_UID), 'users', 'novo-gestor-uid'), {
        role: 'gestor', estados: ['SP'], ativo: true,
      })
    )
  })

  test('admin PODE criar usuário admin', async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), 'users', 'novo-admin-uid-2'), {
        role: 'admin', estados: [], ativo: true,
      })
    )
  })

  test('admin PODE criar usuário gestor', async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), 'users', 'novo-gestor-uid-2'), {
        role: 'gestor', estados: ['SP'], ativo: true,
      })
    )
  })

  test('gestor NÃO pode promover técnico a gestor', async () => {
    await assertFails(
      updateDoc(doc(db(GESTOR_UID), 'users', TEC1_UID), { role: 'gestor' })
    )
  })

  test('gestor NÃO pode editar conta de admin', async () => {
    await assertFails(
      updateDoc(doc(db(GESTOR_UID), 'users', ADMIN_UID), { nome: 'tentativa gestor' })
    )
  })

  test('admin PODE promover técnico a gestor', async () => {
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), 'users', TEC2_UID), { role: 'gestor' })
    )
    // Reverter para não afetar outros testes que dependem de TEC2 ser técnico
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'users', TEC2_UID), { role: 'tecnico' })
    })
  })

  test('ninguém pode deletar usuário (ativo=false é o caminho)', async () => {
    await assertFails(deleteDoc(doc(db(ADMIN_UID), 'users', TEC1_UID)))
  })
})

// ─── 4. Técnico não confirma o próprio envio ─────────────────────────────────

describe('movimentacoes: dupla confirmação', () => {
  test('técnico destinatário PODE confirmar envio que não criou', async () => {
    await assertSucceeds(
      updateDoc(doc(db(TEC1_UID), 'movimentacoes', MOV_ENVIO), {
        status:         'confirmada',
        confirmadoPorId: TEC1_UID,
        confirmadoEm:   new Date(),
      })
    )
  })

  test('gestor (criador) NÃO confirma o próprio envio', async () => {
    // Resetar status para pendente antes do teste
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'movimentacoes', MOV_ENVIO), {
        status: 'pendente',
      })
    })

    await assertFails(
      updateDoc(doc(db(GESTOR_UID), 'movimentacoes', MOV_ENVIO), {
        status:         'confirmada',
        confirmadoPorId: GESTOR_UID,
        confirmadoEm:   new Date(),
      })
    )
  })

  test('técnico de outro estado NÃO confirma envio destinado a outro', async () => {
    await assertFails(
      updateDoc(doc(db(TEC2_UID), 'movimentacoes', MOV_ENVIO), {
        status:         'confirmada',
        confirmadoPorId: TEC2_UID,
        confirmadoEm:   new Date(),
      })
    )
  })

  test('ninguém deleta movimentação', async () => {
    await assertFails(deleteDoc(doc(db(ADMIN_UID), 'movimentacoes', MOV_ENVIO)))
  })
})

// ─── 5. Iniciar e finalizar OS ────────────────────────────────────────────────

describe('OS: iniciar e finalizar atendimento', () => {
  test('técnico dono PODE iniciar OS aberta (→ em_andamento)', async () => {
    // Garante status aberta antes de testar
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'ordens_servico', OS_ABERTA), { status: 'aberta' })
    })
    await assertSucceeds(
      updateDoc(doc(db(TEC1_UID), 'ordens_servico', OS_ABERTA), {
        status: 'em_andamento',
        entrada: '09:30',
        updatedAt: new Date(),
        atualizadoPorId: TEC1_UID,
      })
    )
  })

  test('admin PODE iniciar OS aberta', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'ordens_servico', OS_ABERTA), { status: 'aberta' })
    })
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), 'ordens_servico', OS_ABERTA), {
        status: 'em_andamento',
        entrada: '10:00',
        updatedAt: new Date(),
      })
    )
  })

  test('técnico dono PODE finalizar OS em_andamento (→ concluida)', async () => {
    await assertSucceeds(
      updateDoc(doc(db(TEC1_UID), 'ordens_servico', OS_EM_ANDAMENTO), {
        status:      'concluida',
        saida:       '11:30',
        fechadaEm:   new Date(),
        updatedAt:   new Date(),
        atualizadoPorId: TEC1_UID,
      })
    )
  })

  test('técnico de outro estado NÃO finaliza OS que não lhe pertence', async () => {
    await assertFails(
      updateDoc(doc(db(TEC2_UID), 'ordens_servico', OS_EM_ANDAMENTO), {
        status: 'concluida',
        saida:  '12:00',
      })
    )
  })

  test('técnico NÃO edita OS já concluida (após finalizar)', async () => {
    // OS_CONCLUIDA já está com status='concluida' desde o seed
    await assertFails(
      updateDoc(doc(db(TEC1_UID), 'ordens_servico', OS_CONCLUIDA), {
        comentarios: 'tentativa após conclusão',
      })
    )
  })
})

// ─── 5b. Aguardando peça (pausar e retomar) ───────────────────────────────────

describe('OS: aguardando peça (pausar e retomar)', () => {
  // Garante OS_EM_ANDAMENTO com status='em_andamento' antes de cada teste
  // (testes anteriores no arquivo já mutaram esse doc para 'concluida').
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'ordens_servico', OS_EM_ANDAMENTO), { status: 'em_andamento' })
    })
  })

  test('técnico dono PODE marcar em_andamento → aguardando_peca', async () => {
    await assertSucceeds(
      updateDoc(doc(db(TEC1_UID), 'ordens_servico', OS_EM_ANDAMENTO), {
        status: 'aguardando_peca',
        aguardandoPecaDesde: new Date(),
        updatedAt: new Date(),
        atualizadoPorId: TEC1_UID,
      })
    )
  })

  test('gestor PODE marcar em_andamento → aguardando_peca', async () => {
    await assertSucceeds(
      updateDoc(doc(db(GESTOR_UID), 'ordens_servico', OS_EM_ANDAMENTO), {
        status: 'aguardando_peca',
        aguardandoPecaDesde: new Date(),
        updatedAt: new Date(),
      })
    )
  })

  test('admin PODE marcar em_andamento → aguardando_peca', async () => {
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), 'ordens_servico', OS_EM_ANDAMENTO), {
        status: 'aguardando_peca',
        aguardandoPecaDesde: new Date(),
        updatedAt: new Date(),
      })
    )
  })

  test('técnico de outro estado NÃO marca aguardando_peca em OS que não lhe pertence', async () => {
    await assertFails(
      updateDoc(doc(db(TEC2_UID), 'ordens_servico', OS_EM_ANDAMENTO), {
        status: 'aguardando_peca',
      })
    )
  })

  test('técnico dono PODE retomar aguardando_peca → em_andamento', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'ordens_servico', OS_EM_ANDAMENTO), { status: 'aguardando_peca' })
    })
    await assertSucceeds(
      updateDoc(doc(db(TEC1_UID), 'ordens_servico', OS_EM_ANDAMENTO), {
        status: 'em_andamento',
        updatedAt: new Date(),
        atualizadoPorId: TEC1_UID,
      })
    )
  })

  test('admin/gestor PODEM retomar aguardando_peca → em_andamento', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'ordens_servico', OS_EM_ANDAMENTO), { status: 'aguardando_peca' })
    })
    await assertSucceeds(
      updateDoc(doc(db(GESTOR_UID), 'ordens_servico', OS_EM_ANDAMENTO), {
        status: 'em_andamento',
        updatedAt: new Date(),
      })
    )
  })

  test('técnico de outro estado NÃO retoma OS que não lhe pertence', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'ordens_servico', OS_EM_ANDAMENTO), { status: 'aguardando_peca' })
    })
    await assertFails(
      updateDoc(doc(db(TEC2_UID), 'ordens_servico', OS_EM_ANDAMENTO), {
        status: 'em_andamento',
      })
    )
  })
})

// ─── 6. Numeração sequencial (counters/ordens) ───────────────────────────────

describe('counters: numeração sequencial de OS', () => {
  test('gestor PODE criar o contador na primeira OS (doc ainda não existe)', async () => {
    const gestorDb = db(GESTOR_UID)
    await assertSucceeds(
      runTransaction(gestorDb, async transaction => {
        const ref  = doc(gestorDb, 'counters', 'ordens')
        const snap = await transaction.get(ref)
        const proximo = snap.exists() ? snap.data().proximo : 1
        transaction.set(ref, { proximo: proximo + 1 }, { merge: true })
      })
    )
  })

  test('admin PODE incrementar o contador já existente', async () => {
    const adminDb = db(ADMIN_UID)
    await assertSucceeds(
      runTransaction(adminDb, async transaction => {
        const ref  = doc(adminDb, 'counters', 'ordens')
        const snap = await transaction.get(ref)
        const proximo = snap.exists() ? snap.data().proximo : 1
        transaction.set(ref, { proximo: proximo + 1 }, { merge: true })
      })
    )
  })

  test('técnico NÃO pode ler nem escrever o contador', async () => {
    await assertFails(getDoc(doc(db(TEC1_UID), 'counters', 'ordens')))
    await assertFails(
      updateDoc(doc(db(TEC1_UID), 'counters', 'ordens'), { proximo: 999 })
    )
  })

  test('ninguém deleta o contador', async () => {
    await assertFails(deleteDoc(doc(db(ADMIN_UID), 'counters', 'ordens')))
  })
})

// ─── 7. Setores (cadastro por empresa) ───────────────────────────────────────

describe('setores: cadastro white-label', () => {
  test('técnico PODE ler setores', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'setores', 'acougue'), { nome: 'Açougue', ativo: true })
    })
    await assertSucceeds(getDoc(doc(db(TEC1_UID), 'setores', 'acougue')))
  })

  test('gestor NÃO pode criar setor (só admin)', async () => {
    await assertFails(
      setDoc(doc(db(GESTOR_UID), 'setores', 'novo-setor'), { nome: 'Novo', ativo: true })
    )
  })

  test('admin PODE criar setor', async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), 'setores', 'hortifruti'), { nome: 'Hortifruti', ativo: true })
    )
  })
})

// ─── 8. Lojas (parceiro rede/único) ──────────────────────────────────────────

describe('lojas: vinculadas a um parceiro', () => {
  test('técnico PODE ler lojas', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'lojas', 'loja-1'), {
        parceiroId: 'parceiro-1', numero: '01', nome: 'Mirante', estado: 'SP', cidade: 'São Paulo', regiao: 'Sudeste', ativo: true,
      })
    })
    await assertSucceeds(getDoc(doc(db(TEC1_UID), 'lojas', 'loja-1')))
  })

  test('técnico NÃO pode criar loja', async () => {
    await assertFails(
      setDoc(doc(db(TEC1_UID), 'lojas', 'loja-2'), {
        parceiroId: 'parceiro-1', numero: '02', nome: 'Centro', estado: 'RJ', cidade: 'Rio de Janeiro', regiao: 'Sudeste', ativo: true,
      })
    )
  })

  test('gestor PODE criar loja', async () => {
    await assertSucceeds(
      setDoc(doc(db(GESTOR_UID), 'lojas', 'loja-3'), {
        parceiroId: 'parceiro-1', numero: '03', nome: 'Norte Shopping', estado: 'RJ', cidade: 'Rio de Janeiro', regiao: 'Sudeste', ativo: true,
      })
    )
  })

  test('admin PODE criar loja', async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), 'lojas', 'loja-4'), {
        parceiroId: 'parceiro-1', numero: '04', nome: 'Shopping ABC', estado: 'SP', cidade: 'Campinas', regiao: 'Sudeste', ativo: true,
      })
    )
  })

  test('admin PODE editar loja existente', async () => {
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), 'lojas', 'loja-4'), { nome: 'Shopping ABC — renomeada' })
    )
  })

  test('técnico NÃO pode editar loja existente', async () => {
    await assertFails(
      updateDoc(doc(db(TEC1_UID), 'lojas', 'loja-4'), { nome: 'tentativa técnico' })
    )
  })

  test('técnico NÃO pode excluir loja', async () => {
    await assertFails(deleteDoc(doc(db(TEC1_UID), 'lojas', 'loja-4')))
  })

  test('admin PODE excluir loja', async () => {
    await assertSucceeds(deleteDoc(doc(db(ADMIN_UID), 'lojas', 'loja-4')))
  })
})

// ─── 9. Modelos de balança (catálogo por empresa) ────────────────────────────

describe('modelos: catálogo white-label', () => {
  test('técnico PODE ler modelos', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'modelos', 'toledo-9091'), { nome: 'Toledo 9091', ativo: true })
    })
    await assertSucceeds(getDoc(doc(db(TEC1_UID), 'modelos', 'toledo-9091')))
  })

  test('técnico NÃO pode criar modelo', async () => {
    await assertFails(
      setDoc(doc(db(TEC1_UID), 'modelos', 'novo-modelo'), { nome: 'Filizola CS', ativo: true })
    )
  })

  test('gestor PODE criar modelo', async () => {
    await assertSucceeds(
      setDoc(doc(db(GESTOR_UID), 'modelos', 'filizola-cs'), { nome: 'Filizola CS', ativo: true })
    )
  })

  test('admin PODE criar e editar modelo', async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), 'modelos', 'urano-us15'), { nome: 'Urano US15', ativo: true })
    )
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), 'modelos', 'urano-us15'), { nome: 'Urano US15 — renomeado' })
    )
  })

  test('técnico NÃO pode excluir modelo', async () => {
    await assertFails(deleteDoc(doc(db(TEC1_UID), 'modelos', 'urano-us15')))
  })

  test('admin PODE excluir modelo', async () => {
    await assertSucceeds(deleteDoc(doc(db(ADMIN_UID), 'modelos', 'urano-us15')))
  })
})

// ─── 10. Balanças / Equipamentos (fundação — sem telas ainda) ────────────────

describe('balancas: fundação do parque de equipamentos por loja', () => {
  test('técnico PODE ler balanças', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'balancas', 'balanca-1'), {
        lojaId: 'loja-1', parceiroId: 'parceiro-1', numeroSerie: 'SN-001',
        numeroInmetro: 'INM-001', modelo: 'Toledo 9091', portaria: '123/2020',
        seloInmetro: 'SELO-1', ativo: true,
      })
    })
    await assertSucceeds(getDoc(doc(db(TEC1_UID), 'balancas', 'balanca-1')))
  })

  test('técnico NÃO pode criar balança', async () => {
    await assertFails(
      setDoc(doc(db(TEC1_UID), 'balancas', 'nova-balanca'), {
        lojaId: 'loja-1', parceiroId: 'parceiro-1', numeroSerie: 'SN-002', ativo: true,
      })
    )
  })

  test('gestor PODE criar balança', async () => {
    await assertSucceeds(
      setDoc(doc(db(GESTOR_UID), 'balancas', 'balanca-2'), {
        lojaId: 'loja-1', parceiroId: 'parceiro-1', numeroSerie: 'SN-002',
        numeroInmetro: 'INM-002', modelo: 'Filizola CS', portaria: '124/2020',
        seloInmetro: 'SELO-2', ativo: true,
      })
    )
  })

  test('admin PODE criar e editar balança', async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), 'balancas', 'balanca-3'), {
        lojaId: 'loja-1', parceiroId: 'parceiro-1', numeroSerie: 'SN-003',
        numeroInmetro: 'INM-003', modelo: 'Urano US15', portaria: '125/2020',
        seloInmetro: 'SELO-3', ativo: true,
      })
    )
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), 'balancas', 'balanca-3'), { ativo: false })
    )
  })

  test('técnico NÃO pode excluir balança', async () => {
    await assertFails(deleteDoc(doc(db(TEC1_UID), 'balancas', 'balanca-3')))
  })

  test('admin PODE excluir balança', async () => {
    await assertSucceeds(deleteDoc(doc(db(ADMIN_UID), 'balancas', 'balanca-3')))
  })
})

// ─── 11. Controle de Selos ────────────────────────────────────────────────────

describe('selos: controle de estoque de lacres INMETRO', () => {
  test('técnico PODE ler selo já enviado a ele', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'selos', 'selo-tec1'), {
        numeroSerie: 'SL-0001', status: 'enviado', tecnicoId: TEC1_UID,
      })
    })
    await assertSucceeds(getDoc(doc(db(TEC1_UID), 'selos', 'selo-tec1')))
  })

  test('técnico NÃO pode ler selo enviado a outro técnico', async () => {
    await assertFails(getDoc(doc(db(TEC2_UID), 'selos', 'selo-tec1')))
  })

  test('técnico NÃO pode ler selo disponível (sem tecnicoId)', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'selos', 'selo-disponivel'), {
        numeroSerie: 'SL-0002', status: 'disponivel',
      })
    })
    await assertFails(getDoc(doc(db(TEC1_UID), 'selos', 'selo-disponivel')))
  })

  test('técnico NÃO pode criar selo', async () => {
    await assertFails(
      setDoc(doc(db(TEC1_UID), 'selos', 'selo-novo'), {
        numeroSerie: 'SL-0003', status: 'disponivel',
      })
    )
  })

  test('gestor PODE cadastrar selo', async () => {
    await assertSucceeds(
      setDoc(doc(db(GESTOR_UID), 'selos', 'selo-gestor'), {
        numeroSerie: 'SL-0004', status: 'disponivel',
      })
    )
  })

  test('admin PODE cadastrar e enviar (editar) selo', async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), 'selos', 'selo-admin'), {
        numeroSerie: 'SL-0005', status: 'disponivel',
      })
    )
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), 'selos', 'selo-admin'), {
        status: 'enviado', tecnicoId: TEC1_UID,
      })
    )
  })

  test('técnico NÃO pode excluir selo', async () => {
    await assertFails(deleteDoc(doc(db(TEC1_UID), 'selos', 'selo-admin')))
  })

  test('admin PODE excluir selo', async () => {
    await assertSucceeds(deleteDoc(doc(db(ADMIN_UID), 'selos', 'selo-admin')))
  })
})

// ─── 12. Solicitações de selo (técnico pede mais) ────────────────────────────

describe('solicitacoesSelo: pedido de reposição pelo técnico', () => {
  test('técnico PODE criar solicitação própria pendente', async () => {
    await assertSucceeds(
      setDoc(doc(db(TEC1_UID), 'solicitacoesSelo', 'sol-tec1'), {
        tecnicoId: TEC1_UID, quantidade: 10, status: 'pendente',
      })
    )
  })

  test('técnico NÃO pode criar solicitação em nome de outro técnico', async () => {
    await assertFails(
      setDoc(doc(db(TEC1_UID), 'solicitacoesSelo', 'sol-fake'), {
        tecnicoId: TEC2_UID, quantidade: 5, status: 'pendente',
      })
    )
  })

  test('técnico NÃO pode criar solicitação com status diferente de pendente', async () => {
    await assertFails(
      setDoc(doc(db(TEC1_UID), 'solicitacoesSelo', 'sol-status-errado'), {
        tecnicoId: TEC1_UID, quantidade: 5, status: 'atendida',
      })
    )
  })

  test('técnico PODE ler a própria solicitação', async () => {
    await assertSucceeds(getDoc(doc(db(TEC1_UID), 'solicitacoesSelo', 'sol-tec1')))
  })

  test('técnico NÃO pode ler solicitação de outro técnico', async () => {
    await assertFails(getDoc(doc(db(TEC2_UID), 'solicitacoesSelo', 'sol-tec1')))
  })

  test('técnico NÃO pode editar a própria solicitação', async () => {
    await assertFails(
      updateDoc(doc(db(TEC1_UID), 'solicitacoesSelo', 'sol-tec1'), { quantidade: 20 })
    )
  })

  test('técnico NÃO pode apagar a própria solicitação', async () => {
    await assertFails(deleteDoc(doc(db(TEC1_UID), 'solicitacoesSelo', 'sol-tec1')))
  })

  test('gestor PODE marcar solicitação como atendida', async () => {
    await assertSucceeds(
      updateDoc(doc(db(GESTOR_UID), 'solicitacoesSelo', 'sol-tec1'), {
        status: 'atendida', atendidaPorId: GESTOR_UID,
      })
    )
  })

  test('técnico NÃO pode excluir solicitação', async () => {
    await assertFails(deleteDoc(doc(db(TEC1_UID), 'solicitacoesSelo', 'sol-tec1')))
  })

  test('admin PODE excluir solicitação', async () => {
    await assertSucceeds(deleteDoc(doc(db(ADMIN_UID), 'solicitacoesSelo', 'sol-tec1')))
  })
})
