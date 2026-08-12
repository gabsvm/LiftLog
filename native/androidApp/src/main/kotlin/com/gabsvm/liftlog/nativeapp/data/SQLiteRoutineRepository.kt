package com.gabsvm.liftlog.nativeapp.data

import android.content.ContentValues
import android.database.Cursor
import com.liftlog.shared.domain.ExerciseDefinition
import com.liftlog.shared.domain.ExerciseType
import com.liftlog.shared.domain.RoutineExercise
import com.liftlog.shared.domain.RoutineRepository
import com.liftlog.shared.domain.ProgressionMode
import com.liftlog.shared.domain.ProgressionRule
import com.liftlog.shared.domain.WeightUnit
import com.liftlog.shared.domain.RestConfig
import com.liftlog.shared.domain.WorkoutRoutine
import com.liftlog.shared.domain.WorkoutTemplateFolder

class SQLiteRoutineRepository(
    private val database: LiftLogDatabase,
) : RoutineRepository {
    override suspend fun getById(id: String): WorkoutRoutine? =
        database.readableDatabase.query(
            "workout_routines",
            ROUTINE_COLUMNS,
            "id = ?",
            arrayOf(id),
            null,
            null,
            null,
            "1",
        ).use { cursor -> if (cursor.moveToFirst()) readRoutine(cursor) else null }

    override suspend fun list(limit: Int): List<WorkoutRoutine> {
        return listInternal(limit.coerceIn(1, 200).toString())
    }

    override suspend fun listAll(): List<WorkoutRoutine> = listInternal(null)

    private fun listInternal(limit: String?): List<WorkoutRoutine> {
        return database.readableDatabase.query(
            "workout_routines",
            ROUTINE_COLUMNS,
            null,
            null,
            null,
            null,
            "updated_at DESC",
            limit,
        ).use { cursor ->
            buildList { while (cursor.moveToNext()) add(readRoutine(cursor)) }
        }
    }

    override suspend fun save(routine: WorkoutRoutine) {
        database.withTransaction {
            val db = database.writableDatabase
            db.delete("workout_routines", "id = ?", arrayOf(routine.id))
            db.insertOrThrow("workout_routines", null, routineValues(routine))
            routine.exercises.forEach { exercise ->
                db.insertOrThrow("routine_exercises", null, routineExerciseValues(routine.id, exercise))
            }
        }
    }

    override suspend fun delete(id: String) {
        database.writableDatabase.delete("workout_routines", "id = ?", arrayOf(id))
    }

    override suspend fun listFolders(limit: Int): List<WorkoutTemplateFolder> {
        return listFoldersInternal(limit.coerceIn(1, 200).toString())
    }

    override suspend fun listAllFolders(): List<WorkoutTemplateFolder> = listFoldersInternal(null)

    private fun listFoldersInternal(limit: String?): List<WorkoutTemplateFolder> {
        return database.readableDatabase.query(
            "workout_template_folders",
            FOLDER_COLUMNS,
            null,
            null,
            null,
            null,
            "updated_at DESC",
            limit,
        ).use { cursor ->
            buildList { while (cursor.moveToNext()) add(readFolder(cursor)) }
        }
    }

    override suspend fun saveFolder(folder: WorkoutTemplateFolder) {
        database.withTransaction {
            val values = ContentValues().apply {
                put("id", folder.id)
                put("name", folder.name)
                put("created_at", folder.createdAtEpochMillis)
                put("updated_at", folder.updatedAtEpochMillis)
            }
            database.writableDatabase.insertWithOnConflict(
                "workout_template_folders",
                null,
                values,
                android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE,
            )
        }
    }

    override suspend fun deleteFolder(id: String) {
        val db = database.writableDatabase
        db.beginTransaction()
        try {
            db.execSQL("UPDATE workout_routines SET folder_id = NULL WHERE folder_id = ?", arrayOf(id))
            db.delete("workout_template_folders", "id = ?", arrayOf(id))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun readRoutine(cursor: Cursor): WorkoutRoutine {
        val id = cursor.requiredString("id")
        return WorkoutRoutine(
            id = id,
            name = cursor.requiredString("name"),
            description = cursor.nullableString("description"),
            folderId = cursor.nullableString("folder_id"),
            createdAtEpochMillis = cursor.requiredLong("created_at"),
            updatedAtEpochMillis = cursor.requiredLong("updated_at"),
            exercises = database.readableDatabase.query(
                "routine_exercises",
                EXERCISE_COLUMNS,
                "routine_id = ?",
                arrayOf(id),
                null,
                null,
                "position ASC",
            ).use { exerciseCursor ->
                buildList {
                    while (exerciseCursor.moveToNext()) add(
                        RoutineExercise(
                            id = exerciseCursor.requiredString("id"),
                            position = exerciseCursor.requiredLong("position").toInt(),
                            exercise = ExerciseDefinition(
                                id = exerciseCursor.requiredString("exercise_id"),
                                name = exerciseCursor.requiredString("exercise_name"),
                                type = ExerciseType.valueOf(exerciseCursor.requiredString("exercise_type")),
                                muscleGroup = exerciseCursor.nullableString("muscle_group"),
                                equipment = exerciseCursor.nullableString("equipment"),
                                notes = exerciseCursor.nullableString("exercise_notes"),
                                isArchived = exerciseCursor.requiredLong("is_archived") == 1L,
                            ),
                            plannedSetCount = exerciseCursor.requiredLong("planned_set_count").toInt(),
                            targetRepsMin = exerciseCursor.nullableLong("target_reps_min")?.toInt(),
                            targetRepsMax = exerciseCursor.nullableLong("target_reps_max")?.toInt(),
                            restSeconds = exerciseCursor.nullableLong("rest_seconds")?.toInt(),
                            restConfig = exerciseCursor.restConfig(),
                            progression = exerciseCursor.progressionRule(),
                            supersetGroup = exerciseCursor.nullableString("superset_group"),
                            notes = exerciseCursor.nullableString("notes"),
                        ),
                    )
                }
            },
        )
    }

    private fun routineValues(routine: WorkoutRoutine) = ContentValues().apply {
        put("id", routine.id)
        put("name", routine.name)
        putNullable("description", routine.description)
        putNullable("folder_id", routine.folderId)
        put("created_at", routine.createdAtEpochMillis)
        put("updated_at", routine.updatedAtEpochMillis)
    }

    private fun routineExerciseValues(routineId: String, exercise: RoutineExercise) = ContentValues().apply {
        put("id", exercise.id)
        put("routine_id", routineId)
        put("position", exercise.position)
        put("exercise_id", exercise.exercise.id)
        put("exercise_name", exercise.exercise.name)
        put("exercise_type", exercise.exercise.type.name)
        putNullable("muscle_group", exercise.exercise.muscleGroup)
        putNullable("equipment", exercise.exercise.equipment)
        putNullable("exercise_notes", exercise.exercise.notes)
        put("is_archived", if (exercise.exercise.isArchived) 1 else 0)
        put("planned_set_count", exercise.plannedSetCount)
        putNullable("target_reps_min", exercise.targetRepsMin)
        putNullable("target_reps_max", exercise.targetRepsMax)
        putNullable("rest_seconds", exercise.restSeconds ?: exercise.restConfig?.minRestSeconds)
        putNullable("rest_max_seconds", exercise.restConfig?.maxRestSeconds)
        putNullable("rest_failure_seconds", exercise.restConfig?.failureRestSeconds)
        putNullable("progression_mode", exercise.progression?.mode?.name)
        putNullable("progression_increment", exercise.progression?.increment)
        putNullable("progression_unit", exercise.progression?.unit?.name)
        putNullable("superset_group", exercise.supersetGroup)
        putNullable("notes", exercise.notes)
    }

    private companion object {
        val ROUTINE_COLUMNS = arrayOf("id", "name", "description", "folder_id", "created_at", "updated_at")
        val FOLDER_COLUMNS = arrayOf("id", "name", "created_at", "updated_at")
        val EXERCISE_COLUMNS = arrayOf(
            "id", "routine_id", "position", "exercise_id", "exercise_name", "exercise_type",
            "muscle_group", "equipment", "exercise_notes", "is_archived", "planned_set_count",
            "target_reps_min", "target_reps_max", "rest_seconds", "rest_max_seconds",
            "rest_failure_seconds", "progression_mode", "progression_increment",
            "progression_unit", "superset_group", "notes",
        )
    }
}

private fun readFolder(cursor: Cursor): WorkoutTemplateFolder = WorkoutTemplateFolder(
    id = cursor.requiredString("id"),
    name = cursor.requiredString("name"),
    createdAtEpochMillis = cursor.requiredLong("created_at"),
    updatedAtEpochMillis = cursor.requiredLong("updated_at"),
)

private fun Cursor.requiredString(column: String): String = getString(getColumnIndexOrThrow(column))
private fun Cursor.nullableString(column: String): String? =
    getColumnIndexOrThrow(column).let { index -> if (isNull(index)) null else getString(index) }
private fun Cursor.requiredLong(column: String): Long = getLong(getColumnIndexOrThrow(column))
private fun Cursor.nullableLong(column: String): Long? =
    getColumnIndexOrThrow(column).let { index -> if (isNull(index)) null else getLong(index) }
private fun Cursor.progressionRule(): ProgressionRule? {
    val mode = nullableString("progression_mode")?.let(ProgressionMode::valueOf) ?: return null
    val increment = nullableDouble("progression_increment") ?: return null
    return ProgressionRule(
        mode = mode,
        increment = increment,
        unit = nullableString("progression_unit")?.let(WeightUnit::valueOf) ?: WeightUnit.KILOGRAMS,
    )
}
private fun Cursor.restConfig(): RestConfig? {
    val min = nullableLong("rest_seconds")?.toInt()
    val max = nullableLong("rest_max_seconds")?.toInt()
    val failure = nullableLong("rest_failure_seconds")?.toInt()
    if (min == null && max == null && failure == null) return null
    return RestConfig(minRestSeconds = min, maxRestSeconds = max, failureRestSeconds = failure)
}
private fun Cursor.nullableDouble(column: String): Double? =
    getColumnIndexOrThrow(column).let { index -> if (isNull(index)) null else getDouble(index) }
private fun ContentValues.putNullable(key: String, value: String?) {
    if (value == null) putNull(key) else put(key, value)
}
private fun ContentValues.putNullable(key: String, value: Int?) {
    if (value == null) putNull(key) else put(key, value)
}
private fun ContentValues.putNullable(key: String, value: Double?) {
    if (value == null) putNull(key) else put(key, value)
}
