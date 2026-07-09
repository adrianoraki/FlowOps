// Identificação do responsável pelo FlowOps — isolada neste único arquivo para que,
// quando houver CNPJ/pessoa jurídica (ex: MEI), baste atualizar os campos abaixo em vez
// de reescrever QuemSomos.tsx, Privacidade.tsx e PublicLayout.tsx.
//
// Estado atual: projeto de autoria individual (pessoa física), sem CNPJ.
export const RESPONSAVEL = {
  nome: '[NOME DO RESPONSÁVEL]',
  email: '[E-MAIL DE CONTATO]',
  dominio: '[DOMÍNIO DO SITE]',
  /** Ainda não aplicável (pessoa física) — preencher quando/se houver CNPJ (ex: MEI). */
  cnpj: '[CNPJ, quando aplicável]',
}
