package com.gabsvm.liftlog.nativeapp

import android.os.Bundle
import android.os.Build
import android.Manifest
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.ViewModelProvider
import com.gabsvm.liftlog.nativeapp.data.LiftLogDatabase
import com.gabsvm.liftlog.nativeapp.data.SQLiteWorkoutSessionRepository
import com.gabsvm.liftlog.nativeapp.data.SQLiteRoutineRepository
import com.gabsvm.liftlog.nativeapp.data.SQLiteExerciseRepository
import com.gabsvm.liftlog.nativeapp.data.LegacyExpoDatabaseImporter
import com.gabsvm.liftlog.nativeapp.ui.LiftLogNativeApp
import com.gabsvm.liftlog.nativeapp.ui.LiftLogNativeTheme
import com.gabsvm.liftlog.nativeapp.ui.WorkoutViewModel
import com.gabsvm.liftlog.nativeapp.ui.WorkoutViewModelFactory

class MainActivity : ComponentActivity() {
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

    private val workoutViewModel: WorkoutViewModel by lazy {
        val database = LiftLogDatabase(applicationContext)
        val repository = SQLiteWorkoutSessionRepository(database)
        val routineRepository = SQLiteRoutineRepository(database)
        val exerciseRepository = SQLiteExerciseRepository(database)
        ViewModelProvider(
            this,
            WorkoutViewModelFactory(
                repository,
                routineRepository,
                exerciseRepository,
                applicationContext,
                LegacyExpoDatabaseImporter(applicationContext),
            ),
        )[WorkoutViewModel::class.java]
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        setContent {
            LiftLogNativeTheme {
                LiftLogNativeApp(workoutViewModel)
            }
        }
    }
}
