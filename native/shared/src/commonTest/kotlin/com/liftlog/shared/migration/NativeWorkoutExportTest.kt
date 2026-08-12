package com.liftlog.shared.migration

import com.liftlog.shared.domain.ExerciseType
import com.liftlog.shared.domain.sampleWorkoutSession
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class NativeWorkoutExportTest {
    @Test
    fun importsVersionedExportIntoSharedDomain() {
        val sessions = NativeWorkoutImporter.importExport(
            NativeWorkoutExportV1(
                format = NATIVE_WORKOUT_EXPORT_FORMAT,
                schemaVersion = NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION,
                exportedAtEpochMillis = 1_700_000_000_000,
                sourceApplicationId = "com.gabsvm.gainslab",
                sessions = listOf(
                    NativeWorkoutSessionV1(
                        id = "session-1",
                        name = "Upper body",
                        startedAtEpochMillis = 1_700_000_000_000,
                        bodyweight = 80.0,
                        bodyweightUnit = NativeExportWeightUnit.KILOGRAMS,
                        exercises = listOf(
                            NativeWorkoutExerciseV1(
                                id = "session-1:exercise:0",
                                exerciseId = "bench-press",
                                name = "Bench press",
                                type = NativeExportExerciseType.WEIGHT_REPS,
                                plannedSetCount = 2,
                                targetRepsMin = 8,
                                targetRepsMax = 10,
                                sets = listOf(
                                    NativeWorkoutSetV1(
                                        id = "session-1:exercise:0:set:0",
                                        index = 0,
                                        weight = 60.0,
                                        weightUnit = NativeExportWeightUnit.KILOGRAMS,
                                        reps = 10,
                                        completedAtEpochMillis = 1_700_000_060_000,
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        )

        val session = sessions.single()
        val exercise = session.exercises.single()
        val set = exercise.sets.single()

        assertEquals("session-1", session.id)
        assertEquals("Upper body", session.name)
        assertEquals(80.0, session.bodyweight)
        assertEquals(1, session.exercises.size)
        assertEquals("Bench press", exercise.exercise.name)
        assertEquals(10, set.reps)
        assertEquals(60.0, set.weight)
        assertEquals(1_700_000_060_000, set.completedAtEpochMillis)
    }

    @Test
    fun decodesTransportJson() {
        val sessions = NativeWorkoutImporter.importJson(
            """
            {
              "format": "liftlog.native.workouts",
              "schemaVersion": 1,
              "exportedAtEpochMillis": 1700000000000,
              "sourceApplicationId": "com.gabsvm.gainslab",
              "sessions": [
                {
                  "id": "session-1",
                  "name": "Cardio",
                  "startedAtEpochMillis": 1700000000000,
                  "exercises": [
                    {
                      "id": "session-1:exercise:0",
                      "exerciseId": "run",
                      "name": "Run",
                      "type": "CARDIO",
                      "sets": []
                    }
                  ]
                }
              ]
            }
            """.trimIndent(),
        )

        assertEquals("Cardio", sessions.single().name)
        assertEquals(ExerciseType.CARDIO, sessions.single().exercises.single().exercise.type)
    }

    @Test
    fun rejectsWrongFormatAndDuplicateSessions() {
        assertFailsWith<IllegalArgumentException> {
            NativeWorkoutImporter.importExport(
                NativeWorkoutExportV1(
                    format = "other.format",
                    schemaVersion = NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION,
                    exportedAtEpochMillis = 1,
                ),
            )
        }

        val duplicate = NativeWorkoutSessionV1(
            id = "duplicate",
            name = "Session",
            startedAtEpochMillis = 1,
        )
        assertFailsWith<IllegalArgumentException> {
            NativeWorkoutImporter.importExport(
                NativeWorkoutExportV1(
                    format = NATIVE_WORKOUT_EXPORT_FORMAT,
                    schemaVersion = NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION,
                    exportedAtEpochMillis = 1,
                    sessions = listOf(duplicate, duplicate),
                ),
            )
        }
    }

    @Test
    fun exportsAndImportsTheSameCoreSession() {
        val original = sampleWorkoutSession()
        val json = NativeWorkoutExporter.encode(
            sessions = listOf(original),
            exportedAtEpochMillis = 1_700_000_000_000,
        )

        val restored = NativeWorkoutImporter.importJson(json).single()

        assertEquals(original.id, restored.id)
        assertEquals(original.name, restored.name)
        assertEquals(original.exercises.size, restored.exercises.size)
        assertEquals(original.exercises.first().sets.size, restored.exercises.first().sets.size)
        assertEquals(original.exercises.first().sets.first().weight, restored.exercises.first().sets.first().weight)
    }

    @Test
    fun preservesRoutineAndExerciseLibraryInBundle() {
        val export = NativeWorkoutExportV1(
            format = NATIVE_WORKOUT_EXPORT_FORMAT,
            schemaVersion = NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION,
            exportedAtEpochMillis = 1_700_000_000_000,
            routines = listOf(
                NativeWorkoutRoutineV1(
                    id = "routine-1",
                    name = "Full body",
                    createdAtEpochMillis = 1,
                    updatedAtEpochMillis = 2,
                    exercises = listOf(
                        NativeWorkoutRoutineExerciseV1(
                            id = "routine-1-exercise-1",
                            position = 0,
                            exerciseId = "deadlift",
                            name = "Deadlift",
                            type = NativeExportExerciseType.WEIGHT_REPS,
                            plannedSetCount = 3,
                        ),
                    ),
                ),
            ),
            exerciseLibrary = listOf(
                NativeWorkoutExerciseDefinitionV1(
                    id = "custom-run",
                    name = "Run",
                    type = NativeExportExerciseType.CARDIO,
                ),
            ),
        )

        val bundle = NativeWorkoutImporter.importBundle(export)

        assertEquals("Full body", bundle.routines.single().name)
        assertEquals("Deadlift", bundle.routines.single().exercises.single().exercise.name)
        assertEquals("Run", bundle.exerciseLibrary.single().name)
    }
}
