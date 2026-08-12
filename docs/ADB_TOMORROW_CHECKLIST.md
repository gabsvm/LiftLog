# ADB checklist for the next Redmi session

This checklist is for the isolated native pilot only. It must not replace the
production Expo package during visual testing.

## Packages

- Production: `com.gabsvm.gainslab`
- Native pilot: `com.gabsvm.liftlog.nativeapp`
- Expected device serial: `96165d8a`
- Debug APK:
  `native/androidApp/build/outputs/apk/debug/androidApp-debug.apk`

## Install and launch

```powershell
$env:ANDROID_HOME = 'C:\Users\Gabriel Sanchez\AppData\Local\Android\Sdk'
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
$apk = 'C:\Users\Gabriel Sanchez\Documents\Dev\LiftLog\native\androidApp\build\outputs\apk\debug\androidApp-debug.apk'
& $adb devices
& $adb -s 96165d8a install -r $apk
& $adb -s 96165d8a shell monkey -p com.gabsvm.liftlog.nativeapp 1
```

## Active workout smoke

1. Start an empty workout.
2. Add a weight/reps exercise.
3. Confirm that `Previous`, `KG/LB`, `REPS` and the checkbox are visible.
4. Confirm that an empty set cannot be checked.
5. Enter weight and reps inline; confirm the draft remains after scrolling.
6. Check the set; confirm the contextual rest timer appears below that exercise.
7. Open `More` and test pairing, notes and remove exercise.
8. Add a second exercise and create an A1/A2 pair.
9. Open a set editor and test type, kg/lb, RIR, RPE and notes.
10. Finish the workout and verify the summary values.
11. Create a workout with no exercises; confirm `No exercises added` is shown
    and `Add your first exercise` opens the picker.
12. Confirm progress reads `completed/planned sets` and never combines an
    exercise count with a set percentage.
13. Save a template; open the full-width folder selector and test `Unfiled`
    plus a custom folder.
14. Create a long workout name and confirm the header keeps the elapsed status
    visible without overlapping.

## Recovery and visual checks

- Press Home and return to the native pilot while the workout is active.
- Rotate if the device allows it and confirm the draft is not lost.
- Kill and relaunch the native pilot; confirm the active session remains in the
  home screen and can be resumed.
- Capture the workout screen at 100% scale for comparison with
  `docs/strong-reference/10-workout-with-exercise.png`.
- Check keyboard focus, horizontal clipping, card density and scroll behavior.
- Scroll to the bottom of More/Settings and confirm the final support row is
  fully visible above the navigation bar.

## Restore production after testing

```powershell
& $adb -s 96165d8a shell monkey -p com.gabsvm.gainslab 1
```

The native pilot is not yet a production update. A production replacement still
requires the original package name, release signing key, higher version code,
and an accepted data migration test.
