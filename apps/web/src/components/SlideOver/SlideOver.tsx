import { useEffect, type ReactNode } from 'react'
import s from './SlideOver.module.css'

interface Props {
  aberto: boolean
  titulo: string
  onFechar: () => void
  children: ReactNode
}

export function SlideOver({ aberto, titulo, onFechar, children }: Props) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onFechar])

  return (
    <>
      <div className={`${s.backdrop} ${aberto ? s.visivel : ''}`} onClick={onFechar} />
      <aside className={`${s.painel} ${aberto ? s.aberto : ''}`}>
        <div className={s.cabecalho}>
          <h2 className={s.titulo}>{titulo}</h2>
          <button className={s.fechar} onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className={s.corpo}>{children}</div>
      </aside>
    </>
  )
}
