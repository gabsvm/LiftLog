package com.liftlog.shared.domain

/** Deterministic fixture used by the native pilot until the real data adapter is connected. */
fun sampleWorkoutSession(): WorkoutSession {
    val squat = ExerciseDefinition(
        id = "squat",
        name = "Sentadilla",
        type = ExerciseType.WEIGHT_REPS,
        muscleGroup = "Piernas",
    )
    val row = ExerciseDefinition(
        id = "row",
        name = "Remo con barra",
        type = ExerciseType.WEIGHT_REPS,
        muscleGroup = "Espalda",
    )

    fun sets(prefix: String, weight: Double): List<LoggedSet> = (0 until 3).map { index ->
        LoggedSet(
            id = "$prefix-set-${index + 1}",
            index = index,
            weight = weight,
            weightUnit = WeightUnit.KILOGRAMS,
            reps = 8,
        )
    }

    return WorkoutSession(
        id = "native-pilot-session",
        name = "Entrenamiento de prueba",
        startedAtEpochMillis = 1_000,
        exercises = listOf(
            SessionExercise(
                id = "squat-session-exercise",
                exercise = squat,
                plannedSetCount = 3,
                targetRepsMin = 6,
                targetRepsMax = 10,
                sets = sets("squat", 80.0),
            ),
            SessionExercise(
                id = "row-session-exercise",
                exercise = row,
                plannedSetCount = 3,
                targetRepsMin = 8,
                targetRepsMax = 12,
                sets = sets("row", 60.0),
            ),
        ),
    )
}

