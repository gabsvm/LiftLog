package expo.modules.workoutworker.engine

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
            val currentExerciseIndex = snapshot.exercises
                .indexOfFirst { exercise -> exercise.sets.any { !it.completed } }
                .let { if (it >= 0) it else snapshot.exercises.lastIndex }
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
