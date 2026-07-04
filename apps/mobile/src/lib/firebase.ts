// @react-native-firebase é inicializado nativamente — não é necessário initializeApp().
// A inicialização ocorre via:
//   Android: google-services.json   → apps/mobile/google-services.json
//   iOS:     GoogleService-Info.plist → apps/mobile/GoogleService-Info.plist
//
// Persistência offline do Firestore: habilitada por padrão (SQLite local via SDK nativo) —
// nenhuma configuração adicional é necessária ou deve ser feita aqui. Como consequência:
//   - .get()/.onSnapshot() servem dados do cache local quando offline.
//   - .set()/.update() resolvem contra o cache IMEDIATAMENTE (nunca travam esperando rede)
//     e o SDK sincroniza sozinho com o servidor quando a conexão volta.
//   - Não escrever lógica de sincronização manual (fila, retry, etc.) — o SDK já garante isso.

export { default as auth } from '@react-native-firebase/auth'
export { default as firestore } from '@react-native-firebase/firestore'
