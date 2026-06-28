import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const APP_NAME = 'Secondary'

// Reutiliza a instância se já existir (HMR / hot reload)
const secondaryApp =
  getApps().find(a => a.name === APP_NAME) ?? initializeApp(config, APP_NAME)

export const authSecundario = getAuth(secondaryApp)
