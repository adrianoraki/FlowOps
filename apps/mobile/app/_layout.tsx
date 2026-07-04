import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '../src/context/AuthContext'

function NavigationGuard() {
  const { user, loading, perfilErro } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (loading || perfilErro) return
    const noLogin = segments[0] !== 'login'
    if (!user && noLogin) {
      router.replace('/login')
    } else if (user && !noLogin) {
      router.replace('/')
    }
  }, [user, loading, perfilErro, segments])

  return null
}

function LayoutContent() {
  const { user, loading, perfilErro, recarregarPerfil, logout } = useAuth()
  const [tentando, setTentando] = useState(false)

  async function handleRetry() {
    setTentando(true)
    try { await recarregarPerfil() } finally { setTentando(false) }
  }

  if (!loading && user && perfilErro) {
    return (
      <View style={s.telaErro}>
        <Text style={s.erroIcone}>⚠️</Text>
        <Text style={s.erroTitulo}>Falha na conexão</Text>
        <Text style={s.erroMensagem}>
          Não foi possível carregar seus dados.{'\n'}
          Verifique sua conexão e tente novamente.
        </Text>
        <TouchableOpacity
          style={[s.btnRetry, tentando && s.btnDisabled]}
          onPress={handleRetry}
          disabled={tentando}
          activeOpacity={0.8}
        >
          {tentando
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnRetryTexto}>Tentar novamente</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSair} onPress={logout}>
          <Text style={s.btnSairTexto}>Sair</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <NavigationGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LayoutContent />
    </AuthProvider>
  )
}

const s = StyleSheet.create({
  telaErro: {
    flex: 1,
    backgroundColor: '#f5f6f8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  erroIcone: {
    fontSize: 48,
    marginBottom: 16,
  },
  erroTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  erroMensagem: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  btnRetry: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    maxWidth: 280,
  },
  btnDisabled: { opacity: 0.6 },
  btnRetryTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  btnSair: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  btnSairTexto: {
    color: '#6b7280',
    fontSize: 14,
  },
})
