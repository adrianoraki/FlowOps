import { useState } from 'react'
import { REGIOES_BRASIL } from '@flowops/types'

/**
 * Seleção de estados (UFs) segmentada por região: clica numa região pra ver
 * e marcar só os estados dela, em vez de listar os 27 de uma vez.
 *
 * A região inicialmente visível é a da primeira UF já selecionada — passe uma
 * `key` diferente no componente pai (ex: id do registro sendo editado) pra
 * recalcular isso ao trocar de registro num formulário que fica montado.
 */
export function EstadosPicker({ estados, onChange }: {
  estados: string[]
  onChange: (estados: string[]) => void
}) {
  const [regiaoAtiva, setRegiaoAtiva] = useState(() => {
    const r = REGIOES_BRASIL.find(r => r.estados.some(uf => estados.includes(uf)))
    return r?.id ?? REGIOES_BRASIL[0]?.id ?? ''
  })

  function toggle(uf: string) {
    onChange(estados.includes(uf) ? estados.filter(e => e !== uf) : [...estados, uf])
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
        {REGIOES_BRASIL.map(r => {
          const qtd = r.estados.filter(uf => estados.includes(uf)).length
          const ativa = regiaoAtiva === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegiaoAtiva(r.id)}
              style={{
                fontSize: '0.75rem', lineHeight: 1, padding: '0.4rem 0.65rem',
                borderRadius: '999px', cursor: 'pointer',
                border: `1px solid ${ativa ? '#4f6ef7' : 'var(--border-input)'}`,
                background: ativa ? '#4f6ef7' : 'var(--bg-surface)',
                color: ativa ? '#fff' : 'var(--text-1)',
                fontWeight: qtd > 0 ? 600 : 400,
              }}
            >
              {r.nome}{qtd > 0 && ` (${qtd})`}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {(REGIOES_BRASIL.find(r => r.id === regiaoAtiva)?.estados ?? []).map(uf => {
          const marcado = estados.includes(uf)
          return (
            <button
              key={uf}
              type="button"
              onClick={() => toggle(uf)}
              style={{
                fontSize: '0.78rem', lineHeight: 1, padding: '0.4rem 0.6rem',
                borderRadius: '6px', cursor: 'pointer',
                border: `1px solid ${marcado ? '#4f6ef7' : 'var(--border-input)'}`,
                background: marcado ? '#4f6ef7' : 'var(--bg-surface)',
                color: marcado ? '#fff' : 'var(--text-1)',
              }}
            >
              {uf}
            </button>
          )
        })}
      </div>
    </div>
  )
}
