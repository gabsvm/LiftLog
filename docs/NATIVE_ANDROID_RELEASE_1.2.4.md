# Native Android release 1.2.4

Release date: 2026-08-12

## Update contract

- Package: `com.gabsvm.gainslab`
- Version name: `1.2.4-native-localization`
- Version code: `11`
- Signing alias: `androiddebugkey`
- Signing certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
- Keystore used for this internal distribution: `app/android/app/debug.keystore`
- APK SHA-256: `029498ba6e09d1b9b66a4e6bb9b1ccd52ccf2005be39151fda88d99eb6b2af59`

The package and signing certificate intentionally remain unchanged so this APK
can update the existing internal installation with `adb install -r` without
uninstalling the app or deleting local data.

## Artifact

- GitHub prerelease tag: `native-android-pilot-1.2.4-localization-prerelease.20260812`
- Asset: `GainsLab-1.2.4-native-localization.apk`

## Build command

```powershell
$env:ANDROID_HOME = 'C:\Users\Gabriel Sanchez\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
./app/android/gradlew.bat --project-dir native :androidApp:assembleRelease `
  -PnativeApplicationId=com.gabsvm.gainslab `
  -PnativeVersionCode=11 `
  -PnativeVersionName=1.2.4-native-localization `
  -PnativeStorePassword=android `
  -PnativeKeyAlias=androiddebugkey `
  -PnativeKeyPassword=android
```

## Install/update

```powershell
adb install -r GainsLab-1.2.4-native-localization.apk
```
