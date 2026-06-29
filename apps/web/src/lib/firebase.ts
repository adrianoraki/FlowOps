import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// DIAGNÓSTICO TEMPORÁRIO — remover após confirmar em produção
console.info(
  '[FlowOps] Firebase env →',
  'API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? 'definida ✓' : '⚠ VAZIA',
  '| PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'definida ✓' : '⚠ VAZIA',
  '| AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? 'definida ✓' : '⚠ VAZIA',
)

export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

export const storage = getStorage(app)

if (firebaseConfig.measurementId) {
  try {
    import('firebase/analytics').then(({ getAnalytics, isSupported }) => {
      isSupported().then(ok => { if (ok) getAnalytics(app) })
    })
  } catch {
    // analytics indisponível no ambiente — ignorar
  }
}
