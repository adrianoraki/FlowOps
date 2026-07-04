import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native'
import { useAuth } from '../src/context/AuthContext'

const ERROS: Record<string, string> = {
  'auth/invalid-credential':     'E-mail ou senha inválidos.',
  'auth/user-not-found':         'Usuário não encontrado.',
  'auth/wrong-password':         'Senha incorreta.',
  'auth/invalid-email':          'E-mail inválido.',
  'auth/user-disabled':          'Usuário desativado. Fale com o administrador.',
  'auth/too-many-requests':      'Muitas tentativas. Tente novamente mais tarde.',
  'auth/network-request-failed': 'Sem conexão. Conecte-se à internet para o primeiro acesso.',
}

export default function Login() {
  const { login } = useAuth()
  const [email,   setEmail]   = useState('')
  const [senha,   setSenha]   = useState('')
  const [erro,    setErro]    = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.trim()) { setErro('Informe o e-mail.'); return }
    if (!senha)        { setErro('Informe a senha.');  return }
    setErro('')
    setLoading(true)
    try {
      await login(email.trim(), senha)
      // redirect tratado pelo NavigationGuard no _layout
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      setErro(ERROS[code] ?? 'Erro ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.titulo}>FlowOps</Text>
          <Text style={s.subtitulo}>Acesso do técnico</Text>
        </View>

        <View style={s.card}>
          <View style={s.campo}>
            <Text style={s.label}>E-mail</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={s.campo}>
            <Text style={s.label}>Senha</Text>
            <TextInput
              style={s.input}
              value={senha}
              onChangeText={setSenha}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              editable={!loading}
            />
          </View>

          {erro ? <Text style={s.erro}>{erro}</Text> : null}

          <TouchableOpacity
            style={[s.botao, loading && s.botaoDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.botaoTexto}>Entrar</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f6f8' },

  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  titulo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: -0.5,
  },
  subtitulo: {
    fontSize: 13,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },

  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  campo: { marginBottom: 16 },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#fff',
  },

  erro: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 12,
  },

  botao: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botaoDisabled: { opacity: 0.6 },
  botaoTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
