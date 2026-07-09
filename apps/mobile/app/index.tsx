import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { formatarNumeroOS } from '@flowops/types'
import { useAuth } from '../src/context/AuthContext'
import { useMinhasOS, type OSItem, type Aba } from '../src/hooks/useMinhasOS'
import { STATUS_CONFIG as STATUS, TIPO_CONFIG as TIPO } from '../src/utils/osConfig'
import { SyncStatusBar } from '../src/components/SyncStatusBar'

function formatarDataHora(d: Date): string {
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${data} ${hora}`
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' }
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.bg }]}>
      <Text style={[badge.txt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}

const badge = StyleSheet.create({
  wrap: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  txt:  { fontSize: 11, fontWeight: '700' },
})

function AbaBotao({ label, contagem, ativa, temNovidade, onPress }: {
  label: string; contagem: number; ativa: boolean; temNovidade: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity style={[s.aba, ativa && s.abaAtiva]} onPress={onPress}>
      <View style={s.abaConteudo}>
        <Text style={[s.abaTxt, ativa && s.abaTxtAtiva]}>{label} ({contagem})</Text>
        {temNovidade && <View style={s.abaPonto} />}
      </View>
    </TouchableOpacity>
  )
}

function OSCard({ os, isNew, onPress, aba }: { os: OSItem; isNew: boolean; onPress: () => void; aba: Aba }) {
  const data = aba === 'historico'
    ? (os.fechadaEm?.toDate().toLocaleDateString('pt-BR')
      ?? os.dataAbertura?.toDate().toLocaleDateString('pt-BR') ?? '—')
    : aba === 'aguardando'
    ? (os.aguardandoPecaDesde ? `Aguardando desde ${formatarDataHora(os.aguardandoPecaDesde.toDate())}` : '—')
    : (os.dataAbertura?.toDate().toLocaleDateString('pt-BR') ?? '—')
  return (
    <TouchableOpacity
      style={[card.wrap, isNew && card.wrapNew]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {isNew && (
        <View style={card.novaBadge}>
          <Text style={card.novaTxt}>NOVA</Text>
        </View>
      )}
      <View style={card.header}>
        <StatusBadge status={os.status} />
        <Text style={card.tipo}>{TIPO[os.tipo] ?? os.tipo}</Text>
      </View>
      <Text style={card.cliente} numberOfLines={1}>
        {formatarNumeroOS(os.numero)} · {os.parceiroNome} — {os.lojaNumero ? `${os.lojaNumero} ` : ''}{os.lojaNome}
      </Text>
      <View style={card.footer}>
        <Text style={card.meta}>{data}</Text>
        {os.estado ? <Text style={card.meta}>UF: {os.estado}</Text> : null}
      </View>
    </TouchableOpacity>
  )
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  wrapNew: {
    borderColor: '#2563eb',
    borderWidth: 1.5,
  },
  novaBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  novaTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tipo: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  cliente: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontSize: 12, color: '#9ca3af' },
})

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function MinhasOS() {
  const { user, role, loading: authLoading, logout } = useAuth()
  const {
    ativas, aguardando, historico, newIds, hasNewArrived,
    novidadePorAba, marcarAbaVista,
    loading, markSeen, syncStatus,
  } = useMinhasOS()
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('ativas')

  const listaAtual = aba === 'ativas' ? ativas : aba === 'aguardando' ? aguardando : historico

  // Abrir (ou continuar) numa aba apaga o indicador de novidade dela — reage
  // também a mudanças na lista da aba atual, então nada "acende" na aba já aberta.
  useEffect(() => {
    marcarAbaVista(aba)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, listaAtual])

  // ── Usuário não é técnico ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <View style={s.centralizado}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (role !== 'tecnico') {
    return (
      <View style={s.centralizado}>
        <Text style={s.emoji}>🔒</Text>
        <Text style={s.aviso}>Este app é para técnicos de campo.</Text>
        {user?.email ? <Text style={s.sub}>Logado como {user.email}</Text> : null}
        <TouchableOpacity style={s.botaoSair} onPress={logout}>
          <Text style={s.botaoSairTexto}>Sair</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Tela do técnico ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.titulo}>Minhas OSs</Text>
          {aba === 'ativas' && newIds.size > 0 && (
            <View style={s.badgeCount}>
              <Text style={s.badgeCountTxt}>{newIds.size}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={s.sair}>Sair</Text>
        </TouchableOpacity>
      </View>

      <SyncStatusBar status={syncStatus} />

      {/* Abas */}
      <View style={s.abas}>
        <AbaBotao
          label="Ativas"
          contagem={ativas.length}
          ativa={aba === 'ativas'}
          temNovidade={novidadePorAba.ativas}
          onPress={() => setAba('ativas')}
        />
        <AbaBotao
          label="Aguardando Peça"
          contagem={aguardando.length}
          ativa={aba === 'aguardando'}
          temNovidade={novidadePorAba.aguardando}
          onPress={() => setAba('aguardando')}
        />
        <AbaBotao
          label="Histórico"
          contagem={historico.length}
          ativa={aba === 'historico'}
          temNovidade={novidadePorAba.historico}
          onPress={() => setAba('historico')}
        />
      </View>

      {/* Toast de nova OS */}
      {aba === 'ativas' && hasNewArrived && (
        <View style={s.toast}>
          <Text style={s.toastTxt}>🔔 Nova OS recebida</Text>
        </View>
      )}

      {/* Lista */}
      {loading
        ? (
          <View style={s.centralizado}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        )
        : (
          <FlatList
            data={listaAtual}
            keyExtractor={item => item.id}
            contentContainerStyle={
              listaAtual.length === 0
                ? s.listaVazia
                : { paddingTop: 12, paddingBottom: 32 }
            }
            renderItem={({ item }) => (
              <OSCard
                os={item}
                isNew={aba === 'ativas' && newIds.has(item.id)}
                aba={aba}
                onPress={() => {
                  markSeen(item.id)
                  router.push(`/os/${item.id}`)
                }}
              />
            )}
            ListEmptyComponent={
              <View style={s.centralizado}>
                <Text style={s.emoji}>{aba === 'ativas' ? '📋' : aba === 'aguardando' ? '⏸️' : '🗂️'}</Text>
                <Text style={s.aviso}>
                  {aba === 'ativas'
                    ? 'Nenhuma OS atribuída\nno momento.'
                    : aba === 'aguardando'
                    ? 'Nenhuma OS aguardando\npeça no momento.'
                    : 'Nenhuma OS finalizada\nainda.'}
                </Text>
              </View>
            }
          />
        )
      }
    </SafeAreaView>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f6f8' },
  centralizado: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f5f6f8', padding: 32,
  },
  listaVazia: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo:      { fontSize: 22, fontWeight: '800', color: '#2563eb' },
  badgeCount:  {
    backgroundColor: '#2563eb', borderRadius: 12,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeCountTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  sair:        { fontSize: 14, color: '#dc2626', fontWeight: '600' },

  // Abas
  abas: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingBottom: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  aba: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#f5f6f8',
  },
  abaAtiva: { backgroundColor: '#2563eb' },
  abaConteudo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  abaTxt:   { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  abaTxtAtiva: { color: '#fff' },
  abaPonto: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#fff',
  },

  // Toast
  toast: {
    backgroundColor: '#2563eb', marginHorizontal: 16, marginTop: 10,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Estado vazio / loading
  emoji: { fontSize: 48, marginBottom: 16 },
  aviso: {
    fontSize: 18, fontWeight: '600', color: '#1f2937',
    textAlign: 'center', marginBottom: 12, lineHeight: 26,
  },
  sub:  { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32 },
  botaoSair: {
    backgroundColor: '#fee2e2', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  botaoSairTexto: { color: '#dc2626', fontSize: 15, fontWeight: '700' },
})
