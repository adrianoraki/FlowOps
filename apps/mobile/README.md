# FlowOps Mobile

App para técnicos de campo — Expo (managed) + TypeScript + @react-native-firebase.

---

## Arquivos de configuração Firebase (OBRIGATÓRIOS, não commitados)

Baixe do [Firebase Console](https://console.firebase.google.com) → Configurações do projeto:

| Plataforma | Arquivo             | Destino no projeto                     |
|---|---|---|
| Android    | `google-services.json`       | `apps/mobile/google-services.json`     |
| iOS        | `GoogleService-Info.plist`   | `apps/mobile/GoogleService-Info.plist` |

> **Esses arquivos estão no `.gitignore` — nunca commite credenciais.**

---

## Como rodar (development build)

```bash
# 1. Instale dependências (da raiz do monorepo)
cd /caminho/para/FlowOps
npm install

# 2. Entre na pasta do app
cd apps/mobile

# 3. Gere o código nativo (Android Studio + SDK necessários)
npx expo prebuild --platform android

# 4. Rode no dispositivo/emulador Android
npx expo run:android
```

> **Por que development build?** O `@react-native-firebase` usa módulos nativos que não funcionam no Expo Go — é necessário gerar o APK de desenvolvimento com `expo prebuild` + `expo run:android`.

---

## Requisitos

- Node 18+
- Android Studio + Android SDK (para Android)
- Xcode 15+ (para iOS, apenas macOS)
- JDK 17 (para Android)
