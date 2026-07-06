import type { Atendimento } from '@flowops/types'

export const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  aberta:          { label: 'Aberta',          bg: '#fef3c7', color: '#92400e' },
  em_andamento:    { label: 'Em andamento',    bg: '#eff6ff', color: '#1d4ed8' },
  aguardando_peca: { label: 'Aguardando peça', bg: '#ffedd5', color: '#c2410c' },
  concluida:       { label: 'Concluída',        bg: '#dcfce7', color: '#15803d' },
  cancelada:       { label: 'Cancelada',        bg: '#f3f4f6', color: '#6b7280' },
}

export const TIPO_CONFIG: Record<string, string> = {
  corretiva:  'Corretiva',
  preventiva: 'Preventiva',
  emergencia: 'Emergência',
}

export const ATENDIMENTO_VAZIO: Atendimento = {
  chamado: '',
  modelo: '',
  nSerie: '',
  setor: '',
  mauUso: false,
  nInmetro: '',
  seloInmetro: '',
  seloAtual: '',
  portaria: '',
  etqReparado: false,
  descricaoIntervencao: '',
}

export const STATUS_READONLY = new Set(['concluida', 'cancelada'])
