package expo.modules.workoutworker.engine

import kotlin.time.Instant

data class WorkoutViewSetState(
    val setIndex: Int,
    val completed: Boolean,
    val reps: Int?,
    val weight: Double?,
    val weightUnit: String?,
)

data class WorkoutViewExerciseState(
    val exerciseIndex: Int,
    val name: String,
    val type: String,
    val supersetLabel: String?,
    val sets: List<WorkoutViewSetState>,
    val isCurrent: Boolean,
)

data class WorkoutViewState(
    val sessionId: String,
    val revision: Long,
    val status: String,
    val completedSets: Int,
    val totalSets: Int,
    val progress: Float,
    val restTimerEndTime: Double?,
    val exercises: List<WorkoutViewExerciseState>,
) {
    companion object {
        fun fromSnapshot(
            snapshot: WorkoutEngineSnapshot,
            exerciseNames: List<String>,
        ): WorkoutViewState {
            val completedSets = snapshot.exercises.sumOf { exercise ->
                exercise.sets.count { it.completed }
            }
            val totalSets = snapshot.exercises.sumOf { it.sets.size }
            val currentExerciseIndex = findCurrentExerciseIndex(snapshot.exercises)
            val supersetLabels = buildSupersetLabels(snapshot.exercises)

            return WorkoutViewState(
                sessionId = snapshot.sessionId,
                revision = snapshot.revision,
                status = snapshot.status,
                completedSets = completedSets,
                totalSets = totalSets,
                progress = if (totalSets == 0) 0f else completedSets.toFloat() / totalSets,
                restTimerEndTime = snapshot.restTimerEndTime,
                exercises = snapshot.exercises.mapIndexed { index, exercise ->
                    WorkoutViewExerciseState(
                        exerciseIndex = exercise.exerciseIndex,
                        name = exerciseNames.getOrNull(index).orEmpty(),
                        type = exercise.type,
                        supersetLabel = supersetLabels[index],
                        sets = exercise.sets.map { set ->
                            WorkoutViewSetState(
                                setIndex = set.setIndex,
                                completed = set.completed,
                                reps = set.reps,
                                weight = set.weight,
                                weightUnit = set.weightUnit,
                            )
                        },
                        isCurrent = index == currentExerciseIndex,
                    )
                },
            )
        }

        /**
         * Mirrors Session.nextExercise from the React Native domain model.
         * Native rendering must not accidentally force sequential completion:
         * after A1 it advances to A2, and after A2 it loops back to the first
         * incomplete member of the superset chain.
         */
        private fun findCurrentExerciseIndex(
            exercises: List<WorkoutEngineExerciseSnapshot>,
        ): Int {
            val runningCardioIndex = exercises.indexOfFirst { exercise ->
                exercise.type == "cardio" &&
                    exercise.sets.any { it.currentBlockStartTime != null }
            }
            if (runningCardioIndex >= 0) return runningCardioIndex

            var latestExerciseIndex = -1
            var latestExerciseTime: Long? = null
            exercises.forEachIndexed { index, exercise ->
                if (!isStarted(exercise)) return@forEachIndexed
                val latestTime = latestEpochSecond(exercise)
                if (
                    latestExerciseIndex == -1 ||
                    (latestTime != null &&
                        (latestExerciseTime == null || latestTime > latestExerciseTime!!))
                ) {
                    latestExerciseIndex = index
                    latestExerciseTime = latestTime
                }
            }

            val latestSupersetsWithNext =
                latestExerciseIndex >= 0 &&
                    latestExerciseIndex < exercises.lastIndex &&
                    exercises[latestExerciseIndex].type == "weighted" &&
                    exercises[latestExerciseIndex].supersetWithNext

            val latestSupersetsWithPrevious =
                latestExerciseIndex > 0 &&
                    exercises[latestExerciseIndex - 1].type == "weighted" &&
                    exercises[latestExerciseIndex - 1].supersetWithNext

            if (
                latestSupersetsWithNext &&
                !isComplete(exercises[latestExerciseIndex + 1])
            ) {
                return latestExerciseIndex + 1
            }

            if (latestSupersetsWithPrevious) {
                var indexToJumpBackTo = latestExerciseIndex - 1
                while (
                    indexToJumpBackTo >= 0 &&
                    exercises[indexToJumpBackTo].type == "weighted" &&
                    exercises[indexToJumpBackTo].supersetWithNext
                ) {
                    indexToJumpBackTo--
                }
                indexToJumpBackTo++
                while (
                    indexToJumpBackTo < exercises.size &&
                    isComplete(exercises[indexToJumpBackTo])
                ) {
                    indexToJumpBackTo++
                }
                if (indexToJumpBackTo < exercises.size) {
                    return indexToJumpBackTo
                }
            }

            var result = -1
            var maxEpochSecond = Long.MIN_VALUE
            exercises.forEachIndexed { index, exercise ->
                if (isComplete(exercise)) return@forEachIndexed
                val epochSecond = latestEpochSecond(exercise) ?: Long.MIN_VALUE
                if (result == -1 || epochSecond > maxEpochSecond) {
                    result = index
                    maxEpochSecond = epochSecond
                }
            }
            return result
        }

        private fun isComplete(exercise: WorkoutEngineExerciseSnapshot): Boolean =
            exercise.sets.all { it.completed }

        private fun isStarted(exercise: WorkoutEngineExerciseSnapshot): Boolean =
            exercise.sets.any { it.completionDateTime != null }

        private fun latestEpochSecond(exercise: WorkoutEngineExerciseSnapshot): Long? =
            exercise.sets
                .mapNotNull { set ->
                    set.completionDateTime?.let { Instant.parse(it).epochSeconds }
                }
                .maxOrNull()

        private fun buildSupersetLabels(
            exercises: List<WorkoutEngineExerciseSnapshot>,
        ): List<String?> {
            val labels = MutableList<String?>(exercises.size) { null }
            var groupIndex = 0
            var index = 0
            while (index < exercises.lastIndex) {
                val first = exercises[index]
                val next = exercises[index + 1]
                if (first.type != "weighted" || !first.supersetWithNext || next.type != "weighted") {
                    index += 1
                    continue
                }

                var endIndex = index + 1
                while (endIndex < exercises.lastIndex) {
                    val current = exercises[endIndex]
                    val following = exercises[endIndex + 1]
                    if (current.type != "weighted" || !current.supersetWithNext || following.type != "weighted") {
                        break
                    }
                    endIndex += 1
                }

                val groupName = if (groupIndex < 26) {
                    ('A'.code + groupIndex).toChar().toString()
                } else {
                    "S${groupIndex + 1}"
                }
                for (groupExerciseIndex in index..endIndex) {
                    labels[groupExerciseIndex] = "$groupName${groupExerciseIndex - index + 1}"
                }
                groupIndex += 1
                index = endIndex + 1
            }
            return labels
        }
    }
}
