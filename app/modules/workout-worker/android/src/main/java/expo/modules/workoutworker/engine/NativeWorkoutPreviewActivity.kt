package expo.modules.workoutworker.engine

import android.app.Activity
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import expo.modules.workoutworker.R
import org.json.JSONArray

/**
 * Opt-in XML shell for device validation of the native workout view state.
 *
 * This is deliberately not the production session route yet. It accepts only
 * a versioned engine snapshot through an explicit Intent and has no database,
 * Redux, or persistence authority. The normal React Native session remains the
 * fallback until command/result parity is proven on hardware.
 */
class NativeWorkoutPreviewActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.native_workout_preview)

        val snapshotJson = decodeExtra(EXTRA_SNAPSHOT_JSON, EXTRA_SNAPSHOT_BASE64)
        val namesJson = decodeExtra(EXTRA_EXERCISE_NAMES_JSON, EXTRA_NAMES_BASE64)
        if (snapshotJson.isNullOrBlank() || namesJson.isNullOrBlank()) {
            Log.e(TAG, "Native workout preview requires snapshot and exercise names")
            finish()
            return
        }

        runCatching {
            val names = JSONArray(namesJson).let { array ->
                List(array.length()) { index -> array.optString(index) }
            }
            bind(
                WorkoutViewState.fromSnapshot(
                    WorkoutPreviewSnapshotParser.parse(snapshotJson),
                    names,
                ),
            )
        }.onFailure { error ->
            Log.e(TAG, "Native workout preview failed to bind", error)
            findViewById<TextView>(R.id.native_workout_title).text = "Native preview error"
            findViewById<TextView>(R.id.native_workout_status).text =
                error.message ?: error.javaClass.simpleName
        }
    }

    private fun decodeExtra(jsonKey: String, base64Key: String): String? {
        intent.getStringExtra(base64Key)?.let { encoded ->
            return runCatching {
                Base64.decode(encoded, Base64.DEFAULT).toString(Charsets.UTF_8)
            }.getOrNull()
        }
        return intent.getStringExtra(jsonKey)
    }

    private fun bind(state: WorkoutViewState) {
        findViewById<TextView>(R.id.native_workout_title).text =
            "Workout ${state.sessionId}"
        findViewById<TextView>(R.id.native_workout_status).text =
            "LIVE  •  ${state.completedSets}/${state.totalSets} sets"
        findViewById<android.widget.ProgressBar>(R.id.native_workout_progress).progress =
            (state.progress * 100).toInt()

        val container = findViewById<LinearLayout>(R.id.native_workout_exercises)
        state.exercises.forEach { exercise ->
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(16, 16, 16, 16)
                setBackgroundColor(
                    ContextCompat.getColor(
                        this@NativeWorkoutPreviewActivity,
                        android.R.color.background_dark,
                    ),
                )
            }
            val heading = TextView(this).apply {
                text = listOfNotNull(
                    exercise.supersetLabel,
                    exercise.name.ifBlank { exercise.type },
                ).joinToString("  ")
                setTextColor(
                    ContextCompat.getColor(
                        this@NativeWorkoutPreviewActivity,
                        android.R.color.white,
                    ),
                )
                textSize = 18f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val sets = TextView(this).apply {
                text = exercise.sets.joinToString("   ") { set ->
                    val value = set.reps?.toString() ?: "—"
                    "${if (set.completed) "✓" else "○"} $value"
                }
                setTextColor(
                    ContextCompat.getColor(
                        this@NativeWorkoutPreviewActivity,
                        android.R.color.white,
                    ),
                )
                textSize = 16f
                setPadding(0, 8, 0, 0)
            }
            card.addView(heading)
            card.addView(sets)
            container.addView(
                card,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply { bottomMargin = 12 },
            )
        }
    }

    companion object {
        private const val TAG = "NativeWorkoutPreview"
        const val ACTION_PREVIEW = "com.gabsvm.gainslab.action.NATIVE_WORKOUT_PREVIEW"
        const val EXTRA_SNAPSHOT_JSON = "snapshotJson"
        const val EXTRA_EXERCISE_NAMES_JSON = "exerciseNamesJson"
        const val EXTRA_SNAPSHOT_BASE64 = "snapshotBase64"
        const val EXTRA_NAMES_BASE64 = "exerciseNamesBase64"
    }
}
