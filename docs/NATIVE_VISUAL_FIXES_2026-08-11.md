# Native Android visual fixes - 2026-08-11

This increment keeps the GainsLab visual language while making the native app
an app-general workout tracker.

## Applied

- Progress in an active workout is expressed as completed/planned sets. An
  empty workout displays `No exercises added` instead of mixing exercise and
  set counts.
- Empty workouts have an explicit empty state and a direct action to add the
  first exercise.
- The active workout title is limited to one line with ellipsis so the elapsed
  time and `in progress` status cannot overlap the header.
- Active, history, progress, home and settings lists reserve bottom content
  space so the last item is not hidden behind navigation bars.
- Saving a template presents the folder as a full-width outlined selector;
  `Unfiled` remains the default and existing folders remain selectable.
- Settings uses generic `Import data` wording and no longer advertises an
  IronLog-specific product flow.
- A fresh native database seeds a neutral `Starter strength plan` instead of
  a program-specific Hersovyac/RP plan.
- The empty-session default name is `New workout`, matching the English native
  surface and avoiding mixed-language labels.

## Validation

The following checks passed after the changes:

```text
:shared:jvmTest
:androidApp:assembleDebug
```

The release build also passed and was verified with APK Signature Scheme v2:

- APK: `native/androidApp/build/outputs/apk/release/androidApp-release.apk`
- SHA-256: `75092499F071E1D301153AC8E1A484076FE24690D72AB380D3F9D185018842E1`

The physical-device visual smoke test remains pending until the Redmi is
connected and unlocked. This pilot package remains separate from production
`com.gabsvm.gainslab`.
