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
const { doc, getDoc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore')
const fs = require('fs')

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PROJECT_ID   = 'flowops-test'
const ADMIN_UID    = 'uid-admin'
const GESTOR_UID   = 'uid-gestor'
const TEC1_UID     = 'uid-tec1'   // técnico região SP
const TEC2_UID     = 'uid-tec2'   // técnico região RJ
const REGIAO_SP    = 'regiao-sp'
const REGIAO_RJ    = 'regiao-rj'
const OS_ABERTA    = 'os-aberta-sp'
const OS_CONCLUIDA = 'os-concluida-sp'
const MOV_ENVIO    = 'mov-envio-1'

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

    await setDoc(doc(db, 'users', ADMIN_UID),  { role: 'admin',   regiao: REGIAO_SP, ativo: true })
    await setDoc(doc(db, 'users', GESTOR_UID), { role: 'gestor',  regiao: REGIAO_SP, ativo: true })
    await setDoc(doc(db, 'users', TEC1_UID),   { role: 'tecnico', regiao: REGIAO_SP, ativo: true })
    await setDoc(doc(db, 'users', TEC2_UID),   { role: 'tecnico', regiao: REGIAO_RJ, ativo: true })

    await setDoc(doc(db, 'ordens_servico', OS_ABERTA), {
      status:      'aberta',
      regiao:      REGIAO_SP,
      tecnicoId:   TEC1_UID,
      criadoPorId: GESTOR_UID,
    })

    await setDoc(doc(db, 'ordens_servico', OS_CONCLUIDA), {
      status:      'concluida',
      regiao:      REGIAO_SP,
      tecnicoId:   TEC1_UID,
      criadoPorId: GESTOR_UID,
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

// ─── 1. Técnico não lê OS de outra região ────────────────────────────────────

describe('OS: leitura por região', () => {
  test('técnico da região SP lê OS da própria região', async () => {
    await assertSucceeds(getDoc(doc(db(TEC1_UID), 'ordens_servico', OS_ABERTA)))
  })

  test('técnico da região RJ NÃO lê OS da região SP (sem atribuição)', async () => {
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
        role: 'tecnico', regiao: REGIAO_SP, ativo: true,
      })
    )
  })

  test('gestor PODE criar usuário técnico', async () => {
    await assertSucceeds(
      setDoc(doc(db(GESTOR_UID), 'users', 'novo-tec-uid'), {
        role: 'tecnico', regiao: REGIAO_SP, ativo: true,
      })
    )
  })

  test('gestor NÃO pode alterar o próprio role', async () => {
    await assertFails(
      updateDoc(doc(db(GESTOR_UID), 'users', GESTOR_UID), { role: 'admin' })
    )
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

  test('técnico de outra região NÃO confirma envio destinado a outro', async () => {
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
