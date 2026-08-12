package com.gabsvm.liftlog.nativeapp.ui

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.gabsvm.liftlog.nativeapp.RestTimerService
import com.gabsvm.liftlog.nativeapp.HealthConnectBridge
import com.gabsvm.liftlog.nativeapp.data.LegacyExpoDatabaseImporter
import com.gabsvm.liftlog.nativeapp.data.DefaultWorkoutRoutines
import com.gabsvm.liftlog.nativeapp.data.SupabaseBackupClient
import com.liftlog.shared.domain.LoggedSet
import com.liftlog.shared.domain.ExerciseDefinition
import com.liftlog.shared.domain.ExerciseRepository
import com.liftlog.shared.domain.ExerciseType
import com.liftlog.shared.domain.SessionExercise
import com.liftlog.shared.domain.WorkoutRoutine
import com.liftlog.shared.domain.WorkoutSession
import com.liftlog.shared.domain.WorkoutTemplateFolder
import com.liftlog.shared.domain.WorkoutSessionRepository
import com.liftlog.shared.domain.RoutineRepository
import com.liftlog.shared.domain.toRoutine
import com.liftlog.shared.domain.toSession
import com.liftlog.shared.migration.NativeWorkoutExporter
import com.liftlog.shared.migration.NativeWorkoutImportService
import com.liftlog.shared.migration.NativeWorkoutSettingsV1
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

data class WorkoutUiState(
    val isLoading: Boolean = true,
    val sessions: List<WorkoutSession> = emptyList(),
    val routines: List<WorkoutRoutine> = emptyList(),
    val templateFolders: List<WorkoutTemplateFolder> = emptyList(),
    val exercises: List<ExerciseDefinition> = emptyList(),
    val selectedSessionId: String? = null,
    val isImporting: Boolean = false,
    val isExporting: Boolean = false,
    val infoMessage: String? = null,
    val error: String? = null,
)

data class RestTimerUiState(
    val endEpochMillis: Long? = null,
    val remainingSeconds: Long = 0,
    val sourceExerciseId: String? = null,
) {
    val isRunning: Boolean get() = remainingSeconds > 0 && endEpochMillis != null
}

data class NativeSettingsUiState(
    val defaultRestSeconds: Int = 90,
    val cloudConfigured: Boolean = false,
    val cloudEmail: String? = null,
    val cloudBusy: Boolean = false,
    val cloudMessage: String? = null,
)

class WorkoutViewModel(
    private val repository: WorkoutSessionRepository,
    private val routineRepository: RoutineRepository,
    private val exerciseRepository: ExerciseRepository,
    applicationContext: Context,
    private val legacyImporter: LegacyExpoDatabaseImporter? = null,
) : ViewModel() {
    private val _uiState = MutableStateFlow(WorkoutUiState())
    val uiState: StateFlow<WorkoutUiState> = _uiState.asStateFlow()
    private val appContext = applicationContext.applicationContext
    private val healthConnectBridge = HealthConnectBridge(appContext)
    private val supabaseClient = SupabaseBackupClient(appContext)
    private val preferences = appContext.getSharedPreferences(REST_TIMER_PREFS, Context.MODE_PRIVATE)
    private val migrationPreferences = appContext.getSharedPreferences(MIGRATION_PREFS, Context.MODE_PRIVATE)
    private val _settings = MutableStateFlow(
        NativeSettingsUiState(
            defaultRestSeconds = preferences.getInt(DEFAULT_REST_SECONDS_KEY, 90).coerceIn(1, 3600),
            cloudConfigured = supabaseClient.state().configured,
            cloudEmail = supabaseClient.state().email,
        ),
    )
    val settings: StateFlow<NativeSettingsUiState> = _settings.asStateFlow()
    private val _restTimer = MutableStateFlow(readRestTimer())
    val restTimer: StateFlow<RestTimerUiState> = _restTimer.asStateFlow()
    private val saveMutex = Mutex()
    private val importService = NativeWorkoutImportService(repository, routineRepository, exerciseRepository)
    private var pendingSession: WorkoutSession? = null
    private var persistJob: Job? = null

    init {
        loadSessions()
        viewModelScope.launch {
            while (isActive) {
                refreshRestTimer()
                delay(500)
            }
        }
    }

    fun startRestTimer(
        durationSeconds: Int = _settings.value.defaultRestSeconds,
        sourceExerciseId: String? = null,
    ) {
        val duration = durationSeconds.coerceIn(1, 60 * 60)
        val end = System.currentTimeMillis() + duration * 1000L
        preferences.edit()
            .putLong(REST_TIMER_END_KEY, end)
            .putString(REST_TIMER_SOURCE_EXERCISE_KEY, sourceExerciseId)
            .apply()
        _restTimer.value = RestTimerUiState(end, duration.toLong(), sourceExerciseId)
        val intent = Intent(appContext, RestTimerService::class.java).apply {
            action = RestTimerService.ACTION_START
            putExtra(RestTimerService.EXTRA_END_EPOCH_MILLIS, end)
        }
        appContext.startForegroundService(intent)
    }

    fun saveDefaultRestSeconds(seconds: Int) {
        val normalized = seconds.coerceIn(1, 3600)
        preferences.edit().putInt(DEFAULT_REST_SECONDS_KEY, normalized).apply()
        _settings.value = _settings.value.copy(defaultRestSeconds = normalized)
    }

    fun signInCloud(email: String, password: String, createAccount: Boolean = false) {
        runCloudOperation {
            if (createAccount) supabaseClient.signUp(email, password) else supabaseClient.signIn(email, password)
            "Cuenta conectada"
        }
    }

    fun signOutCloud() {
        supabaseClient.signOut()
        _settings.value = _settings.value.copy(cloudEmail = null, cloudMessage = "Sesión cerrada")
    }

    fun uploadCloudBackup() {
        runCloudOperation {
            val snapshot = readCompleteRepositorySnapshot()
            val json = withContext(Dispatchers.Default) {
                NativeWorkoutExporter.encode(
                    sessions = snapshot.sessions,
                    exportedAtEpochMillis = System.currentTimeMillis(),
                    routines = snapshot.routines,
                    folders = snapshot.folders,
                    exerciseLibrary = snapshot.exercises,
                    settings = NativeWorkoutSettingsV1(_settings.value.defaultRestSeconds),
                )
            }
            val hash = withContext(Dispatchers.IO) { supabaseClient.uploadBackup(json) }
            "Backup remoto subido ($hash)"
        }
    }

    fun restoreCloudBackup() {
        viewModelScope.launch {
            _settings.value = _settings.value.copy(cloudBusy = true, cloudMessage = null)
            runCatching {
                val result = withContext(Dispatchers.IO) {
                    val json = supabaseClient.downloadLatestBackup()
                        ?: error("No hay backups remotos disponibles")
                    saveMutex.withLock { importService.importJson(json) }
                }
                result.settings?.defaultRestSeconds?.let(::saveDefaultRestSeconds)
                val data = withContext(Dispatchers.IO) { readRepositoryData() }
                _uiState.value = _uiState.value.copy(
                    sessions = data.first,
                    routines = data.second.first,
                    templateFolders = data.second.second.first,
                    exercises = data.second.second.second,
                    selectedSessionId = null,
                )
                _settings.value = _settings.value.copy(
                    cloudBusy = false,
                    cloudEmail = supabaseClient.state().email,
                    cloudMessage = "Backup remoto restaurado",
                )
            }.onFailure { error ->
                _settings.value = _settings.value.copy(
                    cloudBusy = false,
                    cloudMessage = error.message ?: "No se pudo restaurar el backup remoto",
                )
            }
        }
    }

    private fun runCloudOperation(operation: suspend () -> String) {
        viewModelScope.launch {
            _settings.value = _settings.value.copy(cloudBusy = true, cloudMessage = null)
            runCatching { withContext(Dispatchers.IO) { operation() } }
                .onSuccess { message ->
                    _settings.value = _settings.value.copy(
                        cloudBusy = false,
                        cloudEmail = supabaseClient.state().email,
                        cloudMessage = message,
                    )
                }
                .onFailure { error ->
                    _settings.value = _settings.value.copy(
                        cloudBusy = false,
                        cloudMessage = error.message ?: "No se pudo completar la operación remota",
                    )
                }
        }
    }

    fun stopRestTimer() {
        preferences.edit()
            .remove(REST_TIMER_END_KEY)
            .remove(REST_TIMER_SOURCE_EXERCISE_KEY)
            .apply()
        _restTimer.value = RestTimerUiState()
        appContext.stopService(Intent(appContext, RestTimerService::class.java))
    }

    fun isHealthConnectAvailable(): Boolean = healthConnectBridge.isAvailable()

    fun exportSessionToHealthConnect(sessionId: String) {
        val session = _uiState.value.sessions.firstOrNull { it.id == sessionId } ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(error = null, infoMessage = null)
            runCatching {
                withContext(Dispatchers.IO) { healthConnectBridge.exportSession(session) }
            }.onSuccess { recordCount ->
                _uiState.value = _uiState.value.copy(
                    infoMessage = "Health Connect: $recordCount registros exportados",
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    error = error.message ?: "No se pudo exportar a Health Connect",
                )
            }
        }
    }

    fun openSession(sessionId: String) {
        if (_uiState.value.sessions.any { it.id == sessionId }) {
            _uiState.value = _uiState.value.copy(
                selectedSessionId = sessionId,
                error = null,
                infoMessage = null,
            )
        }
    }

    fun createEmptySession() {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val now = System.currentTimeMillis()
                    val session = WorkoutSession(
                        id = "native-session-$now",
                        name = "New workout",
                        startedAtEpochMillis = now,
                    )
                    saveMutex.withLock { repository.save(session) }
                    session
                }
            }.onSuccess { session ->
                _uiState.value = _uiState.value.copy(
                    sessions = listOf(session) + _uiState.value.sessions,
                    selectedSessionId = session.id,
                    error = null,
                    infoMessage = null,
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(error = error.message ?: "No se pudo crear la sesión")
            }
        }
    }

    fun addExerciseToSession(exerciseId: String) {
        val current = selectedSession() ?: return
        val exercise = _uiState.value.exercises.firstOrNull { it.id == exerciseId } ?: return
        val sessionExerciseId = "${current.id}:exercise:${System.currentTimeMillis()}"
        val prefilledSets = prefilledSets(
            sessionExerciseId = sessionExerciseId,
            exerciseId = exercise.id,
            sessionIdToExclude = current.id,
            count = 3,
        )
        val updatedExercise = SessionExercise(
            id = sessionExerciseId,
            exercise = exercise,
            plannedSetCount = 3,
            sets = prefilledSets,
        )
        val updated = current.copy(exercises = current.exercises + updatedExercise)
        _uiState.value = _uiState.value.copy(sessions = replaceSession(updated), error = null)
        persist(updated)
    }

    fun removeExerciseFromSession(sessionExerciseId: String) {
        val current = selectedSession() ?: return
        if (current.exercises.none { it.id == sessionExerciseId }) return
        val updated = current.copy(
            exercises = current.exercises.filterNot { it.id == sessionExerciseId },
        )
        _uiState.value = _uiState.value.copy(sessions = replaceSession(updated), error = null)
        persist(updated)
    }

    fun updateSessionExerciseNotes(sessionExerciseId: String, notes: String) {
        val current = selectedSession() ?: return
        val normalized = notes.trim().takeIf { it.isNotBlank() }
        if (current.exercises.none { it.id == sessionExerciseId }) return
        val updated = current.copy(
            exercises = current.exercises.map { exercise ->
                if (exercise.id == sessionExerciseId) exercise.copy(notes = normalized) else exercise
            },
        )
        _uiState.value = _uiState.value.copy(sessions = replaceSession(updated), error = null)
        persist(updated)
    }

    fun updateSessionName(name: String) {
        val current = selectedSession() ?: return
        val normalized = name.trim()
        if (normalized.isBlank() || normalized == current.name) return
        val updated = current.copy(name = normalized)
        _uiState.value = _uiState.value.copy(sessions = replaceSession(updated), error = null)
        persist(updated)
    }

    fun pairExercises(firstExerciseId: String, secondExerciseId: String) {
        val current = selectedSession() ?: return
        if (firstExerciseId == secondExerciseId) return
        val first = current.exercises.firstOrNull { it.id == firstExerciseId } ?: return
        val second = current.exercises.firstOrNull { it.id == secondExerciseId } ?: return
        val firstGroup = first.supersetGroup
        val secondGroup = second.supersetGroup
        val groupId = firstGroup ?: secondGroup ?: "superset-${System.currentTimeMillis()}"
        val groupsToMerge = setOfNotNull(firstGroup, secondGroup)
        val updated = current.copy(
            exercises = current.exercises.map { exercise ->
                if (exercise.id == first.id || exercise.id == second.id ||
                    (exercise.supersetGroup != null && exercise.supersetGroup in groupsToMerge)
                ) {
                    exercise.copy(supersetGroup = groupId)
                } else {
                    exercise
                }
            },
        )
        _uiState.value = _uiState.value.copy(sessions = replaceSession(updated), error = null)
        persist(updated)
    }

    fun unpairExercise(sessionExerciseId: String) {
        val current = selectedSession() ?: return
        val exercise = current.exercises.firstOrNull { it.id == sessionExerciseId } ?: return
        val group = exercise.supersetGroup ?: return
        val members = current.exercises.filter { it.supersetGroup == group }
        val updated = current.copy(
            exercises = current.exercises.map { candidate ->
                if (candidate.id == exercise.id || members.size <= 2 && candidate.supersetGroup == group) {
                    candidate.copy(supersetGroup = null)
                } else {
                    candidate
                }
            },
        )
        _uiState.value = _uiState.value.copy(sessions = replaceSession(updated), error = null)
        persist(updated)
    }

    fun closeSession() {
        _uiState.value = _uiState.value.copy(
            selectedSessionId = null,
            error = null,
        )
    }

    fun completeSession() {
        val current = selectedSession() ?: return
        val completed = current.copy(completedAtEpochMillis = System.currentTimeMillis())
        _uiState.value = _uiState.value.copy(sessions = replaceSession(completed), error = null)
        persist(completed)
    }

    fun saveRoutineFromSession(sessionId: String, nameOverride: String? = null, folderId: String? = null) {
        val session = _uiState.value.sessions.firstOrNull { it.id == sessionId } ?: return
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    saveMutex.withLock {
                        routineRepository.save(
                            session.toRoutine(
                                routineId = "routine-${session.id}",
                                nowEpochMillis = System.currentTimeMillis(),
                            ).copy(
                                name = nameOverride?.trim()?.takeIf { it.isNotBlank() } ?: session.name,
                                folderId = folderId,
                            ),
                        )
                    }
                    routineRepository.list(MAX_ROUTINES) to routineRepository.listFolders(MAX_FOLDERS)
                }
            }.onSuccess { (routines, folders) ->
                _uiState.value = _uiState.value.copy(
                    routines = routines,
                    templateFolders = folders,
                    infoMessage = "Rutina guardada",
                    error = null,
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    error = error.message ?: "No se pudo guardar la rutina",
                )
            }
        }
    }

    fun saveRoutine(routine: WorkoutRoutine) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    saveMutex.withLock { routineRepository.save(routine) }
                    routineRepository.list(MAX_ROUTINES) to routineRepository.listFolders(MAX_FOLDERS)
                }
            }.onSuccess { (routines, folders) ->
                _uiState.value = _uiState.value.copy(
                    routines = routines,
                    templateFolders = folders,
                    infoMessage = "Rutina guardada",
                    error = null,
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    error = error.message ?: "No se pudo guardar la rutina",
                )
            }
        }
    }

    fun startRoutine(routineId: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val routine = routineRepository.getById(routineId)
                        ?: error("No se encontró la rutina")
                    val session = routine.toSession(
                        nowEpochMillis = System.currentTimeMillis(),
                        sessionId = "native-session-${System.currentTimeMillis()}",
                    ).prefilledFromHistory(_uiState.value.sessions)
                    saveMutex.withLock { repository.save(session) }
                    session
                }
            }.onSuccess { session ->
                _uiState.value = _uiState.value.copy(
                    sessions = listOf(session) + _uiState.value.sessions.filterNot { it.id == session.id },
                    selectedSessionId = session.id,
                    infoMessage = null,
                    error = null,
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    error = error.message ?: "No se pudo iniciar la rutina",
                )
            }
        }
    }

    fun deleteRoutine(routineId: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    saveMutex.withLock { routineRepository.delete(routineId) }
                    routineRepository.list(MAX_ROUTINES)
                }
            }.onSuccess { routines ->
                _uiState.value = _uiState.value.copy(routines = routines, error = null)
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    error = error.message ?: "No se pudo borrar la rutina",
                )
            }
        }
    }

    fun saveTemplateFolder(name: String) {
        val normalizedName = name.trim()
        if (normalizedName.isBlank()) return
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val now = System.currentTimeMillis()
                    val folder = WorkoutTemplateFolder(
                        id = "template-folder-$now",
                        name = normalizedName,
                        createdAtEpochMillis = now,
                    )
                    saveMutex.withLock { routineRepository.saveFolder(folder) }
                    routineRepository.listFolders(MAX_FOLDERS)
                }
            }.onSuccess { folders ->
                _uiState.value = _uiState.value.copy(templateFolders = folders, error = null)
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(error = error.message ?: "No se pudo crear la carpeta")
            }
        }
    }

    fun deleteTemplateFolder(folderId: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    saveMutex.withLock { routineRepository.deleteFolder(folderId) }
                    routineRepository.list(MAX_ROUTINES) to routineRepository.listFolders(MAX_FOLDERS)
                }
            }.onSuccess { (routines, folders) ->
                _uiState.value = _uiState.value.copy(routines = routines, templateFolders = folders, error = null)
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(error = error.message ?: "No se pudo borrar la carpeta")
            }
        }
    }

    fun moveRoutineToFolder(routineId: String, folderId: String?) {
        val routine = _uiState.value.routines.firstOrNull { it.id == routineId } ?: return
        saveRoutine(routine.copy(folderId = folderId, updatedAtEpochMillis = System.currentTimeMillis()))
    }

    fun saveExercise(name: String, type: ExerciseType) {
        val normalizedName = name.trim()
        if (normalizedName.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "El nombre del ejercicio es obligatorio")
            return
        }
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val id = "custom:${normalizedName.lowercase().replace(Regex("[^a-z0-9]+"), "-")}:${System.currentTimeMillis()}"
                    saveMutex.withLock {
                        exerciseRepository.save(
                            ExerciseDefinition(id = id, name = normalizedName, type = type),
                        )
                    }
                    exerciseRepository.list(includeArchived = true)
                }
            }.onSuccess { exercises ->
                _uiState.value = _uiState.value.copy(exercises = exercises, error = null, infoMessage = "Ejercicio guardado")
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(error = error.message ?: "No se pudo guardar el ejercicio")
            }
        }
    }

    fun archiveExercise(exerciseId: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    saveMutex.withLock {
                        exerciseRepository.getById(exerciseId)?.let { exerciseRepository.save(it.copy(isArchived = true)) }
                    }
                    exerciseRepository.list(includeArchived = true)
                }
            }.onSuccess { exercises ->
                _uiState.value = _uiState.value.copy(exercises = exercises, error = null)
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(error = error.message ?: "No se pudo archivar el ejercicio")
            }
        }
    }

    fun toggleSet(sessionExerciseId: String, set: LoggedSet) {
        val current = selectedSession() ?: return
        if (current.exercises.none { it.id == sessionExerciseId }) return
        if (set.completedAtEpochMillis == null) {
            completeSet(sessionExerciseId, set)
            return
        }
        val updatedSet = set.copy(completedAtEpochMillis = null)
        val updated = current.withSet(sessionExerciseId, updatedSet)
        _uiState.value = _uiState.value.copy(
            sessions = replaceSession(updated),
            error = null,
            infoMessage = null,
        )
        persist(updated)
    }

    fun saveSet(sessionExerciseId: String, set: LoggedSet) {
        completeSet(sessionExerciseId, set)
    }

    fun completeSet(sessionExerciseId: String, set: LoggedSet) {
        val current = selectedSession() ?: return
        val exercise = current.exercises.firstOrNull { it.id == sessionExerciseId } ?: return
        val completedAt = System.currentTimeMillis()
        val candidate = set.copy(completedAtEpochMillis = completedAt)
        if (!com.liftlog.shared.domain.SessionProgressCalculator.isComplete(exercise.exercise.type, candidate)) {
            _uiState.value = _uiState.value.copy(
                error = "Completa los datos requeridos del set antes de marcarlo",
                infoMessage = null,
            )
            return
        }
        val updatedSet = candidate
        val updated = current.withSet(sessionExerciseId, updatedSet)
        _uiState.value = _uiState.value.copy(
            sessions = replaceSession(updated),
            error = null,
            infoMessage = null,
        )
        persist(updated)
        if (updatedSet.completedAtEpochMillis != null) {
            startRestTimer(
                durationSeconds = exercise.restConfig?.defaultSeconds(
                    exercise.restSeconds ?: _settings.value.defaultRestSeconds,
                ) ?: (exercise.restSeconds ?: _settings.value.defaultRestSeconds),
                sourceExerciseId = exercise.id,
            )
        }
    }

    fun updateSetDraft(sessionExerciseId: String, set: LoggedSet) {
        val current = selectedSession() ?: return
        val exercise = current.exercises.firstOrNull { it.id == sessionExerciseId } ?: return
        val shouldRemainCompleted = set.completedAtEpochMillis != null &&
            com.liftlog.shared.domain.SessionProgressCalculator.isComplete(
                exercise.exercise.type,
                set,
            )
        val updatedSet = set.copy(
            completedAtEpochMillis = if (shouldRemainCompleted) {
                set.completedAtEpochMillis
            } else {
                null
            },
        )
        val updated = current.withSet(sessionExerciseId, updatedSet)
        _uiState.value = _uiState.value.copy(
            sessions = replaceSession(updated),
            error = null,
            infoMessage = null,
        )
        persist(updated)
    }

    fun addSet(sessionExerciseId: String) {
        val current = selectedSession() ?: return
        val exercise = current.exercises.firstOrNull { it.id == sessionExerciseId } ?: return
        val index = (exercise.sets.maxOfOrNull(LoggedSet::index) ?: -1) + 1
        val newSet = LoggedSet(id = "${exercise.id}:set:$index", index = index)
        val updated = current.withSet(sessionExerciseId, newSet)
        _uiState.value = _uiState.value.copy(sessions = replaceSession(updated), error = null)
        persist(updated)
    }

    fun moveExercise(sessionExerciseId: String, direction: Int) {
        val current = selectedSession() ?: return
        val index = current.exercises.indexOfFirst { it.id == sessionExerciseId }
        val target = index + direction
        if (index < 0 || target !in current.exercises.indices) return
        val reordered = current.exercises.toMutableList().apply {
            add(target, removeAt(index))
        }
        val updated = current.copy(exercises = reordered)
        _uiState.value = _uiState.value.copy(sessions = replaceSession(updated), error = null)
        persist(updated)
    }

    fun moveSet(sessionExerciseId: String, setId: String, direction: Int) {
        val current = selectedSession() ?: return
        val exercise = current.exercises.firstOrNull { it.id == sessionExerciseId } ?: return
        val index = exercise.sets.indexOfFirst { it.id == setId }
        val target = index + direction
        if (index < 0 || target !in exercise.sets.indices) return
        val reordered = exercise.sets.toMutableList().apply {
            add(target, removeAt(index))
        }.mapIndexed { newIndex, set -> set.copy(index = newIndex) }
        val updated = current.copy(
            exercises = current.exercises.map { candidate ->
                if (candidate.id == exercise.id) candidate.copy(sets = reordered) else candidate
            },
        )
        _uiState.value = _uiState.value.copy(sessions = replaceSession(updated), error = null)
        persist(updated)
    }

    fun importNativeExport(contentResolver: ContentResolver, uri: Uri) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isImporting = true,
                error = null,
                infoMessage = null,
            )
            try {
                val importResult = withContext(Dispatchers.IO) {
                    val json = contentResolver.openInputStream(uri)
                        ?.bufferedReader(Charsets.UTF_8)
                        ?.use { it.readText() }
                        ?: error("No se pudo leer el archivo seleccionado")
                    require(json.isNotBlank()) { "El archivo seleccionado está vacío" }
                    saveMutex.withLock {
                        importService.importJson(json)
                    }
                }
                importResult.settings?.defaultRestSeconds?.let(::saveDefaultRestSeconds)
                val importedSessions = importResult.importedSessions
                val data = withContext(Dispatchers.IO) { readRepositoryData() }
                _uiState.value = _uiState.value.copy(
                    isImporting = false,
                    sessions = data.first,
                    routines = data.second.first,
                    templateFolders = data.second.second.first,
                    exercises = data.second.second.second,
                    selectedSessionId = null,
                    infoMessage = "Importación completada: $importedSessions sesiones",
                )
            } catch (error: Throwable) {
                _uiState.value = _uiState.value.copy(
                    isImporting = false,
                    error = error.message ?: "No se pudo importar el archivo",
                )
            }
        }
    }

    fun exportNativeExport(contentResolver: ContentResolver, uri: Uri) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isExporting = true, error = null, infoMessage = null)
            try {
                val snapshot = withContext(Dispatchers.IO) { readCompleteRepositorySnapshot() }
                val json = withContext(Dispatchers.Default) {
                    NativeWorkoutExporter.encode(
                        sessions = snapshot.sessions,
                        exportedAtEpochMillis = System.currentTimeMillis(),
                        routines = snapshot.routines,
                        folders = snapshot.folders,
                        exerciseLibrary = snapshot.exercises,
                        settings = NativeWorkoutSettingsV1(_settings.value.defaultRestSeconds),
                    )
                }
                withContext(Dispatchers.IO) {
                    contentResolver.openOutputStream(uri)?.bufferedWriter(Charsets.UTF_8)?.use { writer ->
                        writer.write(json)
                    } ?: error("No se pudo abrir el archivo de destino")
                }
                _uiState.value = _uiState.value.copy(
                    isExporting = false,
                    infoMessage = "Exportación completada: ${snapshot.sessions.size} sesiones",
                )
            } catch (error: Throwable) {
                _uiState.value = _uiState.value.copy(
                    isExporting = false,
                    error = error.message ?: "No se pudo exportar el backup",
                )
            }
        }
    }

    private fun loadSessions() {
        viewModelScope.launch {
            try {
                val data = withContext(Dispatchers.IO) {
                    val migrationVersion = migrationPreferences.getInt(
                        LEGACY_MIGRATION_VERSION_KEY,
                        if (migrationPreferences.getBoolean(LEGACY_MIGRATION_DONE_KEY, false)) {
                            CURRENT_LEGACY_MIGRATION_VERSION
                        } else {
                            0
                        },
                    )
                    if (migrationVersion < CURRENT_LEGACY_MIGRATION_VERSION && legacyImporter != null) {
                        if (!legacyImporter.hasLegacyDatabase()) {
                            migrationPreferences.edit()
                                .putInt(LEGACY_MIGRATION_VERSION_KEY, CURRENT_LEGACY_MIGRATION_VERSION)
                                .putString(LEGACY_MIGRATION_REPORT_KEY, "status=NO_LEGACY_DATABASE")
                                .apply()
                        } else {
                            val readResult = legacyImporter.readExport()
                                ?: error("No se pudo leer la base legacy; la migración se reintentará")
                            check(readResult.isComplete) {
                                "Migración incompleta: ${readResult.skippedRows} filas legacy no pudieron procesarse " +
                                    "(sessions=${readResult.sourceSessions}/${readResult.parsedSessions}, " +
                                    "programs=${readResult.sourcePrograms}/${readResult.parsedProgramRows}, " +
                                    "exercises=${readResult.sourceExercises}/${readResult.parsedExercises})"
                            }
                            val result = saveMutex.withLock { importService.importExport(readResult.export) }
                            val storedSessions = repository.listAll()
                            check(readResult.export.sessions.all { imported -> storedSessions.any { it.id == imported.id } }) {
                                "La migración no pasó la verificación de lectura de sesiones"
                            }
                            val report = "status=SUCCESS;sourceSessions=${readResult.sourceSessions};nativeSessions=${storedSessions.size};" +
                                "sourcePrograms=${readResult.sourcePrograms};nativeRoutines=${routineRepository.listAll().size};" +
                                "sourceExercises=${readResult.sourceExercises};nativeExercises=${exerciseRepository.list(includeArchived = true).size};" +
                                "skippedRows=${readResult.skippedRows}"
                            migrationPreferences.edit()
                                .putInt(LEGACY_MIGRATION_VERSION_KEY, CURRENT_LEGACY_MIGRATION_VERSION)
                                .putBoolean(LEGACY_MIGRATION_DONE_KEY, true)
                                .putString(LEGACY_MIGRATION_REPORT_KEY, report)
                                .apply()
                            Log.i(LEGACY_IMPORT_TAG, "Legacy migration finished: $report importedSessions=${result.importedSessions}")
                        }
                    }
                    val sessions = repository.list(MAX_SESSIONS)
                    var routines = routineRepository.list(MAX_ROUTINES)
                    val defaultsSeeded = migrationPreferences.getBoolean(
                        DEFAULT_ROUTINES_SEEDED_KEY,
                        false,
                    )
                    if (routines.isEmpty() && !defaultsSeeded) {
                        routines = DefaultWorkoutRoutines.create()
                        routines.forEach { routine ->
                            routineRepository.save(routine)
                        }
                        migrationPreferences.edit()
                            .putBoolean(DEFAULT_ROUTINES_SEEDED_KEY, true)
                            .apply()
                    } else if (routines.isNotEmpty() && !defaultsSeeded) {
                        migrationPreferences.edit()
                            .putBoolean(DEFAULT_ROUTINES_SEEDED_KEY, true)
                            .apply()
                    }
                    val currentExercises = exerciseRepository.list(includeArchived = true)
                    if (currentExercises.isEmpty()) {
                        (sessions.flatMap { it.exercises.map { exercise -> exercise.exercise } } +
                            routines.flatMap { it.exercises.map { exercise -> exercise.exercise } })
                            .distinctBy(ExerciseDefinition::id)
                            .forEach { exerciseRepository.save(it) }
                    }
                    val folders = routineRepository.listFolders(MAX_FOLDERS)
                    sessions to (routines to (folders to exerciseRepository.list(includeArchived = true)))
                }
                Log.i(
                    LEGACY_IMPORT_TAG,
                    "Native repository loaded: sessions=${data.first.size} routines=${data.second.first.size} " +
                        "folders=${data.second.second.first.size} exercises=${data.second.second.second.size}",
                )
                _uiState.value = WorkoutUiState(
                    isLoading = false,
                    sessions = data.first,
                    routines = data.second.first,
                    templateFolders = data.second.second.first,
                    exercises = data.second.second.second,
                )
            } catch (error: Throwable) {
                _uiState.value = WorkoutUiState(
                    isLoading = false,
                    error = error.message ?: "No se pudieron abrir las sesiones",
                )
            }
        }
    }

    private data class NativeRepositorySnapshot(
        val sessions: List<WorkoutSession>,
        val routines: List<WorkoutRoutine>,
        val folders: List<WorkoutTemplateFolder>,
        val exercises: List<ExerciseDefinition>,
    )

    private suspend fun readCompleteRepositorySnapshot(): NativeRepositorySnapshot {
        return NativeRepositorySnapshot(
            sessions = repository.listAll(),
            routines = routineRepository.listAll(),
            folders = routineRepository.listAllFolders(),
            exercises = exerciseRepository.list(includeArchived = true),
        )
    }

    private suspend fun readRepositoryData(): Pair<List<WorkoutSession>, Pair<List<WorkoutRoutine>, Pair<List<WorkoutTemplateFolder>, List<ExerciseDefinition>>>> {
        val sessions = repository.list(MAX_SESSIONS)
        val routines = routineRepository.list(MAX_ROUTINES)
        val currentExercises = exerciseRepository.list(includeArchived = true)
        if (currentExercises.isEmpty()) {
            (sessions.flatMap { it.exercises.map { exercise -> exercise.exercise } } +
                routines.flatMap { it.exercises.map { exercise -> exercise.exercise } })
                .distinctBy(ExerciseDefinition::id)
                .forEach { exerciseRepository.save(it) }
        }
        return sessions to (routines to (routineRepository.listFolders(MAX_FOLDERS) to exerciseRepository.list(includeArchived = true)))
    }

    private fun readRestTimer(): RestTimerUiState {
        val end = preferences.getLong(REST_TIMER_END_KEY, 0L).takeIf { it > 0L }
        val remaining = end?.let { ((it - System.currentTimeMillis() + 999L) / 1000L).coerceAtLeast(0L) } ?: 0L
        val sourceExerciseId = preferences.getString(REST_TIMER_SOURCE_EXERCISE_KEY, null)
        return if (remaining > 0L) {
            RestTimerUiState(end, remaining, sourceExerciseId)
        } else {
            RestTimerUiState()
        }
    }

    private fun refreshRestTimer() {
        val current = readRestTimer()
        _restTimer.value = current
        if (!current.isRunning && preferences.contains(REST_TIMER_END_KEY)) {
            stopRestTimer()
        }
    }

    private fun persist(session: WorkoutSession) {
        pendingSession = session
        persistJob?.cancel()
        persistJob = viewModelScope.launch {
            delay(300)
            val pending = pendingSession ?: return@launch
            pendingSession = null
            runCatching {
                withContext(Dispatchers.IO) {
                    saveMutex.withLock { repository.save(pending) }
                }
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    error = error.message ?: "No se pudo guardar la sesión",
                )
            }
        }
    }

    private fun selectedSession(): WorkoutSession? =
        _uiState.value.selectedSessionId?.let { id ->
            _uiState.value.sessions.firstOrNull { it.id == id }
        }

    private fun replaceSession(updated: WorkoutSession): List<WorkoutSession> =
        _uiState.value.sessions.map { session ->
            if (session.id == updated.id) updated else session
        }

    private fun prefilledSets(
        sessionExerciseId: String,
        exerciseId: String,
        sessionIdToExclude: String?,
        count: Int,
    ): List<LoggedSet> {
        val previous = latestSetForExercise(exerciseId, sessionIdToExclude)
        return (0 until count).map { index ->
            previous?.copy(
                id = "$sessionExerciseId:set:$index",
                index = index,
                completedAtEpochMillis = null,
            ) ?: LoggedSet(id = "$sessionExerciseId:set:$index", index = index)
        }
    }

    private fun latestSetForExercise(exerciseId: String, sessionIdToExclude: String?): LoggedSet? =
        _uiState.value.sessions
            .asSequence()
            .filterNot { it.id == sessionIdToExclude }
            .sortedByDescending(WorkoutSession::startedAtEpochMillis)
            .mapNotNull { session ->
                session.exercises
                    .firstOrNull { it.exercise.id == exerciseId }
                    ?.sets
                    ?.filter { set ->
                        set.completedAtEpochMillis != null ||
                            set.weight != null ||
                            set.reps != null ||
                            set.durationSeconds != null ||
                            set.distanceMeters != null
                    }
                    ?.maxByOrNull(LoggedSet::index)
            }
            .firstOrNull()

    private fun WorkoutSession.prefilledFromHistory(history: List<WorkoutSession>): WorkoutSession =
        copy(
            exercises = exercises.map { sessionExercise ->
                val previous = history
                    .asSequence()
                    .filterNot { it.id == id }
                    .sortedByDescending(WorkoutSession::startedAtEpochMillis)
                    .mapNotNull { session ->
                        session.exercises
                            .firstOrNull { it.exercise.id == sessionExercise.exercise.id }
                            ?.sets
                            ?.filter { set ->
                                set.completedAtEpochMillis != null ||
                                    set.weight != null ||
                                    set.reps != null ||
                                    set.durationSeconds != null ||
                                    set.distanceMeters != null
                            }
                            ?.maxByOrNull(LoggedSet::index)
                    }
                    .firstOrNull()
                sessionExercise.copy(
                    sets = sessionExercise.sets.map { set ->
                        previous?.copy(
                            id = set.id,
                            index = set.index,
                            completedAtEpochMillis = null,
                        ) ?: set
                    },
                )
            },
        )

    private companion object {
        const val MAX_SESSIONS = 500
        const val MAX_ROUTINES = 200
        const val MAX_FOLDERS = 100
        const val REST_TIMER_PREFS = "liftlog_rest_timer"
        const val MIGRATION_PREFS = "liftlog_migrations"
        const val LEGACY_MIGRATION_DONE_KEY = "expo_database_v1_done"
        const val LEGACY_MIGRATION_VERSION_KEY = "expo_database_migration_version"
        const val LEGACY_MIGRATION_REPORT_KEY = "expo_database_migration_report"
        const val CURRENT_LEGACY_MIGRATION_VERSION = 2
        const val DEFAULT_ROUTINES_SEEDED_KEY = "default_routines_seeded_v1"
        const val LEGACY_IMPORT_TAG = "LiftLogLegacyImport"
        const val REST_TIMER_END_KEY = "end_epoch_millis"
        const val REST_TIMER_SOURCE_EXERCISE_KEY = "source_exercise_id"
        const val DEFAULT_REST_SECONDS_KEY = "default_rest_seconds"
    }
}

class WorkoutViewModelFactory(
    private val repository: WorkoutSessionRepository,
    private val routineRepository: RoutineRepository,
    private val exerciseRepository: ExerciseRepository,
    private val applicationContext: Context,
    private val legacyImporter: LegacyExpoDatabaseImporter? = null,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(WorkoutViewModel::class.java)) {
            return WorkoutViewModel(
                repository,
                routineRepository,
                exerciseRepository,
                applicationContext,
                legacyImporter,
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
