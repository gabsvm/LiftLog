package com.liftlog.shared.stats

import com.liftlog.shared.domain.ExerciseDefinition
import com.liftlog.shared.domain.ExerciseType
import com.liftlog.shared.domain.LoggedSet
import com.liftlog.shared.domain.SessionExercise
import com.liftlog.shared.domain.WeightUnit
import com.liftlog.shared.domain.WorkoutSession
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WorkoutStatisticsTest {
    @Test
    fun calculatesVolumeCompletionAndExerciseLeaders() {
        val bench = ExerciseDefinition("bench", "Bench press", ExerciseType.WEIGHT_REPS)
        val session = WorkoutSession(
            id = "session-1",
            name = "Upper",
            startedAtEpochMillis = 1_000,
            completedAtEpochMillis = 61_000,
            exercises = listOf(
                SessionExercise(
                    id = "session-exercise-1",
                    exercise = bench,
                    plannedSetCount = 2,
                    sets = listOf(
                        LoggedSet("set-1", 0, weight = 60.0, weightUnit = WeightUnit.KILOGRAMS, reps = 10, completedAtEpochMillis = 2_000),
                        LoggedSet("set-2", 1, weight = 60.0, weightUnit = WeightUnit.KILOGRAMS, reps = 8),
                    ),
                ),
            ),
        )

        val stats = WorkoutStatisticsCalculator.calculate(listOf(session))

        assertEquals(1, stats.totalSessions)
        assertEquals(1, stats.completedSessions)
        assertEquals(2, stats.totalSets)
        assertEquals(1, stats.completedSets)
        assertEquals(600.0, stats.totalVolume)
        assertEquals(60L, stats.averageSessionDurationSeconds)
        assertEquals(1, stats.exerciseStatistics.size)
        assertEquals(60.0, stats.exerciseStatistics.single().bestWeight)
        assertTrue(stats.exerciseStatistics.single().bestEstimatedOneRepMax!! > 60.0)
    }
}
