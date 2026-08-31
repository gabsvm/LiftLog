package expo.modules.workoutworker.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkoutEngineTest {
    private fun snapshot(): WorkoutEngineSnapshot = WorkoutEngineSnapshot(
        schemaVersion = 1,
        sessionId = "session-1",
        revision = 0,
        status = "active",
        exercises = listOf(
            WorkoutEngineExerciseSnapshot(
                exerciseIndex = 0,
                type = "weighted",
                repsPerSet = 8,
                supersetWithNext = true,
                sets = listOf(
                    WorkoutEngineSetSnapshot(0, false, null, 80.0, "kilograms"),
                    WorkoutEngineSetSnapshot(1, false, null, 80.0, "kilograms"),
                ),
            ),
            WorkoutEngineExerciseSnapshot(
                exerciseIndex = 1,
                type = "cardio",
                repsPerSet = null,
                supersetWithNext = false,
                sets = listOf(WorkoutEngineSetSnapshot(0, false, null, null, null)),
            ),
        ),
        restTimerEndTime = null,
        error = null,
    )

    private fun command(
        type: String,
        revision: Long = 1,
        exerciseIndex: Int? = null,
        setIndex: Int? = null,
        reps: Int? = null,
        weight: Double? = null,
        weightUnit: String? = null,
        endTime: Double? = null,
        sessionId: String = "session-1",
    ) = WorkoutEngineCommand(
        schemaVersion = 1,
        sessionId = sessionId,
        revision = revision,
        type = type,
        exerciseIndex = exerciseIndex,
        setIndex = setIndex,
        reps = reps,
        weight = weight,
        weightUnit = weightUnit,
        endTime = endTime,
    )

    @Test
    fun `toggle cycles one set and preserves metadata`() {
        val completed = WorkoutEngine.apply(snapshot(), command("toggle-set", exerciseIndex = 0, setIndex = 0))
        val decremented = WorkoutEngine.apply(completed, command("toggle-set", revision = 2, exerciseIndex = 0, setIndex = 0))
        val next = WorkoutEngine.apply(
            decremented.copy(
                exercises = decremented.exercises.mapIndexed { index, exercise ->
                    if (index == 0) exercise.copy(
                        sets = exercise.sets.mapIndexed { setIndex, set ->
                            if (setIndex == 0) set.copy(reps = 0) else set
                        },
                    ) else exercise
                },
            ),
            command("toggle-set", revision = 3, exerciseIndex = 0, setIndex = 0),
        )

        assertEquals(1, completed.revision)
        assertEquals(8, completed.exercises[0].sets[0].reps)
        assertEquals(7, decremented.exercises[0].sets[0].reps)
        assertFalse(next.exercises[0].sets[0].completed)
        assertNull(next.exercises[0].sets[0].reps)
        assertTrue(next.exercises[0].supersetWithNext)
        assertEquals("cardio", next.exercises[1].type)
    }

    @Test
    fun `retries are idempotent and incompatible revisions are rejected`() {
        val applied = WorkoutEngine.apply(snapshot(), command("toggle-set", exerciseIndex = 0, setIndex = 0))
        assertEquals(applied, WorkoutEngine.apply(applied, command("toggle-set", exerciseIndex = 0, setIndex = 0)))
        assertThrows(WorkoutEngineException::class.java) {
            WorkoutEngine.apply(snapshot(), command("finish", revision = 2))
        }
        assertThrows(WorkoutEngineException::class.java) {
            WorkoutEngine.apply(snapshot(), command("finish", sessionId = "other"))
        }
    }

    @Test
    fun `updates reps weight and timer then finishes`() {
        val withReps = WorkoutEngine.apply(
            snapshot(),
            command("update-reps", exerciseIndex = 0, setIndex = 0, reps = 9),
        )
        val withWeight = WorkoutEngine.apply(
            withReps,
            command("update-weight", revision = 2, exerciseIndex = 0, setIndex = 0, weight = 82.5, weightUnit = "kilograms"),
        )
        val withTimer = WorkoutEngine.apply(
            withWeight,
            command("start-rest", revision = 3, endTime = 123456.0),
        )
        val reset = WorkoutEngine.apply(withTimer, command("reset-rest", revision = 4))
        val finished = WorkoutEngine.apply(reset, command("finish", revision = 5))

        assertEquals(9, withWeight.exercises[0].sets[0].reps)
        assertEquals(82.5, withWeight.exercises[0].sets[0].weight!!, 0.0)
        assertEquals(123456.0, withTimer.restTimerEndTime!!, 0.0)
        assertNull(reset.restTimerEndTime)
        assertEquals("finished", finished.status)
    }
}
