package expo.modules.workoutworker.engine

/**
 * Preview input must use the exact same versioned contract as the engine.
 * Keeping a second JSONObject parser here previously dropped timestamps/cardio
 * fields and made the preview disagree with production parity tests.
 */
internal object WorkoutPreviewSnapshotParser {
    fun parse(json: String): WorkoutEngineSnapshot = WorkoutEngine.decodeSnapshot(json)
}
