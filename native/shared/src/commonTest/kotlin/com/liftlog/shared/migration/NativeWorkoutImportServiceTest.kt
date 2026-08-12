package com.liftlog.shared.migration

import com.liftlog.shared.domain.ExerciseDefinition
import com.liftlog.shared.domain.ExerciseRepository
import com.liftlog.shared.domain.RoutineRepository
import com.liftlog.shared.domain.TransactionalRepository
import com.liftlog.shared.domain.WorkoutRoutine
import com.liftlog.shared.domain.WorkoutSession
import com.liftlog.shared.domain.WorkoutSessionRepository
import com.liftlog.shared.domain.WorkoutTemplateFolder
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.runBlocking

class NativeWorkoutImportServiceTest {
    @Test
    fun completeImportRunsInsideTheTransactionalRepositoryBoundary() = runBlocking {
        val sessions = FakeSessions()
        val routines = FakeRoutines()
        val exercises = FakeExercises()
        val service = NativeWorkoutImportService(sessions, routines, exercises)

        val result = service.importExport(
            NativeWorkoutExportV1(
                format = NATIVE_WORKOUT_EXPORT_FORMAT,
                schemaVersion = NATIVE_WORKOUT_EXPORT_SCHEMA_VERSION,
                exportedAtEpochMillis = 1,
                sessions = listOf(
                    NativeWorkoutSessionV1(
                        id = "session-1",
                        name = "Upper body",
                        startedAtEpochMillis = 1,
                    ),
                ),
            ),
        )

        assertEquals(1, sessions.transactionCalls)
        assertEquals(1, result.importedSessions)
        assertEquals(1, sessions.values.size)
    }
}

private class FakeSessions : WorkoutSessionRepository, TransactionalRepository {
    val values = mutableListOf<WorkoutSession>()
    var transactionCalls = 0

    override suspend fun <T> withTransaction(block: suspend () -> T): T {
        transactionCalls++
        return block()
    }

    override suspend fun getById(id: String): WorkoutSession? = values.firstOrNull { it.id == id }
    override suspend fun list(limit: Int): List<WorkoutSession> = values.take(limit)
    override suspend fun save(session: WorkoutSession) {
        values.removeAll { it.id == session.id }
        values += session
    }
}

private class FakeRoutines : RoutineRepository {
    override suspend fun getById(id: String): WorkoutRoutine? = null
    override suspend fun list(limit: Int): List<WorkoutRoutine> = emptyList()
    override suspend fun save(routine: WorkoutRoutine) = Unit
    override suspend fun delete(id: String) = Unit
}

private class FakeExercises : ExerciseRepository {
    override suspend fun getById(id: String): ExerciseDefinition? = null
    override suspend fun list(includeArchived: Boolean): List<ExerciseDefinition> = emptyList()
    override suspend fun save(exercise: ExerciseDefinition) = Unit
}
