import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import type { EmpresaConfig } from '@flowops/types'

export const EMPRESA_PADRAO: EmpresaConfig = {
  nomeEmpresa: '',
  cnpj: '',
  registro: '',
  regInmetro: '',
  telefone1: '',
  telefone2: '',
  email: '',
  site: '',
  endereco: '',
  logoUrl: '',
}

export function useEmpresa() {
  const [empresa, setEmpresa] = useState<EmpresaConfig>(EMPRESA_PADRAO)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(
      doc(db, 'config', 'empresa'),
      snap => {
        setEmpresa(snap.exists() ? { ...EMPRESA_PADRAO, ...(snap.data() as EmpresaConfig) } : EMPRESA_PADRAO)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  return { empresa, loading }
}
