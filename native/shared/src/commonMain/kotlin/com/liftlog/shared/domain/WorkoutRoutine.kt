package com.liftlog.shared.domain

/** A reusable workout blueprint. It contains no logged results. */
data class WorkoutRoutine(
    val id: String,
    val name: String,
    val description: String? = null,
    /** Null means the template is kept in the top-level library. */
    val folderId: String? = null,
    val createdAtEpochMillis: Long,
    val updatedAtEpochMillis: Long = createdAtEpochMillis,
    val exercises: List<RoutineExercise> = emptyList(),
) {
    init {
        require(id.isNotBlank()) { "Routine id must not be blank" }
        require(name.isNotBlank()) { "Routine name must not be blank" }
        require(createdAtEpochMillis >= 0) { "Routine creation time must not be negative" }
        require(updatedAtEpochMillis >= createdAtEpochMillis) {
            "Routine update time cannot precede creation time"
        }
    }
}

/** A lightweight library folder for reusable workout templates. */
data class WorkoutTemplateFolder(
    val id: String,
    val name: String,
    val createdAtEpochMillis: Long,
    val updatedAtEpochMillis: Long = createdAtEpochMillis,
) {
    init {
        require(id.isNotBlank()) { "Template folder id must not be blank" }
        require(name.isNotBlank()) { "Template folder name must not be blank" }
        require(createdAtEpochMillis >= 0) { "Template folder creation time must not be negative" }
        require(updatedAtEpochMillis >= createdAtEpochMillis) {
            "Template folder update time cannot precede creation time"
        }
    }
}

data class RoutineExercise(
    val id: String,
    val position: Int,
    val exercise: ExerciseDefinition,
    val plannedSetCount: Int = 0,
    val targetRepsMin: Int? = null,
    val targetRepsMax: Int? = null,
    val restSeconds: Int? = null,
    val restConfig: RestConfig? = null,
    val progression: ProgressionRule? = null,
    val supersetGroup: String? = null,
    val notes: String? = null,
) {
    init {
        require(id.isNotBlank()) { "Routine exercise id must not be blank" }
        require(position >= 0) { "Routine exercise position must not be negative" }
        require(plannedSetCount >= 0) { "Routine planned set count must not be negative" }
        require(targetRepsMin == null || targetRepsMin > 0) {
            "Minimum routine reps must be positive"
        }
        require(targetRepsMax == null || targetRepsMax > 0) {
            "Maximum routine reps must be positive"
        }
        require(targetRepsMin == null || targetRepsMax == null || targetRepsMin <= targetRepsMax) {
            "Minimum routine reps must not exceed maximum routine reps"
        }
    }
}

fun WorkoutRoutine.toSession(nowEpochMillis: Long, sessionId: String): WorkoutSession =
    WorkoutSession(
        id = sessionId,
        name = name,
        startedAtEpochMillis = nowEpochMillis,
        notes = description,
        exercises = exercises.sortedBy(RoutineExercise::position).map { routineExercise ->
            SessionExercise(
                id = "$sessionId:${routineExercise.id}",
                exercise = routineExercise.exercise,
                plannedSetCount = routineExercise.plannedSetCount,
                targetRepsMin = routineExercise.targetRepsMin,
                targetRepsMax = routineExercise.targetRepsMax,
                restSeconds = routineExercise.restSeconds,
                restConfig = routineExercise.restConfig,
                progression = routineExercise.progression,
                supersetGroup = routineExercise.supersetGroup,
                notes = routineExercise.notes,
                sets = (0 until routineExercise.plannedSetCount).map { index ->
                    LoggedSet(
                        id = "$sessionId:${routineExercise.id}:set:$index",
                        index = index,
                    )
                },
            )
        },
    )

fun WorkoutSession.toRoutine(
    routineId: String = "routine-${id}",
    nowEpochMillis: Long,
): WorkoutRoutine = WorkoutRoutine(
    id = routineId,
    name = name,
    description = notes,
    createdAtEpochMillis = nowEpochMillis,
    updatedAtEpochMillis = nowEpochMillis,
    exercises = exercises.mapIndexed { index, sessionExercise ->
        RoutineExercise(
            id = "${routineId}:exercise:$index",
            position = index,
            exercise = sessionExercise.exercise,
            plannedSetCount = maxOf(sessionExercise.plannedSetCount, sessionExercise.sets.size),
            targetRepsMin = sessionExercise.targetRepsMin,
            targetRepsMax = sessionExercise.targetRepsMax,
            restSeconds = sessionExercise.restSeconds,
            restConfig = sessionExercise.restConfig,
            progression = sessionExercise.progression,
            supersetGroup = sessionExercise.supersetGroup,
            notes = sessionExercise.notes,
        )
    },
)
