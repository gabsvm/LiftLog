package com.liftlog.shared.domain

/** Storage is intentionally abstract until the SQLite migration is designed and tested. */
interface ExerciseRepository {
    suspend fun getById(id: String): ExerciseDefinition?
    suspend fun list(includeArchived: Boolean = false): List<ExerciseDefinition>
    suspend fun save(exercise: ExerciseDefinition)

    suspend fun saveAll(exercises: List<ExerciseDefinition>) {
        exercises.forEach { exercise -> save(exercise) }
    }
}

/** Optional capability used when a complete import must be all-or-nothing. */
interface TransactionalRepository {
    suspend fun <T> withTransaction(block: suspend () -> T): T
}

interface WorkoutSessionRepository {
    suspend fun getById(id: String): WorkoutSession?
    suspend fun list(limit: Int = 50): List<WorkoutSession>
    suspend fun listAll(): List<WorkoutSession> = list(Int.MAX_VALUE)
    suspend fun save(session: WorkoutSession)

    /** Implementations may override this to make a multi-session import atomic. */
    suspend fun saveAll(sessions: List<WorkoutSession>) {
        sessions.forEach { session -> save(session) }
    }
}

interface RoutineRepository {
    suspend fun getById(id: String): WorkoutRoutine?
    suspend fun list(limit: Int = 50): List<WorkoutRoutine>
    suspend fun listAll(): List<WorkoutRoutine> = list(Int.MAX_VALUE)
    suspend fun save(routine: WorkoutRoutine)
    suspend fun delete(id: String)

    /** Folder support is optional for early platform adapters. */
    suspend fun listFolders(limit: Int = 50): List<WorkoutTemplateFolder> = emptyList()
    suspend fun listAllFolders(): List<WorkoutTemplateFolder> = listFolders(Int.MAX_VALUE)
    suspend fun saveFolder(folder: WorkoutTemplateFolder) = Unit
    suspend fun deleteFolder(id: String) = Unit

    suspend fun saveAll(routines: List<WorkoutRoutine>) {
        routines.forEach { routine -> save(routine) }
    }
}
