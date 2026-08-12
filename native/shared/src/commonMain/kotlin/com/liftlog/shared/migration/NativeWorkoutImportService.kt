package com.liftlog.shared.migration

import com.liftlog.shared.domain.ExerciseRepository
import com.liftlog.shared.domain.RoutineRepository
import com.liftlog.shared.domain.WorkoutSessionRepository

data class NativeWorkoutImportResult(
    val importedSessions: Int,
    val importedRoutines: Int = 0,
    val importedExercises: Int = 0,
    val settings: NativeWorkoutSettingsV1? = null,
)

/** Validates and persists a complete export through the shared repository contract. */
class NativeWorkoutImportService(
    private val repository: WorkoutSessionRepository,
    private val routineRepository: RoutineRepository? = null,
    private val exerciseRepository: ExerciseRepository? = null,
) {
    suspend fun importJson(jsonText: String): NativeWorkoutImportResult {
        return importExport(NativeWorkoutImporter.decode(jsonText))
    }

    suspend fun importExport(export: NativeWorkoutExportV1): NativeWorkoutImportResult {
        val bundle = NativeWorkoutImporter.importBundle(export)
        repository.saveAll(bundle.sessions)
        routineRepository?.let { folders ->
            for (folder in bundle.folders) folders.saveFolder(folder)
        }
        routineRepository?.saveAll(bundle.routines)
        exerciseRepository?.saveAll(bundle.exerciseLibrary)
        return NativeWorkoutImportResult(
            importedSessions = bundle.sessions.size,
            importedRoutines = bundle.routines.size,
            importedExercises = bundle.exerciseLibrary.size,
            settings = bundle.settings,
        )
    }
}
