// Tipos do modelo de dados FlowOps — compartilhados entre web e mobile.
// Timestamp replica a interface do Firestore sem criar dependência do SDK aqui.

export interface Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
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
export type StatusOS = 'aberta' | 'fechada';

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
  dataAbertura: Timestamp;
  entrada: string;
  saida: string;
  tecnicoId: string;
  atendimentos: Atendimento[];
  comentarios: string;
  solicitacaoMaterial: string;
  assinaturaClienteUrl?: string;
  nomeLegivel: string;
  matriculaCliente: string;
  assinaturaTecnicoUrl?: string;
  rgTecnico: string;
  status: StatusOS;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  fechadaEm?: Timestamp;
}
