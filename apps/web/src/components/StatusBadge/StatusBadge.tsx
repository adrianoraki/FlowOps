import s from './StatusBadge.module.css'

const LABELS: Record<string, string> = {
  aberta:           'Aberta',
  em_andamento:     'Em andamento',
  aguardando_peca:  'Aguardando peça',
  concluida:        'Concluída',
  cancelada:        'Cancelada',
  fechada:          'Fechada',
  pendente:         'Pendente',
  confirmada:       'Confirmada',
  divergencia:      'Divergência',
}

export function StatusBadge({ status }: { status: string }) {
  const cls = (s as Record<string, string>)
  return (
    <span className={`${s.badge} ${cls[status] ?? s.desconhecido}`}>
      {LABELS[status] ?? status}
    </span>
  )
}
