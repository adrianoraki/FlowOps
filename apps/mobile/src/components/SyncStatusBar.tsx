import { View, Text, StyleSheet } from 'react-native'
import type { SyncStatus } from '../utils/syncStatus'

const CONFIG: Record<SyncStatus, { label: string; bg: string; color: string }> = {
  offline:       { label: '📴 Offline — alterações serão sincronizadas', bg: '#fef3c7', color: '#92400e' },
  sincronizando: { label: '🔄 Sincronizando alterações…',                bg: '#eff6ff', color: '#1d4ed8' },
  sincronizado:  { label: '✅ Sincronizado',                             bg: '#dcfce7', color: '#15803d' },
}

export function SyncStatusBar({ status }: { status: SyncStatus }) {
  const cfg = CONFIG[status]
  return (
    <View style={[s.wrap, { backgroundColor: cfg.bg }]}>
      <Text style={[s.txt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 5, alignItems: 'center' },
  txt:  { fontSize: 12, fontWeight: '700' },
})
