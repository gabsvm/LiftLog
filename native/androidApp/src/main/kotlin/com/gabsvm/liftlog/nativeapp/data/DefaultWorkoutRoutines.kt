package com.gabsvm.liftlog.nativeapp.data

import com.liftlog.shared.domain.ExerciseDefinition
import com.liftlog.shared.domain.ExerciseType
import com.liftlog.shared.domain.ProgressionMode
import com.liftlog.shared.domain.ProgressionRule
import com.liftlog.shared.domain.RestConfig
import com.liftlog.shared.domain.RoutineExercise
import com.liftlog.shared.domain.WeightUnit
import com.liftlog.shared.domain.WorkoutRoutine

/**
 * Small generic starter plan used only when a fresh native database has no
 * routines yet. It is intentionally product-neutral: users can replace it
 * with their own templates immediately.
 *
 * The Expo app keeps built-in programs in code and may therefore have no
 * corresponding row in the legacy program table. Seeding this fallback
 * only when the native database has no routines keeps the first native screen
 * useful without overwriting user-created routines.
 */
object DefaultWorkoutRoutines {
    fun create(nowEpochMillis: Long = System.currentTimeMillis()): List<WorkoutRoutine> {
        val planName = "Starter strength plan"
        return listOf(
            routine(
                id = "builtin:starter:upper-1",
                name = "Upper 1",
                planName = planName,
                nowEpochMillis = nowEpochMillis,
                exercises = listOf(
                    "BB Bench Press" to (3 to 6),
                    "DB Row" to (3 to 8),
                    "Seated BB Press" to (3 to 6),
                    "Pronated Pull-Up" to (3 to 8),
                    "Dips" to (3 to 8),
                    "DB Lateral Raise" to (3 to 10),
                    "EZ Bar Curl" to (3 to 8),
                    "Cable Triceps Extension" to (3 to 8),
                ),
            ),
            routine(
                id = "builtin:starter:lower-1",
                name = "Lower 1",
                planName = planName,
                nowEpochMillis = nowEpochMillis,
                exercises = listOf(
                    "Back Squat" to (3 to 5),
                    "Tibialis Raise" to (3 to 15),
                    "Deadlift" to (1 to 3),
                    "Calf Raise" to (3 to 10),
                    "Leg Extension" to (3 to 10),
                    "Leg Curl" to (3 to 8),
                    "Back Extension" to (3 to 10),
                    "Hanging Knee Raise" to (3 to 10),
                ),
            ),
            routine(
                id = "builtin:starter:upper-2",
                name = "Upper 2",
                planName = planName,
                nowEpochMillis = nowEpochMillis,
                exercises = listOf(
                    "Seated DB Press" to (5 to 5),
                    "Neutral Grip Pull-Up" to (5 to 5),
                    "Incline DB Press" to (5 to 5),
                    "Pronated Pull-Up" to (3 to 8),
                    "Close Grip Bench Press" to (3 to 5),
                    "DB Hammer Curl" to (3 to 8),
                    "DB Rear Delt Raise" to (3 to 12),
                    "DB Lateral Raise" to (3 to 10),
                ),
            ),
            routine(
                id = "builtin:starter:lower-2",
                name = "Lower 2",
                planName = planName,
                nowEpochMillis = nowEpochMillis,
                exercises = listOf(
                    "Romanian Deadlift" to (3 to 8),
                    "Calf Raise" to (3 to 15),
                    "Leg Press" to (3 to 8),
                    "Tibialis Raise" to (3 to 15),
                    "DB Walking Lunge" to (2 to 8),
                    "Back Extension" to (3 to 10),
                    "Hanging Knee Raise" to (3 to 10),
                ),
            ),
        )
    }

    private fun routine(
        id: String,
        name: String,
        planName: String,
        nowEpochMillis: Long,
        exercises: List<Pair<String, Pair<Int, Int>>>,
    ): WorkoutRoutine {
        return WorkoutRoutine(
            id = id,
            name = name,
            description = planName,
            createdAtEpochMillis = nowEpochMillis,
            updatedAtEpochMillis = nowEpochMillis,
            exercises = exercises.mapIndexed { index, (exerciseName, target) ->
                val exercise = ExerciseDefinition(
                    id = "builtin:exercise:" + slug(exerciseName),
                    name = exerciseName,
                    type = ExerciseType.WEIGHT_REPS,
                )
                RoutineExercise(
                    id = id + ":exercise:" + index,
                    position = index,
                    exercise = exercise,
                    plannedSetCount = target.first,
                    targetRepsMin = target.second,
                    targetRepsMax = target.second,
                    restSeconds = 90,
                    restConfig = RestConfig(
                        minRestSeconds = 90,
                        maxRestSeconds = 180,
                        failureRestSeconds = 240,
                    ),
                    progression = ProgressionRule(
                        mode = ProgressionMode.INCREASE_ALL,
                        increment = 2.5,
                        unit = WeightUnit.KILOGRAMS,
                    ),
                )
            },
        )
    }

    private fun slug(value: String): String =
        value.lowercase()
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
}
