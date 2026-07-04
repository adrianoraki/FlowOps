export type SyncStatus = 'offline' | 'sincronizando' | 'sincronizado'

interface SnapshotMeta {
  fromCache: boolean
  hasPendingWrites: boolean
}

// Deriva o status de conexão a partir dos metadados dos listeners onSnapshot ativos
// (includeMetadataChanges: true) — sem depender de NetInfo ou de lógica de rede própria.
export function computeSyncStatus(metas: Array<SnapshotMeta | null>): SyncStatus {
  const validas = metas.filter((m): m is SnapshotMeta => m !== null)
  if (validas.length === 0) return 'sincronizando'
  if (validas.some(m => m.hasPendingWrites)) return 'sincronizando'
  if (validas.some(m => m.fromCache)) return 'offline'
  return 'sincronizado'
}
