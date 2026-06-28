import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '../src/context/AuthContext'

function NavigationGuard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (loading) return
    const noLogin = segments[0] !== 'login'

    if (!user && noLogin) {
      router.replace('/login')
    } else if (user && !noLogin) {
      router.replace('/')
    }
  }, [user, loading, segments])

  return null
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  )
}
