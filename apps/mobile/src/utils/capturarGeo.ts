import * as Location from 'expo-location'
import firestore from '@react-native-firebase/firestore'
import type { PontoGeo } from '@flowops/types'

// Captura de GPS para o check-in/check-out da OS.
//
// Regras que valem para todo este arquivo:
//   1. NUNCA bloquear o fluxo do técnico. Permissão negada, GPS desligado,
//      sem sinal, demora — tudo retorna null e o atendimento segue normal.
//      A coordenada é um dado de apoio para o mapa do gestor, não um requisito.
//   2. Funciona offline: o GPS do aparelho não depende de internet. A escrita
//      no Firestore resolve contra o cache local e sincroniza depois, como
//      todo o resto do app (ver src/lib/firebase.ts).
//   3. Só é chamada em dois momentos (iniciar e finalizar) — não há
//      rastreamento contínuo. Ver a seção de geolocalização no CLAUDE.md.

/** Tempo máximo esperando um fix novo antes de cair para a última posição conhecida. */
const TIMEOUT_MS = 10_000

function paraPontoGeo(pos: Location.LocationObject): PontoGeo {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    // accuracy vem null em alguns aparelhos — só grava quando é número de verdade,
    // porque o Firestore rejeita `undefined` mas aceita a chave ausente.
    ...(typeof pos.coords.accuracy === 'number' ? { precisao: pos.coords.accuracy } : {}),
    em: firestore.Timestamp.fromDate(new Date(pos.timestamp)) as unknown as PontoGeo['em'],
  }
}

/**
 * Posição atual do aparelho, ou null se não for possível obter.
 * Nunca lança: qualquer falha (permissão, hardware, timeout) vira null.
 */
export async function capturarGeo(): Promise<PontoGeo | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== Location.PermissionStatus.GRANTED) return null

    // Corrida entre um fix novo e o timeout. Sem isso, um técnico dentro de um
    // galpão sem visada de satélite ficaria com o botão travado esperando.
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ])
    if (fix) return paraPontoGeo(fix)

    // Sem fix novo a tempo: a última posição conhecida ainda localiza a loja
    // com folga suficiente para um pin no mapa.
    const ultima = await Location.getLastKnownPositionAsync()
    return ultima ? paraPontoGeo(ultima) : null
  } catch {
    return null
  }
}
