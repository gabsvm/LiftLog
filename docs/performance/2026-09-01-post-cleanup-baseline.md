# GainsLab Post-Cleanup Performance Baseline — 2026-09-01

## Status

**POST-CLEANUP BASELINE VERIFIED**

Official baseline commit:

`603adc7ab16dffcc266dd7e809212788e3f07f48`

Branch:

`agent/gainslab-performance-polish`

## Runtime architecture frozen at this baseline

- Weighted-set writer: React Native.
- Kotlin weighted-set writer experiment: retired from the product hot path.
- Weighted taps calculate from `recordedExerciseRef.current` to avoid stale-prop overwrites during rapid interaction.
- Weighted set mutation uses `withCycledRepCount(...)` and commits through `commitExerciseUpdate(...)`.
- Completing/uncompleting a weighted set and updating Rest Timer remain a single `Session` update.
- Critical weighted-set tap uses `TouchableRipple` directly from `react-native-paper`; RNGH is not in that critical tap path.
- `WorkoutEngine.encodeSnapshot(...)` retains Moshi `.serializeNulls()` and its explicit-null regression test.

## Verification gates

| Gate | Result |
| --- | --- |
| npm ci | PASS |
| TypeScript typecheck | PASS |
| ESLint | PASS |
| Vitest | 31/31 files, 456/456 tests PASS |
| Kotlin tests | 18/18 PASS |
| Explicit-null regression | PASS |
| Kotlin writer product routing | Absent |
| Android release | PASS |
| R8/minification | Enabled |
| ABI | arm64-v8a only |
| Package | com.gabsvm.gainslab |
| versionName | 1.1.10 |
| versionCode | 13 |

Verified release artifact from the final local gate:

- Path: `app/android/app/build/outputs/apk/release/app-release.apk`
- Size: `72,184,789` bytes
- SHA-256: `4E09F43256B3346B03EBCD5247736C1CF6C475A9CF48A2B1561B9F35989E3070`

## Moto G24 Power physical verification

Device:

- Model: `moto g24 power`
- Codename: `fogorow`
- ADB serial: `ZT322QTT5X`

Final physical smoke result:

**MOTO G24 POWER PHYSICAL SMOKE PASS**

Verified behaviors:

- Cold startup → Training.
- Open workout `Upper 2`.
- Normal weighted tap.
- Rapid weighted taps.
- Out-of-order taps.
- Supersets.
- Reps editor followed by interaction.
- Weight editor followed by interaction.
- Rest Timer.
- Second set while Rest Timer is active.
- Background → return.
- Lockscreen → unlock → return.
- Workout data preserved.

Observed during the final smoke:

- Crash: none.
- ANR: none.
- `invalid_snapshot`: none.
- `Property 'crypto' doesn't exist`: none.
- Evidence of native Kotlin weighted writer routing: none.
- Unexpected navigation: none.
- Session corruption: none.

## CI note

GitHub `UI Unit Tests` passed on the verified baseline. The prior Android GitHub Actions failure was an infrastructure/configuration issue: the workflow invoked an unrestricted `assembleRelease`, causing the hosted runner to compile multiple ABIs and run out of JVM heap. The product baseline itself was verified with the intended `arm64-v8a` release build.

The Android CI workflow should therefore stay aligned with the product target and explicitly build `arm64-v8a` only.

## Baseline rule

All subsequent workout-performance work must compare against commit `603adc7ab16dffcc266dd7e809212788e3f07f48` unless a newer baseline is explicitly verified and documented.

Do not reopen the Kotlin weighted-set writer experiment without new measured evidence that justifies an architecture change.
