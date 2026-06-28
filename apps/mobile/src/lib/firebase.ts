// @react-native-firebase é inicializado nativamente — não é necessário initializeApp().
// A inicialização ocorre via:
//   Android: google-services.json   → apps/mobile/google-services.json
//   iOS:     GoogleService-Info.plist → apps/mobile/GoogleService-Info.plist
//
// Persistência offline do Firestore: habilitada por padrão (SQLite local via SDK nativo).

export { default as auth } from '@react-native-firebase/auth'
export { default as firestore } from '@react-native-firebase/firestore'
