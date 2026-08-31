package expo.modules.workoutworker.engine

import com.squareup.moshi.JsonClass
import com.squareup.moshi.adapter
import expo.modules.workoutworker.utils.Json

@JsonClass(generateAdapter = false)
data class WorkoutEngineSetSnapshot(
    val setIndex: Int,
    val completed: Boolean,
    val reps: Int?,
    val weight: Double?,
    val weightUnit: String?,
)

@JsonClass(generateAdapter = false)
data class WorkoutEngineExerciseSnapshot(
    val exerciseIndex: Int,
    val type: String,
    val repsPerSet: Int?,
    val supersetWithNext: Boolean,
    val sets: List<WorkoutEngineSetSnapshot>,
)

@JsonClass(generateAdapter = false)
data class WorkoutEngineError(
    val code: String,
    val message: String,
)

@JsonClass(generateAdapter = false)
data class WorkoutEngineSnapshot(
    val schemaVersion: Int,
    val sessionId: String,
    val revision: Long,
    val status: String,
    val exercises: List<WorkoutEngineExerciseSnapshot>,
    val restTimerEndTime: Double?,
    val error: WorkoutEngineError?,
)

@JsonClass(generateAdapter = false)
data class WorkoutEngineCommand(
    val schemaVersion: Int,
    val sessionId: String,
    val revision: Long,
    val type: String,
    val exerciseIndex: Int?,
    val setIndex: Int?,
    val reps: Int?,
    val weight: Double?,
    val weightUnit: String?,
    val endTime: Double?,
)

class WorkoutEngineException(
    val code: String,
    message: String,
) : IllegalArgumentException("$code: $message")

object WorkoutEngine {
    private const val SCHEMA_VERSION = 1

    @OptIn(ExperimentalStdlibApi::class)
    fun decodeSnapshot(json: String): WorkoutEngineSnapshot =
        runCatching {
            Json.moshi.adapter<WorkoutEngineSnapshot>().fromJson(json)
                ?: throw WorkoutEngineException("invalid_snapshot", "snapshot is null")
        }.getOrElse { error ->
            if (error is WorkoutEngineException) throw error
            throw WorkoutEngineException("invalid_snapshot", error.message ?: "invalid JSON")
        }.also(::validateSnapshot)

    @OptIn(ExperimentalStdlibApi::class)
    fun decodeCommand(json: String): WorkoutEngineCommand =
        runCatching {
            Json.moshi.adapter<WorkoutEngineCommand>().fromJson(json)
                ?: throw WorkoutEngineException("invalid_command", "command is null")
        }.getOrElse { error ->
            if (error is WorkoutEngineException) throw error
            throw WorkoutEngineException("invalid_command", error.message ?: "invalid JSON")
        }.also(::validateCommand)

    @OptIn(ExperimentalStdlibApi::class)
    fun encodeSnapshot(snapshot: WorkoutEngineSnapshot): String {
        validateSnapshot(snapshot)
        return Json.moshi.adapter<WorkoutEngineSnapshot>().toJson(snapshot)
    }

    fun applyJson(snapshotJson: String, commandJson: String): String =
        encodeSnapshot(apply(decodeSnapshot(snapshotJson), decodeCommand(commandJson)))

    fun apply(
        snapshot: WorkoutEngineSnapshot,
        command: WorkoutEngineCommand,
    ): WorkoutEngineSnapshot {
        validateSnapshot(snapshot)
        validateCommand(command)
        if (command.sessionId != snapshot.sessionId) {
            throw WorkoutEngineException(
                "session_mismatch",
                "command sessionId does not match the snapshot",
            )
        }
        if (command.revision < snapshot.revision) {
            throw WorkoutEngineException(
                "stale_revision",
                "command revision ${command.revision} is older than ${snapshot.revision}",
            )
        }
        if (command.revision == snapshot.revision) return snapshot
        if (command.revision != snapshot.revision + 1) {
            throw WorkoutEngineException(
                "revision_gap",
                "expected revision ${snapshot.revision + 1}, received ${command.revision}",
            )
        }
        if (snapshot.status != "active") {
            throw WorkoutEngineException(
                "invalid_status",
                "finished sessions cannot receive new commands",
            )
        }

        val next = when (command.type) {
            "toggle-set" -> updateSet(snapshot, command) { set ->
                val exercise = snapshot.exercises[command.exerciseIndex!!]
                if (exercise.type == "weighted" && exercise.repsPerSet != null) {
                    when {
                        !set.completed -> set.copy(completed = true, reps = exercise.repsPerSet)
                        set.reps == 0 -> set.copy(completed = false, reps = null)
                        else -> set.copy(
                            completed = true,
                            reps = (set.reps ?: exercise.repsPerSet) - 1,
                        )
                    }
                } else {
                    set.copy(completed = !set.completed)
                }
            }

            "update-reps" -> updateSet(snapshot, command) { set ->
                set.copy(completed = true, reps = command.reps)
            }

            "update-weight" -> updateSet(snapshot, command) { set ->
                set.copy(weight = command.weight, weightUnit = command.weightUnit)
            }

            "start-rest" -> snapshot.copy(restTimerEndTime = command.endTime, error = null)
            "reset-rest" -> snapshot.copy(restTimerEndTime = null, error = null)
            "finish" -> snapshot.copy(status = "finished", restTimerEndTime = null, error = null)
            else -> throw WorkoutEngineException(
                "invalid_command",
                "unsupported command type: ${command.type}",
            )
        }
        return next.copy(revision = command.revision, error = null)
    }

    private fun updateSet(
        snapshot: WorkoutEngineSnapshot,
        command: WorkoutEngineCommand,
        update: (WorkoutEngineSetSnapshot) -> WorkoutEngineSetSnapshot,
    ): WorkoutEngineSnapshot {
        val exerciseIndex = command.exerciseIndex ?: invalidCommand("exerciseIndex is required")
        val setIndex = command.setIndex ?: invalidCommand("setIndex is required")
        val exercise = snapshot.exercises.getOrNull(exerciseIndex)
            ?: invalidTarget("set $exerciseIndex:$setIndex does not exist")
        if (exercise.sets.getOrNull(setIndex) == null) {
            invalidTarget("set $exerciseIndex:$setIndex does not exist")
        }
        return snapshot.copy(
            error = null,
            exercises = snapshot.exercises.mapIndexed { currentExerciseIndex, currentExercise ->
                if (currentExerciseIndex != exerciseIndex) {
                    currentExercise
                } else {
                    currentExercise.copy(
                        sets = currentExercise.sets.mapIndexed { currentSetIndex, currentSet ->
                            if (currentSetIndex == setIndex) update(currentSet) else currentSet
                        },
                    )
                }
            },
        )
    }

    private fun validateSnapshot(snapshot: WorkoutEngineSnapshot) {
        if (snapshot.schemaVersion != SCHEMA_VERSION) {
            throw WorkoutEngineException("invalid_snapshot", "unsupported schemaVersion")
        }
        if (snapshot.sessionId.isBlank()) {
            throw WorkoutEngineException("invalid_snapshot", "sessionId must not be blank")
        }
        if (snapshot.revision < 0) {
            throw WorkoutEngineException("invalid_snapshot", "revision must not be negative")
        }
        if (snapshot.status != "active" && snapshot.status != "finished") {
            throw WorkoutEngineException("invalid_snapshot", "status must be active or finished")
        }
        snapshot.exercises.forEachIndexed { exercisePosition, exercise ->
            if (exercise.exerciseIndex < 0 || exercise.exerciseIndex != exercisePosition) {
                throw WorkoutEngineException("invalid_snapshot", "exerciseIndex must match its position")
            }
            if (exercise.type != "weighted" && exercise.type != "cardio") {
                throw WorkoutEngineException("invalid_snapshot", "unsupported exercise type")
            }
            if (exercise.repsPerSet != null && exercise.repsPerSet < 0) {
                throw WorkoutEngineException("invalid_snapshot", "repsPerSet must not be negative")
            }
            exercise.sets.forEachIndexed { setPosition, set ->
                if (set.setIndex < 0 || set.setIndex != setPosition) {
                    throw WorkoutEngineException("invalid_snapshot", "setIndex must match its position")
                }
                if (set.reps != null && set.reps < 0) {
                    throw WorkoutEngineException("invalid_snapshot", "reps must not be negative")
                }
                if (set.weight != null && !set.weight.isFinite()) {
                    throw WorkoutEngineException("invalid_snapshot", "weight must be finite")
                }
                if (set.weightUnit != null && set.weightUnit.isBlank()) {
                    throw WorkoutEngineException("invalid_snapshot", "weightUnit must not be blank")
                }
            }
        }
        if (snapshot.restTimerEndTime != null && !snapshot.restTimerEndTime.isFinite()) {
            throw WorkoutEngineException("invalid_snapshot", "restTimerEndTime must be finite")
        }
        if (snapshot.error != null && (snapshot.error.code.isBlank() || snapshot.error.message.isBlank())) {
            throw WorkoutEngineException("invalid_snapshot", "error fields must not be blank")
        }
    }

    private fun validateCommand(command: WorkoutEngineCommand) {
        if (command.schemaVersion != SCHEMA_VERSION) {
            throw WorkoutEngineException("invalid_command", "unsupported schemaVersion")
        }
        if (command.sessionId.isBlank()) {
            throw WorkoutEngineException("invalid_command", "sessionId must not be blank")
        }
        if (command.revision < 0) {
            throw WorkoutEngineException("invalid_command", "revision must not be negative")
        }
        when (command.type) {
            "toggle-set" -> {
                if (command.exerciseIndex == null || command.exerciseIndex < 0) {
                    invalidCommand("exerciseIndex must be non-negative")
                }
                if (command.setIndex == null || command.setIndex < 0) {
                    invalidCommand("setIndex must be non-negative")
                }
            }
            "update-reps" -> {
                if (command.exerciseIndex == null || command.exerciseIndex < 0) {
                    invalidCommand("exerciseIndex must be non-negative")
                }
                if (command.setIndex == null || command.setIndex < 0) {
                    invalidCommand("setIndex must be non-negative")
                }
                if (command.reps == null || command.reps < 0) {
                    invalidCommand("reps must be non-negative")
                }
            }
            "update-weight" -> {
                if (command.exerciseIndex == null || command.exerciseIndex < 0) {
                    invalidCommand("exerciseIndex must be non-negative")
                }
                if (command.setIndex == null || command.setIndex < 0) {
                    invalidCommand("setIndex must be non-negative")
                }
                if (command.weight == null || !command.weight.isFinite() || command.weight < 0) {
                    invalidCommand("weight must be a non-negative finite number")
                }
                if (command.weightUnit.isNullOrBlank()) {
                    invalidCommand("weightUnit must not be blank")
                }
            }
            "start-rest" -> if (command.endTime == null || !command.endTime.isFinite() || command.endTime <= 0) {
                invalidCommand("endTime must be a positive finite number")
            }
            "reset-rest", "finish" -> Unit
            else -> invalidCommand("unsupported command type: ${command.type}")
        }
    }

    private fun invalidCommand(message: String): Nothing =
        throw WorkoutEngineException("invalid_command", message)

    private fun invalidTarget(message: String): Nothing =
        throw WorkoutEngineException("invalid_target", message)
}
