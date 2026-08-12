package com.gabsvm.liftlog.nativeapp.data

import android.content.ContentValues
import android.database.Cursor
import com.liftlog.shared.domain.ExerciseDefinition
import com.liftlog.shared.domain.ExerciseType
import com.liftlog.shared.domain.LoggedSet
import com.liftlog.shared.domain.ProgressionMode
import com.liftlog.shared.domain.ProgressionRule
import com.liftlog.shared.domain.RestConfig
import com.liftlog.shared.domain.SessionExercise
import com.liftlog.shared.domain.SetType
import com.liftlog.shared.domain.TransactionalRepository
import com.liftlog.shared.domain.WeightUnit
import com.liftlog.shared.domain.WorkoutSession
import com.liftlog.shared.domain.WorkoutSessionRepository
import com.liftlog.shared.migration.NativeWorkoutImporter

class SQLiteWorkoutSessionRepository(
    private val database: LiftLogDatabase,
) : WorkoutSessionRepository, TransactionalRepository {
    override suspend fun getById(id: String): WorkoutSession? {
        database.readableDatabase.query(
            "workout_sessions",
            SESSION_COLUMNS,
            "id = ?",
            arrayOf(id),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            return if (cursor.moveToFirst()) readSession(cursor) else null
        }
    }

    override suspend fun list(limit: Int): List<WorkoutSession> {
        return listInternal(limit.coerceIn(1, 500).toString())
    }

    override suspend fun listAll(): List<WorkoutSession> = listInternal(null)

    override suspend fun <T> withTransaction(block: suspend () -> T): T = database.withTransaction(block)

    private fun listInternal(limit: String?): List<WorkoutSession> {
        database.readableDatabase.query(
            "workout_sessions",
            SESSION_COLUMNS,
            null,
            null,
            null,
            null,
            "started_at DESC",
            limit,
        ).use { cursor ->
            return buildList {
                while (cursor.moveToNext()) add(readSession(cursor))
            }
        }
    }

    override suspend fun save(session: WorkoutSession) {
        database.withTransaction { writeSession(database.writableDatabase, session) }
    }

    override suspend fun saveAll(sessions: List<WorkoutSession>) {
        if (sessions.isEmpty()) return
        database.withTransaction {
            val db = database.writableDatabase
            sessions.forEach { writeSession(db, it) }
        }
    }

    /** Controlled bridge for a previously exported Expo database payload. */
    suspend fun importNativeExport(json: String): Int {
        val sessions = NativeWorkoutImporter.importJson(json)
        saveAll(sessions)
        return sessions.size
    }

    private fun writeSession(
        db: android.database.sqlite.SQLiteDatabase,
        session: WorkoutSession,
    ) {
        db.delete("workout_sessions", "id = ?", arrayOf(session.id))
        db.insertOrThrow("workout_sessions", null, sessionValues(session))

        session.exercises.forEachIndexed { position, exercise ->
            db.insertOrThrow(
                "session_exercises",
                null,
                sessionExerciseValues(session.id, position, exercise),
            )
            exercise.sets.forEach { set ->
                db.insertOrThrow(
                    "logged_sets",
                    null,
                    loggedSetValues(exercise.id, set),
                )
            }
        }
    }

    private fun readSession(cursor: Cursor): WorkoutSession {
        val sessionId = cursor.requiredString("id")
        return WorkoutSession(
            id = sessionId,
            name = cursor.requiredString("name"),
            startedAtEpochMillis = cursor.requiredLong("started_at"),
            completedAtEpochMillis = cursor.nullableLong("completed_at"),
            bodyweight = cursor.nullableDouble("bodyweight"),
            bodyweightUnit = cursor.nullableEnum("bodyweight_unit", WeightUnit::valueOf),
            notes = cursor.nullableString("notes"),
            exercises = readExercises(sessionId),
        )
    }

    private fun readExercises(sessionId: String): List<SessionExercise> {
        database.readableDatabase.query(
            "session_exercises",
            EXERCISE_COLUMNS,
            "session_id = ?",
            arrayOf(sessionId),
            null,
            null,
            "position ASC",
        ).use { cursor ->
            return buildList {
                while (cursor.moveToNext()) {
                    val exerciseId = cursor.requiredString("id")
                    add(
                        SessionExercise(
                            id = exerciseId,
                            exercise = ExerciseDefinition(
                                id = cursor.requiredString("exercise_id"),
                                name = cursor.requiredString("exercise_name"),
                                type = ExerciseType.valueOf(cursor.requiredString("exercise_type")),
                                muscleGroup = cursor.nullableString("muscle_group"),
                                equipment = cursor.nullableString("equipment"),
                                notes = cursor.nullableString("exercise_notes"),
                                isArchived = cursor.requiredLong("is_archived") == 1L,
                            ),
                            plannedSetCount = cursor.requiredLong("planned_set_count").toInt(),
                            targetRepsMin = cursor.nullableLong("target_reps_min")?.toInt(),
                            targetRepsMax = cursor.nullableLong("target_reps_max")?.toInt(),
                            restSeconds = cursor.nullableLong("rest_seconds")?.toInt(),
                            restConfig = cursor.restConfig(),
                            progression = cursor.progressionRule(),
                            supersetGroup = cursor.nullableString("superset_group"),
                            notes = cursor.nullableString("notes"),
                            sets = readSets(exerciseId),
                        ),
                    )
                }
            }
        }
    }

    private fun readSets(sessionExerciseId: String): List<LoggedSet> {
        database.readableDatabase.query(
            "logged_sets",
            SET_COLUMNS,
            "session_exercise_id = ?",
            arrayOf(sessionExerciseId),
            null,
            null,
            "index_in_exercise ASC",
        ).use { cursor ->
            return buildList {
                while (cursor.moveToNext()) {
                    add(
                        LoggedSet(
                            id = cursor.requiredString("id"),
                            index = cursor.requiredLong("index_in_exercise").toInt(),
                            type = SetType.valueOf(cursor.requiredString("set_type")),
                            weight = cursor.nullableDouble("weight"),
                            weightUnit = cursor.nullableEnum("weight_unit", WeightUnit::valueOf),
                            reps = cursor.nullableLong("reps")?.toInt(),
                            bodyweight = cursor.nullableDouble("bodyweight"),
                            assistance = cursor.nullableDouble("assistance"),
                            durationSeconds = cursor.nullableLong("duration_seconds"),
                            distanceMeters = cursor.nullableDouble("distance_meters"),
                            rir = cursor.nullableDouble("rir"),
                            rpe = cursor.nullableDouble("rpe"),
                            completedAtEpochMillis = cursor.nullableLong("completed_at"),
                            notes = cursor.nullableString("notes"),
                        ),
                    )
                }
            }
        }
    }

    private fun sessionValues(session: WorkoutSession) = ContentValues().apply {
        put("id", session.id)
        put("name", session.name)
        put("started_at", session.startedAtEpochMillis)
        putNullable("completed_at", session.completedAtEpochMillis)
        putNullable("bodyweight", session.bodyweight)
        putNullable("bodyweight_unit", session.bodyweightUnit?.name)
        putNullable("notes", session.notes)
    }

    private fun sessionExerciseValues(
        sessionId: String,
        position: Int,
        exercise: SessionExercise,
    ) = ContentValues().apply {
        put("id", exercise.id)
        put("session_id", sessionId)
        put("position", position)
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

    private fun loggedSetValues(
        sessionExerciseId: String,
        set: LoggedSet,
    ) = ContentValues().apply {
        put("id", set.id)
        put("session_exercise_id", sessionExerciseId)
        put("index_in_exercise", set.index)
        put("set_type", set.type.name)
        putNullable("weight", set.weight)
        putNullable("weight_unit", set.weightUnit?.name)
        putNullable("reps", set.reps)
        putNullable("bodyweight", set.bodyweight)
        putNullable("assistance", set.assistance)
        putNullable("duration_seconds", set.durationSeconds)
        putNullable("distance_meters", set.distanceMeters)
        putNullable("rir", set.rir)
        putNullable("rpe", set.rpe)
        putNullable("completed_at", set.completedAtEpochMillis)
        putNullable("notes", set.notes)
    }

    private companion object {
        val SESSION_COLUMNS = arrayOf(
            "id",
            "name",
            "started_at",
            "completed_at",
            "bodyweight",
            "bodyweight_unit",
            "notes",
        )
        val EXERCISE_COLUMNS = arrayOf(
            "id",
            "session_id",
            "position",
            "exercise_id",
            "exercise_name",
            "exercise_type",
            "muscle_group",
            "equipment",
            "exercise_notes",
            "is_archived",
            "planned_set_count",
            "target_reps_min",
            "target_reps_max",
            "rest_seconds",
            "rest_max_seconds",
            "rest_failure_seconds",
            "progression_mode",
            "progression_increment",
            "progression_unit",
            "superset_group",
            "notes",
        )
        val SET_COLUMNS = arrayOf(
            "id",
            "session_exercise_id",
            "index_in_exercise",
            "set_type",
            "weight",
            "weight_unit",
            "reps",
            "bodyweight",
            "assistance",
            "duration_seconds",
            "distance_meters",
            "rir",
            "rpe",
            "completed_at",
            "notes",
        )
    }
}

private fun Cursor.requiredString(column: String): String =
    getString(getColumnIndexOrThrow(column))

private fun Cursor.nullableString(column: String): String? =
    getColumnIndexOrThrow(column).let { index -> if (isNull(index)) null else getString(index) }

private fun Cursor.requiredLong(column: String): Long =
    getLong(getColumnIndexOrThrow(column))

private fun Cursor.nullableLong(column: String): Long? =
    getColumnIndexOrThrow(column).let { index -> if (isNull(index)) null else getLong(index) }

private fun Cursor.nullableDouble(column: String): Double? =
    getColumnIndexOrThrow(column).let { index -> if (isNull(index)) null else getDouble(index) }

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

private fun <T : Enum<T>> Cursor.nullableEnum(
    column: String,
    parser: (String) -> T,
): T? = nullableString(column)?.let(parser)

private fun ContentValues.putNullable(key: String, value: String?) {
    if (value == null) putNull(key) else put(key, value)
}

private fun ContentValues.putNullable(key: String, value: Int?) {
    if (value == null) putNull(key) else put(key, value)
}

private fun ContentValues.putNullable(key: String, value: Long?) {
    if (value == null) putNull(key) else put(key, value)
}

private fun ContentValues.putNullable(key: String, value: Double?) {
    if (value == null) putNull(key) else put(key, value)
}
