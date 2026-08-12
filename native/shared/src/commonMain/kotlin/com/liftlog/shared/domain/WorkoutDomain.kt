package com.liftlog.shared.domain

/** The kinds of tracking supported by a general-purpose workout tracker. */
enum class ExerciseType {
    WEIGHT_REPS,
    BODYWEIGHT_REPS,
    ASSISTED_BODYWEIGHT_REPS,
    DURATION,
    DISTANCE,
    CARDIO,
    MIXED,
}

enum class SetType {
    NORMAL,
    WARMUP,
    DROP_SET,
    TOP_SET,
    BACKOFF,
    FAILURE,
    AMRAP,
}

enum class WeightUnit {
    KILOGRAMS,
    POUNDS,
}

enum class ProgressionMode {
    NONE,
    INCREASE_ALL,
    INCREASE_LOWEST,
}

data class ProgressionRule(
    val mode: ProgressionMode,
    val increment: Double,
    val unit: WeightUnit = WeightUnit.KILOGRAMS,
) {
    init {
        require(increment > 0.0) { "Progression increment must be positive" }
        require(increment.isFinite()) { "Progression increment must be finite" }
        require(mode != ProgressionMode.NONE) { "A disabled progression has no rule" }
    }
}

data class RestConfig(
    val minRestSeconds: Int? = null,
    val maxRestSeconds: Int? = null,
    val failureRestSeconds: Int? = null,
) {
    init {
        require(minRestSeconds == null || minRestSeconds >= 0) { "Minimum rest must not be negative" }
        require(maxRestSeconds == null || maxRestSeconds >= 0) { "Maximum rest must not be negative" }
        require(failureRestSeconds == null || failureRestSeconds >= 0) { "Failure rest must not be negative" }
        require(minRestSeconds == null || maxRestSeconds == null || minRestSeconds <= maxRestSeconds) {
            "Minimum rest must not exceed maximum rest"
        }
    }

    fun defaultSeconds(fallback: Int = 90): Int =
        (minRestSeconds ?: fallback).coerceAtLeast(0)
}

data class ExerciseDefinition(
    val id: String,
    val name: String,
    val type: ExerciseType,
    val muscleGroup: String? = null,
    val equipment: String? = null,
    val notes: String? = null,
    val isArchived: Boolean = false,
)

data class SessionExercise(
    val id: String,
    val exercise: ExerciseDefinition,
    val plannedSetCount: Int = 0,
    val targetRepsMin: Int? = null,
    val targetRepsMax: Int? = null,
    val restSeconds: Int? = null,
    val restConfig: RestConfig? = null,
    val progression: ProgressionRule? = null,
    val supersetGroup: String? = null,
    val notes: String? = null,
    val sets: List<LoggedSet> = emptyList(),
) {
    init {
        require(id.isNotBlank()) { "Session exercise id must not be blank" }
        require(plannedSetCount >= 0) { "Planned set count must not be negative" }
        require(targetRepsMin == null || targetRepsMin > 0) {
            "Minimum target reps must be positive"
        }
        require(targetRepsMax == null || targetRepsMax > 0) {
            "Maximum target reps must be positive"
        }
        require(
            targetRepsMin == null || targetRepsMax == null || targetRepsMin <= targetRepsMax,
        ) { "Minimum target reps must not exceed maximum target reps" }
    }
}

data class LoggedSet(
    val id: String,
    val index: Int,
    val type: SetType = SetType.NORMAL,
    val weight: Double? = null,
    val weightUnit: WeightUnit? = null,
    val reps: Int? = null,
    val bodyweight: Double? = null,
    val assistance: Double? = null,
    val durationSeconds: Long? = null,
    val distanceMeters: Double? = null,
    val rir: Double? = null,
    val rpe: Double? = null,
    val completedAtEpochMillis: Long? = null,
    val notes: String? = null,
) {
    init {
        require(id.isNotBlank()) { "Set id must not be blank" }
        require(index >= 0) { "Set index must not be negative" }
        require(weight == null || weight >= 0) { "Weight must not be negative" }
        require(bodyweight == null || bodyweight >= 0) { "Bodyweight must not be negative" }
        require(assistance == null || assistance >= 0) { "Assistance must not be negative" }
        require(reps == null || reps >= 0) { "Reps must not be negative" }
        require(durationSeconds == null || durationSeconds >= 0) {
            "Duration must not be negative"
        }
        require(distanceMeters == null || distanceMeters >= 0) {
            "Distance must not be negative"
        }
        require(rir == null || rir >= 0) { "RIR must not be negative" }
        require(rpe == null || rpe in 0.0..10.0) { "RPE must be between 0 and 10" }
    }
}

data class WorkoutSession(
    val id: String,
    val name: String,
    val startedAtEpochMillis: Long,
    val completedAtEpochMillis: Long? = null,
    val bodyweight: Double? = null,
    val bodyweightUnit: WeightUnit? = null,
    val notes: String? = null,
    val exercises: List<SessionExercise> = emptyList(),
) {
    init {
        require(id.isNotBlank()) { "Session id must not be blank" }
        require(name.isNotBlank()) { "Session name must not be blank" }
        require(startedAtEpochMillis >= 0) { "Session start must not be negative" }
        require(
            completedAtEpochMillis == null || completedAtEpochMillis >= startedAtEpochMillis,
        ) { "Session completion cannot precede its start" }
    }

    fun withSet(sessionExerciseId: String, set: LoggedSet): WorkoutSession {
        var found = false
        val updatedExercises = exercises.map { sessionExercise ->
            if (sessionExercise.id != sessionExerciseId) {
                sessionExercise
            } else {
                found = true
                sessionExercise.copy(
                    sets = sessionExercise.sets
                        .filterNot { it.id == set.id }
                        .plus(set)
                        .sortedBy(LoggedSet::index),
                )
            }
        }
        require(found) { "Session exercise not found: $sessionExerciseId" }
        return copy(exercises = updatedExercises)
    }
}
