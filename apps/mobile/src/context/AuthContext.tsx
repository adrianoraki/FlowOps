import React, { createContext, useContext, useEffect, useState } from 'react'
import type { FirebaseAuthTypes } from '@react-native-firebase/auth'
import { auth, firestore } from '../lib/firebase'
import type { UserRole } from '@flowops/types'

const TIMEOUT_PERFIL_MS = 15_000

interface PerfilData {
  role: UserRole | null
  estados: string[]
}

async function buscarPerfil(uid: string): Promise<PerfilData> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), TIMEOUT_PERFIL_MS)
  )
  const snap = await Promise.race([
    firestore().collection('users').doc(uid).get(),
    timeout,
  ])
  const data = snap.data()
  return {
    role:    (data?.role    as UserRole) ?? null,
    estados: (data?.estados as string[]) ?? [],
  }
}

interface AuthContextValue {
  user:             FirebaseAuthTypes.User | null
  role:             UserRole | null
  estados:          string[]
  loading:          boolean
  perfilErro:       boolean
  login:            (email: string, senha: string) => Promise<void>
  logout:           () => Promise<void>
  recarregarPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,       setUser]       = useState<FirebaseAuthTypes.User | null>(null)
  const [role,       setRole]       = useState<UserRole | null>(null)
  const [estados,    setEstados]    = useState<string[]>([])
  const [loading,    setLoading]    = useState(true)
  const [perfilErro, setPerfilErro] = useState(false)

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        try {
          const perfil = await buscarPerfil(firebaseUser.uid)
          setRole(perfil.role)
          setEstados(perfil.estados)
          setPerfilErro(false)
        } catch {
          setPerfilErro(true)
        }
      } else {
        setRole(null)
        setEstados([])
        setPerfilErro(false)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function recarregarPerfil(): Promise<void> {
    const u = auth().currentUser
    if (!u) return
    try {
      const perfil = await buscarPerfil(u.uid)
      setRole(perfil.role)
      setEstados(perfil.estados)
      setPerfilErro(false)
    } catch {
      setPerfilErro(true)
    }
  }

  async function login(email: string, senha: string) {
    await auth().signInWithEmailAndPassword(email, senha)
  }

  async function logout() {
    await auth().signOut()
  }

  return (
    <AuthContext.Provider value={{ user, role, estados, loading, perfilErro, login, logout, recarregarPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
