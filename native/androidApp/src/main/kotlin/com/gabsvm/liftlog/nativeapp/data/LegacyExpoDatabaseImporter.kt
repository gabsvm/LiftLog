package com.gabsvm.liftlog.nativeapp.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import com.liftlog.shared.migration.NATIVE_WORKOUT_EXPORT_FORMAT
import com.liftlog.shared.migration.NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION
import com.liftlog.shared.migration.NativeExportExerciseType
import com.liftlog.shared.migration.NativeExportProgressionMode
import com.liftlog.shared.migration.NativeExportWeightUnit
import com.liftlog.shared.migration.NativeWorkoutExerciseDefinitionV1
import com.liftlog.shared.migration.NativeWorkoutExerciseV1
import com.liftlog.shared.migration.NativeWorkoutExportV1
import com.liftlog.shared.migration.NativeWorkoutRoutineExerciseV1
import com.liftlog.shared.migration.NativeWorkoutRoutineV1
import com.liftlog.shared.migration.NativeWorkoutSessionV1
import com.liftlog.shared.migration.NativeWorkoutSetV1
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Locale

/**
 * Reads the Expo/Drizzle database without modifying it. It is only used by a
 * production-package migration build on first launch; malformed legacy rows
 * are skipped rather than preventing the native app from opening.
 */
class LegacyExpoDatabaseImporter(
    private val context: Context,
) {
    fun readExport(): NativeWorkoutExportV1? {
        val databaseFile = context.getDatabasePath(LEGACY_DATABASE_NAME)
        if (!databaseFile.exists()) return null

        return runCatching {
            SQLiteDatabase.openDatabase(
                databaseFile.path,
                null,
                SQLiteDatabase.OPEN_READONLY,
            ).use { database ->
                val sessions = readSessions(database)
                val routines = readRoutines(database)
                val exercises = readExerciseLibrary(database)
                NativeWorkoutExportV1(
                    format = NATIVE_WORKOUT_EXPORT_FORMAT,
                    schemaVersion = NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION,
                    exportedAtEpochMillis = System.currentTimeMillis(),
                    sourceApplicationId = LEGACY_APPLICATION_ID,
                    sessions = sessions,
                    routines = routines,
                    exerciseLibrary = exercises,
                )
            }
        }.onFailure { error ->
            Log.w(TAG, "Could not read legacy Expo database; native app will start empty", error)
        }.getOrNull()
    }

    private fun readSessions(database: SQLiteDatabase): List<NativeWorkoutSessionV1> {
        if (!hasTable(database, "session")) return emptyList()
        return database.query("session", arrayOf("id", "payload"), null, null, null, null, null).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val id = cursor.getString(cursor.getColumnIndexOrThrow("id"))
                    val payload = cursor.getString(cursor.getColumnIndexOrThrow("payload"))
                    parseSession(id, payload)?.let(::add)
                }
            }
        }
    }

    private fun readRoutines(database: SQLiteDatabase): List<NativeWorkoutRoutineV1> {
        if (!hasTable(database, "program")) return emptyList()
        return database.query("program", arrayOf("id", "payload"), null, null, null, null, null).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val id = cursor.getString(cursor.getColumnIndexOrThrow("id"))
                    val payload = cursor.getString(cursor.getColumnIndexOrThrow("payload"))
                    parseProgram(id, payload)?.let { routines -> addAll(routines) }
                }
            }
        }
    }

    private fun readExerciseLibrary(database: SQLiteDatabase): List<NativeWorkoutExerciseDefinitionV1> {
        if (!hasTable(database, "exercise")) return emptyList()
        return database.query("exercise", arrayOf("id", "payload"), null, null, null, null, null).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val id = cursor.getString(cursor.getColumnIndexOrThrow("id"))
                    val payload = cursor.getString(cursor.getColumnIndexOrThrow("payload"))
                    parseExerciseDescriptor(id, payload)?.let(::add)
                }
            }
        }
    }

    private fun parseSession(id: String, payload: String): NativeWorkoutSessionV1? = runCatching {
        val root = jsonObject(payload)
        val blueprint = root.objectValue("blueprint") ?: return null
        val name = blueprint.stringValue("name") ?: return null
        val date = root.stringValue("date") ?: return null
        val recordedExercises = root.arrayValue("recordedExercises") ?: JsonArray(emptyList())
        val exercises = recordedExercises.mapIndexedNotNull { index, element ->
            parseRecordedExercise(id, index, element.jsonObject)
        }
        val completion = exercises.flatMap { exercise ->
            exercise.sets.mapNotNull(NativeWorkoutSetV1::completedAtEpochMillis)
        }.maxOrNull()
        NativeWorkoutSessionV1(
            id = id,
            name = name,
            startedAtEpochMillis = LocalDate.parse(date).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
            completedAtEpochMillis = completion,
            bodyweight = root.objectValue("bodyweight")?.numberValue("value"),
            bodyweightUnit = root.objectValue("bodyweight")?.weightUnit(),
            notes = blueprint.stringValue("notes"),
            exercises = exercises,
        )
    }.onFailure { error ->
        Log.w(TAG, "Skipping legacy session $id", error)
    }.getOrNull()

    private fun parseProgram(id: String, payload: String): List<NativeWorkoutRoutineV1>? = runCatching {
        val root = jsonObject(payload)
        val name = root.stringValue("name") ?: return null
        val sessions = root.arrayValue("sessions") ?: return emptyList()
        val now = System.currentTimeMillis()
        sessions.mapIndexed { index, element ->
            val session = element.jsonObject
            val routineId = "legacy:$id:session:$index"
            NativeWorkoutRoutineV1(
                id = routineId,
                name = "$name · ${session.stringValue("name") ?: "Sesión ${index + 1}"}",
                description = session.stringValue("notes"),
                createdAtEpochMillis = now,
                updatedAtEpochMillis = now,
                exercises = (session.arrayValue("exercises") ?: JsonArray(emptyList()))
                    .mapIndexedNotNull { exerciseIndex, exercise ->
                        parseRoutineExercise(routineId, exerciseIndex, exercise.jsonObject)
                    },
            )
        }
    }.onFailure { error ->
        Log.w(TAG, "Skipping legacy program $id", error)
    }.getOrNull()

    private fun parseRecordedExercise(
        sessionId: String,
        index: Int,
        root: JsonObject,
    ): NativeWorkoutExerciseV1? {
        val blueprint = root.objectValue("blueprint") ?: return null
        val name = blueprint.stringValue("name") ?: return null
        val id = "$sessionId:exercise:$index"
        return when (root.stringValue("type")) {
            "RecordedWeightedExercise" -> {
                val potentialSets = root.arrayValue("potentialSets") ?: JsonArray(emptyList())
                val rest = blueprint.objectValue("restBetweenSets")
                NativeWorkoutExerciseV1(
                    id = id,
                    exerciseId = stableExerciseId(name),
                    name = name,
                    type = NativeExportExerciseType.WEIGHT_REPS,
                    plannedSetCount = potentialSets.size,
                    targetRepsMin = blueprint.intValue("repsPerSet"),
                    targetRepsMax = blueprint.intValue("repsPerSet"),
                    restSeconds = durationSeconds(rest?.stringValue("minRest")),
                    restMinSeconds = durationSeconds(rest?.stringValue("minRest")),
                    restMaxSeconds = durationSeconds(rest?.stringValue("maxRest")),
                    restFailureSeconds = durationSeconds(rest?.stringValue("failureRest")),
                    progressionMode = progressionMode(blueprint.objectValue("progressiveOverload")),
                    progressionIncrement = blueprint.objectValue("progressiveOverload")?.elementNumber("amount"),
                    progressionUnit = NativeExportWeightUnit.KILOGRAMS,
                    notes = root.stringValue("notes") ?: blueprint.stringValue("notes"),
                    sets = potentialSets.mapIndexed { setIndex, element ->
                        val potentialSet = element.jsonObject
                        val weight = potentialSet.objectValue("weight")
                        val recorded = potentialSet.objectValue("set")
                        NativeWorkoutSetV1(
                            id = "$id:set:$setIndex",
                            index = setIndex,
                            weight = weight?.numberValue("value"),
                            weightUnit = weight?.weightUnit(),
                            reps = recorded?.intValue("repsCompleted"),
                            completedAtEpochMillis = parseEpoch(recorded?.stringValue("completionDateTime")),
                        )
                    },
                )
            }
            "RecordedCardioExercise" -> {
                val sets = root.arrayValue("sets") ?: JsonArray(emptyList())
                NativeWorkoutExerciseV1(
                    id = id,
                    exerciseId = stableExerciseId(name),
                    name = name,
                    type = NativeExportExerciseType.CARDIO,
                    plannedSetCount = sets.size,
                    notes = root.stringValue("notes") ?: blueprint.stringValue("notes"),
                    sets = sets.mapIndexed { setIndex, element ->
                        val set = element.jsonObject
                        val distance = set.objectValue("distance")
                        NativeWorkoutSetV1(
                            id = "$id:set:$setIndex",
                            index = setIndex,
                            durationSeconds = durationSeconds(set.stringValue("duration"))?.toLong(),
                            distanceMeters = distance?.numberValue("value")?.let {
                                distanceToMeters(it, distance.stringValue("unit"))
                            },
                            weight = set.objectValue("weight")?.numberValue("value"),
                            weightUnit = set.objectValue("weight")?.weightUnit(),
                            assistance = set.numberValue("resistance"),
                            completedAtEpochMillis = parseEpoch(set.stringValue("completionDateTime")),
                        )
                    },
                )
            }
            else -> null
        }
    }

    private fun parseRoutineExercise(
        routineId: String,
        index: Int,
        root: JsonObject,
    ): NativeWorkoutRoutineExerciseV1? {
        val type = root.stringValue("type") ?: return null
        val name = root.stringValue("name") ?: return null
        val id = "$routineId:exercise:$index"
        val rest = root.objectValue("restBetweenSets")
        return NativeWorkoutRoutineExerciseV1(
            id = id,
            position = index,
            exerciseId = stableExerciseId(name),
            name = name,
            type = if (type == "WeightedExerciseBlueprint") NativeExportExerciseType.WEIGHT_REPS else NativeExportExerciseType.CARDIO,
            plannedSetCount = root.intValue("sets") ?: root.arrayValue("sets")?.size ?: 0,
            targetRepsMin = root.intValue("repsPerSet"),
            targetRepsMax = root.intValue("repsPerSet"),
            restSeconds = durationSeconds(rest?.stringValue("minRest")),
            restMinSeconds = durationSeconds(rest?.stringValue("minRest")),
            restMaxSeconds = durationSeconds(rest?.stringValue("maxRest")),
            restFailureSeconds = durationSeconds(rest?.stringValue("failureRest")),
            progressionMode = progressionMode(root.objectValue("progressiveOverload")),
            progressionIncrement = root.objectValue("progressiveOverload")?.elementNumber("amount"),
            progressionUnit = NativeExportWeightUnit.KILOGRAMS,
            notes = root.stringValue("notes"),
        )
    }

    private fun parseExerciseDescriptor(id: String, payload: String): NativeWorkoutExerciseDefinitionV1? = runCatching {
        val root = jsonObject(payload)
        NativeWorkoutExerciseDefinitionV1(
            id = stableExerciseId(id),
            name = root.stringValue("name") ?: return null,
            type = NativeExportExerciseType.WEIGHT_REPS,
            muscleGroup = root.arrayValue("muscles")?.joinToString(", "),
            equipment = root.stringValue("equipment"),
            notes = root.stringValue("instructions"),
        )
    }.getOrNull()

    private fun progressionMode(root: JsonObject?): NativeExportProgressionMode? = when (root?.stringValue("type")) {
        "IncreaseAllEvenlyProgressiveOverload" -> NativeExportProgressionMode.INCREASE_ALL
        "IncreaseLowestSetProgressiveOverload" -> NativeExportProgressionMode.INCREASE_LOWEST
        else -> null
    }

    private fun hasTable(database: SQLiteDatabase, table: String): Boolean =
        database.rawQuery(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            arrayOf(table),
        ).use { it.moveToFirst() }

    private fun jsonObject(payload: String): JsonObject =
        kotlinx.serialization.json.Json.parseToJsonElement(payload).jsonObject

    private fun durationSeconds(value: String?): Int? = value?.let {
        runCatching { Duration.parse(it).seconds.toInt() }.getOrNull()
    }

    private fun parseEpoch(value: String?): Long? = value?.let {
        runCatching { OffsetDateTime.parse(it).toInstant().toEpochMilli() }
            .recoverCatching { Instant.parse(value).toEpochMilli() }
            .getOrNull()
    }

    private fun distanceToMeters(value: Double, unit: String?): Double = when (unit) {
        "yard" -> value * 0.9144
        "mile" -> value * 1609.344
        "kilometre" -> value * 1000.0
        else -> value
    }

    private fun stableExerciseId(value: String): String =
        "legacy:" + value.lowercase(Locale.US).replace(Regex("[^a-z0-9]+"), "-").trim('-')

    private fun JsonObject.stringValue(key: String): String? =
        this[key]?.jsonPrimitive?.contentOrNull

    private fun JsonObject.intValue(key: String): Int? =
        this[key]?.jsonPrimitive?.intOrNull

    private fun JsonObject.numberValue(key: String): Double? =
        this[key]?.jsonPrimitive?.doubleOrNull ?: this[key]?.jsonPrimitive?.contentOrNull?.toDoubleOrNull()

    private fun JsonObject.elementNumber(key: String): Double? =
        this[key]?.jsonPrimitive?.doubleOrNull ?: this[key]?.jsonPrimitive?.contentOrNull?.toDoubleOrNull()

    private fun JsonObject.objectValue(key: String): JsonObject? = this[key]?.jsonObject

    private fun JsonObject.arrayValue(key: String): JsonArray? = this[key]?.jsonArray

    private fun JsonObject.weightUnit(): NativeExportWeightUnit? = when (stringValue("unit")) {
        "kilograms" -> NativeExportWeightUnit.KILOGRAMS
        "pounds" -> NativeExportWeightUnit.POUNDS
        else -> null
    }

    private companion object {
        const val LEGACY_DATABASE_NAME = "db.db"
        const val LEGACY_APPLICATION_ID = "com.gabsvm.gainslab"
        const val TAG = "LiftLogLegacyImport"
    }
}
