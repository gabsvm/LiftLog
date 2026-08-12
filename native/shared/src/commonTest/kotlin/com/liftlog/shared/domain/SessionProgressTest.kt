package com.liftlog.shared.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SessionProgressTest {
    @Test
    fun weightedSetRequiresWeightRepsAndCompletionTime() {
        val incomplete = LoggedSet(
            id = "set-1",
            index = 0,
            weight = 60.0,
            weightUnit = WeightUnit.KILOGRAMS,
            reps = 8,
        )
        val complete = incomplete.copy(completedAtEpochMillis = 1_000)

        assertFalse(
            SessionProgressCalculator.isComplete(ExerciseType.WEIGHT_REPS, incomplete),
        )
        assertTrue(
            SessionProgressCalculator.isComplete(ExerciseType.WEIGHT_REPS, complete),
        )
    }

    @Test
    fun cardioCanCompleteWithDurationOrDistance() {
        val durationSet = LoggedSet(
            id = "set-1",
            index = 0,
            durationSeconds = 900,
            completedAtEpochMillis = 1_000,
        )
        val distanceSet = LoggedSet(
            id = "set-2",
            index = 1,
            distanceMeters = 2_000.0,
            completedAtEpochMillis = 2_000,
        )

        assertTrue(SessionProgressCalculator.isComplete(ExerciseType.CARDIO, durationSet))
        assertTrue(SessionProgressCalculator.isComplete(ExerciseType.DISTANCE, distanceSet))
    }

    @Test
    fun progressUsesPlannedSetsAndDoesNotMutateTheSession() {
        val exercise = ExerciseDefinition("squat", "Squat", ExerciseType.WEIGHT_REPS)
        val sessionExercise = SessionExercise(
            id = "session-exercise-1",
            exercise = exercise,
            plannedSetCount = 3,
        )
        val session = WorkoutSession(
            id = "session-1",
            name = "Lower body",
            startedAtEpochMillis = 1_000,
            exercises = listOf(sessionExercise),
        )
        val completedSet = LoggedSet(
            id = "set-1",
            index = 0,
            weight = 100.0,
            weightUnit = WeightUnit.KILOGRAMS,
            reps = 5,
            completedAtEpochMillis = 2_000,
        )

        val updated = session.withSet("session-exercise-1", completedSet)
        val progress = SessionProgressCalculator.calculate(updated)

        assertEquals(1, progress.completedSets)
        assertEquals(3, progress.plannedSets)
        assertEquals(33, progress.completionPercent)
        assertEquals(0, session.exercises.single().sets.size)
        assertEquals(1, updated.exercises.single().sets.size)
    }
}

