// Tipos do modelo de dados FlowOps — compartilhados entre web e mobile.
// Timestamp replica a interface do Firestore sem criar dependência do SDK aqui.

export interface Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
}

// ─── Regiões ──────────────────────────────────────────────────────────────────

export interface Regiao {
  id: string;
  nome: string;
  ufs: string[];
  cidades?: string[];
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
  regiao: string;
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

// ─── Clientes ─────────────────────────────────────────────────────────────────

export interface Cliente {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  loja: string;
}

// ─── Ordens de Serviço ────────────────────────────────────────────────────────

export type TipoOS = 'corretiva' | 'preventiva' | 'emergencia';
export type StatusOS = 'aberta' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada';

export interface Atendimento {
  chamado: string;
  modelo: string;
  nSerie: string;
  mauUso: boolean;
  nInmetro: string;
  seloInmetro: string;
  seloAtual: string;
  portaria: string;
  etqReparado: boolean;
  descricaoIntervencao: string;
}

export interface OrdemServico {
  id: string;
  /** Atribuído pela Cloud Function na sincronização — ausente enquanto offline */
  numero?: number;
  tipo: TipoOS;
  clienteId: string;
  cidade: string;
  estado: string;
  loja: string;
  veiculo: string;
  regiao: string;
  dataAbertura: Timestamp;
  entrada: string;
  saida: string;
  criadoPorId: string;
  tecnicoId: string;
  atendimentos: Atendimento[];
  comentarios: string;
  solicitacaoMaterial: string;
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
