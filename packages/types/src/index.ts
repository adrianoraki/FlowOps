// Tipos do modelo de dados FlowOps — compartilhados entre web e mobile.
// Timestamp replica a interface do Firestore sem criar dependência do SDK aqui.

import { MUNICIPIOS_POR_UF } from './municipios';
export * from './municipios';

export interface Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
}

// ─── Regiões (estrutura fixa — não é mais cadastrada no Firestore) ────────────

export interface RegiaoBrasil {
  id: string;
  nome: string;
  estados: string[];
}

/** As 5 regiões do Brasil e suas UFs — fixo no código, só para referência/organização visual. */
export const REGIOES_BRASIL: RegiaoBrasil[] = [
  { id: 'norte',        nome: 'Norte',        estados: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'] },
  { id: 'nordeste',     nome: 'Nordeste',     estados: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] },
  { id: 'centro-oeste', nome: 'Centro-Oeste', estados: ['GO', 'MT', 'MS', 'DF'] },
  { id: 'sudeste',      nome: 'Sudeste',      estados: ['ES', 'MG', 'RJ', 'SP'] },
  { id: 'sul',          nome: 'Sul',          estados: ['PR', 'RS', 'SC'] },
];

/** Todas as 27 UFs, na ordem das 5 regiões acima. */
export const TODOS_ESTADOS: string[] = REGIOES_BRASIL.flatMap(r => r.estados);

/** UF -> nome da região (para exibição). Ex: 'SP' -> 'Sudeste'. */
export function regiaoDoEstado(uf: string): string | undefined {
  return REGIOES_BRASIL.find(r => r.estados.includes(uf))?.nome;
}

/** Municípios de uma UF (dataset embutido, ver municipios.ts). Vazio se UF não informada. */
export function cidadesDoEstado(uf: string): string[] {
  return MUNICIPIOS_POR_UF[uf] ?? [];
}

// ─── Users ────────────────────────────────────────────────────────────────────

export type UserRole = 'tecnico' | 'gestor' | 'admin';

export interface User {
  uid: string;
  nome: string;
  email: string;
  role: UserRole;
  matricula: string;
  rg: string;
  /** UFs atendidas (técnico) ou geridas (gestor). Um usuário pode cobrir vários estados. */
  estados: string[];
  /** false = desativado. Ausente ou true = ativo. Remover do Auth exige Admin SDK (TODO). */
  ativo?: boolean;
}

// ─── Config da empresa (white-label) ──────────────────────────────────────────

export interface EmpresaConfig {
  nomeEmpresa: string;
  cnpj: string;
  registro: string;
  telefone1: string;
  telefone2: string;
  email: string;
  site: string;
  endereco: string;
  logoUrl: string;
}

// ─── Peças e Estoque ──────────────────────────────────────────────────────────

export interface Peca {
  id: string;
  nome: string;
  codigo: string;
  unidade: string;
  ativo?: boolean;
}

/** Item do array OrdemServico.pecasUsadas — nome denormalizado do catálogo (pecas/{id}) na hora do uso. */
export interface ItemPecaUsada {
  pecaId: string;
  nome: string;
  quantidade: number;
}

export type TipoMovimentacao = 'envio' | 'devolucao';
export type StatusMovimentacao = 'pendente' | 'confirmada' | 'divergencia';

export interface ItemMovimentacao {
  pecaId: string;
  quantidade: number;
}

export interface Movimentacao {
  id: string;
  tipo: TipoMovimentacao;
  tecnicoId: string;
  itens: ItemMovimentacao[];
  status: StatusMovimentacao;
  criadoPorId: string;
  confirmadoPorId?: string;
  observacao?: string;
  createdAt: Timestamp;
  confirmadoEm?: Timestamp;
}

export interface EstoqueTecnico {
  id: string;
  tecnicoId: string;
  pecaId: string;
  quantidade: number;
}

// ─── Parceiros e Lojas ──────────────────────────────────────────────────────
//
// Um parceiro é 'rede' (várias lojas) ou 'unico' (uma loja só, criada junto
// com o parceiro). Estado/cidade/região ficam na LOJA, não no parceiro —
// uma rede pode ter lojas em vários estados.

export type TipoParceiro = 'rede' | 'unico';

export interface Parceiro {
  id: string;
  nome: string;
  tipo: TipoParceiro;
}

export interface Loja {
  id: string;
  parceiroId: string;
  /** Obrigatório para lojas de rede; opcional quando o parceiro é 'unico'. */
  numero?: string;
  nome: string;
  estado: string;
  cidade: string;
  /** Derivada do estado (regiaoDoEstado) — guardada para facilitar consultas/relatórios. */
  regiao: string;
  ativo?: boolean;
}

// ─── Ordens de Serviço ────────────────────────────────────────────────────────

export type TipoOS = 'corretiva' | 'preventiva' | 'emergencia';
export type StatusOS = 'aberta' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada';

/** Status que aparecem na lista principal (aba "Ativas") */
export const STATUS_ATIVOS: StatusOS[] = ['aberta', 'em_andamento', 'aguardando_peca'];
/** Status finalizados — aba "Histórico", somente leitura */
export const STATUS_HISTORICO: StatusOS[] = ['concluida', 'cancelada'];

export interface Atendimento {
  /** Número do chamado desta balança — opcional; a finalização da OS apenas avisa se estiver vazio, não bloqueia. */
  chamado: string;
  modelo: string;
  nSerie: string;
  /** Nome do setor (ver coleção setores) — texto livre para OS antigas sem setor cadastrado. */
  setor: string;
  mauUso: boolean;
  nInmetro: string;
  seloInmetro: string;
  seloAtual: string;
  portaria: string;
  /** Texto livre preenchido pelo técnico (ex: número/descrição da etiqueta de reparo aplicada). Era boolean até 2026-07. */
  etqReparado: string;
  descricaoIntervencao: string;
}

// ─── Setores (cadastro por empresa — white-label) ─────────────────────────────

export interface Setor {
  id: string;
  nome: string;
  ativo?: boolean;
}

/** Setores iniciais sugeridos ao configurar uma empresa nova. */
export const SETORES_PADRAO: string[] = [
  'Açougue', 'Hortifruti', 'Perecíveis', 'Empório Frios', 'FLV', 'Autoatendimento', 'PDV',
];

// ─── Modelos de balança (catálogo por empresa — white-label) ─────────────────

export interface Modelo {
  id: string;
  nome: string;
  ativo?: boolean;
}

export interface OrdemServico {
  id: string;
  /** Sequencial atribuído via transação client-side em counters/ordens (ver formatarNumeroOS) */
  numero?: number;
  tipo: TipoOS;
  /** Preenchidos automaticamente ao escolher a loja (ver Parceiro/Loja) — não digitados. */
  parceiroId: string;
  parceiroNome: string;
  lojaId: string;
  lojaNumero?: string;
  lojaNome: string;
  cidade: string;
  /** UF onde a OS acontece (vem da loja) — usado pelas Security Rules e pela atribuição de técnico. */
  estado: string;
  /** Derivada do estado da loja — só para relatórios/exibição, não usada pelas Security Rules. */
  regiao: string;
  /** Nome de quem abriu o chamado. */
  solicitante: string;
  dataAbertura: Timestamp;
  entrada: string;
  saida: string;
  criadoPorId: string;
  tecnicoId: string;
  atendimentos: Atendimento[];
  /** Descrição da ABERTURA — o que o solicitante pediu. Preenchida por quem despacha (admin/gestor); somente leitura para o técnico no app. */
  comentarios: string;
  /** Descrição do SERVIÇO REALIZADO — preenchida pelo técnico durante o atendimento. */
  descricaoServicoRealizado: string;
  solicitacaoMaterial: string;
  /** Peças usadas no atendimento — catálogo (pecas/{id}) + quantidade, preenchido pelo técnico no app. */
  pecasUsadas: ItemPecaUsada[];
  assinaturaClienteUrl?: string;
  /** Base64 PNG data URL capturada no app (sem Firebase Storage) */
  assinaturaClienteBase64?: string;
  nomeLegivel: string;
  matriculaCliente: string;
  assinaturaTecnicoUrl?: string;
  /** Base64 PNG data URL capturada no app (sem Firebase Storage) */
  assinaturaTecnicoBase64?: string;
  rgTecnico: string;
  status: StatusOS;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  fechadaEm?: Timestamp;
}

/** Documento counters/ordens — numeração sequencial via transação client-side (sem Cloud Function) */
export interface CounterOrdens {
  proximo: number;
}

/** 1 -> "0001", 42 -> "0042", 1234 -> "1234". Sem número atribuído -> "S/N". */
export function formatarNumeroOS(numero: number | null | undefined): string {
  if (numero == null) return 'S/N';
  return String(numero).padStart(4, '0');
}
