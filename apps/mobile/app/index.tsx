import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useAuth } from '../src/context/AuthContext'

export default function Home() {
  const { user, role, loading, logout } = useAuth()

  if (loading) {
    return (
      <View style={s.centralizado}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  // Usuário não é técnico de campo
  if (role !== 'tecnico') {
    return (
      <View style={s.centralizado}>
        <Text style={s.emoji}>🔒</Text>
        <Text style={s.aviso}>Este app é para técnicos de campo.</Text>
        <Text style={s.sub}>
          {user?.email ? `Logado como ${user.email}` : ''}
          {role ? `\nPerfil: ${role}` : ''}
        </Text>
        <TouchableOpacity style={s.botaoSair} onPress={logout}>
          <Text style={s.botaoSairTexto}>Sair</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.titulo}>FlowOps</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={s.sair}>Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={s.conteudo}>
        {/* Placeholder — tela de OSs será implementada na próxima sprint */}
        <Text style={s.placeholder}>Minhas OSs</Text>
        <Text style={s.placeholderSub}>Em construção</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f6f8',
    padding: 32,
  },

  emoji: { fontSize: 48, marginBottom: 16 },

  aviso: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },

  sub: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },

  botaoSair: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  botaoSairTexto: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '700',
  },

  // Tela de técnico autenticado
  container: { flex: 1, backgroundColor: '#f5f6f8' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2563eb',
  },

  sair: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },

  conteudo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholder: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },

  placeholderSub: {
    fontSize: 14,
    color: '#9ca3af',
  },
})
