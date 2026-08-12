package com.liftlog.shared.stats

import com.liftlog.shared.domain.ExerciseType
import com.liftlog.shared.domain.LoggedSet
import com.liftlog.shared.domain.SessionProgressCalculator
import com.liftlog.shared.domain.WorkoutSession

/**
 * Read-only aggregates used by the native statistics screens.
 *
 * The calculation intentionally works on the domain model only. Android and iOS
 * can therefore render the same numbers even when their charts and navigation
 * are different.
 */
data class ExerciseStatistics(
    val exerciseId: String,
    val exerciseName: String,
    val sessions: Int,
    val completedSets: Int,
    val totalReps: Int,
    val totalVolume: Double,
    val bestWeight: Double?,
    val bestEstimatedOneRepMax: Double?,
)

data class WorkoutStatistics(
    val totalSessions: Int,
    val completedSessions: Int,
    val totalSets: Int,
    val completedSets: Int,
    val totalVolume: Double,
    val averageSessionDurationSeconds: Long?,
    val exerciseStatistics: List<ExerciseStatistics>,
) {
    val completionPercent: Int
        get() = if (totalSets == 0) 0 else ((completedSets * 100.0) / totalSets).toInt()
}

object WorkoutStatisticsCalculator {
    fun calculate(sessions: List<WorkoutSession>): WorkoutStatistics {
        val exerciseRows = sessions
            .flatMap { session ->
                session.exercises.map { exercise -> session to exercise }
            }
            .groupBy { (_, exercise) -> exercise.exercise.id }
            .map { (exerciseId, rows) ->
                val exercise = rows.first().second.exercise
                val sets = rows.flatMap { (_, sessionExercise) ->
                    sessionExercise.sets.filter { set ->
                        SessionProgressCalculator.isComplete(sessionExercise.exercise.type, set)
                    }
                }
                val completed = rows.sumOf { (_, sessionExercise) ->
                    sessionExercise.sets.count { set ->
                        SessionProgressCalculator.isComplete(sessionExercise.exercise.type, set)
                    }
                }
                ExerciseStatistics(
                    exerciseId = exerciseId,
                    exerciseName = exercise.name,
                    sessions = rows.map { (session, _) -> session.id }.distinct().size,
                    completedSets = completed,
                    totalReps = sets.sumOf { it.reps ?: 0 },
                    totalVolume = sets.sumOf { set -> volume(exercise.type, set) },
                    bestWeight = sets.mapNotNull(LoggedSet::weight).maxOrNull(),
                    bestEstimatedOneRepMax = sets
                        .mapNotNull { set -> estimatedOneRepMax(exercise.type, set) }
                        .maxOrNull(),
                )
            }
            .sortedWith(compareByDescending<ExerciseStatistics> { it.totalVolume }.thenBy { it.exerciseName })

        val durations = sessions.mapNotNull { session ->
            session.completedAtEpochMillis?.let { completedAt ->
                (completedAt - session.startedAtEpochMillis).coerceAtLeast(0)
            }
        }

        return WorkoutStatistics(
            totalSessions = sessions.size,
            completedSessions = sessions.count { it.completedAtEpochMillis != null },
            totalSets = sessions.sumOf { session ->
                session.exercises.sumOf { exercise -> maxOf(exercise.plannedSetCount, exercise.sets.size) }
            },
            completedSets = sessions.sumOf { session ->
                session.exercises.sumOf { exercise ->
                    exercise.sets.count { set ->
                        SessionProgressCalculator.isComplete(exercise.exercise.type, set)
                    }
                }
            },
            totalVolume = sessions.sumOf { session ->
                session.exercises.sumOf { exercise ->
                    exercise.sets
                        .filter { set -> SessionProgressCalculator.isComplete(exercise.exercise.type, set) }
                        .sumOf { set -> volume(exercise.exercise.type, set) }
                }
            },
            averageSessionDurationSeconds = durations
                .takeIf { it.isNotEmpty() }
                ?.average()
                ?.toLong()
                ?.div(1000),
            exerciseStatistics = exerciseRows,
        )
    }

    private fun volume(type: ExerciseType, set: LoggedSet): Double = when (type) {
        ExerciseType.WEIGHT_REPS -> (set.weight ?: 0.0) * (set.reps ?: 0)
        ExerciseType.BODYWEIGHT_REPS -> (set.bodyweight ?: 0.0) * (set.reps ?: 0)
        ExerciseType.ASSISTED_BODYWEIGHT_REPS ->
            ((set.bodyweight ?: 0.0) - (set.assistance ?: 0.0)).coerceAtLeast(0.0) * (set.reps ?: 0)
        ExerciseType.DURATION,
        ExerciseType.DISTANCE,
        ExerciseType.CARDIO,
        ExerciseType.MIXED,
        -> 0.0
    }

    private fun estimatedOneRepMax(type: ExerciseType, set: LoggedSet): Double? {
        if (type != ExerciseType.WEIGHT_REPS) return null
        val weight = set.weight ?: return null
        val reps = set.reps ?: return null
        if (weight <= 0.0 || reps <= 0) return null
        return if (reps == 1) weight else weight * (1.0 + reps / 30.0)
    }
}
