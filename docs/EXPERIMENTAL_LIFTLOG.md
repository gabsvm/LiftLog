# LiftLog experimental track

This document describes changes maintained only in the fork's `lab/liftlog-next`.
It is not an official release or an upstream roadmap.

## Branch policy

- `main`: fast-forward synchronization with `LiamMorrow/LiftLog:main`. Never develop on it.
- `contrib/*`: small, independently tested potential upstream contributions based on upstream main.
- `experiment/*`: exploratory changes. Confirm behavior and upstream interest before proposing PRs.
- `lab/liftlog-next`: integration branch for device testing; changes are cherry-picked or merged from reviewed individual branches.

## Currently included

- Decimal input compatibility (#927), with localized parsing tests.
- Deferred numeric editor focus, including cancellation.
- Workout title clipping mitigation (#914; draft PR requires on-device validation).
- Stable focus callbacks in four workout and statistics screens.
- Bounded quick-rep choices with larger touch targets, including a manual input path.
- Responsive statistics grid and improved label legibility.
- Cancelable area-chart rendering after initial layout.
- Removal of unused presentation highlighting and an unused landscape hook.

## Android experimental builds

The experimental app is branded **LiftLog Lab** and uses Android package
`com.gabsvm.liftlog.lab`. It can be installed alongside the official LiftLog,
with separate application data. Historical builds of this fork used the official
package identifier; they are not directly upgradable to the new lab package.
Do not uninstall any existing app before verifying your workout backups.

The upstream release workflow supplies a RevenueCat API key, but the open-source
fork's experimental workflow does not. Lab builds skip optional billing
initialization when the key is missing, allowing settings and workouts to load.
Purchases and premium subscriptions are not configured in these lab builds.

The official upstream `Build Android` workflow runs `./gradlew build`, which triggers
`:react-native-worklets:lintAnalyzeDebug`. On upstream and the fork this currently
fails with a Kotlin UAST/KaModule error unrelated to the experimental UI changes.
**Do not interpret this as a clean Android lint result.**

The fork-only `Experimental Android APK` workflow runs `:app:assembleRelease`
to bundle JavaScript and produce an installable APK without invoking that broken
Lint task. It still requires independent native/device acceptance testing.
Download its `liftlog-lab-android-apk` artifact from Actions once the job succeeds.

**Signing:** the Expo-generated Android project's default signing configuration
must be inspected in each build. Treat experimental artifacts as untrusted test
builds, not as upgrades or production distributions. Back up workout data before
installing. The lab APK has a different package ID and cannot update the official app.

## Device validation checklist

1. Import the exported `ROPE_GTP_32b.liftlogplan` from issue #914; confirm both
   `GTP 32b UK` and `GPT 32b OK` retain their full names in Plan and Workouts.
2. Open, close, and rapidly reopen the weight/reps editor to ensure focus does
   not jump to a dismissed dialog.
3. Test target reps 5, 12, 30, and 1000; quick options must remain responsive.
   Confirm custom reps, zero, and removal still work.
4. Navigate repeatedly between Workout and Stats. Verify updates on focus while
   checking for excessive dispatches and backup attempts.
5. Rotate the device, use large system font scaling, and verify KPI labels do
   not disappear on narrow layouts and tablets.
6. Inspect stats charts for area fill and stale frames during fast navigation.
7. Confirm there are no regressions in saved sessions, exports, or backups.

## Upstream submission standard

Only submit independently reproducible improvements, preferably under ~100
changed lines, after an issue or discussion has been accepted by Liam Morrow.
Follow the upstream AI Usage Policy and document measured outcomes in your own
words. Avoid sending all of `lab/liftlog-next` as one PR.
