import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { UserRole } from '@flowops/types'

interface AuthContextValue {
  user: User | null
  role: UserRole | null
  estados: string[]
  loading: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [role,    setRole]    = useState<UserRole | null>(null)
  const [estados, setEstados] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        setRole((snap.data()?.role as UserRole) ?? null)
        setEstados((snap.data()?.estados as string[]) ?? [])
      } else {
        setRole(null)
        setEstados([])
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function login(email: string, senha: string) {
    await signInWithEmailAndPassword(auth, email, senha)
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, role, estados, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
