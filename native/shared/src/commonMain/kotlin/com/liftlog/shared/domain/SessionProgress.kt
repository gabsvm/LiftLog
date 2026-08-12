package com.liftlog.shared.domain

data class SessionProgress(
    val completedSets: Int,
    val plannedSets: Int,
    val completionPercent: Int,
) {
    init {
        require(completedSets >= 0) { "Completed sets must not be negative" }
        require(plannedSets >= 0) { "Planned sets must not be negative" }
        require(completedSets <= plannedSets || plannedSets == 0) {
            "Completed sets cannot exceed planned sets when a plan exists"
        }
        require(completionPercent in 0..100) { "Completion percent must be between 0 and 100" }
    }
}

object SessionProgressCalculator {
    fun calculate(session: WorkoutSession): SessionProgress {
        val plannedSets = session.exercises.sumOf { exercise ->
            maxOf(exercise.plannedSetCount, exercise.sets.size)
        }
        val completedSets = session.exercises.sumOf { exercise ->
            exercise.sets.count { set -> isComplete(exercise.exercise.type, set) }
        }
        val completionPercent = if (plannedSets == 0) {
            0
        } else {
            ((completedSets.toDouble() / plannedSets.toDouble()) * 100.0)
                .toInt()
                .coerceIn(0, 100)
        }
        return SessionProgress(completedSets, plannedSets, completionPercent)
    }

    fun isComplete(exerciseType: ExerciseType, set: LoggedSet): Boolean {
        if (set.completedAtEpochMillis == null) return false

        return when (exerciseType) {
            ExerciseType.WEIGHT_REPS -> set.weight != null && (set.reps ?: 0) > 0
            ExerciseType.BODYWEIGHT_REPS -> (set.reps ?: 0) > 0
            ExerciseType.ASSISTED_BODYWEIGHT_REPS ->
                set.assistance != null && (set.reps ?: 0) > 0
            ExerciseType.DURATION -> (set.durationSeconds ?: 0) > 0
            ExerciseType.DISTANCE -> (set.distanceMeters ?: 0.0) > 0.0
            ExerciseType.CARDIO ->
                (set.durationSeconds ?: 0) > 0 ||
                    (set.distanceMeters ?: 0.0) > 0.0 ||
                    (set.reps ?: 0) > 0
            ExerciseType.MIXED ->
                (set.reps ?: 0) > 0 ||
                    (set.durationSeconds ?: 0) > 0 ||
                    (set.distanceMeters ?: 0.0) > 0.0
        }
    }
}

