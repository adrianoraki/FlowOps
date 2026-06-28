import React, { createContext, useContext, useEffect, useState } from 'react'
import type { FirebaseAuthTypes } from '@react-native-firebase/auth'
import { auth, firestore } from '../lib/firebase'
import type { UserRole } from '@flowops/types'

interface AuthContextValue {
  user:    FirebaseAuthTypes.User | null
  role:    UserRole | null
  regiao:  string
  loading: boolean
  login:   (email: string, senha: string) => Promise<void>
  logout:  () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<FirebaseAuthTypes.User | null>(null)
  const [role,    setRole]    = useState<UserRole | null>(null)
  const [regiao,  setRegiao]  = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        try {
          const snap = await firestore().collection('users').doc(firebaseUser.uid).get()
          const data = snap.data()
          setRole((data?.role as UserRole) ?? null)
          setRegiao((data?.regiao as string) ?? '')
        } catch {
          setRole(null)
          setRegiao('')
        }
      } else {
        setRole(null)
        setRegiao('')
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function login(email: string, senha: string) {
    await auth().signInWithEmailAndPassword(email, senha)
  }

  async function logout() {
    await auth().signOut()
  }

  return (
    <AuthContext.Provider value={{ user, role, regiao, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
