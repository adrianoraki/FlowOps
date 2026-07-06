import { REGIOES_BRASIL } from '@flowops/types'
import c from '../../components/CrudPage/CrudPage.module.css'

// As 5 regiões do Brasil são fixas (ver packages/types) — não há mais CRUD manual.
// Cada técnico/gestor atende um ou mais ESTADOS (ver /tecnicos); esta tela é só referência.

export function Regioes() {
  return (
    <div className={c.pagina}>
      <div className={c.topo}>
        <span className={c.contagem}>{REGIOES_BRASIL.length} regiões</span>
      </div>

      <p className={c.dica} style={{ marginBottom: '1rem' }}>
        Estrutura fixa das regiões do Brasil, usada como referência ao atribuir estados a técnicos e gestores.
      </p>

      <div className={c.tabelaScroll}>
        <table className={c.tabela}>
          <thead>
            <tr><th>Região</th><th>Estados (UF)</th></tr>
          </thead>
          <tbody>
            {REGIOES_BRASIL.map(r => (
              <tr key={r.id}>
                <td>{r.nome}</td>
                <td className={c.mono}>{r.estados.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
