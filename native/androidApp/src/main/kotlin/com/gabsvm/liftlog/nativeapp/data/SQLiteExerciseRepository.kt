package com.gabsvm.liftlog.nativeapp.data

import android.content.ContentValues
import android.database.Cursor
import com.liftlog.shared.domain.ExerciseDefinition
import com.liftlog.shared.domain.ExerciseRepository
import com.liftlog.shared.domain.ExerciseType

class SQLiteExerciseRepository(
    private val database: LiftLogDatabase,
) : ExerciseRepository {
    override suspend fun getById(id: String): ExerciseDefinition? =
        database.readableDatabase.query(
            "exercise_library",
            COLUMNS,
            "id = ?",
            arrayOf(id),
            null,
            null,
            null,
            "1",
        ).use { cursor -> if (cursor.moveToFirst()) readExercise(cursor) else null }

    override suspend fun list(includeArchived: Boolean): List<ExerciseDefinition> {
        val where = if (includeArchived) null else "is_archived = 0"
        return database.readableDatabase.query(
            "exercise_library",
            COLUMNS,
            where,
            null,
            null,
            null,
            "name COLLATE NOCASE ASC",
        ).use { cursor ->
            buildList { while (cursor.moveToNext()) add(readExercise(cursor)) }
        }
    }

    override suspend fun save(exercise: ExerciseDefinition) {
        database.writableDatabase.insertWithOnConflict(
            "exercise_library",
            null,
            values(exercise),
            android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    private fun readExercise(cursor: Cursor): ExerciseDefinition = ExerciseDefinition(
        id = cursor.requiredString("id"),
        name = cursor.requiredString("name"),
        type = ExerciseType.valueOf(cursor.requiredString("exercise_type")),
        muscleGroup = cursor.nullableString("muscle_group"),
        equipment = cursor.nullableString("equipment"),
        notes = cursor.nullableString("notes"),
        isArchived = cursor.requiredLong("is_archived") == 1L,
    )

    private fun values(exercise: ExerciseDefinition) = ContentValues().apply {
        put("id", exercise.id)
        put("name", exercise.name)
        put("exercise_type", exercise.type.name)
        putNullable("muscle_group", exercise.muscleGroup)
        putNullable("equipment", exercise.equipment)
        putNullable("notes", exercise.notes)
        put("is_archived", if (exercise.isArchived) 1 else 0)
        put("updated_at", System.currentTimeMillis())
    }

    private companion object { val COLUMNS = arrayOf("id", "name", "exercise_type", "muscle_group", "equipment", "notes", "is_archived", "updated_at") }
}

private fun Cursor.requiredString(column: String): String = getString(getColumnIndexOrThrow(column))
private fun Cursor.nullableString(column: String): String? =
    getColumnIndexOrThrow(column).let { index -> if (isNull(index)) null else getString(index) }
private fun Cursor.requiredLong(column: String): Long = getLong(getColumnIndexOrThrow(column))
private fun ContentValues.putNullable(key: String, value: String?) {
    if (value == null) putNull(key) else put(key, value)
}
