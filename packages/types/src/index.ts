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
  /** CPF do técnico, com máscara (000.000.000-00). Substituiu `regInmetro` como identificação pessoal em 2026-07 — ver nota abaixo. */
  cpf?: string;
  /**
   * @deprecated Campo legado — o Reg. INMETRO é ÚNICO por empresa, não por técnico (era um erro de
   * modelagem: o registro pertence à oficina autorizada, não à pessoa). Substituído por
   * `EmpresaConfig.regInmetro` em 2026-07. Mantido aqui só para não perder os valores já gravados em
   * `users/{uid}` de técnicos cadastrados antes da correção — não ler nem escrever em código novo.
   */
  regInmetro?: string;
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
  /** Registro único da empresa (oficina autorizada) no INMETRO — ex: "73000171". Um só valor para toda a empresa, não por técnico (ver nota em `User.regInmetro`). Exibido na área de assinatura do técnico no PDF/impressão da OS. */
  regInmetro?: string;
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

// ─── Controle de Selos (lacres INMETRO) ────────────────────────────────────────
//
// Cada documento é UM selo físico individual (não uma quantidade). Sem contador
// agregado (ex: counters/selos) de propósito — no plano Spark, manter um contador
// consistente exigiria atualizá-lo via transação em todo lugar que muda o status
// de um selo, e é fácil esquecer um caminho e o contador ficar dessincronizado
// (mesmo risco documentado para estoque_tecnico). Como não é uma soma de N
// coleções, dá pra simplesmente contar os documentos: os totais (disponível,
// enviado por técnico) são sempre calculados na hora a partir da mesma coleção
// `selos` que já precisa ser lida para a listagem — uma única fonte de verdade.

export type StatusSelo = 'disponivel' | 'enviado' | 'usado';

export interface Selo {
  id: string;
  numeroSerie: string;
  status: StatusSelo;
  /** Presente apenas quando status === 'enviado' (ou já foi enviado antes de virar 'usado'). */
  tecnicoId?: string;
  dataEnvio?: Timestamp;
  createdAt: Timestamp;
}

export type StatusSolicitacaoSelo = 'pendente' | 'atendida';

/** Pedido do técnico por mais selos — admin/gestor vê e marca como atendida manualmente (não dispara envio automático). */
export interface SolicitacaoSelo {
  id: string;
  tecnicoId: string;
  quantidade: number;
  status: StatusSolicitacaoSelo;
  createdAt: Timestamp;
  atendidaPorId?: string;
  atendidaEm?: Timestamp;
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

/** Status que aparecem na aba "Ativas" (aguardando_peca tem aba própria) */
export const STATUS_ATIVOS: StatusOS[] = ['aberta', 'em_andamento'];
/** Status que aparecem na aba "Aguardando Peça" */
export const STATUS_AGUARDANDO_PECA: StatusOS[] = ['aguardando_peca'];
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

/**
 * Compatibilidade com OS antigas: `etqReparado` era boolean antes de 2026-07.
 * Sem isso, `true`/`false` legados quebram a geração do PDF (esc() chama .replace
 * num boolean) e somem silenciosamente na impressão web (React não renderiza booleans).
 * Chamar sempre que atendimentos vierem "crus" do Firestore (nunca confiar no tipo).
 */
export function normalizarAtendimentos(atendimentos: unknown): Atendimento[] {
  if (!Array.isArray(atendimentos)) return [];
  return atendimentos.map(a => {
    const at = (a ?? {}) as Atendimento & { etqReparado: unknown };
    return {
      ...at,
      etqReparado: typeof at.etqReparado === 'string' ? at.etqReparado : (at.etqReparado ? 'Sim' : ''),
    };
  });
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

// ─── Balanças / Equipamentos (FUNDAÇÃO — sem telas ainda, ver CLAUDE.md) ─────
//
// Parque de balanças cadastrado por loja (ex: Assaí 305 tem 36 balanças).
// Campos espelham Atendimento (packages/types) para consistência: quando a
// tela de OS existir, o técnico poderá escolher uma Balanca já cadastrada em
// vez de digitar numeroSerie/numeroInmetro/modelo/setor/portaria/seloInmetro
// na hora. Hoje só o tipo + a coleção `balancas` + a Security Rule existem —
// não há telas de cadastro/edição/listagem (fase futura).

export interface Balanca {
  id: string;
  lojaId: string;
  parceiroId: string;
  /** Espelha Atendimento.nSerie (mesmo dado, nome por extenso aqui por ser um cadastro permanente, não um campo de formulário). */
  numeroSerie: string;
  /** Espelha Atendimento.nInmetro. */
  numeroInmetro: string;
  /** Nome do modelo (ver coleção modelos) — mesmo padrão de Atendimento.modelo. */
  modelo: string;
  /** Nome do setor (ver coleção setores) — opcional, mesmo padrão de Atendimento.setor. */
  setor?: string;
  /** Espelha Atendimento.portaria. */
  portaria: string;
  /** Espelha Atendimento.seloInmetro. */
  seloInmetro: string;
  ativo: boolean;
  /** Reservado para uma futura arquitetura multi-empresa — hoje o sistema é single-tenant (ver white-label em CLAUDE.md), campo não é lido/gravado por nenhuma tela ainda. */
  empresaId?: string;
  createdAt: Timestamp;
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
  /** Rótulo "Descrição do Problema" — o que o TÉCNICO diagnosticou/identificou (nível da OS). Ver tabela dos 4 campos de descrição no CLAUDE.md. */
  comentarios: string;
  /** Rótulo "Descrição do Serviço Realizado" — o que o TÉCNICO fez (nível da OS). */
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
  /** Setado ao entrar em 'aguardando_peca' (aba própria mostra "aguardando desde"). Não é limpo ao retomar — sempre reflete a última vez que entrou em espera. */
  aguardandoPecaDesde?: Timestamp;
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

/** Aceita "HH:MM" (legado/web) ou datetime ISO (app). Retorna null se não der para interpretar. */
export function paraDataHorario(v: string | undefined | null): Date | null {
  if (!v) return null;
  if (/^\d{2}:\d{2}$/.test(v)) {
    const d = new Date();
    const [h, m] = v.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Formata uma Date pro valor esperado por `<input type="datetime-local">` ("AAAA-MM-DDTHH:mm", fuso local). */
export function paraDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Exibe só a hora de um horário salvo (aceita "HH:MM" legado ou ISO do app).
 * Sem isso, entrada/saída gravadas pelo app (ISO completo) aparecem cruas
 * ("2026-07-07T14:30:00.000Z") na impressão/PDF em vez de "14:30".
 */
export function formatarHora(v: string | undefined | null): string {
  if (!v) return '';
  if (/^\d{2}:\d{2}$/.test(v)) return v;
  const d = paraDataHorario(v);
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }) : v;
}

/**
 * Exibe data + hora ("DD/MM/AAAA HH:MM") de um datetime ISO completo. Para o formato
 * legado "HH:MM" (sem data), retorna só a hora — não há data pra mostrar nesse caso.
 * Usado para início/finalização, que podem cair em dias diferentes da abertura (ex: OS
 * pausada em "Aguardando Peça" e retomada dias depois).
 */
export function formatarDataHora(v: string | undefined | null): string {
  if (!v) return '';
  if (/^\d{2}:\d{2}$/.test(v)) return v;
  const d = paraDataHorario(v);
  if (!d) return v;
  const data = d.toLocaleDateString('pt-BR');
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${data} ${hora}`;
}

/** Duração em minutos entre entrada e saída (aceita "HH:MM" ou ISO). `null` se não der para calcular. Usado por `calcularTempoTotal` e por relatórios que precisam da média (não dá para calcular média a partir da string formatada). */
export function calcularDuracaoMinutos(entrada: string | undefined | null, saida: string | undefined | null): number | null {
  const e = paraDataHorario(entrada);
  const s = paraDataHorario(saida);
  if (!e || !s) return null;
  const diffMin = Math.round((s.getTime() - e.getTime()) / 60000);
  return diffMin > 0 ? diffMin : null;
}

/** Formata minutos como "1h 30min" / "45min". */
export function formatarDuracaoMinutos(diffMin: number): string {
  const h = Math.floor(diffMin / 60), m = diffMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

/** Duração entre entrada e saída (aceita "HH:MM" ou ISO) — ex: "1h 30min". '' se não der para calcular. */
export function calcularTempoTotal(entrada: string | undefined | null, saida: string | undefined | null): string {
  const diffMin = calcularDuracaoMinutos(entrada, saida);
  return diffMin == null ? '' : formatarDuracaoMinutos(diffMin);
}

/** Corta o texto para no máximo `max` linhas (separadas por \n), descartando o excedente. */
export function limitarLinhas(texto: string, max: number): string {
  const linhas = texto.split('\n');
  return linhas.length > max ? linhas.slice(0, max).join('\n') : texto;
}

// ─── CPF ───────────────────────────────────────────────────────────────────────

/** Formata progressivamente como "000.000.000-00" enquanto o usuário digita (aceita entrada só com dígitos ou já mascarada). */
export function formatarCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Valida os dígitos verificadores do CPF (aceita com ou sem máscara). Rejeita sequências repetidas (ex: 111.111.111-11). */
export function validarCPF(v: string): boolean {
  const cpf = v.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpf[10])) return false;

  return true;
}
