package com.gabsvm.liftlog.nativeapp.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class LiftLogDatabase(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(true)
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE workout_sessions (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                completed_at INTEGER,
                bodyweight REAL,
                bodyweight_unit TEXT,
                notes TEXT
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE session_exercises (
                id TEXT PRIMARY KEY NOT NULL,
                session_id TEXT NOT NULL,
                position INTEGER NOT NULL,
                exercise_id TEXT NOT NULL,
                exercise_name TEXT NOT NULL,
                exercise_type TEXT NOT NULL,
                muscle_group TEXT,
                equipment TEXT,
                exercise_notes TEXT,
                is_archived INTEGER NOT NULL,
                planned_set_count INTEGER NOT NULL,
                target_reps_min INTEGER,
                target_reps_max INTEGER,
                rest_seconds INTEGER,
                progression_mode TEXT,
                progression_increment REAL,
                progression_unit TEXT,
                rest_max_seconds INTEGER,
                rest_failure_seconds INTEGER,
                superset_group TEXT,
                notes TEXT,
                FOREIGN KEY(session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE logged_sets (
                id TEXT PRIMARY KEY NOT NULL,
                session_exercise_id TEXT NOT NULL,
                index_in_exercise INTEGER NOT NULL,
                set_type TEXT NOT NULL,
                weight REAL,
                weight_unit TEXT,
                reps INTEGER,
                bodyweight REAL,
                assistance REAL,
                duration_seconds INTEGER,
                distance_meters REAL,
                rir REAL,
                rpe REAL,
                completed_at INTEGER,
                notes TEXT,
                FOREIGN KEY(session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
            )
            """.trimIndent(),
        )
        db.execSQL(
            "CREATE INDEX index_session_exercises_session_id ON session_exercises(session_id)",
        )
        db.execSQL(
            "CREATE INDEX index_logged_sets_session_exercise_id ON logged_sets(session_exercise_id)",
        )
        createRoutineTables(db)
        createExerciseTables(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) createRoutineTables(db)
        if (oldVersion < 3) createExerciseTables(db)
        if (oldVersion < 4) {
            addColumnIfMissing(db, "session_exercises", "progression_mode", "TEXT")
            addColumnIfMissing(db, "session_exercises", "progression_increment", "REAL")
            addColumnIfMissing(db, "session_exercises", "progression_unit", "TEXT")
            addColumnIfMissing(db, "routine_exercises", "progression_mode", "TEXT")
            addColumnIfMissing(db, "routine_exercises", "progression_increment", "REAL")
            addColumnIfMissing(db, "routine_exercises", "progression_unit", "TEXT")
        }
        if (oldVersion < 5) {
            addColumnIfMissing(db, "session_exercises", "rest_max_seconds", "INTEGER")
            addColumnIfMissing(db, "session_exercises", "rest_failure_seconds", "INTEGER")
            addColumnIfMissing(db, "routine_exercises", "rest_max_seconds", "INTEGER")
            addColumnIfMissing(db, "routine_exercises", "rest_failure_seconds", "INTEGER")
        }
        if (oldVersion < 6) {
            createTemplateFolderTable(db)
            addColumnIfMissing(db, "workout_routines", "folder_id", "TEXT")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_workout_routines_folder_id ON workout_routines(folder_id)")
        }
    }

    private fun addColumnIfMissing(db: SQLiteDatabase, table: String, column: String, definition: String) {
        db.rawQuery("PRAGMA table_info($table)", null).use { cursor ->
            val nameIndex = cursor.getColumnIndexOrThrow("name")
            while (cursor.moveToNext()) {
                if (cursor.getString(nameIndex) == column) return
            }
        }
        db.execSQL("ALTER TABLE $table ADD COLUMN $column $definition")
    }

    private fun createRoutineTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS workout_routines (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                folder_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS routine_exercises (
                id TEXT PRIMARY KEY NOT NULL,
                routine_id TEXT NOT NULL,
                position INTEGER NOT NULL,
                exercise_id TEXT NOT NULL,
                exercise_name TEXT NOT NULL,
                exercise_type TEXT NOT NULL,
                muscle_group TEXT,
                equipment TEXT,
                exercise_notes TEXT,
                is_archived INTEGER NOT NULL,
                planned_set_count INTEGER NOT NULL,
                target_reps_min INTEGER,
                target_reps_max INTEGER,
                rest_seconds INTEGER,
                progression_mode TEXT,
                progression_increment REAL,
                progression_unit TEXT,
                rest_max_seconds INTEGER,
                rest_failure_seconds INTEGER,
                superset_group TEXT,
                notes TEXT,
                FOREIGN KEY(routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE
            )
            """.trimIndent(),
        )
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS index_routine_exercises_routine_id ON routine_exercises(routine_id)",
        )
        createTemplateFolderTable(db)
        db.execSQL("CREATE INDEX IF NOT EXISTS index_workout_routines_folder_id ON workout_routines(folder_id)")
    }

    private fun createTemplateFolderTable(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS workout_template_folders (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
    }

    private fun createExerciseTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS exercise_library (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                exercise_type TEXT NOT NULL,
                muscle_group TEXT,
                equipment TEXT,
                notes TEXT,
                is_archived INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS index_exercise_library_name ON exercise_library(name)")
    }

    private companion object {
        const val DATABASE_NAME = "liftlog_native_pilot.db"
        const val DATABASE_VERSION = 6
    }
}
