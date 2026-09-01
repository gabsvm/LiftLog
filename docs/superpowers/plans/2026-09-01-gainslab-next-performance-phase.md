# GainsLab Next Performance Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure and reduce the next largest workout-runtime performance costs without changing the verified weighted-set architecture.

**Architecture:** Treat `603adc7ab16dffcc266dd7e809212788e3f07f48` as the immutable comparison baseline. Profile first, change one bottleneck at a time, and require before/after evidence on the Moto G24 Power before retaining any optimization. The React Native weighted-set writer, optimistic `recordedExerciseRef` hot path, direct `react-native-paper` `TouchableRipple`, and Kotlin `serializeNulls()` fix are frozen constraints.

**Tech Stack:** React Native / Expo, TypeScript, React Native Paper, Android release builds with R8, ADB, Android frame/memory diagnostics, Vitest, Kotlin/JUnit.

**Spec:** `docs/performance/2026-09-01-post-cleanup-baseline.md`

## Global Constraints

- Branch: `agent/gainslab-performance-polish`.
- Baseline SHA for comparisons: `603adc7ab16dffcc266dd7e809212788e3f07f48`.
- Do not reintroduce the Kotlin weighted-set writer.
- Do not reintroduce RNGH into the critical weighted-set tap.
- Preserve the single `Session` update for weighted-set mutation + Rest Timer.
- Preserve `WorkoutEngine.encodeSnapshot(...).serializeNulls()` and the explicit-null regression test.
- Android performance target: `arm64-v8a` release build with R8 enabled.
- Device target: Moto G24 Power (`fogorow`, ADB `ZT322QTT5X`).
- No optimization is accepted without before/after measurements and regression gates.

---

### Task 1: Establish fresh measurement captures from the verified baseline

**Files:**
- Read: `docs/performance/2026-09-01-post-cleanup-baseline.md`
- Create after measurement: `docs/performance/<date>-workout-profile-baseline.md`
- No production-code changes.

**Interfaces:**
- Consumes: verified baseline APK/commit and physical Moto G24 Power.
- Produces: reproducible measurements for Tasks 2–6.

- [ ] **Step 1: Build the verified baseline release**

Run an ARM64/R8 release build from baseline SHA `603adc7ab16dffcc266dd7e809212788e3f07f48` and record APK SHA-256.

- [ ] **Step 2: Capture cold-start baseline**

Measure repeated cold starts into the Training/workout path using the same procedure for every sample. Record median and tail behavior rather than a single launch.

- [ ] **Step 3: Capture workout frame baseline**

Exercise a representative long workout and record frame/jank data for scrolling, normal weighted taps, rapid taps, dialogs, and Rest Timer presentation.

- [ ] **Step 4: Capture memory baseline**

Record PSS shortly after opening the workout and again after 15–20 minutes of normal interaction. Record total PSS and relevant process breakdown available from Android tooling.

- [ ] **Step 5: Capture interaction-latency observations**

Measure or instrument reps-editor save → visible state, weight-editor save → visible state, and Rest Timer appearance. Avoid speculative optimization before identifying a measurable delay.

- [ ] **Step 6: Save evidence**

Document device, SHA, APK SHA, commands, sample counts, medians/tails, PSS values, and any anomalies in `docs/performance/<date>-workout-profile-baseline.md`.

- [ ] **Step 7: Commit measurement documentation only**

Commit only the measurement document. No production-code modifications in this task.

---

### Task 2: Diagnose workout render churn

**Files:**
- Inspect first: workout presentation/component tree under `app/src/components/presentation/workout/`
- Modify only files proven by profiling to rerender unnecessarily.
- Add focused Vitest/component tests beside the affected module when behavior can regress.

**Interfaces:**
- Consumes: frame/render evidence from Task 1.
- Produces: one isolated render-churn optimization or a documented no-change conclusion.

- [ ] **Step 1: Identify the highest-frequency unnecessary rerender**

Use React/JS profiling or temporary local instrumentation to identify which workout component rerenders during unrelated set updates or scrolling.

- [ ] **Step 2: Write a regression test before production changes**

Create the smallest behavior-level test that would fail if the proposed state/prop boundary were changed incorrectly. Do not test implementation details solely to satisfy coverage.

- [ ] **Step 3: Verify the test fails for the intended reason**

Run the focused test and confirm the expected failure before the implementation change.

- [ ] **Step 4: Implement one minimal render-boundary fix**

Prefer stable props/selectors/memoization only where profiling proves a cost. Do not restructure the weighted-set mutation path.

- [ ] **Step 5: Run focused and full JS gates**

Run typecheck, lint, focused tests, then full Vitest.

- [ ] **Step 6: Re-profile the same scenario on Moto**

Use the identical scenario/sample method from Task 1. Keep the change only if measured frame/jank behavior improves without a meaningful regression elsewhere.

- [ ] **Step 7: Commit independently**

One render-churn optimization per commit.

---

### Task 3: Profile and optimize workout scrolling

**Files:**
- Inspect the concrete list/scroll container used by the active workout screen.
- Modify only the list/rendering files identified by profiling.

**Interfaces:**
- Consumes: baseline scroll jank and render data.
- Produces: measured scroll improvement or documented rejection.

- [ ] **Step 1: Reproduce the worst scroll scenario**

Use a long workout with enough exercises/sets to trigger the baseline issue consistently.

- [ ] **Step 2: Determine whether cost is JS rerender, layout, drawing, or list virtualization**

Do not choose FlatList/FlashList/memoization changes by assumption. Identify the dominant layer first.

- [ ] **Step 3: Add a regression test for any state/identity change required by the proposed fix**

Verify RED before modifying production behavior.

- [ ] **Step 4: Implement exactly one scrolling optimization**

Keep layout and workout semantics identical unless the measurement explicitly requires a visual change.

- [ ] **Step 5: Run full JS gates and release build**

Typecheck, lint, Vitest, then ARM64/R8 release build.

- [ ] **Step 6: A/B on Moto against Task 1 baseline**

Compare jank and frame percentiles using the same scroll sequence. Reject the optimization if gains are noise-level or tails worsen materially.

---

### Task 4: Profile reps/weight dialogs and commit latency

**Files:**
- Inspect reps and weight editor components plus their immediate update path.
- Do not modify `weighted-exercise.tsx` hot-path semantics unless profiling proves that file is the bottleneck and the baseline invariants remain intact.

**Interfaces:**
- Consumes: interaction-latency evidence from Task 1.
- Produces: isolated dialog/commit optimization with regression coverage.

- [ ] **Step 1: Measure open, save, close, and immediate-tap sequences separately**

Identify whether delay comes from modal rendering, state propagation, persistence, or follow-up render work.

- [ ] **Step 2: Write a failing regression test for the chosen optimization boundary**

Preserve immediate edit → tap correctness for both reps and weight.

- [ ] **Step 3: Apply one minimal optimization**

Do not batch unrelated dialog changes.

- [ ] **Step 4: Run typecheck, lint, full Vitest, Kotlin tests if bridge semantics are touched, and ARM64/R8 build**

Any bridge change additionally requires the explicit-null regression.

- [ ] **Step 5: Physical smoke the immediate edit → tap paths**

Confirm edited values survive immediate weighted-set interaction and lifecycle transitions.

---

### Task 5: Profile Rest Timer visual/update cost

**Files:**
- Inspect the Rest Timer presentation/state consumers.
- Preserve the baseline rule that weighted-set mutation + timer reset occurs in one `Session` update.

**Interfaces:**
- Consumes: Rest Timer frame/render evidence.
- Produces: visual/update optimization without changing timer semantics.

- [ ] **Step 1: Measure timer appearance and ticking cost**

Separate one-time appearance cost from recurring timer-tick rerenders.

- [ ] **Step 2: Identify whether unrelated workout subtree rerenders on each tick**

Prove the affected subtree before changing component boundaries.

- [ ] **Step 3: Add regression coverage for timer behavior**

Ensure set completion, second set during an active timer, background/return, and lockscreen/return semantics remain unchanged.

- [ ] **Step 4: Implement one isolated timer-render optimization**

Do not change timer duration or session semantics.

- [ ] **Step 5: A/B on Moto and retain only a measured improvement**

Compare frame/jank and interaction behavior against the Task 1 baseline.

---

### Task 6: Investigate 15–20 minute PSS growth

**Files:**
- No code changes until memory-growth ownership is identified.
- Modify only the component/service proven to retain memory unnecessarily.

**Interfaces:**
- Consumes: early and 15–20 minute PSS captures.
- Produces: memory-retention diagnosis and, only if justified, one targeted fix.

- [ ] **Step 1: Repeat the same workout interaction loop for 15–20 minutes**

Collect multiple PSS snapshots at fixed intervals.

- [ ] **Step 2: Distinguish stable cache growth from unbounded retention**

Do not call normal warm-up/cache growth a leak without repeated evidence.

- [ ] **Step 3: Identify retained owner before editing code**

Use available Android/JS memory tooling to narrow ownership to images, JS objects, native views, bridge snapshots, dialogs, or other concrete resources.

- [ ] **Step 4: If a real retention bug is proven, write a regression/reproduction first**

Use the smallest reliable automated or scripted reproduction possible.

- [ ] **Step 5: Implement one targeted release/fix and re-run the full 15–20 minute scenario**

Accept only if the growth curve materially improves and runtime behavior remains correct.

---

### Task 7: Re-measure cold startup last

**Files:**
- Inspect startup/navigation/bootstrap code only after Tasks 2–6 establish whether workout-focused changes already affect launch.

**Interfaces:**
- Consumes: Task 1 cold-start baseline and the final candidate branch state.
- Produces: final cold-start comparison and, only if needed, a separately justified optimization.

- [ ] **Step 1: Repeat baseline cold-start methodology on the current candidate**

Use the same number of samples and launch target.

- [ ] **Step 2: Identify startup phase before optimizing**

Separate native process startup, JS bundle/bootstrap, persistence/session restore, navigation, and first meaningful render.

- [ ] **Step 3: Only if a dominant startup cost remains, create a dedicated follow-up task**

Do not bundle startup refactoring into prior workout-runtime changes.

---

## Final acceptance gate for any new performance baseline

Before replacing `603adc7ab16dffcc266dd7e809212788e3f07f48` as the official baseline:

- TypeScript: PASS.
- Lint: PASS.
- Full Vitest: PASS.
- Kotlin tests: PASS when native worker/bridge code is touched.
- Explicit-null regression: PASS.
- ARM64/R8 release: PASS.
- Physical Moto G24 Power smoke: PASS.
- No crash/ANR/session corruption.
- No `invalid_snapshot` or crypto regression.
- Before/after performance evidence shows a meaningful improvement in the metric targeted by the change.
- Document the new baseline SHA and measurements before beginning the next optimization.
