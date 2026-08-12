package com.liftlog.shared.migration

import com.liftlog.shared.domain.ExerciseDefinition
import com.liftlog.shared.domain.ExerciseType
import com.liftlog.shared.domain.LoggedSet
import com.liftlog.shared.domain.ProgressionMode
import com.liftlog.shared.domain.ProgressionRule
import com.liftlog.shared.domain.RestConfig
import com.liftlog.shared.domain.SessionExercise
import com.liftlog.shared.domain.SetType
import com.liftlog.shared.domain.WeightUnit
import com.liftlog.shared.domain.WorkoutSession
import com.liftlog.shared.domain.RoutineExercise
import com.liftlog.shared.domain.WorkoutRoutine
import com.liftlog.shared.domain.WorkoutTemplateFolder
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

const val NATIVE_WORKOUT_EXPORT_FORMAT = "liftlog.native.workouts"
const val NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION = 1

/** Stable transport values used by the Expo-to-native migration boundary. */
@Serializable
enum class NativeExportExerciseType {
    WEIGHT_REPS,
    BODYWEIGHT_REPS,
    ASSISTED_BODYWEIGHT_REPS,
    DURATION,
    DISTANCE,
    CARDIO,
    MIXED,
}

@Serializable
enum class NativeExportSetType {
    NORMAL,
    WARMUP,
    DROP_SET,
    TOP_SET,
    BACKOFF,
    FAILURE,
    AMRAP,
}

@Serializable
enum class NativeExportWeightUnit {
    KILOGRAMS,
    POUNDS,
}

@Serializable
enum class NativeExportProgressionMode {
    INCREASE_ALL,
    INCREASE_LOWEST,
}

@Serializable
data class NativeWorkoutExportV1(
    val format: String,
    val schemaVersion: Int,
    val exportedAtEpochMillis: Long,
    val sourceApplicationId: String? = null,
    val sessions: List<NativeWorkoutSessionV1> = emptyList(),
    val routines: List<NativeWorkoutRoutineV1> = emptyList(),
    val folders: List<NativeWorkoutTemplateFolderV1> = emptyList(),
    val exerciseLibrary: List<NativeWorkoutExerciseDefinitionV1> = emptyList(),
    val settings: NativeWorkoutSettingsV1? = null,
)

/** Preferences that are safe to move between devices without platform state. */
@Serializable
data class NativeWorkoutSettingsV1(
    val defaultRestSeconds: Int = 90,
)

@Serializable
data class NativeWorkoutExerciseDefinitionV1(
    val id: String,
    val name: String,
    val type: NativeExportExerciseType,
    val muscleGroup: String? = null,
    val equipment: String? = null,
    val notes: String? = null,
    val isArchived: Boolean = false,
)

@Serializable
data class NativeWorkoutRoutineV1(
    val id: String,
    val name: String,
    val description: String? = null,
    val folderId: String? = null,
    val createdAtEpochMillis: Long,
    val updatedAtEpochMillis: Long,
    val exercises: List<NativeWorkoutRoutineExerciseV1> = emptyList(),
)

@Serializable
data class NativeWorkoutTemplateFolderV1(
    val id: String,
    val name: String,
    val createdAtEpochMillis: Long,
    val updatedAtEpochMillis: Long,
)

@Serializable
data class NativeWorkoutRoutineExerciseV1(
    val id: String,
    val position: Int,
    val exerciseId: String,
    val name: String,
    val type: NativeExportExerciseType,
    val muscleGroup: String? = null,
    val equipment: String? = null,
    val exerciseNotes: String? = null,
    val isArchived: Boolean = false,
    val plannedSetCount: Int = 0,
    val targetRepsMin: Int? = null,
    val targetRepsMax: Int? = null,
    val restSeconds: Int? = null,
    val restMinSeconds: Int? = null,
    val restMaxSeconds: Int? = null,
    val restFailureSeconds: Int? = null,
    val progressionMode: NativeExportProgressionMode? = null,
    val progressionIncrement: Double? = null,
    val progressionUnit: NativeExportWeightUnit? = null,
    val supersetGroup: String? = null,
    val notes: String? = null,
)

@Serializable
data class NativeWorkoutSessionV1(
    val id: String,
    val name: String,
    val startedAtEpochMillis: Long,
    val completedAtEpochMillis: Long? = null,
    val bodyweight: Double? = null,
    val bodyweightUnit: NativeExportWeightUnit? = null,
    val notes: String? = null,
    val exercises: List<NativeWorkoutExerciseV1> = emptyList(),
)

@Serializable
data class NativeWorkoutExerciseV1(
    val id: String,
    val exerciseId: String,
    val name: String,
    val type: NativeExportExerciseType,
    val muscleGroup: String? = null,
    val equipment: String? = null,
    val plannedSetCount: Int = 0,
    val targetRepsMin: Int? = null,
    val targetRepsMax: Int? = null,
    val restSeconds: Int? = null,
    val restMinSeconds: Int? = null,
    val restMaxSeconds: Int? = null,
    val restFailureSeconds: Int? = null,
    val progressionMode: NativeExportProgressionMode? = null,
    val progressionIncrement: Double? = null,
    val progressionUnit: NativeExportWeightUnit? = null,
    val supersetGroup: String? = null,
    val notes: String? = null,
    val sets: List<NativeWorkoutSetV1> = emptyList(),
)

@Serializable
data class NativeWorkoutSetV1(
    val id: String,
    val index: Int,
    val type: NativeExportSetType = NativeExportSetType.NORMAL,
    val weight: Double? = null,
    val weightUnit: NativeExportWeightUnit? = null,
    val reps: Int? = null,
    val bodyweight: Double? = null,
    val assistance: Double? = null,
    val durationSeconds: Long? = null,
    val distanceMeters: Double? = null,
    val rir: Double? = null,
    val rpe: Double? = null,
    val completedAtEpochMillis: Long? = null,
    val notes: String? = null,
)

/** Serializes the native domain back to the same versioned migration boundary. */
object NativeWorkoutExporter {
    private val json = Json {
        prettyPrint = true
        encodeDefaults = true
    }

    fun encode(
        sessions: List<WorkoutSession>,
        exportedAtEpochMillis: Long,
        sourceApplicationId: String? = "com.gabsvm.liftlog.nativeapp",
        routines: List<WorkoutRoutine> = emptyList(),
        folders: List<WorkoutTemplateFolder> = emptyList(),
        exerciseLibrary: List<ExerciseDefinition> = emptyList(),
        settings: NativeWorkoutSettingsV1? = null,
    ): String {
        require(exportedAtEpochMillis >= 0) { "Export timestamp must not be negative" }
        val export = NativeWorkoutExportV1(
            format = NATIVE_WORKOUT_EXPORT_FORMAT,
            schemaVersion = NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION,
            exportedAtEpochMillis = exportedAtEpochMillis,
            sourceApplicationId = sourceApplicationId,
            sessions = sessions.map(::toTransportSession),
            routines = routines.map(::toTransportRoutine),
            folders = folders.map(::toTransportFolder),
            exerciseLibrary = exerciseLibrary.map(::toTransportExerciseDefinition),
            settings = settings,
        )
        return json.encodeToString(NativeWorkoutExportV1.serializer(), export)
    }

    private fun toTransportSession(session: WorkoutSession): NativeWorkoutSessionV1 =
        NativeWorkoutSessionV1(
            id = session.id,
            name = session.name,
            startedAtEpochMillis = session.startedAtEpochMillis,
            completedAtEpochMillis = session.completedAtEpochMillis,
            bodyweight = session.bodyweight,
            bodyweightUnit = session.bodyweightUnit?.toExport(),
            notes = session.notes,
            exercises = session.exercises.map(::toTransportExercise),
        )

    private fun toTransportExercise(exercise: SessionExercise): NativeWorkoutExerciseV1 =
        NativeWorkoutExerciseV1(
            id = exercise.id,
            exerciseId = exercise.exercise.id,
            name = exercise.exercise.name,
            type = exercise.exercise.type.toExport(),
            muscleGroup = exercise.exercise.muscleGroup,
            equipment = exercise.exercise.equipment,
            plannedSetCount = exercise.plannedSetCount,
            targetRepsMin = exercise.targetRepsMin,
            targetRepsMax = exercise.targetRepsMax,
            restSeconds = exercise.restSeconds,
            restMinSeconds = exercise.restConfig?.minRestSeconds ?: exercise.restSeconds,
            restMaxSeconds = exercise.restConfig?.maxRestSeconds,
            restFailureSeconds = exercise.restConfig?.failureRestSeconds,
            progressionMode = exercise.progression?.mode?.toExport(),
            progressionIncrement = exercise.progression?.increment,
            progressionUnit = exercise.progression?.unit?.toExport(),
            supersetGroup = exercise.supersetGroup,
            notes = exercise.notes,
            sets = exercise.sets.map(::toTransportSet),
        )

    private fun toTransportSet(set: LoggedSet): NativeWorkoutSetV1 =
        NativeWorkoutSetV1(
            id = set.id,
            index = set.index,
            type = set.type.toExport(),
            weight = set.weight,
            weightUnit = set.weightUnit?.toExport(),
            reps = set.reps,
            bodyweight = set.bodyweight,
            assistance = set.assistance,
            durationSeconds = set.durationSeconds,
            distanceMeters = set.distanceMeters,
            rir = set.rir,
            rpe = set.rpe,
            completedAtEpochMillis = set.completedAtEpochMillis,
            notes = set.notes,
        )

    private fun toTransportExerciseDefinition(exercise: ExerciseDefinition) = NativeWorkoutExerciseDefinitionV1(
        id = exercise.id,
        name = exercise.name,
        type = exercise.type.toExport(),
        muscleGroup = exercise.muscleGroup,
        equipment = exercise.equipment,
        notes = exercise.notes,
        isArchived = exercise.isArchived,
    )

    private fun toTransportRoutine(routine: WorkoutRoutine) = NativeWorkoutRoutineV1(
        id = routine.id,
        name = routine.name,
        description = routine.description,
        folderId = routine.folderId,
        createdAtEpochMillis = routine.createdAtEpochMillis,
        updatedAtEpochMillis = routine.updatedAtEpochMillis,
        exercises = routine.exercises.map(::toTransportRoutineExercise),
    )

    private fun toTransportFolder(folder: WorkoutTemplateFolder) = NativeWorkoutTemplateFolderV1(
        id = folder.id,
        name = folder.name,
        createdAtEpochMillis = folder.createdAtEpochMillis,
        updatedAtEpochMillis = folder.updatedAtEpochMillis,
    )

    private fun toTransportRoutineExercise(exercise: RoutineExercise) = NativeWorkoutRoutineExerciseV1(
        id = exercise.id,
        position = exercise.position,
        exerciseId = exercise.exercise.id,
        name = exercise.exercise.name,
        type = exercise.exercise.type.toExport(),
        muscleGroup = exercise.exercise.muscleGroup,
        equipment = exercise.exercise.equipment,
        exerciseNotes = exercise.exercise.notes,
        isArchived = exercise.exercise.isArchived,
        plannedSetCount = exercise.plannedSetCount,
        targetRepsMin = exercise.targetRepsMin,
        targetRepsMax = exercise.targetRepsMax,
        restSeconds = exercise.restSeconds,
        restMinSeconds = exercise.restConfig?.minRestSeconds ?: exercise.restSeconds,
        restMaxSeconds = exercise.restConfig?.maxRestSeconds,
        restFailureSeconds = exercise.restConfig?.failureRestSeconds,
        progressionMode = exercise.progression?.mode?.toExport(),
        progressionIncrement = exercise.progression?.increment,
        progressionUnit = exercise.progression?.unit?.toExport(),
        supersetGroup = exercise.supersetGroup,
        notes = exercise.notes,
    )
}

data class NativeWorkoutImportBundle(
    val sessions: List<WorkoutSession>,
    val routines: List<WorkoutRoutine>,
    val folders: List<WorkoutTemplateFolder> = emptyList(),
    val exerciseLibrary: List<ExerciseDefinition>,
    val settings: NativeWorkoutSettingsV1? = null,
)

/**
 * Decodes the versioned export produced from the Expo/Drizzle database and
 * converts it into the platform-neutral domain. It deliberately does not read
 * SQLite itself, so Android and iOS can share the same migration behavior.
 */
object NativeWorkoutImporter {
    private val json = Json {
        ignoreUnknownKeys = false
    }

    fun decode(jsonText: String): NativeWorkoutExportV1 =
        json.decodeFromString<NativeWorkoutExportV1>(jsonText)

    fun importJson(jsonText: String): List<WorkoutSession> =
        importBundle(decode(jsonText)).sessions

    fun importBundle(export: NativeWorkoutExportV1): NativeWorkoutImportBundle {
        validateExport(export)
        return NativeWorkoutImportBundle(
            sessions = export.sessions.map(::toDomain),
            routines = export.routines.map(::toRoutine),
            folders = export.folders.map(::toFolder),
            exerciseLibrary = export.exerciseLibrary.map(::toExerciseDefinition),
            settings = export.settings?.also { settings ->
                require(settings.defaultRestSeconds in 1..3600) {
                    "Default rest seconds must be between 1 and 3600"
                }
            },
        )
    }

    fun importExport(export: NativeWorkoutExportV1): List<WorkoutSession> {
        return importBundle(export).sessions
    }

    private fun validateExport(export: NativeWorkoutExportV1) {
        require(export.format == NATIVE_WORKOUT_EXPORT_FORMAT) {
            "Unsupported workout export format: ${export.format}"
        }
        require(export.schemaVersion == NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION) {
            "Unsupported workout export schema version: ${export.schemaVersion}"
        }
        require(export.exportedAtEpochMillis >= 0) {
            "Export timestamp must not be negative"
        }
        require(export.sessions.map(NativeWorkoutSessionV1::id).distinct().size == export.sessions.size) {
            "Workout export contains duplicate session ids"
        }
        require(export.routines.map(NativeWorkoutRoutineV1::id).distinct().size == export.routines.size) {
            "Workout export contains duplicate routine ids"
        }
        require(export.folders.map(NativeWorkoutTemplateFolderV1::id).distinct().size == export.folders.size) {
            "Workout export contains duplicate template folder ids"
        }
        require(export.exerciseLibrary.map(NativeWorkoutExerciseDefinitionV1::id).distinct().size == export.exerciseLibrary.size) {
            "Workout export contains duplicate exercise ids"
        }
    }

    private fun toDomain(session: NativeWorkoutSessionV1): WorkoutSession {
        require(session.id.isNotBlank()) { "Imported session id must not be blank" }
        require(session.name.isNotBlank()) { "Imported session name must not be blank" }
        require(session.startedAtEpochMillis >= 0) {
            "Imported session start must not be negative"
        }

        return WorkoutSession(
            id = session.id,
            name = session.name,
            startedAtEpochMillis = session.startedAtEpochMillis,
            completedAtEpochMillis = session.completedAtEpochMillis,
            bodyweight = session.bodyweight,
            bodyweightUnit = session.bodyweightUnit?.toDomain(),
            notes = session.notes,
            exercises = session.exercises.map(::toDomain),
        )
    }

    private fun toExerciseDefinition(exercise: NativeWorkoutExerciseDefinitionV1): ExerciseDefinition {
        require(exercise.id.isNotBlank()) { "Imported exercise definition id must not be blank" }
        require(exercise.name.isNotBlank()) { "Imported exercise definition name must not be blank" }
        return ExerciseDefinition(
            id = exercise.id,
            name = exercise.name,
            type = exercise.type.toDomain(),
            muscleGroup = exercise.muscleGroup,
            equipment = exercise.equipment,
            notes = exercise.notes,
            isArchived = exercise.isArchived,
        )
    }

    private fun toRoutine(routine: NativeWorkoutRoutineV1): WorkoutRoutine {
        require(routine.id.isNotBlank()) { "Imported routine id must not be blank" }
        require(routine.name.isNotBlank()) { "Imported routine name must not be blank" }
        return WorkoutRoutine(
            id = routine.id,
            name = routine.name,
            description = routine.description,
            folderId = routine.folderId,
            createdAtEpochMillis = routine.createdAtEpochMillis,
            updatedAtEpochMillis = routine.updatedAtEpochMillis,
            exercises = routine.exercises.map(::toRoutineExercise),
        )
    }

    private fun toFolder(folder: NativeWorkoutTemplateFolderV1): WorkoutTemplateFolder {
        require(folder.id.isNotBlank()) { "Imported template folder id must not be blank" }
        require(folder.name.isNotBlank()) { "Imported template folder name must not be blank" }
        return WorkoutTemplateFolder(
            id = folder.id,
            name = folder.name,
            createdAtEpochMillis = folder.createdAtEpochMillis,
            updatedAtEpochMillis = folder.updatedAtEpochMillis,
        )
    }

    private fun toRoutineExercise(exercise: NativeWorkoutRoutineExerciseV1): RoutineExercise =
        RoutineExercise(
            id = exercise.id,
            position = exercise.position,
            exercise = ExerciseDefinition(
                id = exercise.exerciseId,
                name = exercise.name,
                type = exercise.type.toDomain(),
                muscleGroup = exercise.muscleGroup,
                equipment = exercise.equipment,
                notes = exercise.exerciseNotes,
                isArchived = exercise.isArchived,
            ),
            plannedSetCount = exercise.plannedSetCount,
            targetRepsMin = exercise.targetRepsMin,
            targetRepsMax = exercise.targetRepsMax,
            restSeconds = exercise.restSeconds ?: restConfigOrNull(exercise.restMinSeconds, exercise.restMaxSeconds, exercise.restFailureSeconds)?.minRestSeconds,
            restConfig = restConfigOrNull(exercise.restMinSeconds, exercise.restMaxSeconds, exercise.restFailureSeconds),
            progression = progressionOrNull(exercise.progressionMode, exercise.progressionIncrement, exercise.progressionUnit),
            supersetGroup = exercise.supersetGroup,
            notes = exercise.notes,
        )

    private fun toDomain(exercise: NativeWorkoutExerciseV1): SessionExercise {
        require(exercise.id.isNotBlank()) { "Imported exercise id must not be blank" }
        require(exercise.exerciseId.isNotBlank()) {
            "Imported exercise definition id must not be blank"
        }
        require(exercise.name.isNotBlank()) { "Imported exercise name must not be blank" }
        require(exercise.id !in exercise.sets.map(NativeWorkoutSetV1::id)) {
            "Imported exercise id collides with a set id"
        }

        return SessionExercise(
            id = exercise.id,
            exercise = ExerciseDefinition(
                id = exercise.exerciseId,
                name = exercise.name,
                type = exercise.type.toDomain(),
                muscleGroup = exercise.muscleGroup,
                equipment = exercise.equipment,
                notes = exercise.notes,
            ),
            plannedSetCount = exercise.plannedSetCount,
            targetRepsMin = exercise.targetRepsMin,
            targetRepsMax = exercise.targetRepsMax,
            restSeconds = exercise.restSeconds ?: restConfigOrNull(exercise.restMinSeconds, exercise.restMaxSeconds, exercise.restFailureSeconds)?.minRestSeconds,
            restConfig = restConfigOrNull(exercise.restMinSeconds, exercise.restMaxSeconds, exercise.restFailureSeconds),
            progression = progressionOrNull(exercise.progressionMode, exercise.progressionIncrement, exercise.progressionUnit),
            supersetGroup = exercise.supersetGroup,
            notes = exercise.notes,
            sets = exercise.sets
                .also { sets ->
                    require(sets.map(NativeWorkoutSetV1::id).distinct().size == sets.size) {
                        "Imported exercise contains duplicate set ids"
                    }
                }
                .map(::toDomain),
        )
    }

    private fun toDomain(set: NativeWorkoutSetV1): LoggedSet {
        require(set.id.isNotBlank()) { "Imported set id must not be blank" }
        return LoggedSet(
            id = set.id,
            index = set.index,
            type = set.type.toDomain(),
            weight = set.weight,
            weightUnit = set.weightUnit?.toDomain(),
            reps = set.reps,
            bodyweight = set.bodyweight,
            assistance = set.assistance,
            durationSeconds = set.durationSeconds,
            distanceMeters = set.distanceMeters,
            rir = set.rir,
            rpe = set.rpe,
            completedAtEpochMillis = set.completedAtEpochMillis,
            notes = set.notes,
        )
    }

    private fun progressionOrNull(
        mode: NativeExportProgressionMode?,
        increment: Double?,
        unit: NativeExportWeightUnit?,
    ): ProgressionRule? {
        if (mode == null && increment == null && unit == null) return null
        require(mode != null && increment != null) { "Incomplete progression rule" }
        return ProgressionRule(
            mode = mode.toDomain(),
            increment = increment,
            unit = unit?.toDomain() ?: WeightUnit.KILOGRAMS,
        )
    }

    private fun restConfigOrNull(min: Int?, max: Int?, failure: Int?): RestConfig? {
        if (min == null && max == null && failure == null) return null
        return RestConfig(minRestSeconds = min, maxRestSeconds = max, failureRestSeconds = failure)
    }
}

private fun NativeExportExerciseType.toDomain(): ExerciseType = when (this) {
    NativeExportExerciseType.WEIGHT_REPS -> ExerciseType.WEIGHT_REPS
    NativeExportExerciseType.BODYWEIGHT_REPS -> ExerciseType.BODYWEIGHT_REPS
    NativeExportExerciseType.ASSISTED_BODYWEIGHT_REPS -> ExerciseType.ASSISTED_BODYWEIGHT_REPS
    NativeExportExerciseType.DURATION -> ExerciseType.DURATION
    NativeExportExerciseType.DISTANCE -> ExerciseType.DISTANCE
    NativeExportExerciseType.CARDIO -> ExerciseType.CARDIO
    NativeExportExerciseType.MIXED -> ExerciseType.MIXED
}

private fun NativeExportSetType.toDomain(): SetType = when (this) {
    NativeExportSetType.NORMAL -> SetType.NORMAL
    NativeExportSetType.WARMUP -> SetType.WARMUP
    NativeExportSetType.DROP_SET -> SetType.DROP_SET
    NativeExportSetType.TOP_SET -> SetType.TOP_SET
    NativeExportSetType.BACKOFF -> SetType.BACKOFF
    NativeExportSetType.FAILURE -> SetType.FAILURE
    NativeExportSetType.AMRAP -> SetType.AMRAP
}

private fun NativeExportWeightUnit.toDomain(): WeightUnit = when (this) {
    NativeExportWeightUnit.KILOGRAMS -> WeightUnit.KILOGRAMS
    NativeExportWeightUnit.POUNDS -> WeightUnit.POUNDS
}

private fun ExerciseType.toExport(): NativeExportExerciseType = when (this) {
    ExerciseType.WEIGHT_REPS -> NativeExportExerciseType.WEIGHT_REPS
    ExerciseType.BODYWEIGHT_REPS -> NativeExportExerciseType.BODYWEIGHT_REPS
    ExerciseType.ASSISTED_BODYWEIGHT_REPS -> NativeExportExerciseType.ASSISTED_BODYWEIGHT_REPS
    ExerciseType.DURATION -> NativeExportExerciseType.DURATION
    ExerciseType.DISTANCE -> NativeExportExerciseType.DISTANCE
    ExerciseType.CARDIO -> NativeExportExerciseType.CARDIO
    ExerciseType.MIXED -> NativeExportExerciseType.MIXED
}

private fun SetType.toExport(): NativeExportSetType = when (this) {
    SetType.NORMAL -> NativeExportSetType.NORMAL
    SetType.WARMUP -> NativeExportSetType.WARMUP
    SetType.DROP_SET -> NativeExportSetType.DROP_SET
    SetType.TOP_SET -> NativeExportSetType.TOP_SET
    SetType.BACKOFF -> NativeExportSetType.BACKOFF
    SetType.FAILURE -> NativeExportSetType.FAILURE
    SetType.AMRAP -> NativeExportSetType.AMRAP
}

private fun WeightUnit.toExport(): NativeExportWeightUnit = when (this) {
    WeightUnit.KILOGRAMS -> NativeExportWeightUnit.KILOGRAMS
    WeightUnit.POUNDS -> NativeExportWeightUnit.POUNDS
}

private fun ProgressionMode.toExport(): NativeExportProgressionMode = when (this) {
    ProgressionMode.INCREASE_ALL -> NativeExportProgressionMode.INCREASE_ALL
    ProgressionMode.INCREASE_LOWEST -> NativeExportProgressionMode.INCREASE_LOWEST
    ProgressionMode.NONE -> error("Disabled progression cannot be exported")
}

private fun NativeExportProgressionMode.toDomain(): ProgressionMode = when (this) {
    NativeExportProgressionMode.INCREASE_ALL -> ProgressionMode.INCREASE_ALL
    NativeExportProgressionMode.INCREASE_LOWEST -> ProgressionMode.INCREASE_LOWEST
}
