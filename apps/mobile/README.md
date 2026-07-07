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

> **Novo módulo nativo (`expo-print` + `expo-sharing`, para o PDF da OS):** após dar `npm install`, é preciso **rebuild** (`npx expo prebuild --platform android` + `npx expo run:android`, ou gerar um novo APK/AAB de release) — só recarregar o Metro/JS não basta, pois são módulos nativos novos que precisam ser linkados.

---

## Build de release (Android)

Keystore de release em `apps/mobile/keystore/` (nunca commitada — está no `.gitignore`). `android/app/build.gradle` assina o build `release` com ela automaticamente se `keystore/release.keystore.properties` existir; caso contrário cai no `debug.keystore`.

```bash
cd apps/mobile/android
./gradlew bundleRelease     # gera .aab (Play Store)
# ou: ./gradlew assembleRelease   # gera .apk
```

> **Por que não precisa mais setar `EXPO_NO_METRO_WORKSPACE_ROOT` manualmente?** No monorepo, o Gradle plugin do React Native invoca `expo export:embed` com `--entry-file` como caminho relativo a `apps/mobile`, mas o modo padrão de monorepo do Expo (`EXPO_USE_METRO_WORKSPACE_ROOT`, ativado por padrão) resolve esse caminho relativo à raiz do repo — causando `Unable to resolve module .../expo-router/entry.js`. O `metro.config.js` já configura `watchFolders`/`nodeModulesPaths` manualmente para o monorepo, então essa detecção automática do Expo é redundante e conflita. A flag `EXPO_NO_METRO_WORKSPACE_ROOT=1` desativa isso — e está em `apps/mobile/.env` (commitado, não é segredo), carregado automaticamente pelo Expo CLI em qualquer comando rodado a partir de `apps/mobile` (`expo run:android`, `expo start`, e o `expo export:embed` disparado pelo Gradle). Não precisa exportar a variável na mão.

Saída: `android/app/build/outputs/bundle/release/app-release.aab` (ou `apk/release/app-release.apk`).

---

## Requisitos

- Node 18+
- Android Studio + Android SDK (para Android)
- Xcode 15+ (para iOS, apenas macOS)
- JDK 17 (para Android)
