package com.gabsvm.liftlog.nativeapp.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.PermissionController
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle as ComposeTextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gabsvm.liftlog.nativeapp.HealthConnectBridge
import com.liftlog.shared.domain.ExerciseType
import com.liftlog.shared.domain.ExerciseDefinition
import com.liftlog.shared.domain.LoggedSet
import com.liftlog.shared.domain.SessionExercise
import com.liftlog.shared.domain.SessionProgressCalculator
import com.liftlog.shared.domain.WorkoutSession
import com.liftlog.shared.domain.WorkoutRoutine
import com.liftlog.shared.domain.toSession
import com.liftlog.shared.domain.RoutineExercise
import com.liftlog.shared.domain.ProgressionMode
import com.liftlog.shared.domain.ProgressionRule
import com.liftlog.shared.domain.RestConfig
import com.liftlog.shared.domain.SetType
import com.liftlog.shared.domain.WeightUnit
import com.liftlog.shared.domain.sampleWorkoutSession
import com.liftlog.shared.stats.WorkoutStatisticsCalculator
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.delay

@Composable
fun LiftLogNativeApp(viewModel: WorkoutViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val restTimer by viewModel.restTimer.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showStats by rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
    var showRoutines by rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
    var showExercises by rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
    var showSettings by rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
    var showHistory by rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
    var healthSessionId by rememberSaveable { mutableStateOf<String?>(null) }
    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri ->
        uri?.let { viewModel.importNativeExport(context.contentResolver, it) }
    }
    val exportPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        uri?.let { viewModel.exportNativeExport(context.contentResolver, it) }
    }
    val healthPermissionPicker = rememberLauncherForActivityResult(
        contract = PermissionController.createRequestPermissionResultContract(),
    ) { granted ->
        if (HealthConnectBridge.REQUIRED_PERMISSIONS.all { it in granted }) {
            healthSessionId?.let(viewModel::exportSessionToHealthConnect)
        }
    }
    val selectedSession = state.selectedSessionId?.let { id ->
        state.sessions.firstOrNull { it.id == id }
    }

    when {
        state.isLoading -> LoadingScreen()
        selectedSession != null -> ActiveWorkoutScreen(
            session = selectedSession,
            historySessions = state.sessions,
            error = state.error,
            onBack = viewModel::closeSession,
            onSetToggle = { exerciseId, set ->
                viewModel.saveSet(exerciseId, set)
            },
            onSetQuickToggle = { exerciseId, set ->
                viewModel.toggleSet(exerciseId, set)
            },
            onSetDraftChange = { exerciseId, set ->
                viewModel.updateSetDraft(exerciseId, set)
            },
            onMoveExercise = { exerciseId, direction ->
                viewModel.moveExercise(exerciseId, direction)
            },
            onMoveSet = { exerciseId, setId, direction ->
                viewModel.moveSet(exerciseId, setId, direction)
            },
            onPairExercises = { firstId, secondId ->
                viewModel.pairExercises(firstId, secondId)
            },
            onUnpairExercise = viewModel::unpairExercise,
            onAddSet = viewModel::addSet,
            onRemoveExercise = viewModel::removeExerciseFromSession,
            onUpdateExerciseNotes = { exerciseId, notes ->
                viewModel.updateSessionExerciseNotes(exerciseId, notes)
            },
            onRenameSession = viewModel::updateSessionName,
            onComplete = viewModel::completeSession,
            availableExercises = state.exercises.filterNot(ExerciseDefinition::isArchived),
            onAddExercise = viewModel::addExerciseToSession,
            templateFolders = state.templateFolders,
            onSaveRoutine = { name, folderId ->
                viewModel.saveRoutineFromSession(selectedSession.id, name, folderId)
            },
            restTimer = restTimer,
            onStopRestTimer = viewModel::stopRestTimer,
            onHealthConnect = {
                healthSessionId = selectedSession.id
                if (viewModel.isHealthConnectAvailable()) {
                    healthPermissionPicker.launch(HealthConnectBridge.REQUIRED_PERMISSIONS)
                } else {
                    viewModel.exportSessionToHealthConnect(selectedSession.id)
                }
            },
        )
        showStats -> NativeProgressScreen(
            sessions = state.sessions,
            onBack = { showStats = false },
            onTrain = { showStats = false },
            onHistory = { showStats = false; showHistory = true },
            onMore = { showStats = false; showSettings = true },
        )
        showHistory -> NativeHistoryScreen(
            sessions = state.sessions,
            isImporting = state.isImporting,
            isExporting = state.isExporting,
            infoMessage = state.infoMessage,
            error = state.error,
            onImport = { filePicker.launch(arrayOf("application/json", "text/plain", "application/octet-stream")) },
            onExport = { exportPicker.launch("liftlog-native-backup.json") },
            onOpenSession = viewModel::openSession,
            onStats = { showHistory = false; showStats = true },
            onRoutines = { showHistory = false; showRoutines = true },
            onExercises = { showHistory = false; showExercises = true },
            onSettings = { showHistory = false; showSettings = true },
            onNewSession = viewModel::createEmptySession,
            onBack = { showHistory = false },
            onTrain = { showHistory = false },
            onProgress = { showHistory = false; showStats = true },
            onMore = { showHistory = false; showSettings = true },
        )
        showRoutines -> RoutineListScreen(
            routines = state.routines,
            folders = state.templateFolders,
            availableExercises = state.exercises.filterNot(ExerciseDefinition::isArchived),
            error = state.error,
            onBack = { showRoutines = false },
            onStartEmpty = viewModel::createEmptySession,
            onStart = viewModel::startRoutine,
            onDelete = viewModel::deleteRoutine,
            onSave = viewModel::saveRoutine,
            onCreateFolder = viewModel::saveTemplateFolder,
            onDeleteFolder = viewModel::deleteTemplateFolder,
            onMoveToFolder = viewModel::moveRoutineToFolder,
        )
        showExercises -> ExerciseLibraryScreen(
            exercises = state.exercises,
            error = state.error,
            onBack = { showExercises = false },
            onSave = viewModel::saveExercise,
            onArchive = viewModel::archiveExercise,
        )
        showSettings -> NativeMoreScreen(
            settings = settings,
            isImporting = state.isImporting,
            isExporting = state.isExporting,
            onBack = { showSettings = false },
            onTrain = { showSettings = false },
            onProgress = { showSettings = false; showStats = true },
            onHistory = { showSettings = false; showHistory = true },
            onRoutines = { showSettings = false; showRoutines = true },
            onExercises = { showSettings = false; showExercises = true },
            onImport = { filePicker.launch(arrayOf("application/json", "text/plain", "application/octet-stream")) },
            onExport = { exportPicker.launch("liftlog-native-backup.json") },
            onSaveDefaultRest = viewModel::saveDefaultRestSeconds,
            onSignInCloud = viewModel::signInCloud,
            onSignOutCloud = viewModel::signOutCloud,
            onUploadCloud = viewModel::uploadCloudBackup,
            onRestoreCloud = viewModel::restoreCloudBackup,
        )
        else -> TrainingHomeScreen(
            sessions = state.sessions,
            routines = state.routines,
            isImporting = state.isImporting,
            isExporting = state.isExporting,
            infoMessage = state.infoMessage,
            error = state.error,
            onImport = { filePicker.launch(arrayOf("application/json", "text/plain", "application/octet-stream")) },
            onExport = { exportPicker.launch("liftlog-native-backup.json") },
            onOpenSession = viewModel::openSession,
            onStartRoutine = viewModel::startRoutine,
            onStats = { showStats = true },
            onHistory = { showHistory = true },
            onRoutines = { showRoutines = true },
            onExercises = { showExercises = true },
            onSettings = { showSettings = true },
            onNewSession = viewModel::createEmptySession,
            onBack = { showHistory = true },
        )
    }
}

/**
 * The native shell deliberately mirrors the existing GainsLab home screen.
 * During migration the UI is the compatibility surface: the data and domain
 * implementations can move underneath it without making the app feel like a
 * different product.
 */
@Composable
private fun TrainingHomeScreen(
    sessions: List<WorkoutSession>,
    routines: List<WorkoutRoutine>,
    isImporting: Boolean,
    isExporting: Boolean,
    infoMessage: String?,
    error: String?,
    onImport: () -> Unit,
    onExport: () -> Unit,
    onOpenSession: (String) -> Unit,
    onStartRoutine: (String) -> Unit,
    onStats: () -> Unit,
    onHistory: () -> Unit,
    onRoutines: () -> Unit,
    onExercises: () -> Unit,
    onSettings: () -> Unit,
    onNewSession: () -> Unit,
    onBack: () -> Unit,
) {
    val activeSession = sessions.firstOrNull { it.completedAtEpochMillis == null }
    val cards = buildList {
        addAll(
            sessions
                .filterNot { it.id == activeSession?.id }
                .sortedByDescending { it.startedAtEpochMillis }
                .take(4),
        )
        if (isEmpty()) {
            addAll(routines.flatMap { routine ->
                listOf(
                    routine.toSession(
                        nowEpochMillis = System.currentTimeMillis(),
                        sessionId = "preview-${routine.id}",
                    ),
                )
            }.take(4))
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainerLow) {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Text("T") },
                    label = { Text("Train") },
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onStats,
                    icon = { Text("P") },
                    label = { Text("Progress") },
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onHistory,
                    icon = { Text("H") },
                    label = { Text("History") },
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onSettings,
                    icon = { Text("...") },
                    label = { Text("More") },
                )
            }
        },
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
        ) {
            item {
                GainsLabWordmarkNative(modifier = Modifier.padding(top = 16.dp))
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "TODAY'S TRAINING",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        "Ready to train?",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                    )
                    Text(
                        "Your plan, your numbers, your next best set.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            item {
                TrainingPlanCard(
                    planName = routines.firstOrNull()?.description?.takeIf { it.isNotBlank() }
                        ?: "No plan selected",
                    onChoose = onRoutines,
                    onEdit = onRoutines,
                )
            }
            if (activeSession != null) {
                item {
                    HomeSectionHeading("CURRENT WORKOUT", activeSession.name)
                }
                item {
                    NativeWorkoutCard(
                        session = activeSession,
                        actionLabel = "Resume workout",
                        onClick = { onOpenSession(activeSession.id) },
                    )
                }
            }
            if (routines.isNotEmpty()) {
                item {
                    HomeSectionHeading("UP NEXT", "Pick up where your plan left off")
                }
                items(routines.take(4), key = { it.id }) { routine ->
                    NativeRoutineCard(
                        routine = routine,
                        actionLabel = "Start workout",
                        onClick = { onStartRoutine(routine.id) },
                    )
                }
            } else if (cards.isNotEmpty()) {
                item {
                    HomeSectionHeading("UP NEXT", "Pick up where your plan left off")
                }
                items(cards, key = { it.id }) { session ->
                    NativeWorkoutCard(
                        session = session,
                        actionLabel = if (session.completedAtEpochMillis == null) "Start workout" else "Train",
                        onClick = { onOpenSession(session.id) },
                    )
                }
            }
            if (routines.isEmpty() && cards.isEmpty()) {
                item {
                    NativeEmptyHomeCard(onNewSession = onNewSession)
                }
            }
            if (infoMessage != null) {
                item { Text(infoMessage, color = MaterialTheme.colorScheme.primary) }
            }
            if (error != null) {
                item { Text(error, color = MaterialTheme.colorScheme.error) }
            }
            item {
                androidx.compose.material3.OutlinedButton(
                    onClick = onNewSession,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Freeform workout") }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun GainsLabWordmarkNative(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .width(32.dp)
                .height(32.dp)
                .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "â†—",
                color = MaterialTheme.colorScheme.onPrimary,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
            )
        }
        Text(
            "GainsLab",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
        )
    }
}

@Composable
private fun HomeSectionHeading(title: String, detail: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            title,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
        )
        Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun TrainingPlanCard(planName: String, onChoose: () -> Unit, onEdit: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .width(44.dp)
                        .height(44.dp)
                        .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center,
                ) { Text("[]", color = MaterialTheme.colorScheme.primary) }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Training plan", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                    Text(planName, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onChoose) { Text("Choose plan") }
                androidx.compose.material3.Button(onClick = onEdit) { Text("Edit") }
            }
        }
    }
}

@Composable
private fun NativeWorkoutCard(session: WorkoutSession, actionLabel: String, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                session.name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
            )
            Text(
                "${session.exercises.size} exercises",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            session.exercises.take(4).forEachIndexed { index, exercise ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        (index + 1).toString().padStart(2, '0'),
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.width(32.dp),
                    )
                    Text(exercise.exercise.name, modifier = Modifier.weight(1f), maxLines = 1)
                    if (exercise.plannedSetCount > 0) {
                        val reps = exercise.targetRepsMin?.toString() ?: "-"
                        Text(
                            "${exercise.plannedSetCount} x $reps",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
            }
            if (session.exercises.size > 4) {
                Text(
                    "+${session.exercises.size - 4} more",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
            Spacer(Modifier.height(10.dp))
            Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) { Text(actionLabel) }
        }
    }
}

@Composable
private fun NativeRoutineCard(
    routine: WorkoutRoutine,
    actionLabel: String,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                routine.name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
            )
            Text(
                routine.exercises.size.toString() + " exercises",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            routine.exercises.take(4).forEachIndexed { index, exercise ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        (index + 1).toString().padStart(2, '0'),
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.width(32.dp),
                    )
                    Text(exercise.exercise.name, modifier = Modifier.weight(1f), maxLines = 1)
                    val reps = exercise.targetRepsMin?.toString() ?: "-"
                    Text(
                        exercise.plannedSetCount.toString() + " x " + reps,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
            if (routine.exercises.size > 4) {
                Text(
                    "+" + (routine.exercises.size - 4) + " more",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
            Spacer(Modifier.height(10.dp))
            Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
                Text(actionLabel)
            }
        }
    }
}

@Composable
private fun NativeEmptyHomeCard(onNewSession: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("No workouts yet", style = MaterialTheme.typography.titleMedium)
            Text(
                "Start a freeform workout to begin tracking.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            androidx.compose.material3.OutlinedButton(onClick = onNewSession) {
                Text("Start workout")
            }
        }
    }
}

private enum class NativeTab {
    TRAIN,
    PROGRESS,
    HISTORY,
    MORE,
}

@Composable
private fun NativeBottomBar(
    selected: NativeTab,
    onTrain: () -> Unit,
    onProgress: () -> Unit,
    onHistory: () -> Unit,
    onMore: () -> Unit,
) {
    NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainerLow) {
        NavigationBarItem(
            selected = selected == NativeTab.TRAIN,
            onClick = onTrain,
            icon = { Text("T") },
            label = { Text("Train") },
        )
        NavigationBarItem(
            selected = selected == NativeTab.PROGRESS,
            onClick = onProgress,
            icon = { Text("P") },
            label = { Text("Progress") },
        )
        NavigationBarItem(
            selected = selected == NativeTab.HISTORY,
            onClick = onHistory,
            icon = { Text("H") },
            label = { Text("History") },
        )
        NavigationBarItem(
            selected = selected == NativeTab.MORE,
            onClick = onMore,
            icon = { Text("...") },
            label = { Text("More") },
        )
    }
}

@Composable
private fun NativeHistoryScreen(
    sessions: List<WorkoutSession>,
    isImporting: Boolean,
    isExporting: Boolean,
    infoMessage: String?,
    error: String?,
    onImport: () -> Unit,
    onExport: () -> Unit,
    onOpenSession: (String) -> Unit,
    onStats: () -> Unit,
    onRoutines: () -> Unit,
    onExercises: () -> Unit,
    onSettings: () -> Unit,
    onNewSession: () -> Unit,
    onBack: () -> Unit,
    onTrain: () -> Unit,
    onProgress: () -> Unit,
    onMore: () -> Unit,
) {
    var monthKey by rememberSaveable { mutableStateOf(YearMonth.now().toString()) }
    val month = YearMonth.parse(monthKey)
    val sessionDates = sessions.map { session ->
        Instant.ofEpochMilli(session.startedAtEpochMillis)
            .atZone(ZoneId.systemDefault())
            .toLocalDate()
    }.toSet()
    val sessionsInMonth = sessions.filter { session ->
        val date = Instant.ofEpochMilli(session.startedAtEpochMillis)
            .atZone(ZoneId.systemDefault())
            .toLocalDate()
        date.year == month.year && date.month == month.month
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NativeBottomBar(
                selected = NativeTab.HISTORY,
                onTrain = onTrain,
                onProgress = onProgress,
                onHistory = {},
                onMore = onMore,
            )
        },
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
        ) {
            item { GainsLabWordmarkNative(modifier = Modifier.padding(top = 16.dp)) }
            item {
                NativeScreenHeading(
                    eyebrow = "HISTORY",
                    title = "History",
                    subtitle = "Review, repeat and improve past sessions.",
                )
            }
            item {
                NativeHistoryCalendar(
                    month = month,
                    sessionDates = sessionDates,
                    onPrevious = { monthKey = month.minusMonths(1).toString() },
                    onNext = { monthKey = month.plusMonths(1).toString() },
                    onSelectDate = onNewSession,
                )
            }
            item {
                NativeSectionHeading(
                    title = "Workouts in month",
                    detail = sessionsInMonth.size.toString(),
                    action = if (sessionsInMonth.isEmpty()) onNewSession else null,
                    actionLabel = "Log a workout",
                )
            }
            if (infoMessage != null) {
                item { Text(infoMessage, color = MaterialTheme.colorScheme.primary) }
            }
            if (error != null) {
                item { Text(error, color = MaterialTheme.colorScheme.error) }
            }
            if (sessionsInMonth.isEmpty()) {
                item {
                    NativeEmptyHistoryCard(onNewSession = onNewSession)
                }
            } else {
                items(sessionsInMonth, key = { it.id }) { session ->
                    NativeHistorySessionCard(
                        session = session,
                        onOpen = { onOpenSession(session.id) },
                    )
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedAction(
                        if (isExporting) "Exporting..." else "Export backup",
                        onExport,
                        Modifier.weight(1f),
                    )
                    OutlinedAction(
                        if (isImporting) "Importing..." else "Import backup",
                        onImport,
                        Modifier.weight(1f),
                    )
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun NativeScreenHeading(eyebrow: String, title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            eyebrow,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
        )
        Text(
            title,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
        )
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun NativeSectionHeading(
    title: String,
    detail: String,
    action: (() -> Unit)? = null,
    actionLabel: String = "",
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (action != null) {
            TextButton(onClick = action) { Text(actionLabel) }
        }
    }
}

@Composable
private fun NativeHistoryCalendar(
    month: YearMonth,
    sessionDates: Set<java.time.LocalDate>,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onSelectDate: () -> Unit,
) {
    val monthLabel = month.month.getDisplayName(TextStyle.FULL, Locale.ENGLISH)
    val leadingDays = month.atDay(1).dayOfWeek.value % 7
    val cellCount = ((leadingDays + month.lengthOfMonth() + 6) / 7) * 7
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        shape = RoundedCornerShape(22.dp),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                IconButton(onClick = onPrevious) { Text("<") }
                Text(monthLabel, style = MaterialTheme.typography.titleMedium)
                IconButton(onClick = onNext) { Text(">") }
            }
            Row(modifier = Modifier.fillMaxWidth()) {
                listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat").forEach { day ->
                    Text(
                        day,
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            for (row in 0 until cellCount step 7) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    for (column in 0 until 7) {
                        val dayNumber = row + column - leadingDays + 1
                        val validDay = dayNumber in 1..month.lengthOfMonth()
                        val date = if (validDay) month.atDay(dayNumber) else null
                        val hasWorkout = date != null && date in sessionDates
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(36.dp)
                                .clickable(enabled = validDay, onClick = onSelectDate),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (validDay) {
                                Surface(
                                    color = if (hasWorkout) {
                                        MaterialTheme.colorScheme.primaryContainer
                                    } else {
                                        androidx.compose.ui.graphics.Color.Transparent
                                    },
                                    shape = RoundedCornerShape(10.dp),
                                ) {
                                    Text(
                                        dayNumber.toString(),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                                        color = if (hasWorkout) {
                                            MaterialTheme.colorScheme.onPrimaryContainer
                                        } else {
                                            MaterialTheme.colorScheme.onSurface
                                        },
                                        style = MaterialTheme.typography.labelMedium,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NativeEmptyHistoryCard(onNewSession: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("No workouts logged this month.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = onNewSession) { Text("Log a workout") }
        }
    }
}

@Composable
private fun NativeHistorySessionCard(session: WorkoutSession, onOpen: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(session.name, style = MaterialTheme.typography.titleMedium)
            Text(
                formatSessionDate(session.startedAtEpochMillis),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Column(
                modifier = Modifier.padding(top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                session.exercises.take(3).forEachIndexed { index, exercise ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            (index + 1).toString().padStart(2, '0'),
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.width(32.dp),
                            style = MaterialTheme.typography.labelMedium,
                        )
                        Text(exercise.exercise.name, maxLines = 1)
                    }
                }
                if (session.exercises.size > 3) {
                    Text(
                        "+" + (session.exercises.size - 3) + " more",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
            TextButton(onClick = onOpen) { Text("Edit workout") }
        }
    }
}

@Composable
private fun NativeProgressScreen(
    sessions: List<WorkoutSession>,
    onBack: () -> Unit,
    onTrain: () -> Unit,
    onHistory: () -> Unit,
    onMore: () -> Unit,
) {
    val stats = WorkoutStatisticsCalculator.calculate(sessions)
    val hasTrainingData = stats.totalSessions > 0 || stats.totalSets > 0
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NativeBottomBar(
                selected = NativeTab.PROGRESS,
                onTrain = onTrain,
                onProgress = {},
                onHistory = onHistory,
                onMore = onMore,
            )
        },
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
        ) {
            item { GainsLabWordmarkNative(modifier = Modifier.padding(top = 16.dp)) }
            item {
                NativeScreenHeading(
                    eyebrow = "PROGRESS",
                    title = "Statistics",
                    subtitle = "See the signal behind every session.",
                )
            }
            item {
                androidx.compose.material3.OutlinedButton(onClick = {}) {
                    Text("Last 90 days")
                }
            }
            if (!hasTrainingData) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = androidx.compose.material3.CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceContainer,
                        ),
                        shape = RoundedCornerShape(22.dp),
                    ) {
                        Column(
                            modifier = Modifier.padding(22.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Text(
                                "Your progress starts with one workout",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                            )
                            Text(
                                "Complete a workout and GainsLab will turn your sets into useful trends.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Button(onClick = onTrain) { Text("Train") }
                        }
                    }
                }
            } else {
                item {
                    Text("Overview", style = MaterialTheme.typography.titleLarge)
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard("Workouts", stats.totalSessions.toString(), Modifier.weight(1f))
                        StatCard("Completed", stats.completedSessions.toString(), Modifier.weight(1f))
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard(
                            "Sets",
                            stats.completedSets.toString() + "/" + stats.totalSets,
                            Modifier.weight(1f),
                        )
                        StatCard("Max volume", formatVolume(stats.totalVolume), Modifier.weight(1f))
                    }
                }
                item {
                    Text(
                        "Overall completion: " + stats.completionPercent + "%",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                item { Text("Exercises", style = MaterialTheme.typography.titleLarge) }
                items(stats.exerciseStatistics, key = { it.exerciseId }) { exercise ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = androidx.compose.material3.CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceContainer,
                        ),
                        shape = RoundedCornerShape(20.dp),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(exercise.exerciseName, style = MaterialTheme.typography.titleMedium)
                            Text(
                                exercise.sessions.toString() + " sessions - " +
                                    exercise.completedSets + " sets - volume " +
                                    formatVolume(exercise.totalVolume),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NativeMoreScreen(
    settings: NativeSettingsUiState,
    isImporting: Boolean,
    isExporting: Boolean,
    onBack: () -> Unit,
    onTrain: () -> Unit,
    onProgress: () -> Unit,
    onHistory: () -> Unit,
    onRoutines: () -> Unit,
    onExercises: () -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit,
    onSaveDefaultRest: (Int) -> Unit,
    onSignInCloud: (String, String, Boolean) -> Unit,
    onSignOutCloud: () -> Unit,
    onUploadCloud: () -> Unit,
    onRestoreCloud: () -> Unit,
) {
    var restSeconds by rememberSaveable(settings.defaultRestSeconds) {
        mutableStateOf(settings.defaultRestSeconds.toString())
    }
    var cloudEmail by rememberSaveable { mutableStateOf("") }
    var cloudPassword by rememberSaveable { mutableStateOf("") }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NativeBottomBar(
                selected = NativeTab.MORE,
                onTrain = onTrain,
                onProgress = onProgress,
                onHistory = onHistory,
                onMore = {},
            )
        },
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
        ) {
            item { GainsLabWordmarkNative(modifier = Modifier.padding(top = 16.dp)) }
            item {
                NativeScreenHeading(
                    eyebrow = "MORE",
                    title = "Settings",
                    subtitle = "Plans, preferences, data and support.",
                )
            }
            item {
                NativeSettingsGroup(
                    title = "Training plan",
                    description = "Choose or edit your routine",
                ) {
                    NativeSettingsRow("Manage plans", "Setup your workout plans", onRoutines)
                    NativeSettingsRow("Manage exercises", "Manage your exercise list", onExercises)
                }
            }
            item {
                NativeSettingsGroup(
                    title = "Account and data",
                    description = "Sync, imports and backups",
                ) {
                    NativeSettingsRow(
                        "Account and sync",
                        if (settings.cloudEmail == null) {
                            "Keep your private routines in sync"
                        } else {
                            "Connected as " + settings.cloudEmail
                        },
                    )
                    NativeSettingsRow(
                        "Import data",
                        "Bring over sessions, routines and supersets",
                        onImport,
                    )
                    NativeSettingsRow(
                        "Export, backup, and restore",
                        "Create and export backups for transferring between devices",
                        onExport,
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedAction(
                            if (isExporting) "Exporting..." else "Export",
                            onExport,
                            Modifier.weight(1f),
                        )
                        OutlinedAction(
                            if (isImporting) "Importing..." else "Import",
                            onImport,
                            Modifier.weight(1f),
                        )
                    }
                    if (settings.cloudEmail == null && settings.cloudConfigured) {
                        TextField(
                            value = cloudEmail,
                            onValueChange = { cloudEmail = it },
                            label = { Text("Email") },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp),
                        )
                        TextField(
                            value = cloudPassword,
                            onValueChange = { cloudPassword = it },
                            label = { Text("Password") },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp),
                        )
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Button(
                                onClick = { onSignInCloud(cloudEmail, cloudPassword, false) },
                                enabled = !settings.cloudBusy && cloudEmail.isNotBlank() && cloudPassword.isNotBlank(),
                            ) { Text("Sign in") }
                            TextButton(
                                onClick = { onSignInCloud(cloudEmail, cloudPassword, true) },
                                enabled = !settings.cloudBusy && cloudEmail.isNotBlank() && cloudPassword.isNotBlank(),
                            ) { Text("Create account") }
                        }
                    } else if (settings.cloudEmail != null) {
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Button(onClick = onUploadCloud, enabled = !settings.cloudBusy) {
                                Text("Upload")
                            }
                            Button(onClick = onRestoreCloud, enabled = !settings.cloudBusy) {
                                Text("Restore")
                            }
                            TextButton(onClick = onSignOutCloud, enabled = !settings.cloudBusy) {
                                Text("Sign out")
                            }
                        }
                    }
                    if (!settings.cloudConfigured) {
                        Text(
                            "Cloud sync is not configured in this build.",
                            modifier = Modifier.padding(16.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    settings.cloudMessage?.let { message ->
                        Text(
                            message,
                            modifier = Modifier.padding(16.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            item {
                NativeSettingsGroup(
                    title = "App configuration",
                    description = "Theme, language and app behavior",
                ) {
                    NativeSettingsRow("Appearance and experience", "Adjust theme and other app behavior")
                    NativeSettingsRow("Language and units", "Set the app language and default weight units")
                    NativeSettingsRow("Notifications", "Adjust notification settings for rest timers")
                    TextField(
                        value = restSeconds,
                        onValueChange = { restSeconds = it.filter(Char::isDigit) },
                        label = { Text("Default rest (seconds)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                    Button(
                        onClick = {
                            onSaveDefaultRest(restSeconds.toIntOrNull() ?: settings.defaultRestSeconds)
                        },
                        enabled = restSeconds.toIntOrNull()?.let { it in 1..3600 } == true,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    ) { Text("Save settings") }
                }
            }
            item {
                NativeSettingsGroup(
                    title = "Support",
                    description = "Community, diagnostics and app information",
                ) {
                    NativeSettingsRow("Feature request", "Suggest a new feature")
                    NativeSettingsRow("Bug report", "Let us know when you encounter a bug")
                    NativeSettingsRow("Copy logs", "Copy your logs for a bug report")
                    NativeSettingsRow("App info", "Display app information")
                }
            }
            item { Spacer(Modifier.height(32.dp)) }
        }
    }
}

@Composable
private fun NativeSettingsGroup(
    title: String,
    description: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        NativeSectionHeading(title, description)
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = androidx.compose.material3.CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainer,
            ),
            shape = RoundedCornerShape(20.dp),
        ) {
            Column { content() }
        }
    }
}

@Composable
private fun NativeSettingsRow(
    title: String,
    subtitle: String,
    onClick: (() -> Unit)? = null,
) {
    val rowModifier = if (onClick == null) {
        Modifier.fillMaxWidth()
    } else {
        Modifier.fillMaxWidth().clickable(onClick = onClick)
    }
    Row(
        modifier = rowModifier.padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .width(36.dp)
                .height(36.dp)
                .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(11.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text("â€¢", color = MaterialTheme.colorScheme.primary)
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun DashboardScreen(
    sessions: List<WorkoutSession>,
    isImporting: Boolean,
    isExporting: Boolean,
    infoMessage: String?,
    error: String?,
    onImport: () -> Unit,
    onExport: () -> Unit,
    onOpenSession: (String) -> Unit,
    onStats: () -> Unit,
    onRoutines: () -> Unit,
    onExercises: () -> Unit,
    onSettings: () -> Unit,
    onNewSession: () -> Unit,
    onBack: () -> Unit,
) {
    val completed = sessions.count { it.completedAtEpochMillis != null }
    val current = sessions.firstOrNull { it.completedAtEpochMillis == null }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(selected = true, onClick = {}, icon = { Text("âŒ‚") }, label = { Text("Inicio") })
                NavigationBarItem(selected = false, onClick = onBack, icon = { Text("â–¤") }, label = { Text("Historial") })
                NavigationBarItem(selected = false, onClick = onRoutines, icon = { Text("â–¦") }, label = { Text("Rutinas") })
                NavigationBarItem(selected = false, onClick = onSettings, icon = { Text("âš™") }, label = { Text("MÃ¡s") })
            }
        },
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Column(modifier = Modifier.padding(top = 24.dp)) {
                    Text("LIFTLOG", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(6.dp))
                    Text("Tu prÃ³ximo entrenamiento", style = MaterialTheme.typography.headlineMedium)
                    Text("Entrena con intenciÃ³n. Registra lo que importa.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    colors = androidx.compose.material3.CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                    ),
                ) {
                    Column(modifier = Modifier.padding(22.dp)) {
                        Text("ENTRENAMIENTO", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            current?.name ?: "Listo para empezar",
                            style = MaterialTheme.typography.headlineSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                        Text(
                            if (current == null) "Comienza una sesiÃ³n y lleva tu progreso contigo." else "Tienes una sesiÃ³n en curso.",
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.75f),
                        )
                        Spacer(Modifier.height(18.dp))
                        Button(
                            onClick = { if (current != null) onOpenSession(current.id) else onNewSession() },
                            shape = RoundedCornerShape(16.dp),
                        ) { Text(if (current != null) "Continuar sesiÃ³n" else "Empezar entrenamiento") }
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    DashboardMetric("Sesiones", sessions.size.toString(), Modifier.weight(1f))
                    DashboardMetric("Completadas", completed.toString(), Modifier.weight(1f))
                    DashboardMetric("Racha", "â€”", Modifier.weight(1f))
                }
            }
            if (infoMessage != null) item { Text(infoMessage, color = MaterialTheme.colorScheme.primary) }
            if (error != null) item { Text(error, color = MaterialTheme.colorScheme.error) }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Actividad reciente", style = MaterialTheme.typography.titleLarge)
                    TextButton(onClick = onStats) { Text("Ver progreso") }
                }
            }
            if (sessions.isEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Text("TodavÃ­a no hay entrenamientos", style = MaterialTheme.typography.titleMedium)
                            Text("Tu historial aparecerÃ¡ aquÃ­ despuÃ©s de la primera sesiÃ³n.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            } else {
                items(sessions.take(4), key = { it.id }) { session ->
                    DashboardSessionCard(session, onClick = { onOpenSession(session.id) })
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedAction("Ejercicios", onExercises, Modifier.weight(1f))
                    OutlinedAction("Backup", onExport, Modifier.weight(1f))
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun DashboardMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier, shape = RoundedCornerShape(18.dp)) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(value, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun DashboardSessionCard(session: WorkoutSession, onClick: () -> Unit) {
    val progress = SessionProgressCalculator.calculate(session)
    Card(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(session.name, style = MaterialTheme.typography.titleMedium)
                    Text(formatSessionDate(session.startedAtEpochMillis), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text("${progress.completionPercent}%", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
            }
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(progress = { progress.completionPercent / 100f }, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun OutlinedAction(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    androidx.compose.material3.OutlinedButton(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(14.dp)) {
        Text(label)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SessionHistoryScreen(
    sessions: List<WorkoutSession>,
    isImporting: Boolean,
    isExporting: Boolean,
    infoMessage: String?,
    error: String?,
    onImport: () -> Unit,
    onExport: () -> Unit,
    onOpenSession: (String) -> Unit,
    onStats: () -> Unit,
    onRoutines: () -> Unit,
    onExercises: () -> Unit,
    onSettings: () -> Unit,
    onNewSession: () -> Unit,
    onBack: () -> Unit,
) {
    var showMoreActions by remember { mutableStateOf(false) }
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onBack) { Text("â€¹") } },
                title = {
                    Column {
                        Text("LiftLog")
                        Text(
                            text = "Tu actividad",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = {
                    TextButton(onClick = onStats) { Text("Stats") }
                    TextButton(onClick = onNewSession) { Text("Nuevo") }
                    Box {
                        IconButton(onClick = { showMoreActions = true }) { Text("...") }
                        DropdownMenu(
                            expanded = showMoreActions,
                            onDismissRequest = { showMoreActions = false },
                        ) {
                            DropdownMenuItem(
                                text = { Text("Ejercicios") },
                                onClick = { showMoreActions = false; onExercises() },
                            )
                            DropdownMenuItem(
                                text = { Text("Rutinas") },
                                onClick = { showMoreActions = false; onRoutines() },
                            )
                            DropdownMenuItem(
                                text = { Text("Ajustes") },
                                onClick = { showMoreActions = false; onSettings() },
                            )
                            DropdownMenuItem(
                                text = { Text(if (isExporting) "Exportando..." else "Exportar") },
                                enabled = !isExporting,
                                onClick = { showMoreActions = false; onExport() },
                            )
                            DropdownMenuItem(
                                text = { Text(if (isImporting) "Importando..." else "Importar") },
                                enabled = !isImporting,
                                onClick = { showMoreActions = false; onImport() },
                            )
                        }
                    }
                },
            )
        },
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Column(modifier = Modifier.padding(top = 16.dp)) {
                    Text("Sesiones", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        text = "Selecciona una sesiÃ³n para registrar sets o revisarla.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (infoMessage != null) {
                item { Text(infoMessage, color = MaterialTheme.colorScheme.primary) }
            }
            if (error != null) {
                item {
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            items(sessions, key = { it.id }) { session ->
                SessionHistoryCard(session = session, onClick = { onOpenSession(session.id) })
            }

            item {
                Text(
                    text = "ImportaciÃ³n v1: selecciona un JSON generado por LiftLog Expo. La validaciÃ³n ocurre antes de guardar y la escritura nativa es transaccional.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp, bottom = 24.dp),
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExerciseLibraryScreen(
    exercises: List<ExerciseDefinition>,
    error: String?,
    onBack: () -> Unit,
    onSave: (String, ExerciseType) -> Unit,
    onArchive: (String) -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    var showNewExercise by rememberSaveable { mutableStateOf(false) }
    val visibleExercises = exercises.filter { exercise ->
        query.isBlank() || exercise.name.contains(query, ignoreCase = true) ||
            exercise.muscleGroup?.contains(query, ignoreCase = true) == true
    }

    if (showNewExercise) {
        var name by remember { mutableStateOf("") }
        var typeIndex by remember { mutableStateOf(0) }
        val types = ExerciseType.values().toList()
        AlertDialog(
            onDismissRequest = { showNewExercise = false },
            title = { Text("Nuevo ejercicio") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextField(value = name, onValueChange = { name = it }, label = { Text("Nombre") }, singleLine = true)
                    Text("Tipo: ${types[typeIndex].displayName()}", style = MaterialTheme.typography.bodyMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        TextButton(onClick = { typeIndex = (typeIndex - 1 + types.size) % types.size }) { Text("Anterior") }
                        TextButton(onClick = { typeIndex = (typeIndex + 1) % types.size }) { Text("Siguiente") }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onSave(name, types[typeIndex])
                        showNewExercise = false
                    },
                    enabled = name.isNotBlank(),
                ) { Text("Guardar") }
            },
            dismissButton = { TextButton(onClick = { showNewExercise = false }) { Text("Cancelar") } },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onBack) { Text("<- ") } },
                title = { Text("Ejercicios") },
                actions = { TextButton(onClick = { showNewExercise = true }) { Text("Nuevo") } },
            )
        },
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                TextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp),
                    label = { Text("Buscar") },
                    singleLine = true,
                )
            }
            if (error != null) item { Text(error, color = MaterialTheme.colorScheme.error) }
            if (visibleExercises.isEmpty()) {
                item { Text("No hay ejercicios que coincidan.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            } else {
                items(visibleExercises, key = { it.id }) { exercise ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(exercise.name, style = MaterialTheme.typography.titleMedium)
                                Text(exercise.type.displayName(), style = MaterialTheme.typography.bodySmall)
                                exercise.muscleGroup?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                if (exercise.isArchived) Text("Archivado", color = MaterialTheme.colorScheme.error)
                            }
                            if (!exercise.isArchived) {
                                TextButton(onClick = { onArchive(exercise.id) }) { Text("Archivar") }
                            }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoutineListScreen(
    routines: List<WorkoutRoutine>,
    folders: List<com.liftlog.shared.domain.WorkoutTemplateFolder>,
    availableExercises: List<ExerciseDefinition>,
    error: String?,
    onBack: () -> Unit,
    onStartEmpty: () -> Unit,
    onStart: (String) -> Unit,
    onDelete: (String) -> Unit,
    onSave: (WorkoutRoutine) -> Unit,
    onCreateFolder: (String) -> Unit,
    onDeleteFolder: (String) -> Unit,
    onMoveToFolder: (String, String?) -> Unit,
) {
    var editorRoutine by remember { mutableStateOf<WorkoutRoutine?>(null) }
    var showEditor by rememberSaveable { mutableStateOf(false) }
    var showFolderDialog by rememberSaveable { mutableStateOf(false) }
    var movingRoutineId by rememberSaveable { mutableStateOf<String?>(null) }
    var folderMenuExpanded by remember { mutableStateOf(false) }
    if (showEditor) {
        RoutineEditorDialog(
            initialRoutine = editorRoutine,
            availableExercises = availableExercises,
            onDismiss = { showEditor = false },
            onSave = {
                onSave(it)
                showEditor = false
            },
        )
    }
    if (showFolderDialog) {
        TemplateFolderDialog(
            onDismiss = { showFolderDialog = false },
            onSave = { name ->
                onCreateFolder(name)
                showFolderDialog = false
            },
        )
    }
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onBack) { Text("<- ") } },
                title = { Text("Templates") },
                actions = {
                    TextButton(onClick = { showFolderDialog = true }) { Text("Folder") }
                    TextButton(onClick = { editorRoutine = null; showEditor = true }) { Text("Template") }
                },
            )
        },
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                GainsLabWordmarkNative(modifier = Modifier.padding(top = 14.dp))
                Text("Your workout library", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "Start empty when the plan changes. Save any workout as a template when it works.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 10.dp)) {
                    Button(onClick = onStartEmpty, shape = RoundedCornerShape(14.dp)) { Text("Start empty") }
                    androidx.compose.material3.OutlinedButton(onClick = { showFolderDialog = true }, shape = RoundedCornerShape(14.dp)) {
                        Text("New folder")
                    }
                }
            }
            if (error != null) {
                item { Text(error, color = MaterialTheme.colorScheme.error) }
            }
            if (routines.isEmpty()) {
                item { Text("No templates yet. Start a workout and save it here.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            folders.forEach { folder ->
                item(key = "folder-header-${folder.id}") {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(folder.name, style = MaterialTheme.typography.titleLarge)
                        TextButton(onClick = { onDeleteFolder(folder.id) }) { Text("Delete") }
                    }
                }
                items(
                    routines.filter { it.folderId == folder.id },
                    key = { it.id },
                ) { routine ->
                    TemplateCard(
                        routine = routine,
                        folders = folders,
                        moving = movingRoutineId == routine.id && folderMenuExpanded,
                        onStart = { onStart(routine.id) },
                        onEdit = { editorRoutine = routine; showEditor = true },
                        onDelete = { onDelete(routine.id) },
                        onMove = {
                            movingRoutineId = routine.id
                            folderMenuExpanded = true
                        },
                        onMoveToFolder = { target ->
                            onMoveToFolder(routine.id, target)
                            movingRoutineId = null
                            folderMenuExpanded = false
                        },
                    )
                }
            }
            item(key = "folder-header-unfiled") {
                Text("Unfiled", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
            }
            items(routines.filter { it.folderId == null }, key = { it.id }) { routine ->
                TemplateCard(
                    routine = routine,
                    folders = folders,
                    moving = movingRoutineId == routine.id && folderMenuExpanded,
                    onStart = { onStart(routine.id) },
                    onEdit = { editorRoutine = routine; showEditor = true },
                    onDelete = { onDelete(routine.id) },
                    onMove = {
                        movingRoutineId = routine.id
                        folderMenuExpanded = true
                    },
                    onMoveToFolder = { target ->
                        onMoveToFolder(routine.id, target)
                        movingRoutineId = null
                        folderMenuExpanded = false
                    },
                )
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun TemplateCard(
    routine: WorkoutRoutine,
    folders: List<com.liftlog.shared.domain.WorkoutTemplateFolder>,
    moving: Boolean,
    onStart: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onMove: () -> Unit,
    onMoveToFolder: (String?) -> Unit,
) {
    val orderedExercises = routine.exercises.sortedBy(RoutineExercise::position)
    val supersetGroups = orderedExercises.mapNotNull { it.supersetGroup }.distinct()
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(routine.name, style = MaterialTheme.typography.titleMedium)
            routine.description?.takeIf { it.isNotBlank() }?.let { description ->
                Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                "${routine.exercises.size} exercises Â· ${routine.exercises.sumOf { it.plannedSetCount }} sets",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            supersetGroups.forEachIndexed { index, group ->
                val members = orderedExercises.filter { it.supersetGroup == group }
                if (members.size >= 2) {
                    Text(
                        "${if (members.size > 2) "Circuit" else "Superset"} ${('A'.code + index).toChar()} Â· " +
                            members.mapIndexed { memberIndex, exercise ->
                                "${('A'.code + index).toChar()}${memberIndex + 1} ${exercise.exercise.name}"
                            }.joinToString(" Â· "),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Box {
                    TextButton(onClick = onMove) { Text("Move") }
                    DropdownMenu(expanded = moving, onDismissRequest = { onMoveToFolder(routine.folderId) }) {
                        DropdownMenuItem(text = { Text("Unfiled") }, onClick = { onMoveToFolder(null) })
                        folders.forEach { folder ->
                            DropdownMenuItem(text = { Text(folder.name) }, onClick = { onMoveToFolder(folder.id) })
                        }
                    }
                }
                TextButton(onClick = onEdit) { Text("Edit") }
                TextButton(onClick = onDelete) { Text("Delete") }
                Button(onClick = onStart, shape = RoundedCornerShape(12.dp)) { Text("Start") }
            }
        }
    }
}

@Composable
private fun TemplateFolderDialog(
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    var name by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New template folder") },
        text = {
            TextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Folder name") },
                singleLine = true,
            )
        },
        confirmButton = {
            Button(onClick = { onSave(name.trim()) }, enabled = name.isNotBlank()) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

private data class RoutineExerciseEditorData(
    val setCount: String = "3",
    val targetReps: String = "",
    val restSeconds: String = "90",
    val progressionMode: ProgressionMode = ProgressionMode.NONE,
    val progressionIncrement: String = "",
)

@Composable
private fun RoutineEditorDialog(
    initialRoutine: WorkoutRoutine?,
    availableExercises: List<ExerciseDefinition>,
    onDismiss: () -> Unit,
    onSave: (WorkoutRoutine) -> Unit,
) {
    val existingByExercise = remember(initialRoutine?.id) {
        initialRoutine?.exercises?.associateBy { it.exercise.id }.orEmpty()
    }
    var name by remember(initialRoutine?.id) { mutableStateOf(initialRoutine?.name.orEmpty()) }
    var description by remember(initialRoutine?.id) { mutableStateOf(initialRoutine?.description.orEmpty()) }
    var selectedIds by remember(initialRoutine?.id) {
        mutableStateOf(initialRoutine?.exercises?.sortedBy(RoutineExercise::position)?.map { it.exercise.id }.orEmpty())
    }
    var configs by remember(initialRoutine?.id) {
        mutableStateOf(
            existingByExercise.mapValues { (_, exercise) ->
                RoutineExerciseEditorData(
                    setCount = exercise.plannedSetCount.toString(),
                    targetReps = exercise.targetRepsMin?.toString().orEmpty(),
                    restSeconds = (exercise.restSeconds ?: exercise.restConfig?.minRestSeconds ?: 90).toString(),
                    progressionMode = exercise.progression?.mode ?: ProgressionMode.NONE,
                    progressionIncrement = exercise.progression?.increment?.toString().orEmpty(),
                )
            },
        )
    }
    var supersetGroups by remember(initialRoutine?.id) {
        mutableStateOf(initialRoutine?.exercises?.associate { it.exercise.id to it.supersetGroup }.orEmpty())
    }
    var pairingRoutineExerciseId by rememberSaveable(initialRoutine?.id) { mutableStateOf<String?>(null) }

    pairingRoutineExerciseId?.let { currentId ->
        val selectedExercises = selectedIds.mapNotNull { id -> availableExercises.firstOrNull { it.id == id } }
        val options = selectedExercises.map { exercise ->
            SupersetPairOption(
                id = exercise.id,
                name = exercise.name,
                badge = routineSupersetBadge(selectedIds, supersetGroups, exercise.id),
                groupId = supersetGroups[exercise.id],
            )
        }
        options.firstOrNull { it.id == currentId }?.let { currentOption ->
            SupersetPairDialog(
                currentExercise = currentOption,
                exercises = options,
                onDismiss = { pairingRoutineExerciseId = null },
                onPair = { targetId ->
                    val currentGroup = supersetGroups[currentId]
                    val targetGroup = supersetGroups[targetId]
                    val groupId = currentGroup ?: targetGroup ?: "superset-${System.currentTimeMillis()}"
                    val groupsToMerge = setOfNotNull(currentGroup, targetGroup)
                    supersetGroups = supersetGroups.mapValues { (id, group) ->
                        if (id == currentId || id == targetId || (group != null && group in groupsToMerge)) groupId else group
                    }
                    pairingRoutineExerciseId = null
                },
                onUnpair = {
                    val group = supersetGroups[currentId]
                    val members = supersetGroups.values.count { it == group }
                    supersetGroups = supersetGroups.mapValues { (id, value) ->
                        if (id == currentId || (members <= 2 && value == group)) null else value
                    }
                    pairingRoutineExerciseId = null
                },
            )
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initialRoutine == null) "Nueva rutina" else "Editar rutina") },
        text = {
            LazyColumn(
                modifier = Modifier.height(480.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    TextField(value = name, onValueChange = { name = it }, label = { Text("Nombre") }, singleLine = true)
                    Spacer(Modifier.height(8.dp))
                    TextField(value = description, onValueChange = { description = it }, label = { Text("Descripcion") })
                    Spacer(Modifier.height(8.dp))
                    Text("Selecciona ejercicios y configura sets, descanso y progresion.", style = MaterialTheme.typography.bodySmall)
                }
                items(availableExercises, key = { it.id }) { exercise ->
                    val selected = exercise.id in selectedIds
                    val config = configs[exercise.id] ?: RoutineExerciseEditorData()
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            TextButton(
                                onClick = {
                                    selectedIds = if (selected) selectedIds - exercise.id else selectedIds + exercise.id
                                    if (!selected) configs = configs + (exercise.id to config)
                                    if (selected) supersetGroups = supersetGroups - exercise.id
                                },
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(if (selected) "âœ“ ${exercise.name}" else "+ ${exercise.name}")
                            }
                            if (selected) {
                                val supersetBadge = routineSupersetBadge(selectedIds, supersetGroups, exercise.id)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Text(
                                        text = supersetBadge?.let { "${if (selectedIds.count { id -> supersetGroups[id] == supersetGroups[exercise.id] } > 2) "Circuit" else "Superset"} $it" }
                                            ?: "Sin pair",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (supersetBadge != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    TextButton(onClick = { pairingRoutineExerciseId = exercise.id }) {
                                        Text(if (supersetBadge == null) "Pair" else "Edit pair")
                                    }
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    NumericField("Sets", config.setCount, { value -> configs = configs + (exercise.id to config.copy(setCount = value)) }, KeyboardType.Number, Modifier.weight(1f))
                                    NumericField("Reps", config.targetReps, { value -> configs = configs + (exercise.id to config.copy(targetReps = value)) }, KeyboardType.Number, Modifier.weight(1f))
                                }
                                NumericField("Descanso (seg)", config.restSeconds, { value -> configs = configs + (exercise.id to config.copy(restSeconds = value)) }, KeyboardType.Number)
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    TextButton(onClick = {
                                        val next = when (config.progressionMode) {
                                            ProgressionMode.NONE -> ProgressionMode.INCREASE_ALL
                                            ProgressionMode.INCREASE_ALL -> ProgressionMode.INCREASE_LOWEST
                                            ProgressionMode.INCREASE_LOWEST -> ProgressionMode.NONE
                                        }
                                        configs = configs + (exercise.id to config.copy(progressionMode = next))
                                    }) { Text("Progresion: ${config.progressionMode.displayName()}") }
                                    if (config.progressionMode != ProgressionMode.NONE) {
                                        NumericField("Incremento", config.progressionIncrement, { value -> configs = configs + (exercise.id to config.copy(progressionIncrement = value)) }, KeyboardType.Decimal, Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val now = System.currentTimeMillis()
                    val routineId = initialRoutine?.id ?: "routine-$now"
                    val routineExercises = selectedIds.mapIndexedNotNull { position, exerciseId ->
                        val exercise = availableExercises.firstOrNull { it.id == exerciseId } ?: return@mapIndexedNotNull null
                        val config = configs[exerciseId] ?: RoutineExerciseEditorData()
                        val sets = config.setCount.toIntOrNull()?.coerceIn(0, 50) ?: 3
                        val reps = config.targetReps.toIntOrNull()?.takeIf { it > 0 }
                        val rest = config.restSeconds.toIntOrNull()?.takeIf { it > 0 }
                        val increment = config.progressionIncrement.toDoubleOrNull()?.takeIf { it > 0.0 }
                        RoutineExercise(
                            id = existingByExercise[exerciseId]?.id ?: "$routineId:exercise:$position",
                            position = position,
                            exercise = exercise,
                            plannedSetCount = sets,
                            targetRepsMin = reps,
                            targetRepsMax = reps,
                            restSeconds = rest,
                            restConfig = rest?.let { RestConfig(minRestSeconds = it) },
                            progression = if (config.progressionMode == ProgressionMode.NONE || increment == null) {
                                null
                            } else {
                                ProgressionRule(config.progressionMode, increment)
                            },
                            supersetGroup = supersetGroups[exerciseId],
                        )
                    }
                    onSave(
                        WorkoutRoutine(
                            id = routineId,
                            name = name.trim(),
                            description = description.trim().ifBlank { null },
                            createdAtEpochMillis = initialRoutine?.createdAtEpochMillis ?: now,
                            updatedAtEpochMillis = now,
                            exercises = routineExercises,
                        ),
                    )
                },
                enabled = name.isNotBlank() && selectedIds.isNotEmpty(),
            ) { Text("Guardar") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NativeSettingsScreen(
    settings: NativeSettingsUiState,
    onBack: () -> Unit,
    onSaveDefaultRest: (Int) -> Unit,
    onSignInCloud: (String, String, Boolean) -> Unit,
    onSignOutCloud: () -> Unit,
    onUploadCloud: () -> Unit,
    onRestoreCloud: () -> Unit,
) {
    var restSeconds by rememberSaveable(settings.defaultRestSeconds) {
        mutableStateOf(settings.defaultRestSeconds.toString())
    }
    var cloudEmail by rememberSaveable { mutableStateOf(settings.cloudEmail.orEmpty()) }
    var cloudPassword by rememberSaveable { mutableStateOf("") }
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onBack) { Text("<- ") } },
                title = { Text("Ajustes") },
            )
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Entrenamiento", style = MaterialTheme.typography.headlineSmall)
            TextField(
                value = restSeconds,
                onValueChange = { restSeconds = it.filter(Char::isDigit) },
                label = { Text("Descanso por defecto (segundos)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = { onSaveDefaultRest(restSeconds.toIntOrNull() ?: settings.defaultRestSeconds) },
                enabled = restSeconds.toIntOrNull()?.let { it in 1..3600 } == true,
            ) { Text("Guardar preferencias") }
            Text("Sincronizacion remota", style = MaterialTheme.typography.headlineSmall)
            if (!settings.cloudConfigured) {
                Text(
                    "Supabase no esta configurado en este APK. Compila con LIFTLOG_SUPABASE_URL y LIFTLOG_SUPABASE_ANON_KEY para habilitarlo.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextField(
                value = cloudEmail,
                onValueChange = { cloudEmail = it },
                label = { Text("Correo") },
                singleLine = true,
                enabled = settings.cloudConfigured && settings.cloudEmail == null,
                modifier = Modifier.fillMaxWidth(),
            )
            TextField(
                value = cloudPassword,
                onValueChange = { cloudPassword = it },
                label = { Text("ContraseÃ±a") },
                singleLine = true,
                enabled = settings.cloudConfigured && settings.cloudEmail == null,
                modifier = Modifier.fillMaxWidth(),
            )
            if (settings.cloudEmail == null) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { onSignInCloud(cloudEmail, cloudPassword, false) },
                        enabled = settings.cloudConfigured && !settings.cloudBusy && cloudEmail.isNotBlank() && cloudPassword.isNotBlank(),
                    ) { Text("Iniciar sesion") }
                    TextButton(
                        onClick = { onSignInCloud(cloudEmail, cloudPassword, true) },
                        enabled = settings.cloudConfigured && !settings.cloudBusy && cloudEmail.isNotBlank() && cloudPassword.isNotBlank(),
                    ) { Text("Crear cuenta") }
                }
            } else {
                Text("Conectado como ${settings.cloudEmail}", color = MaterialTheme.colorScheme.primary)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onUploadCloud, enabled = !settings.cloudBusy) { Text("Subir backup") }
                    Button(onClick = onRestoreCloud, enabled = !settings.cloudBusy) { Text("Restaurar") }
                    TextButton(onClick = onSignOutCloud, enabled = !settings.cloudBusy) { Text("Salir") }
                }
            }
            settings.cloudMessage?.let { message ->
                Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text("Datos", style = MaterialTheme.typography.headlineSmall)
            Text(
                "Las sesiones, rutinas y ejercicios se guardan localmente en SQLite. " +
                    "El backup JSON se inicia desde Historial > Exportar y se restaura con Importar.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text("LiftLog Native Â· piloto Android", style = MaterialTheme.typography.labelLarge)
            Text(
                "Este package sigue aislado para mantener la app productiva Expo como rollback.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkoutStatsScreen(
    sessions: List<WorkoutSession>,
    onBack: () -> Unit,
) {
    val stats = WorkoutStatisticsCalculator.calculate(sessions)

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onBack) { Text("<- ") } },
                title = { Text("Estadisticas") },
            )
        },
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Text(
                    "Resumen de tus entrenamientos",
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.padding(top = 16.dp),
                )
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    StatCard("Sesiones", stats.totalSessions.toString(), Modifier.weight(1f))
                    StatCard("Completadas", stats.completedSessions.toString(), Modifier.weight(1f))
                }
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    StatCard("Sets", "${stats.completedSets}/${stats.totalSets}", Modifier.weight(1f))
                    StatCard("Volumen", formatVolume(stats.totalVolume), Modifier.weight(1f))
                }
            }
            item {
                Text(
                    "Completitud global: ${stats.completionPercent}%" +
                        (stats.averageSessionDurationSeconds?.let { " Â· Duracion media: ${it / 60} min" } ?: ""),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            item { Text("Ejercicios", style = MaterialTheme.typography.titleLarge) }
            if (stats.exerciseStatistics.isEmpty()) {
                item { Text("Todavia no hay ejercicios registrados.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            } else {
                items(stats.exerciseStatistics, key = { it.exerciseId }) { exercise ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(exercise.exerciseName, style = MaterialTheme.typography.titleMedium)
                            Text(
                                "${exercise.sessions} sesiones Â· ${exercise.completedSets} sets Â· volumen ${formatVolume(exercise.totalVolume)}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            exercise.bestWeight?.let { best ->
                                Text("Mejor peso: ${formatVolume(best)}")
                            }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(value, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun formatVolume(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString() else "%.1f".format(Locale.getDefault(), value)

@Composable
private fun SessionHistoryCard(session: WorkoutSession, onClick: () -> Unit) {
    val progress = SessionProgressCalculator.calculate(session)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(session.name, style = MaterialTheme.typography.titleMedium)
                    Text(
                        formatSessionDate(session.startedAtEpochMillis),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        if (session.completedAtEpochMillis == null) "En curso" else "Completada",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (session.completedAtEpochMillis == null) {
                            MaterialTheme.colorScheme.tertiary
                        } else {
                            MaterialTheme.colorScheme.primary
                        },
                    )
                }
                Text(
                    text = "${progress.completionPercent}%",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Spacer(Modifier.height(10.dp))
            LinearProgressIndicator(
                progress = { progress.completionPercent / 100f },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = "${progress.completedSets} de ${progress.plannedSets} sets completados",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun LoadingScreen() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator()
        Spacer(Modifier.height(16.dp))
        Text("Abriendo sesiones guardadas")
    }
}

@Composable
private fun ErrorScreen(message: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("No se pudo abrir LiftLog Native", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(8.dp))
        Text(message, color = MaterialTheme.colorScheme.error)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ActiveWorkoutScreen(
    session: WorkoutSession,
    historySessions: List<WorkoutSession>,
    error: String?,
    onBack: () -> Unit,
    onSetToggle: (String, LoggedSet) -> Unit,
    onSetQuickToggle: (String, LoggedSet) -> Unit,
    onSetDraftChange: (String, LoggedSet) -> Unit,
    onMoveExercise: (String, Int) -> Unit,
    onMoveSet: (String, String, Int) -> Unit,
    onPairExercises: (String, String) -> Unit,
    onUnpairExercise: (String) -> Unit,
    onAddSet: (String) -> Unit,
    onRemoveExercise: (String) -> Unit,
    onUpdateExerciseNotes: (String, String) -> Unit,
    onRenameSession: (String) -> Unit,
    onComplete: () -> Unit,
    availableExercises: List<ExerciseDefinition>,
    onAddExercise: (String) -> Unit,
    templateFolders: List<com.liftlog.shared.domain.WorkoutTemplateFolder>,
    onSaveRoutine: (String, String?) -> Unit,
    restTimer: RestTimerUiState,
    onStopRestTimer: () -> Unit,
    onHealthConnect: () -> Unit,
) {
    val progress = SessionProgressCalculator.calculate(session)
    val finishStats = WorkoutStatisticsCalculator.calculate(listOf(session))
    var editingExerciseId by rememberSaveable { mutableStateOf<String?>(null) }
    var editingSetIndex by rememberSaveable { mutableStateOf(-1) }
    var showExercisePicker by rememberSaveable { mutableStateOf(false) }
    var showMoreActions by rememberSaveable { mutableStateOf(false) }
    var showSaveTemplate by rememberSaveable { mutableStateOf(false) }
    var showFinishDialog by rememberSaveable { mutableStateOf(false) }
    var showRenameDialog by rememberSaveable { mutableStateOf(false) }
    var pairingExerciseId by rememberSaveable { mutableStateOf<String?>(null) }
    var notesExerciseId by rememberSaveable { mutableStateOf<String?>(null) }
    var notesDraft by rememberSaveable { mutableStateOf("") }
    var exerciseQuery by rememberSaveable { mutableStateOf("") }
    var muscleFilter by rememberSaveable { mutableStateOf("All") }
    var pickerSortDescending by rememberSaveable { mutableStateOf(false) }
    var pickerFilterExpanded by remember { mutableStateOf(false) }
    var renameDraft by rememberSaveable(session.id) { mutableStateOf(session.name) }
    var nowEpochMillis by remember { mutableStateOf(System.currentTimeMillis()) }
    val editingExercise = editingExerciseId?.let { id -> session.exercises.firstOrNull { it.id == id } }
    val editingSet = editingExercise?.sets?.firstOrNull { it.index == editingSetIndex }
    val notesExercise = notesExerciseId?.let { id -> session.exercises.firstOrNull { it.id == id } }

    androidx.compose.runtime.LaunchedEffect(session.id) {
        while (true) {
            nowEpochMillis = System.currentTimeMillis()
            delay(1_000)
        }
    }

    if (editingExercise != null && editingSet != null) {
        SetEditorDialog(
            exerciseType = editingExercise.exercise.type,
            set = editingSet,
            onDismiss = {
                editingExerciseId = null
                editingSetIndex = -1
            },
            onSave = { updatedSet ->
                onSetToggle(editingExercise.id, updatedSet)
                editingExerciseId = null
                editingSetIndex = -1
            },
        )
    }

    if (showExercisePicker) {
        PolishedExercisePickerDialog(
            availableExercises = availableExercises,
            query = exerciseQuery,
            onQueryChange = { exerciseQuery = it },
            muscleFilter = muscleFilter,
            onMuscleFilterChange = { muscleFilter = it },
            sortDescending = pickerSortDescending,
            onToggleSort = { pickerSortDescending = !pickerSortDescending },
            onDismiss = {
                showExercisePicker = false
                exerciseQuery = ""
                muscleFilter = "All"
            },
            onAddExercise = { exerciseId ->
                onAddExercise(exerciseId)
                showExercisePicker = false
                exerciseQuery = ""
                muscleFilter = "All"
            },
        )
    }

    if (false && showExercisePicker) {
        AlertDialog(
            onDismissRequest = {
                showExercisePicker = false
                exerciseQuery = ""
                muscleFilter = "All"
            },
            title = { Text("Add exercise") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextField(
                        value = exerciseQuery,
                        onValueChange = { exerciseQuery = it },
                        label = { Text("Search exercises") },
                        singleLine = true,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box {
                            TextButton(onClick = { pickerFilterExpanded = true }) {
                                Text("Filter: $muscleFilter")
                            }
                            DropdownMenu(
                                expanded = pickerFilterExpanded,
                                onDismissRequest = { pickerFilterExpanded = false },
                            ) {
                                val groups = listOf("All") + availableExercises
                                    .mapNotNull(ExerciseDefinition::muscleGroup)
                                    .distinct()
                                    .sorted()
                                groups.forEach { group ->
                                    DropdownMenuItem(
                                        text = { Text(group) },
                                        onClick = {
                                            muscleFilter = group
                                            pickerFilterExpanded = false
                                        },
                                    )
                                }
                            }
                        }
                        TextButton(onClick = { pickerSortDescending = !pickerSortDescending }) {
                            Text(if (pickerSortDescending) "Z-A" else "A-Z")
                        }
                    }
                    val filteredExercises = availableExercises
                        .filter { exercise ->
                            (muscleFilter == "All" || exercise.muscleGroup == muscleFilter) &&
                                (exerciseQuery.isBlank() ||
                                    exercise.name.contains(exerciseQuery, ignoreCase = true) ||
                                    exercise.muscleGroup?.contains(exerciseQuery, ignoreCase = true) == true)
                        }
                        .sortedBy { it.name.lowercase(Locale.getDefault()) }
                        .let { exercises -> if (pickerSortDescending) exercises.reversed() else exercises }
                    LazyColumn(
                        modifier = Modifier.height(300.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        if (filteredExercises.isEmpty()) {
                            item { Text("No exercises match this search.") }
                        } else {
                            items(filteredExercises, key = { it.id }) { exercise ->
                                TextButton(
                                    onClick = {
                                        onAddExercise(exercise.id)
                                        showExercisePicker = false
                                        exerciseQuery = ""
                                        muscleFilter = "All"
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        Text(exercise.name)
                                        exercise.muscleGroup?.let {
                                            Text(
                                                it,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showExercisePicker = false
                        exerciseQuery = ""
                        muscleFilter = "All"
                    },
                ) { Text("Close") }
            },
        )
    }

    if (showRenameDialog) {
        AlertDialog(
            onDismissRequest = { showRenameDialog = false },
            title = { Text("Rename workout") },
            text = {
                TextField(
                    value = renameDraft,
                    onValueChange = { renameDraft = it },
                    label = { Text("Workout name") },
                    singleLine = true,
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onRenameSession(renameDraft)
                        showRenameDialog = false
                    },
                    enabled = renameDraft.isNotBlank(),
                ) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { showRenameDialog = false }) { Text("Cancel") } },
        )
    }

    if (notesExercise != null) {
        AlertDialog(
            onDismissRequest = { notesExerciseId = null },
            title = { Text("Exercise notes") },
            text = {
                TextField(
                    value = notesDraft,
                    onValueChange = { notesDraft = it },
                    label = { Text(notesExercise.exercise.name) },
                    minLines = 3,
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdateExerciseNotes(notesExercise.id, notesDraft)
                        notesExerciseId = null
                    },
                ) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { notesExerciseId = null }) { Text("Cancel") } },
        )
    }

    if (showSaveTemplate) {
        SaveTemplateDialog(
            sessionName = session.name,
            folders = templateFolders,
            onDismiss = { showSaveTemplate = false },
            onSave = { name, folderId ->
                onSaveRoutine(name, folderId)
                showSaveTemplate = false
            },
        )
    }

    if (showFinishDialog) {
        AlertDialog(
            onDismissRequest = { showFinishDialog = false },
            title = { Text("Finish workout?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Your session will be saved in History. You can also turn it into a reusable template now.")
                    Text(
                        "${finishStats.completedSets}/${finishStats.totalSets} sets Â· " +
                            "${session.exercises.size} exercises",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        "Duration ${formatElapsedWorkout(nowEpochMillis - session.startedAtEpochMillis)} Â· " +
                            "Volume ${"%.0f".format(Locale.getDefault(), finishStats.totalVolume)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(
                        onClick = {
                            onComplete()
                            showFinishDialog = false
                        },
                    ) { Text("Finish") }
                    Button(
                        onClick = {
                            onComplete()
                            showFinishDialog = false
                            showSaveTemplate = true
                        },
                    ) { Text("Finish & save") }
                }
            },
            dismissButton = { TextButton(onClick = { showFinishDialog = false }) { Text("Keep training") } },
        )
    }

    pairingExerciseId?.let { currentId ->
        val currentExercise = session.exercises.firstOrNull { it.id == currentId }
        if (currentExercise != null) {
            val pairOptions = session.exercises.map { exercise ->
                SupersetPairOption(
                    id = exercise.id,
                    name = exercise.exercise.name,
                    badge = sessionSupersetBadge(session.exercises, exercise),
                    groupId = exercise.supersetGroup,
                )
            }
            SupersetPairDialog(
                currentExercise = pairOptions.first { it.id == currentId },
                exercises = pairOptions,
                onDismiss = { pairingExerciseId = null },
                onPair = { targetId ->
                    onPairExercises(currentId, targetId)
                    pairingExerciseId = null
                },
                onUnpair = {
                    onUnpairExercise(currentId)
                    pairingExerciseId = null
                },
            )
        }
    }

    Scaffold(
        topBar = {
            SafeWorkoutHeader(
                sessionName = session.name,
                elapsed = formatElapsedWorkout(nowEpochMillis - session.startedAtEpochMillis),
                onBack = onBack,
                onRename = { renameDraft = session.name; showRenameDialog = true },
                onFinish = { showFinishDialog = true },
            )
        },    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 40.dp),
        ) {
            item {
                PolishedProgressCard(
                    sessionName = session.name,
                    completedSets = progress.completedSets,
                    plannedSets = progress.plannedSets,
                    completionPercent = progress.completionPercent,
                )
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    PolishedActionButton(
                        label = "+ Add exercise",
                        onClick = { showExercisePicker = true },
                        modifier = Modifier.weight(1f),
                        primary = true,
                    )
                    PolishedActionButton(
                        label = "Save template",
                        onClick = { showSaveTemplate = true },
                        modifier = Modifier.weight(1f),
                        primary = false,
                    )
                }
                TextButton(onClick = onHealthConnect) { Text("Export to Health Connect") }
            }

            if (session.exercises.isEmpty()) {
                item {
                    EmptyWorkoutCard(onAddExercise = { showExercisePicker = true })
                }
            }

            if (error != null) {
                item {
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            itemsIndexed(session.exercises, key = { _, exercise -> exercise.id }) { exerciseIndex, exercise ->
                val supersetBadge = sessionSupersetBadge(session.exercises, exercise)
                val groupId = exercise.supersetGroup
                val isSupersetStart = groupId != null && session.exercises
                    .take(exerciseIndex)
                    .none { it.supersetGroup == groupId }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (false && isSupersetStart) {
                        Text(
                            text = "${if (session.exercises.count { it.supersetGroup == groupId } > 2) "Circuit" else "Superset"} " +
                                "${supersetBadge?.firstOrNull() ?: 'A'} Â· alternate sets",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                    SafePolishedExerciseCard(
                        exercise = exercise,
                        previousSets = previousSetsFor(exercise, session, historySessions),
                        supersetBadge = supersetBadge,
                        supersetPartnerText = sessionSupersetPartnerText(session.exercises, exercise),
                        onSetEdit = { set ->
                            editingExerciseId = exercise.id
                            editingSetIndex = set.index
                        },
                        onSetToggle = { set -> onSetQuickToggle(exercise.id, set) },
                        onSetDraftChange = { set -> onSetDraftChange(exercise.id, set) },
                        onSetMove = { set, direction -> onMoveSet(exercise.id, set.id, direction) },
                        canMoveUp = exerciseIndex > 0,
                        canMoveDown = exerciseIndex < session.exercises.lastIndex,
                        onMoveUp = { onMoveExercise(exercise.id, -1) },
                        onMoveDown = { onMoveExercise(exercise.id, 1) },
                        onPair = { pairingExerciseId = exercise.id },
                        onRemove = { onRemoveExercise(exercise.id) },
                        onEditNotes = {
                            notesDraft = exercise.notes.orEmpty()
                            notesExerciseId = exercise.id
                        },
                        onAddSet = { onAddSet(exercise.id) },
                    )
                    if (restTimer.isRunning && restTimer.sourceExerciseId == exercise.id) {
                        SafePolishedRestTimerCard(
                            restTimer = restTimer,
                            exerciseName = exercise.exercise.name,
                            onStop = onStopRestTimer,
                        )
                    }
                }
            }

            item {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Your data is saved locally and stays available when you train offline.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 24.dp),
                )
            }
        }
    }
}

@Composable
private fun SafeWorkoutHeader(
    sessionName: String,
    elapsed: String,
    onBack: () -> Unit,
    onRename: () -> Unit,
    onFinish: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(top = 8.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Text("\u2039", style = MaterialTheme.typography.titleLarge)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                sessionName,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "$elapsed  \u00B7  in progress",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(
            "Rename",
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClick = onRename)
                .padding(horizontal = 4.dp, vertical = 8.dp),
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            "Finish",
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClick = onFinish)
                .padding(horizontal = 4.dp, vertical = 8.dp),
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun SafePolishedRestTimerCard(
    restTimer: RestTimerUiState,
    exerciseName: String,
    onStop: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        shape = RoundedCornerShape(16.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    "REST  \u00B7  $exerciseName",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "%02d:%02d".format(restTimer.remainingSeconds / 60, restTimer.remainingSeconds % 60),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                )
            }
            Text(
                "Stop",
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(onClick = onStop)
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun SafePolishedExerciseCard(
    exercise: SessionExercise,
    previousSets: Map<Int, LoggedSet>,
    supersetBadge: String?,
    supersetPartnerText: String?,
    onSetEdit: (LoggedSet) -> Unit,
    onSetToggle: (LoggedSet) -> Unit,
    onSetDraftChange: (LoggedSet) -> Unit,
    onSetMove: (LoggedSet, Int) -> Unit,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onPair: () -> Unit,
    onRemove: () -> Unit,
    onEditNotes: () -> Unit,
    onAddSet: () -> Unit,
) {
    var showMenu by rememberSaveable(exercise.id) { mutableStateOf(false) }
    val shape = RoundedCornerShape(18.dp)
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f), shape),
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = shape,
    ) {
        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 13.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .reorderOnLongPress(onMoveUp = onMoveUp, onMoveDown = onMoveDown),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                supersetBadge?.let { badge ->
                    Text(
                        badge,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.primaryContainer)
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        exercise.exercise.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        exercise.exercise.type.displayName(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    supersetBadge?.let { badge ->
                        Text(
                            "Superset ${badge.firstOrNull() ?: 'A'} \u00B7 alternate sets",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .clickable { showMenu = true },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("\u22EF", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                }
                if (canMoveUp) TextButton(onClick = onMoveUp) { Text("\u2191") }
                if (canMoveDown) TextButton(onClick = onMoveDown) { Text("\u2193") }
                DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                    DropdownMenuItem(
                        text = { Text(if (supersetBadge == null) "Pair exercise" else "Edit pairing") },
                        onClick = { showMenu = false; onPair() },
                    )
                    DropdownMenuItem(
                        text = { Text("Edit notes") },
                        onClick = { showMenu = false; onEditNotes() },
                    )
                    DropdownMenuItem(
                        text = { Text("Remove exercise") },
                        onClick = { showMenu = false; onRemove() },
                    )
                }
            }
            Spacer(Modifier.height(13.dp))
            PolishedSetHeader(exercise.exercise.type)
            exercise.sets.forEachIndexed { index, set ->
                SafePolishedSetRow(
                    set = set,
                    exerciseType = exercise.exercise.type,
                    previous = previousSets[set.index],
                    onClick = { onSetEdit(set) },
                    onToggle = { onSetToggle(set) },
                    onDraftChange = onSetDraftChange,
                    onMoveUp = if (index > 0) ({ onSetMove(set, -1) }) else null,
                    onMoveDown = if (index < exercise.sets.lastIndex) ({ onSetMove(set, 1) }) else null,
                )
            }
            Text(
                "+ Add set",
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(onClick = onAddSet)
                    .padding(top = 8.dp, end = 8.dp, bottom = 2.dp),
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun SafePolishedSetRow(
    set: LoggedSet,
    exerciseType: ExerciseType,
    previous: LoggedSet?,
    onClick: () -> Unit,
    onToggle: () -> Unit,
    onDraftChange: (LoggedSet) -> Unit,
    onMoveUp: (() -> Unit)?,
    onMoveDown: (() -> Unit)?,
) {
    var weightText by rememberSaveable(set.id) { mutableStateOf(set.weight?.toString().orEmpty()) }
    var repsText by rememberSaveable(set.id) { mutableStateOf(set.reps?.toString().orEmpty()) }
    var assistanceText by rememberSaveable(set.id) { mutableStateOf(set.assistance?.toString().orEmpty()) }
    var durationText by rememberSaveable(set.id) { mutableStateOf(set.durationSeconds?.toString().orEmpty()) }
    var distanceText by rememberSaveable(set.id) { mutableStateOf(set.distanceMeters?.toString().orEmpty()) }

    fun updateDraft() {
        val weight = weightText.toDoubleOrNull()
        onDraftChange(
            set.copy(
                weight = weight,
                weightUnit = if (weight != null) set.weightUnit ?: WeightUnit.KILOGRAMS else null,
                reps = repsText.toIntOrNull(),
                assistance = assistanceText.toDoubleOrNull(),
                durationSeconds = durationText.toLongOrNull(),
                distanceMeters = distanceText.toDoubleOrNull(),
            ),
        )
    }

    val draft = set.copy(
        weight = weightText.toDoubleOrNull(),
        reps = repsText.toIntOrNull(),
        assistance = assistanceText.toDoubleOrNull(),
        durationSeconds = durationText.toLongOrNull(),
        distanceMeters = distanceText.toDoubleOrNull(),
        completedAtEpochMillis = set.completedAtEpochMillis ?: 1L,
    )
    val canComplete = SessionProgressCalculator.isComplete(exerciseType, draft)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .reorderOnLongPress(onMoveUp = onMoveUp ?: {}, onMoveDown = onMoveDown ?: {})
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Column(modifier = Modifier.width(30.dp).clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text("${set.index + 1}", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            if (set.type != SetType.NORMAL) Text(set.type.displayName(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Column(modifier = Modifier.width(58.dp).clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(safeSetSummary(previous, exerciseType), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("Previous", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        }
        when (exerciseType) {
            ExerciseType.WEIGHT_REPS -> {
                PolishedNumericCell(if (set.weightUnit == WeightUnit.POUNDS) "LB" else "KG", weightText, { weightText = it; updateDraft() }, KeyboardType.Decimal, Modifier.weight(1f))
                PolishedNumericCell("REPS", repsText, { repsText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(1f))
            }
            ExerciseType.BODYWEIGHT_REPS -> PolishedNumericCell("REPS", repsText, { repsText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(2f))
            ExerciseType.ASSISTED_BODYWEIGHT_REPS -> {
                PolishedNumericCell("ASSIST", assistanceText, { assistanceText = it; updateDraft() }, KeyboardType.Decimal, Modifier.weight(1f))
                PolishedNumericCell("REPS", repsText, { repsText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(1f))
            }
            ExerciseType.DURATION -> PolishedNumericCell("SEC", durationText, { durationText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(2f))
            ExerciseType.DISTANCE -> PolishedNumericCell("M", distanceText, { distanceText = it; updateDraft() }, KeyboardType.Decimal, Modifier.weight(2f))
            ExerciseType.CARDIO, ExerciseType.MIXED -> {
                PolishedNumericCell("REPS", repsText, { repsText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(1f))
                PolishedNumericCell("SEC", durationText, { durationText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(1f))
            }
        }
        SafePolishedCompletionBox(
            checked = set.completedAtEpochMillis != null,
            enabled = canComplete || set.completedAtEpochMillis != null,
            onClick = { if (canComplete || set.completedAtEpochMillis != null) onToggle() },
        )
    }
}

private fun safeSetSummary(set: LoggedSet?, exerciseType: ExerciseType): String {
    if (set == null) return "\u2014"
    return when (exerciseType) {
        ExerciseType.WEIGHT_REPS -> listOfNotNull(set.weight?.let { formatCompactNumber(it) }, set.reps?.toString()).joinToString(" \u00D7 ")
        ExerciseType.BODYWEIGHT_REPS -> set.reps?.let { "$it reps" } ?: "\u2014"
        ExerciseType.ASSISTED_BODYWEIGHT_REPS -> listOfNotNull(set.assistance?.let { formatCompactNumber(it) }, set.reps?.toString()).joinToString(" \u00D7 ")
        ExerciseType.DURATION -> set.durationSeconds?.let { "${it}s" } ?: "\u2014"
        ExerciseType.DISTANCE -> set.distanceMeters?.let { "${formatCompactNumber(it)}m" } ?: "\u2014"
        ExerciseType.CARDIO, ExerciseType.MIXED -> listOfNotNull(set.reps?.toString(), set.durationSeconds?.let { "${it}s" }).joinToString(" \u00D7 ").ifBlank { "\u2014" }
    }
}

@Composable
private fun SafePolishedCompletionBox(checked: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier = Modifier
            .size(28.dp)
            .clip(shape)
            .background(if (checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceContainerHigh)
            .border(1.5.dp, if (checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline, shape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (checked) Text("\u2713", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
    }
}

@Composable
private fun PolishedExercisePickerDialog(
    availableExercises: List<ExerciseDefinition>,
    query: String,
    onQueryChange: (String) -> Unit,
    muscleFilter: String,
    onMuscleFilterChange: (String) -> Unit,
    sortDescending: Boolean,
    onToggleSort: () -> Unit,
    onDismiss: () -> Unit,
    onAddExercise: (String) -> Unit,
) {
    var filterExpanded by remember { mutableStateOf(false) }
    val groups = listOf("All") + availableExercises
        .mapNotNull(ExerciseDefinition::muscleGroup)
        .distinct()
        .sorted()
    val filteredExercises = availableExercises
        .filter { exercise ->
            (muscleFilter == "All" || exercise.muscleGroup == muscleFilter) &&
                (query.isBlank() ||
                    exercise.name.contains(query, ignoreCase = true) ||
                    exercise.muscleGroup?.contains(query, ignoreCase = true) == true)
        }
        .sortedBy { it.name.lowercase(Locale.getDefault()) }
        .let { exercises -> if (sortDescending) exercises.reversed() else exercises }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp),
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(26.dp),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("Add exercise", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text("Choose what you want to train", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(
                        "Close",
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .clickable(onClick = onDismiss)
                            .padding(horizontal = 4.dp, vertical = 8.dp),
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                PolishedSearchField(query, onQueryChange)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box {
                        PickerChip("Filter: $muscleFilter", active = muscleFilter != "All") { filterExpanded = true }
                        DropdownMenu(expanded = filterExpanded, onDismissRequest = { filterExpanded = false }) {
                            groups.forEach { group ->
                                DropdownMenuItem(
                                    text = { Text(group) },
                                    onClick = { onMuscleFilterChange(group); filterExpanded = false },
                                )
                            }
                        }
                    }
                    PickerChip(if (sortDescending) "Z-A" else "A-Z", active = true, onClick = onToggleSort)
                }
                LazyColumn(
                    modifier = Modifier.height(360.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (filteredExercises.isEmpty()) {
                        item {
                            Text(
                                "No exercises match this search.",
                                modifier = Modifier.padding(vertical = 16.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else {
                        items(filteredExercises, key = { it.id }) { exercise ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable { onAddExercise(exercise.id) }
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(exercise.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                                    exercise.muscleGroup?.let {
                                        Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                                Text("+", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleLarge)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PolishedSearchField(value: String, onValueChange: (String) -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .padding(horizontal = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Text("âŒ•", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleLarge)
        Box(modifier = Modifier.weight(1f)) {
            if (value.isBlank()) {
                Text("Search exercises", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                textStyle = ComposeTextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            )
        }
    }
}

@Composable
private fun PickerChip(label: String, active: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Text(
        label,
        modifier = Modifier
            .clip(shape)
            .background(if (active) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerHigh)
            .border(1.dp, if (active) MaterialTheme.colorScheme.primary.copy(alpha = 0.45f) else MaterialTheme.colorScheme.outlineVariant, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 11.dp, vertical = 8.dp),
        color = if (active) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
private fun WorkoutHeader(
    sessionName: String,
    elapsed: String,
    onBack: () -> Unit,
    onRename: () -> Unit,
    onFinish: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(top = 8.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Text("â€¹", style = MaterialTheme.typography.titleLarge)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                sessionName,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "$elapsed  Â·  in progress",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(
            "Rename",
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClick = onRename)
                .padding(horizontal = 4.dp, vertical = 8.dp),
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            "Finish",
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClick = onFinish)
                .padding(horizontal = 4.dp, vertical = 8.dp),
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun PolishedActionButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    primary: Boolean,
) {
    val shape = RoundedCornerShape(15.dp)
    Box(
        modifier = modifier
            .height(52.dp)
            .clip(shape)
            .background(
                if (primary) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.surfaceContainer,
            )
            .border(
                width = if (primary) 0.dp else 1.dp,
                color = MaterialTheme.colorScheme.outline,
                shape = shape,
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (primary) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun PolishedProgressCard(
    sessionName: String,
    completedSets: Int,
    plannedSets: Int,
    completionPercent: Int,
) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(
            "WORKOUT IN PROGRESS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
        )
        Text(
            sessionName,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.ExtraBold,
        )
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(18.dp),
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 15.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        if (plannedSets == 0) "Ready when you are" else "$completedSets/$plannedSets sets",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        "$completionPercent%",
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Spacer(Modifier.height(12.dp))
                LinearProgressIndicator(
                    progress = { completionPercent / 100f },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(99.dp)),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                )
            }
        }
    }
}

@Composable
private fun PolishedRestTimerCard(
    restTimer: RestTimerUiState,
    exerciseName: String,
    onStop: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        shape = RoundedCornerShape(16.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    "REST  Â·  $exerciseName",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "%02d:%02d".format(restTimer.remainingSeconds / 60, restTimer.remainingSeconds % 60),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                )
            }
            Text(
                "Stop",
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(onClick = onStop)
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun PolishedExerciseCard(
    exercise: SessionExercise,
    previousSets: Map<Int, LoggedSet>,
    supersetBadge: String?,
    supersetPartnerText: String?,
    onSetEdit: (LoggedSet) -> Unit,
    onSetToggle: (LoggedSet) -> Unit,
    onSetDraftChange: (LoggedSet) -> Unit,
    onSetMove: (LoggedSet, Int) -> Unit,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onPair: () -> Unit,
    onRemove: () -> Unit,
    onEditNotes: () -> Unit,
    onAddSet: () -> Unit,
) {
    var showMenu by rememberSaveable(exercise.id) { mutableStateOf(false) }
    val shape = RoundedCornerShape(18.dp)
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f), shape),
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = shape,
    ) {
        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 13.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .reorderOnLongPress(onMoveUp = onMoveUp, onMoveDown = onMoveDown),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                supersetBadge?.let { badge ->
                    Text(
                        badge,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.primaryContainer)
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        exercise.exercise.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        exercise.exercise.type.displayName(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    supersetPartnerText?.let { partner ->
                        Text(
                            partner.replace("Ã‚Â·", "Â·"),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .clickable { showMenu = true },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("â‹¯", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                }
                if (canMoveUp) SmallMoveButton("â†‘", onMoveUp)
                if (canMoveDown) SmallMoveButton("â†“", onMoveDown)
                DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                    DropdownMenuItem(
                        text = { Text(if (supersetBadge == null) "Pair exercise" else "Edit pairing") },
                        onClick = { showMenu = false; onPair() },
                    )
                    DropdownMenuItem(
                        text = { Text("Edit notes") },
                        onClick = { showMenu = false; onEditNotes() },
                    )
                    DropdownMenuItem(
                        text = { Text("Remove exercise") },
                        onClick = { showMenu = false; onRemove() },
                    )
                }
            }
            Spacer(Modifier.height(13.dp))
            PolishedSetHeader(exercise.exercise.type)
            exercise.sets.forEachIndexed { index, set ->
                PolishedSetRow(
                    set = set,
                    exerciseType = exercise.exercise.type,
                    previous = previousSets[set.index],
                    onClick = { onSetEdit(set) },
                    onToggle = { onSetToggle(set) },
                    onDraftChange = onSetDraftChange,
                    onMoveUp = if (index > 0) ({ onSetMove(set, -1) }) else null,
                    onMoveDown = if (index < exercise.sets.lastIndex) ({ onSetMove(set, 1) }) else null,
                )
            }
            Text(
                "+ Add set",
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(onClick = onAddSet)
                    .padding(top = 8.dp, end = 8.dp, bottom = 2.dp),
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun SmallMoveButton(label: String, onClick: () -> Unit) {
    Text(
        label,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 3.dp, vertical = 5.dp),
        color = MaterialTheme.colorScheme.primary,
        style = MaterialTheme.typography.labelLarge,
    )
}

@Composable
private fun PolishedSetHeader(exerciseType: ExerciseType) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("SET", modifier = Modifier.width(30.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        Text("PREV", modifier = Modifier.width(58.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        when (exerciseType) {
            ExerciseType.WEIGHT_REPS -> {
                Text("KG", modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
                Text("REPS", modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
            }
            ExerciseType.ASSISTED_BODYWEIGHT_REPS -> {
                Text("ASSIST", modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
                Text("REPS", modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
            }
            ExerciseType.CARDIO, ExerciseType.MIXED -> {
                Text("REPS", modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
                Text("SEC", modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
            }
            ExerciseType.BODYWEIGHT_REPS -> Text("REPS", modifier = Modifier.weight(2f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
            ExerciseType.DURATION -> Text("SEC", modifier = Modifier.weight(2f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
            ExerciseType.DISTANCE -> Text("M", modifier = Modifier.weight(2f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        }
        Spacer(Modifier.width(30.dp))
    }
}

@Composable
private fun PolishedSetRow(
    set: LoggedSet,
    exerciseType: ExerciseType,
    previous: LoggedSet?,
    onClick: () -> Unit,
    onToggle: () -> Unit,
    onDraftChange: (LoggedSet) -> Unit,
    onMoveUp: (() -> Unit)?,
    onMoveDown: (() -> Unit)?,
) {
    var weightText by rememberSaveable(set.id) { mutableStateOf(set.weight?.toString().orEmpty()) }
    var repsText by rememberSaveable(set.id) { mutableStateOf(set.reps?.toString().orEmpty()) }
    var assistanceText by rememberSaveable(set.id) { mutableStateOf(set.assistance?.toString().orEmpty()) }
    var durationText by rememberSaveable(set.id) { mutableStateOf(set.durationSeconds?.toString().orEmpty()) }
    var distanceText by rememberSaveable(set.id) { mutableStateOf(set.distanceMeters?.toString().orEmpty()) }

    fun updateDraft() {
        val weight = weightText.toDoubleOrNull()
        onDraftChange(
            set.copy(
                weight = weight,
                weightUnit = if (weight != null) set.weightUnit ?: WeightUnit.KILOGRAMS else null,
                reps = repsText.toIntOrNull(),
                assistance = assistanceText.toDoubleOrNull(),
                durationSeconds = durationText.toLongOrNull(),
                distanceMeters = distanceText.toDoubleOrNull(),
            ),
        )
    }

    val draft = set.copy(
        weight = weightText.toDoubleOrNull(),
        reps = repsText.toIntOrNull(),
        assistance = assistanceText.toDoubleOrNull(),
        durationSeconds = durationText.toLongOrNull(),
        distanceMeters = distanceText.toDoubleOrNull(),
        completedAtEpochMillis = set.completedAtEpochMillis ?: 1L,
    )
    val canComplete = SessionProgressCalculator.isComplete(exerciseType, draft)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .reorderOnLongPress(onMoveUp = onMoveUp ?: {}, onMoveDown = onMoveDown ?: {})
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Column(
            modifier = Modifier
                .width(30.dp)
                .clickable(onClick = onClick),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text("${set.index + 1}", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            if (set.type != SetType.NORMAL) {
                Text(set.type.displayName(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Column(modifier = Modifier.width(58.dp).clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(shortSetSummary(previous, exerciseType), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("Previous", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        }
        when (exerciseType) {
            ExerciseType.WEIGHT_REPS -> {
                PolishedNumericCell(if (set.weightUnit == WeightUnit.POUNDS) "LB" else "KG", weightText, { weightText = it; updateDraft() }, KeyboardType.Decimal, Modifier.weight(1f))
                PolishedNumericCell("REPS", repsText, { repsText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(1f))
            }
            ExerciseType.BODYWEIGHT_REPS -> PolishedNumericCell("REPS", repsText, { repsText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(2f))
            ExerciseType.ASSISTED_BODYWEIGHT_REPS -> {
                PolishedNumericCell("ASSIST", assistanceText, { assistanceText = it; updateDraft() }, KeyboardType.Decimal, Modifier.weight(1f))
                PolishedNumericCell("REPS", repsText, { repsText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(1f))
            }
            ExerciseType.DURATION -> PolishedNumericCell("SEC", durationText, { durationText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(2f))
            ExerciseType.DISTANCE -> PolishedNumericCell("M", distanceText, { distanceText = it; updateDraft() }, KeyboardType.Decimal, Modifier.weight(2f))
            ExerciseType.CARDIO, ExerciseType.MIXED -> {
                PolishedNumericCell("REPS", repsText, { repsText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(1f))
                PolishedNumericCell("SEC", durationText, { durationText = it; updateDraft() }, KeyboardType.Number, Modifier.weight(1f))
            }
        }
        PolishedCompletionBox(
            checked = set.completedAtEpochMillis != null,
            enabled = canComplete || set.completedAtEpochMillis != null,
            onClick = { if (canComplete || set.completedAtEpochMillis != null) onToggle() },
        )
    }
}

private fun shortSetSummary(set: LoggedSet?, exerciseType: ExerciseType): String {
    if (set == null) return "â€”"
    return when (exerciseType) {
        ExerciseType.WEIGHT_REPS -> listOfNotNull(set.weight?.let { formatCompactNumber(it) }, set.reps?.toString()).joinToString(" Ã— ")
        ExerciseType.BODYWEIGHT_REPS -> set.reps?.let { "$it reps" } ?: "â€”"
        ExerciseType.ASSISTED_BODYWEIGHT_REPS -> listOfNotNull(set.assistance?.let { formatCompactNumber(it) }, set.reps?.toString()).joinToString(" Ã— ")
        ExerciseType.DURATION -> set.durationSeconds?.let { "${it}s" } ?: "â€”"
        ExerciseType.DISTANCE -> set.distanceMeters?.let { "${formatCompactNumber(it)}m" } ?: "â€”"
        ExerciseType.CARDIO, ExerciseType.MIXED -> listOfNotNull(set.reps?.toString(), set.durationSeconds?.let { "${it}s" }).joinToString(" Ã— ").ifBlank { "â€”" }
    }
}

private fun formatCompactNumber(value: Double): String =
    if (value % 1.0 == 0.0) value.toInt().toString() else "%.1f".format(Locale.getDefault(), value)

@Composable
private fun PolishedNumericCell(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType,
    modifier: Modifier,
) {
    val shape = RoundedCornerShape(9.dp)
    Column(
        modifier = modifier
            .height(50.dp)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.65f), shape)
            .padding(horizontal = 9.dp, vertical = 5.dp),
        verticalArrangement = Arrangement.spacedBy(1.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            textStyle = ComposeTextStyle(
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Start,
            ),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        )
    }
}

@Composable
private fun PolishedCompletionBox(checked: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier = Modifier
            .size(28.dp)
            .clip(shape)
            .background(if (checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceContainerHigh)
            .border(
                1.5.dp,
                if (checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                shape,
            )
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (checked) {
            Text("âœ“", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        }
    }
}

@Composable
private fun RestTimerCard(
    restTimer: RestTimerUiState,
    exerciseName: String,
    onStop: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text("Rest Â· $exerciseName", style = MaterialTheme.typography.titleMedium)
                Text(
                    text = "%02d:%02d".format(restTimer.remainingSeconds / 60, restTimer.remainingSeconds % 60),
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    "Next set ready when the timer ends",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = onStop) { Text("Stop") }
        }
    }
}

@Composable
private fun EmptyWorkoutCard(onAddExercise: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Your workout is empty", style = MaterialTheme.typography.titleMedium)
            Text(
                "Add an exercise to start logging sets. You can rename or save this workout as a template at any time.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            androidx.compose.material3.OutlinedButton(onClick = onAddExercise) {
                Text("Add your first exercise")
            }
        }
    }
}

@Composable
private fun ProgressCard(
    sessionName: String,
    completedSets: Int,
    plannedSets: Int,
    completionPercent: Int,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            "WORKOUT IN PROGRESS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
        )
        Text(
            sessionName,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
        )
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = androidx.compose.material3.CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainer,
            ),
            shape = RoundedCornerShape(18.dp),
        ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (plannedSets == 0) {
                        "No exercises added"
                    } else {
                        "$completedSets/$plannedSets sets complete"
                    },
                    style = MaterialTheme.typography.labelLarge,
                )
                Text(
                    text = "$completionPercent%",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(
                progress = { completionPercent / 100f },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
        }
        }
    }
}

@Composable
private fun ExerciseCard(
    exercise: SessionExercise,
    previousSets: Map<Int, LoggedSet>,
    supersetBadge: String?,
    supersetPartnerText: String?,
    onSetEdit: (LoggedSet) -> Unit,
    onSetToggle: (LoggedSet) -> Unit,
    onSetDraftChange: (LoggedSet) -> Unit,
    onSetMove: (LoggedSet, Int) -> Unit,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onPair: () -> Unit,
    onRemove: () -> Unit,
    onEditNotes: () -> Unit,
    onAddSet: () -> Unit,
) {
    var showMenu by rememberSaveable(exercise.id) { mutableStateOf(false) }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        if (supersetBadge != null) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(4.dp)),
            )
        }
        Card(
            modifier = Modifier.weight(1f),
            colors = androidx.compose.material3.CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainer,
            ),
            shape = RoundedCornerShape(20.dp),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .reorderOnLongPress(onMoveUp = onMoveUp, onMoveDown = onMoveDown),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (supersetBadge != null) {
                        Text(
                            text = supersetBadge,
                            modifier = Modifier
                                .padding(end = 8.dp)
                                .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(8.dp))
                                .padding(horizontal = 7.dp, vertical = 4.dp),
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            style = MaterialTheme.typography.labelLarge,
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(exercise.exercise.name, style = MaterialTheme.typography.titleMedium)
                        Text(
                            text = exercise.exercise.type.displayName(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        supersetPartnerText?.let { partner ->
                            Text(
                                text = partner,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                    Box {
                        TextButton(onClick = { showMenu = true }) { Text("More") }
                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false },
                        ) {
                            DropdownMenuItem(
                                text = { Text(if (supersetBadge == null) "Pair exercise" else "Edit pairing") },
                                onClick = {
                                    showMenu = false
                                    onPair()
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Remove exercise") },
                                onClick = {
                                    showMenu = false
                                    onRemove()
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Edit notes") },
                                onClick = {
                                    showMenu = false
                                    onEditNotes()
                                },
                            )
                        }
                    }
                    if (canMoveUp) TextButton(onClick = onMoveUp) { Text("â†‘") }
                    if (canMoveDown) TextButton(onClick = onMoveDown) { Text("â†“") }
                }
                Spacer(Modifier.height(8.dp))
                exercise.sets.forEachIndexed { index, set ->
                    SetRow(
                        set = set,
                        exerciseType = exercise.exercise.type,
                        previous = previousSets[set.index],
                        onClick = { onSetEdit(set) },
                        onToggle = { onSetToggle(set) },
                        onDraftChange = onSetDraftChange,
                        onMoveUp = if (index > 0) ({ onSetMove(set, -1) }) else null,
                        onMoveDown = if (index < exercise.sets.lastIndex) ({ onSetMove(set, 1) }) else null,
                    )
                }
                TextButton(onClick = onAddSet) { Text("+ Add set") }
            }
        }
    }
}

private data class SupersetPairOption(
    val id: String,
    val name: String,
    val badge: String?,
    val groupId: String?,
)

@Composable
private fun SupersetPairDialog(
    currentExercise: SupersetPairOption,
    exercises: List<SupersetPairOption>,
    onDismiss: () -> Unit,
    onPair: (String) -> Unit,
    onUnpair: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (currentExercise.badge == null) "Pair exercise" else "Edit pair") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Selecciona el siguiente ejercicio para alternar sets. LiftLog los mostrara como A1, A2, etc.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(currentExercise.name, style = MaterialTheme.typography.titleMedium)
                LazyColumn(
                    modifier = Modifier.height(240.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    items(exercises.filter { it.id != currentExercise.id }, key = { it.id }) { candidate ->
                        TextButton(
                            onClick = { onPair(candidate.id) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                text = listOfNotNull(candidate.badge, candidate.name).joinToString(" Â· "),
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        dismissButton = if (currentExercise.groupId != null) {
            { TextButton(onClick = onUnpair) { Text("Unpair") } }
        } else {
            null
        },
    )
}

private fun sessionSupersetBadge(
    exercises: List<SessionExercise>,
    exercise: SessionExercise,
): String? {
    val group = exercise.supersetGroup ?: return null
    val members = exercises.filter { it.supersetGroup == group }
    if (members.size < 2) return null
    val groupIndex = exercises.mapNotNull { it.supersetGroup }.distinct().indexOf(group)
    val letter = ('A'.code + groupIndex.coerceAtLeast(0)).toChar()
    return "$letter${members.indexOfFirst { it.id == exercise.id } + 1}"
}

private fun sessionSupersetPartnerText(
    exercises: List<SessionExercise>,
    exercise: SessionExercise,
): String? {
    val group = exercise.supersetGroup ?: return null
    val members = exercises.filter { it.supersetGroup == group }
    if (members.size < 2) return null
    val badge = sessionSupersetBadge(exercises, exercise) ?: return null
    val partners = members.filterNot { it.id == exercise.id }.mapNotNull { sessionSupersetBadge(exercises, it) }
    val kind = if (members.size > 2) "Circuit" else "Superset"
    return "$kind ${badge.first()} Â· alterna con ${partners.joinToString(", ")}"
}

private fun routineSupersetBadge(
    selectedIds: List<String>,
    groups: Map<String, String?>,
    exerciseId: String,
): String? {
    val group = groups[exerciseId] ?: return null
    val members = selectedIds.filter { groups[it] == group }
    if (members.size < 2) return null
    val groupIndex = selectedIds.mapNotNull { groups[it] }.distinct().indexOf(group)
    val letter = ('A'.code + groupIndex.coerceAtLeast(0)).toChar()
    return "$letter${members.indexOf(exerciseId) + 1}"
}

@Composable
private fun SetRow(
    set: LoggedSet,
    exerciseType: ExerciseType,
    previous: LoggedSet?,
    onClick: () -> Unit,
    onToggle: () -> Unit,
    onDraftChange: (LoggedSet) -> Unit,
    onMoveUp: (() -> Unit)?,
    onMoveDown: (() -> Unit)?,
) {
    var weightText by rememberSaveable(set.id) { mutableStateOf(set.weight?.toString().orEmpty()) }
    var repsText by rememberSaveable(set.id) { mutableStateOf(set.reps?.toString().orEmpty()) }
    var assistanceText by rememberSaveable(set.id) { mutableStateOf(set.assistance?.toString().orEmpty()) }
    var durationText by rememberSaveable(set.id) { mutableStateOf(set.durationSeconds?.toString().orEmpty()) }
    var distanceText by rememberSaveable(set.id) { mutableStateOf(set.distanceMeters?.toString().orEmpty()) }

    fun updateDraft() {
        val weight = weightText.toDoubleOrNull()
        onDraftChange(
            set.copy(
                weight = weight,
                weightUnit = if (weight != null) {
                    set.weightUnit ?: com.liftlog.shared.domain.WeightUnit.KILOGRAMS
                } else {
                    null
                },
                reps = repsText.toIntOrNull(),
                assistance = assistanceText.toDoubleOrNull(),
                durationSeconds = durationText.toLongOrNull(),
                distanceMeters = distanceText.toDoubleOrNull(),
            ),
        )
    }

    val draft = set.copy(
        weight = weightText.toDoubleOrNull(),
        reps = repsText.toIntOrNull(),
        assistance = assistanceText.toDoubleOrNull(),
        durationSeconds = durationText.toLongOrNull(),
        distanceMeters = distanceText.toDoubleOrNull(),
        completedAtEpochMillis = set.completedAtEpochMillis ?: 1L,
    )
    val canComplete = SessionProgressCalculator.isComplete(exerciseType, draft)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .reorderOnLongPress(
                onMoveUp = onMoveUp ?: {},
                onMoveDown = onMoveDown ?: {},
            )
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Column(
            modifier = Modifier
                .width(40.dp)
                .clickable(onClick = onClick),
        ) {
            Text((set.index + 1).toString(), style = MaterialTheme.typography.labelLarge)
            Text("SET", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
            if (set.type != SetType.NORMAL) {
                Text(
                    set.type.displayName(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
        Column(
            modifier = Modifier
                .weight(0.9f)
                .clickable(onClick = onClick),
        ) {
            Text(
                previous?.let { setSummary(it, exerciseType) } ?: "â€”",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text("Previous", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        }
        when (exerciseType) {
            ExerciseType.WEIGHT_REPS -> {
                CompactNumericField(
                    if (set.weightUnit == WeightUnit.POUNDS) "LB" else "KG",
                    weightText,
                    { value ->
                    weightText = value
                    updateDraft()
                    },
                    KeyboardType.Decimal,
                    Modifier.weight(1f),
                )
                CompactNumericField("REPS", repsText, { value ->
                    repsText = value
                    updateDraft()
                }, KeyboardType.Number, Modifier.weight(1f))
            }
            ExerciseType.BODYWEIGHT_REPS -> CompactNumericField(
                "REPS",
                repsText,
                { value -> repsText = value; updateDraft() },
                KeyboardType.Number,
                Modifier.weight(1.4f),
            )
            ExerciseType.ASSISTED_BODYWEIGHT_REPS -> {
                CompactNumericField("ASSIST", assistanceText, { value ->
                    assistanceText = value
                    updateDraft()
                }, KeyboardType.Decimal, Modifier.weight(1f))
                CompactNumericField("REPS", repsText, { value ->
                    repsText = value
                    updateDraft()
                }, KeyboardType.Number, Modifier.weight(1f))
            }
            ExerciseType.DURATION -> CompactNumericField(
                "SEC",
                durationText,
                { value -> durationText = value; updateDraft() },
                KeyboardType.Number,
                Modifier.weight(1.4f),
            )
            ExerciseType.DISTANCE -> CompactNumericField(
                "M",
                distanceText,
                { value -> distanceText = value; updateDraft() },
                KeyboardType.Decimal,
                Modifier.weight(1.4f),
            )
            ExerciseType.CARDIO, ExerciseType.MIXED -> {
                CompactNumericField("REPS", repsText, { value ->
                    repsText = value
                    updateDraft()
                }, KeyboardType.Number, Modifier.weight(1f))
                CompactNumericField("SEC", durationText, { value ->
                    durationText = value
                    updateDraft()
                }, KeyboardType.Number, Modifier.weight(1f))
            }
        }
        androidx.compose.material3.Checkbox(
            checked = set.completedAtEpochMillis != null,
            enabled = canComplete || set.completedAtEpochMillis != null,
            onCheckedChange = { checked ->
                if (checked || set.completedAtEpochMillis != null) onToggle()
            },
        )
    }
}

@Composable
private fun CompactNumericField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType,
    modifier: Modifier,
) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.height(56.dp),
        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
    )
}

@Composable
private fun LegacySetRow(
    set: LoggedSet,
    exerciseType: ExerciseType,
    previous: LoggedSet?,
    onClick: () -> Unit,
    onToggle: () -> Unit,
    onDraftChange: (LoggedSet) -> Unit,
    onMoveUp: (() -> Unit)?,
    onMoveDown: (() -> Unit)?,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .reorderOnLongPress(
                onMoveUp = onMoveUp ?: {},
                onMoveDown = onMoveDown ?: {},
            )
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Set " + (set.index + 1),
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                text = setSummary(set, exerciseType),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        onMoveUp?.let { moveUp -> TextButton(onClick = moveUp) { Text("â†‘") } }
        onMoveDown?.let { moveDown -> TextButton(onClick = moveDown) { Text("â†“") } }
        TextButton(onClick = onClick) { Text("Edit") }
        androidx.compose.material3.Checkbox(
            checked = set.completedAtEpochMillis != null,
            onCheckedChange = { onToggle() },
        )
    }
}

private fun previousSetsFor(
    exercise: SessionExercise,
    currentSession: WorkoutSession,
    historySessions: List<WorkoutSession>,
): Map<Int, LoggedSet> {
    val previousExercise = historySessions
        .asSequence()
        .filterNot { it.id == currentSession.id }
        .sortedByDescending(WorkoutSession::startedAtEpochMillis)
        .mapNotNull { session ->
            session.exercises.firstOrNull { candidate ->
                candidate.exercise.id == exercise.exercise.id &&
                    candidate.sets.any { set ->
                        set.weight != null ||
                            set.reps != null ||
                            set.durationSeconds != null ||
                            set.distanceMeters != null
                    }
            }
        }
        .firstOrNull()
    return previousExercise?.sets?.associateBy(LoggedSet::index).orEmpty()
}

private fun formatElapsedWorkout(elapsedMillis: Long): String {
    val totalSeconds = (elapsedMillis / 1_000L).coerceAtLeast(0L)
    val hours = totalSeconds / 3_600L
    val minutes = (totalSeconds % 3_600L) / 60L
    val seconds = totalSeconds % 60L
    return if (hours > 0L) {
        "%d:%02d:%02d".format(hours, minutes, seconds)
    } else {
        "%02d:%02d".format(minutes, seconds)
    }
}

private fun setSummary(set: LoggedSet, exerciseType: ExerciseType): String = when (exerciseType) {
    ExerciseType.WEIGHT_REPS -> (set.weight ?: "-").toString() + " kg x " + (set.reps ?: "-") + " reps"
    ExerciseType.BODYWEIGHT_REPS -> (set.reps ?: "-").toString() + " reps"
    ExerciseType.ASSISTED_BODYWEIGHT_REPS -> (set.reps ?: "-").toString() + " reps - assistance " + (set.assistance ?: "-")
    ExerciseType.DURATION -> (set.durationSeconds ?: "-").toString() + " s"
    ExerciseType.DISTANCE -> (set.distanceMeters ?: "-").toString() + " m"
    ExerciseType.CARDIO, ExerciseType.MIXED -> listOfNotNull(
        set.durationSeconds?.let { it.toString() + " s" },
        set.distanceMeters?.let { it.toString() + " m" },
        set.reps?.let { it.toString() + " reps" },
    ).ifEmpty { listOf("Not recorded") }.joinToString(" - ")
}

@Composable
private fun SaveTemplateDialog(
    sessionName: String,
    folders: List<com.liftlog.shared.domain.WorkoutTemplateFolder>,
    onDismiss: () -> Unit,
    onSave: (String, String?) -> Unit,
) {
    var name by rememberSaveable { mutableStateOf(sessionName) }
    var selectedFolderId by rememberSaveable { mutableStateOf<String?>(null) }
    var folderMenuExpanded by remember { mutableStateOf(false) }
    val selectedFolder = folders.firstOrNull { it.id == selectedFolderId }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Save as template") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                TextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Template name") },
                    singleLine = true,
                )
                Box {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            "Folder",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        androidx.compose.material3.OutlinedButton(
                            onClick = { folderMenuExpanded = true },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(selectedFolder?.name ?: "Unfiled")
                                Text(">", color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                    DropdownMenu(
                        expanded = folderMenuExpanded,
                        onDismissRequest = { folderMenuExpanded = false },
                    ) {
                        DropdownMenuItem(
                            text = { Text("Unfiled") },
                            onClick = {
                                selectedFolderId = null
                                folderMenuExpanded = false
                            },
                        )
                        folders.forEach { folder ->
                            DropdownMenuItem(
                                text = { Text(folder.name) },
                                onClick = {
                                    selectedFolderId = folder.id
                                    folderMenuExpanded = false
                                },
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(name.trim(), selectedFolderId) },
                enabled = name.isNotBlank(),
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

private fun Modifier.reorderOnLongPress(
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
): Modifier = pointerInput(Unit) {
    var totalDrag = 0f
    detectDragGesturesAfterLongPress(
        onDragStart = { totalDrag = 0f },
        onDrag = { change, dragAmount ->
            totalDrag += dragAmount.y
        },
        onDragEnd = {
            when {
                totalDrag <= -60f -> onMoveUp()
                totalDrag >= 60f -> onMoveDown()
            }
        },
        onDragCancel = { totalDrag = 0f },
    )
}

@Composable
private fun SetEditorDialog(
    exerciseType: ExerciseType,
    set: LoggedSet,
    onDismiss: () -> Unit,
    onSave: (LoggedSet) -> Unit,
) {
    var weight by rememberSaveable(set.id) { mutableStateOf(set.weight?.toString() ?: "") }
    var reps by rememberSaveable(set.id) { mutableStateOf(set.reps?.toString() ?: "") }
    var bodyweight by rememberSaveable(set.id) { mutableStateOf(set.bodyweight?.toString() ?: "") }
    var assistance by rememberSaveable(set.id) { mutableStateOf(set.assistance?.toString() ?: "") }
    var duration by rememberSaveable(set.id) { mutableStateOf(set.durationSeconds?.toString() ?: "") }
    var distance by rememberSaveable(set.id) { mutableStateOf(set.distanceMeters?.toString() ?: "") }
    var rir by rememberSaveable(set.id) { mutableStateOf(set.rir?.toString() ?: "") }
    var rpe by rememberSaveable(set.id) { mutableStateOf(set.rpe?.toString() ?: "") }
    var setType by rememberSaveable(set.id) { mutableStateOf(set.type.name) }
    var weightUnit by rememberSaveable(set.id) {
        mutableStateOf((set.weightUnit ?: WeightUnit.KILOGRAMS).name)
    }
    var notes by rememberSaveable(set.id) { mutableStateOf(set.notes.orEmpty()) }
    var setTypeExpanded by remember { mutableStateOf(false) }
    var weightUnitExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Set " + (set.index + 1) + " - " + exerciseType.displayName()) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box {
                        TextButton(onClick = { setTypeExpanded = true }) {
                            Text(
                                "Type: " + runCatching { SetType.valueOf(setType) }
                                    .getOrDefault(SetType.NORMAL)
                                    .displayName(),
                            )
                        }
                        DropdownMenu(
                            expanded = setTypeExpanded,
                            onDismissRequest = { setTypeExpanded = false },
                        ) {
                            SetType.entries.forEach { option ->
                                DropdownMenuItem(
                                    text = { Text(option.displayName()) },
                                    onClick = {
                                        setType = option.name
                                        setTypeExpanded = false
                                    },
                                )
                            }
                        }
                    }
                    if (exerciseType in setOf(ExerciseType.WEIGHT_REPS, ExerciseType.CARDIO, ExerciseType.MIXED)) {
                        Box {
                            TextButton(onClick = { weightUnitExpanded = true }) {
                                Text(
                                    runCatching { WeightUnit.valueOf(weightUnit) }
                                        .getOrDefault(WeightUnit.KILOGRAMS)
                                        .displayName(),
                                )
                            }
                            DropdownMenu(
                                expanded = weightUnitExpanded,
                                onDismissRequest = { weightUnitExpanded = false },
                            ) {
                                WeightUnit.entries.forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(option.displayName()) },
                                        onClick = {
                                            weightUnit = option.name
                                            weightUnitExpanded = false
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
                if (exerciseType in setOf(ExerciseType.WEIGHT_REPS, ExerciseType.CARDIO, ExerciseType.MIXED)) {
                    NumericField(
                        "Weight (" + if (weightUnit == WeightUnit.POUNDS.name) "lb" else "kg" + ")",
                        weight,
                        { weight = it },
                        KeyboardType.Decimal,
                    )
                }
                if (exerciseType in setOf(ExerciseType.WEIGHT_REPS, ExerciseType.BODYWEIGHT_REPS, ExerciseType.ASSISTED_BODYWEIGHT_REPS, ExerciseType.CARDIO, ExerciseType.MIXED)) {
                    NumericField("Reps", reps, { reps = it }, KeyboardType.Number)
                }
                if (exerciseType in setOf(ExerciseType.BODYWEIGHT_REPS, ExerciseType.ASSISTED_BODYWEIGHT_REPS)) {
                    NumericField("Bodyweight", bodyweight, { bodyweight = it }, KeyboardType.Decimal)
                }
                if (exerciseType == ExerciseType.ASSISTED_BODYWEIGHT_REPS || exerciseType == ExerciseType.CARDIO) {
                    NumericField("Assistance / resistance", assistance, { assistance = it }, KeyboardType.Decimal)
                }
                if (exerciseType in setOf(ExerciseType.DURATION, ExerciseType.CARDIO, ExerciseType.MIXED)) {
                    NumericField("Duration (seconds)", duration, { duration = it }, KeyboardType.Number)
                }
                if (exerciseType in setOf(ExerciseType.DISTANCE, ExerciseType.CARDIO, ExerciseType.MIXED)) {
                    NumericField("Distance (meters)", distance, { distance = it }, KeyboardType.Decimal)
                }
                if (exerciseType in setOf(ExerciseType.WEIGHT_REPS, ExerciseType.BODYWEIGHT_REPS, ExerciseType.ASSISTED_BODYWEIGHT_REPS)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NumericField("RIR", rir, { rir = it }, KeyboardType.Decimal, Modifier.weight(1f))
                        NumericField("RPE", rpe, { rpe = it }, KeyboardType.Decimal, Modifier.weight(1f))
                    }
                }
                TextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Set notes") },
                    minLines = 2,
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        set.copy(
                            type = runCatching { SetType.valueOf(setType) }.getOrDefault(SetType.NORMAL),
                            weight = weight.toDoubleOrNull(),
                            weightUnit = if (weight.toDoubleOrNull() != null) {
                                runCatching { WeightUnit.valueOf(weightUnit) }.getOrDefault(WeightUnit.KILOGRAMS)
                            } else {
                                null
                            },
                            reps = reps.toIntOrNull(),
                            bodyweight = bodyweight.toDoubleOrNull(),
                            assistance = assistance.toDoubleOrNull(),
                            durationSeconds = duration.toLongOrNull(),
                            distanceMeters = distance.toDoubleOrNull(),
                            rir = rir.toDoubleOrNull(),
                            rpe = rpe.toDoubleOrNull(),
                            notes = notes.trim().takeIf { it.isNotBlank() },
                        ),
                    )
                },
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun NumericField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType,
    modifier: Modifier = Modifier.fillMaxWidth(),
) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
    )
}

private fun formatSessionDate(epochMillis: Long): String =
    SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.getDefault()).format(Date(epochMillis))

private fun ExerciseType.displayName(): String = when (this) {
    ExerciseType.WEIGHT_REPS -> "Weight and reps"
    ExerciseType.BODYWEIGHT_REPS -> "Bodyweight"
    ExerciseType.ASSISTED_BODYWEIGHT_REPS -> "Assisted bodyweight"
    ExerciseType.DURATION -> "Duration"
    ExerciseType.DISTANCE -> "Distance"
    ExerciseType.CARDIO -> "Cardio"
    ExerciseType.MIXED -> "Mixed"
}

private fun SetType.displayName(): String = when (this) {
    SetType.NORMAL -> "Normal"
    SetType.WARMUP -> "Warm-up"
    SetType.DROP_SET -> "Drop set"
    SetType.TOP_SET -> "Top set"
    SetType.BACKOFF -> "Back-off"
    SetType.FAILURE -> "Failure"
    SetType.AMRAP -> "AMRAP"
}

private fun WeightUnit.displayName(): String = when (this) {
    WeightUnit.KILOGRAMS -> "Kilograms (kg)"
    WeightUnit.POUNDS -> "Pounds (lb)"
}

private fun ProgressionMode.displayName(): String = when (this) {
    ProgressionMode.NONE -> "Ninguna"
    ProgressionMode.INCREASE_ALL -> "Todos"
    ProgressionMode.INCREASE_LOWEST -> "El menor"
}

@Preview(showBackground = true)
@Composable
private fun LiftLogNativeAppPreview() {
    LiftLogNativeTheme {
        Surface {
            ActiveWorkoutScreen(
                session = sampleWorkoutSession(),
                historySessions = listOf(sampleWorkoutSession()),
                error = null,
                onBack = {},
                onSetToggle = { _, _ -> },
                onSetQuickToggle = { _, _ -> },
                onSetDraftChange = { _, _ -> },
                onMoveExercise = { _, _ -> },
                onMoveSet = { _, _, _ -> },
                onPairExercises = { _, _ -> },
                onUnpairExercise = {},
                onAddSet = {},
                onRemoveExercise = {},
                onUpdateExerciseNotes = { _, _ -> },
                onRenameSession = {},
                onComplete = {},
                availableExercises = emptyList(),
                onAddExercise = {},
                templateFolders = emptyList(),
                onSaveRoutine = { _, _ -> },
                restTimer = RestTimerUiState(),
                onStopRestTimer = {},
                onHealthConnect = {},
            )
        }
    }
}
