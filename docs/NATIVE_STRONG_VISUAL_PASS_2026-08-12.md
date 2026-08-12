# Native Android visual pass - Strong-inspired workout logging

Date: 2026-08-12

This increment focuses on the active workout screen. It keeps the GainsLab
identity while adopting the density and interaction language observed in
Strong.

## Implemented

- Replaced the active-workout Material top app bar with a compact custom header.
- Replaced generic Material buttons in the active workout with compact custom
  action controls.
- Replaced generic `TextField` set cells with dense numeric cells that retain
  the same inline editing behavior.
- Added an explicit `SET / PREV / KG / REPS` row so the table reads quickly.
- Added custom completion boxes with disabled, active and completed states.
- Reduced card padding, border weight and vertical spacing for faster scanning.
- Improved A1/A2 badges, exercise metadata, movement controls and the overflow
  action menu.
- Reworked the rest timer into a compact contextual surface under the source
  exercise.
- Replaced the exercise picker with a custom dialog, search field, filter/sort
  chips and compact selectable rows.
- Kept all existing domain actions: editing sets, previous values, pairing,
  notes, remove, reorder, rest timer, templates and Health Connect.

## Validation

Passed locally:

```text
:shared:jvmTest
:androidApp:assembleDebug
```

The remaining validation is visual on the Redmi. In particular, confirm the
keyboard does not obscure the active numeric cell and that the compact table
fits the device width without clipping.
