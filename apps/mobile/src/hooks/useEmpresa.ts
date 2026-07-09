import { useEffect, useState } from 'react'
import firestore from '@react-native-firebase/firestore'
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

  useEffect(() => {
    return firestore()
      .collection('config')
      .doc('empresa')
      .onSnapshot(
        snap => setEmpresa(snap.exists ? { ...EMPRESA_PADRAO, ...(snap.data() as EmpresaConfig) } : EMPRESA_PADRAO),
        () => {},
      )
  }, [])

  return { empresa }
}
