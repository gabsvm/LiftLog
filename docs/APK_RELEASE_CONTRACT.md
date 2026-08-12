# Contrato de identidad de la APK Android

Estado: referencia verificada el 2026-08-11.

Este documento fija la identidad que debe conservar cualquier APK que se
publique para actualizar la instalación Android existente. No sustituye una
firma de Play Store: la versión actual es una distribución interna por
GitHub Release firmada con el certificado debug histórico del proyecto.

## Identidad que no se puede cambiar sin una migración explícita

| Campo | Valor de referencia |
|---|---|
| Nombre visible actual | `LiftLog` en la variante nativa; `GainsLab` en la referencia Expo |
| Producto futuro | LiftLog, tracker general de entrenamientos |
| Android applicationId | `com.gabsvm.gainslab` |
| Android namespace | `com.gabsvm.gainslab` |
| Scheme | `gainslab` |
| Variante | `release` |
| Arquitectura publicada | `arm64-v8a` |
| Última APK instalada | `GainsLab-1.1.3-arm64-v8a.apk` |
| versionName | `1.1.3` |
| versionCode | `6` |
| Firma | Android Debug, RSA 2048, APK Signature Scheme v2 |
| Certificado SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Keystore local | `app/android/app/debug.keystore` |
| Alias | `androiddebugkey` |

La identidad fue comprobada contra `app-release.apk` con `output-metadata.json`
y `apksigner`. La última APK instalada por ADB tiene SHA-256 de archivo:

```text
C09164212DBD8D98A89A41430F5C3D7654EE9B08B30750A6377C3612FB1099A5
```

El hash del archivo cambia en cada build. El hash que permite actualizar la
instalación es el del certificado, no el del archivo APK.

## Reglas para una actualización por ADB

Una APK futura debe cumplir todas estas condiciones:

1. Ser una APK de producción de la app Expo/React Native; el piloto nativo
   `com.gabsvm.liftlog.nativeapp` nunca se instala encima de esta app.
2. Mantener exactamente `com.gabsvm.gainslab` como `applicationId`.
3. Usar el mismo certificado SHA-256 de referencia.
4. Tener un `versionCode` estrictamente mayor que `6` y que el último release
   instalado.
5. Mantener `versionName` coherente con la versión publicada.
6. Ser una variante `release`, no `debug`.
7. Incluir el bundle JavaScript y los assets de Metro dentro de la APK; no
   depender de Metro, Expo Go ni de un servidor local.
8. Construirse para `arm64-v8a` cuando el destino sea el teléfono Android
   utilizado para las pruebas.
9. Pasar la verificación de firma, package, versión y hash antes de instalarla.
10. Instalarse siempre con `adb install -r`, conservando los datos de la
   aplicación.
11. Arrancar correctamente y no producir `FATAL EXCEPTION` en logcat.

Si cambia el package o el certificado, Android no la considera una
actualización: habrá que desinstalar manualmente o distribuir una aplicación
distinta, con posible pérdida de datos. No se debe hacer eso como parte de la
migración incremental.

## Comando de build de referencia

Desde `app/android`, preferir la ruta corta `L:` en Windows cuando CMake/Ninja
falle por la longitud del checkout:

```powershell
$env:NODE_ENV = 'production'
.\gradlew.bat assembleRelease `
  "-PnewArchEnabled=true" `
  "-PreactNativeArchitectures=arm64-v8a" `
  "-PDISPLAY_VERSION=1.1.3" `
  "-PBUILD_NUMBER=6" `
  --no-daemon --console=plain
```

Artefacto esperado:

```text
app/android/app/build/outputs/apk/release/app-release.apk
```

Para la siguiente APK reemplazable se debe usar como mínimo
`DISPLAY_VERSION=1.1.4` y `BUILD_NUMBER=7`, o valores superiores si ya existe
otra instalación. Nunca reutilizar un `versionCode` ya publicado.

En PowerShell las propiedades `-P...` deben ir entre comillas; de lo contrario
Gradle puede interpretar una parte de la versión como el nombre de una tarea.

## Checklist obligatorio antes de publicar

```powershell
$apk = (Resolve-Path 'app-release.apk').Path
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$apksigner = Get-ChildItem "$sdk\build-tools" -Filter apksigner.bat -Recurse |
  Sort-Object FullName -Descending | Select-Object -First 1

& $apksigner.FullName verify --verbose --print-certs $apk
Get-FileHash -Algorithm SHA256 -LiteralPath $apk

$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $adb devices -l
& $adb install -r $apk
& $adb shell dumpsys package com.gabsvm.gainslab |
  Select-String 'versionCode|versionName'
```

La salida debe confirmar:

- `Verifies` para la firma APK;
- un único firmante con el SHA-256 documentado;
- `com.gabsvm.gainslab`;
- un `versionCode` mayor al anterior;
- instalación mediante `adb install -r` sin desinstalar la app.

Después de instalar, abrir la app y comprobar al menos arranque, sesión activa,
datos locales, navegación principal y ausencia de `FATAL EXCEPTION` en logcat.

## GitHub Release de referencia

- Tag: `v1.1.2-gainslab-sync-import.20260811`
- Asset: `GainsLab-1.1.2-arm64-v8a.apk`
- URL: <https://github.com/gabsvm/LiftLog/releases/download/v1.1.2-gainslab-sync-import.20260811/GainsLab-1.1.2-arm64-v8a.apk>

La APK `1.1.3 (6)` fue construida e instalada localmente por ADB el
2026-08-11 sobre el Redmi Note 10 (`serial 96165d8a`). Android reportó
`versionCode=6`, `versionName=1.1.3`, el mismo package y el proceso arrancó sin
`FATAL EXCEPTION` en el smoke test. No se publicó una nueva GitHub Release en
esta operación.

El tag apunta al commit publicado de referencia. Si el APK se construye con
cambios locales todavía no committeados, debe indicarse expresamente y no debe
presentarse el tag como reproducción exacta del árbol local.

## Relación con la migración nativa

El piloto Compose/KMP utiliza deliberadamente otro package:
`com.gabsvm.liftlog.nativeapp`. No debe subirse como actualización de
`com.gabsvm.gainslab` ni instalarse encima de la APK de producción hasta que
exista una decisión específica sobre package, firma, migración de datos y
paridad funcional.

La migración mantendrá la identidad de producción hasta completar una ruta de
datos segura y una versión nativa con paridad suficiente.
## Anexo vigente — APK nativa candidata 1.2.0

La migración Android ya autorizó una candidata nativa bajo la misma identidad
de producción. Esta variante concreta usa:

- applicationId: `com.gabsvm.gainslab`;
- namespace de código nativo: `com.gabsvm.liftlog.nativeapp`;
- versionName: `1.2.0-native-migration`;
- versionCode: `7`;
- launcher: `com.gabsvm.liftlog.nativeapp.MainActivity`;
- APK: `native/androidApp/build/outputs/apk/release/androidApp-release.apk`;
- certificado SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`;
- hash de archivo verificado: `27835CC76EBCBB8E51D58B2877BC0644A79415A0251D33E2526D30A86EB02FF3`;
- instalación verificada con `adb install -r` en `96165d8a`.

La variante nativa no borra `db.db`: en el primer arranque lee las tablas
legacy de Expo en modo read-only y persiste el resultado en
`liftlog_native_pilot.db`. No se debe ejecutar `pm clear`, desinstalar ni
reemplazar el keystore durante una actualización.

## Corrección vigente: no reemplazar producción durante la paridad visual

El anexo anterior documenta una candidata técnica, no una APK aprobada para
reemplazar la instalación diaria. La APK de producción quedó restaurada en el
Redmi como `com.gabsvm.gainslab` `1.1.3` (`versionCode=6`).

La próxima APK nativa solamente podrá usar `adb install -r` sobre producción
cuando conserve la identidad GainsLab y haya pasado la comparación visual y
funcional pantalla por pantalla. Hasta entonces se probará con un package
temporal o sin instalarla sobre el teléfono de uso.
