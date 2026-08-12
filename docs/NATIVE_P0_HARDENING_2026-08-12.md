# Native Android P0 hardening

## Implemented

- Legacy Expo migration uses a versioned marker (`2`) instead of relying on an empty session list.
- Session, folder, routine and exercise writes share the SQLite transaction boundary.
- Invalid legacy rows are counted. The migration remains pending when any source row is skipped.
- A compact migration report is stored in `SharedPreferences` and written to Logcat.
- Migration validates that imported session ids can be read back before marking success.
- Manual and cloud exports read the complete repositories, independently of the 500-session UI limit.
- Health Connect declares `WRITE_EXERCISE` and `WRITE_WEIGHT` in the native manifest.
- Native CI runs shared JVM tests, Android unit-test task, lint and debug assembly whenever `native/**` changes.
- Quick set completion now rejects incomplete sets and uses one completion path.
- Session writes are debounced by 300 ms while editing numeric cells.

## Validation

```powershell
$env:ANDROID_HOME = "<local Android SDK>"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
app\android\gradlew.bat --project-dir native `
  :shared:jvmTest `
  :androidApp:testDebugUnitTest `
  :androidApp:lintDebug `
  :androidApp:assembleDebug `
  --console=plain
```

The build is expected to warn that iOS Kotlin/Native targets are disabled on Windows. That does not affect the Android validation.

## Still pending

- Physical Redmi validation of Health Connect permission flow and keyboard behavior.
- Navigation Compose destination stack.
- Native string resources, icons and accessibility semantics.
- Auth refresh lifecycle and a separate entity-level cloud sync contract.
