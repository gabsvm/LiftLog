# Compilar la APK release reemplazable de GainsLab/LiftLog en Windows

La referencia obligatoria de package, firma, versionado y actualización está en
[`docs/APK_RELEASE_CONTRACT.md`](../../docs/APK_RELEASE_CONTRACT.md). Toda APK
que deba reemplazar la instalada debe conservar `com.gabsvm.gainslab`, la misma
firma y un `versionCode` superior; se instala con `adb install -r`.

Este es el procedimiento validado para este checkout:

`C:\Users\Gabriel Sanchez\Documents\Dev\LiftLog\app`

La aplicación usa Expo con React Native 0.85. La compilación debe hacerse como release, con Nueva Arquitectura explícita y únicamente para `arm64-v8a` cuando el destino sea un teléfono Android moderno.

## 1. Comprobaciones previas

Abrir PowerShell en la raíz de `app` y comprobar:

```powershell
node -v
java -version
Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
npm run typecheck
npm run lint
npm test -- --run
git diff --check
```

No borrar ni resetear cambios locales existentes. La APK se puede compilar con el árbol sucio, pero hay que revisar que ningún cambio ajeno quede accidentalmente descartado.

## 2. Workaround CMake/Ninja de Windows

En este proyecto `react-native-quick-crypto` puede dejar `build.ninja` regenerándose indefinidamente (`manifest 'build.ninja' still dirty after 100 tries`). Antes de compilar, comprobar que estos tres archivos contienen `set(CMAKE_SUPPRESS_REGENERATION TRUE)` cerca del inicio:

```text
node_modules/react-native-quick-crypto/android/CMakeLists.txt
node_modules/react-native-reanimated/android/CMakeLists.txt
node_modules/react-native-worklets/android/CMakeLists.txt
```

Si `npm install` reemplazó esos archivos, volver a insertar la línea después de `cmake_minimum_required(...)` o `project(...)`. Son archivos generados de `node_modules`, no cambios de producto, y pueden necesitar reaplicarse tras reinstalar dependencias.

Mover los directorios CMake generados a una carpeta temporal recuperable antes de reintentar:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidence = Join-Path $env:TEMP "gainslab-native-build-$stamp"
New-Item -ItemType Directory -Path $evidence | Out-Null

$root = (Resolve-Path .).Path
$targets = @(
  'android\app\.cxx',
  'node_modules\react-native-quick-crypto\android\.cxx',
  'node_modules\react-native-reanimated\android\.cxx',
  'node_modules\react-native-worklets\android\.cxx'
)

foreach ($relative in $targets) {
  $source = Join-Path $root $relative
  if (Test-Path -LiteralPath $source) {
    $resolved = (Resolve-Path -LiteralPath $source).Path
    if (-not $resolved.StartsWith($root + [IO.Path]::DirectorySeparatorChar)) {
      throw "Target fuera del checkout: $resolved"
    }
    $name = $relative -replace '[\\/]', '_'
    Move-Item -LiteralPath $resolved -Destination (Join-Path $evidence $name)
  }
}
```

La ruta real tiene espacios. Para evitar que CMake/Ninja vuelva a fallar por rutas largas, usar temporalmente una unidad corta:

```powershell
subst L: "C:\Users\Gabriel Sanchez\Documents\Dev\LiftLog"
```

## 3. Comando de release validado

Incrementar `BUILD_NUMBER` en cada APK instalable. Mantener `DISPLAY_VERSION` igual a la versión visible de `app.json` salvo que se quiera cambiar la versión de producto.

```powershell
Push-Location L:\app\android
$env:NODE_ENV = 'production'
.\gradlew.bat assembleRelease `
  "-PnewArchEnabled=true" `
  "-PreactNativeArchitectures=arm64-v8a" `
  "-PDISPLAY_VERSION=1.1.3" `
  "-PBUILD_NUMBER=6" `
  --no-daemon --console=plain
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { exit $code }
```

No usar solamente `npm run build:android:release` en PowerShell: el script usa `./android/gradlew`, sintaxis Unix, y puede fallar antes de iniciar Gradle. Si no se usa `L:`, ejecutar el mismo comando desde `app\android` usando `.\gradlew.bat`.

## 4. Artefacto y huella

La APK queda en:

```text
android\app\build\outputs\apk\release\app-release.apk
```

Comprobar tamaño y SHA-256:

```powershell
$apk = (Resolve-Path 'android\app\build\outputs\apk\release\app-release.apk').Path
Get-Item -LiteralPath $apk | Select-Object FullName, Length, LastWriteTime
Get-FileHash -Algorithm SHA256 -LiteralPath $apk
```

## 5. Instalación y smoke test ADB

`adb install -r` conserva los datos locales del teléfono:

```powershell
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $adb devices -l
& $adb install -r $apk
& $adb shell dumpsys package com.gabsvm.gainslab | Select-String 'versionCode|versionName'

& $adb logcat -c
& $adb shell am force-stop com.gabsvm.gainslab
& $adb shell am start -W -n com.gabsvm.gainslab/.MainActivity
Start-Sleep -Seconds 6
& $adb logcat -d -v brief | Select-String 'FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|Unable to start activity|SIGABRT'
```

El último comando no debe mostrar errores fatales. También comprobar visualmente que aparezcan GainsLab, la pantalla de entrenamiento y la barra inferior.

Para esta integración de Supabase, el log esperado después del arranque, cuando existe una sesión autenticada, es:

```text
Remote backup completed successfully<hash>
```

## 6. Problemas conocidos

- `RNCViewPagerManagerDelegate` o `RNCViewPagerManagerInterface` sin resolver: falta `-PnewArchEnabled=true`.
- `manifest 'build.ninja' still dirty after 100 tries`: reaplicar el workaround CMake, mover los `.cxx` y compilar desde `L:`.
- La compilación universal tarda demasiado: usar `-PreactNativeArchitectures=arm64-v8a` para un teléfono físico.
- El script npm falla con `'.' is not recognized`: usar directamente `.\gradlew.bat` desde `app\android`.
- Un build `release` local no implica firma Play Store. Verificar el certificado con `apksigner` antes de publicar; si aparece `CN=Android Debug`, es una APK de instalación/pruebas.

Al terminar, se puede quitar la unidad temporal con:

```powershell
subst L: /d
```
