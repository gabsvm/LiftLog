# LiftLog native migration

Este árbol contiene la migración incremental hacia Kotlin Multiplatform para
el dominio y Jetpack Compose + Material 3 para Android. iOS queda fuera de
alcance por ahora; no se crea `iosApp` hasta disponer de macOS/Xcode.

## Estado

`androidApp` ya incluye sesiones, sets, biblioteca, rutinas, estadísticas,
temporizador foreground, backups JSON, migración read-only desde la base Expo
legacy y sincronización Supabase configurable por build. La APK candidata usa
el package productivo `com.gabsvm.gainslab` y la firma documentada en
`docs/APK_RELEASE_CONTRACT.md`.

## Estructura

```text
shared/
  src/commonMain/    dominio, estadísticas y contrato de backup
  src/commonTest/    tests JVM del núcleo
androidApp/
  src/main/           Activity, Compose, SQLite y adaptadores Android
```

El conversor Expo vive en:

```text
app/src/services/native-workout-export.ts
```

## Build Android

```powershell
$env:ANDROID_HOME = "<ruta-local-del-Android-SDK>"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
app\android\gradlew.bat --project-dir native :shared:jvmTest :androidApp:assembleDebug --offline --console=plain
```

Para un release reemplazable de la app existente:

```powershell
app\android\gradlew.bat --project-dir native :shared:jvmTest :androidApp:assembleRelease `
  "-PnativeApplicationId=com.gabsvm.gainslab" `
  "-PnativeVersionName=1.2.0-native-migration" `
  "-PnativeVersionCode=7" --console=plain
```

La sincronización remota se habilita al compilar con:

```powershell
$env:LIFTLOG_SUPABASE_URL = "https://..."
$env:LIFTLOG_SUPABASE_ANON_KEY = "..."
```

La validación de backup Expo real sigue siendo opt-in:

```powershell
Push-Location app
$env:LIFTLOG_RUN_REAL_BACKUP = '1'
npx.cmd vitest run src/services/native-workout-export.spec.ts --testTimeout=15000
Pop-Location
```
