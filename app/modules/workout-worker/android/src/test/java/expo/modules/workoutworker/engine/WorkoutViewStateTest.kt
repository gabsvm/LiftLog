package expo.modules.workoutworker.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkoutViewStateTest {
    @Test
    fun `maps the engine snapshot into stable workout display state`() {
        val state = WorkoutViewState.fromSnapshot(
            WorkoutEngineSnapshot(
                schemaVersion = 2,
                sessionId = "session-1",
                revision = 3,
                status = "active",
                exercises = listOf(
                    WorkoutEngineExerciseSnapshot(
                        exerciseIndex = 0,
                        type = "weighted",
                        repsPerSet = 8,
                        supersetWithNext = true,
                        sets = listOf(
                            WorkoutEngineSetSnapshot(0, true, 8, 80.0, "kilograms", completionDateTime = "2026-08-31T15:00:00-03:00"),
                            WorkoutEngineSetSnapshot(1, false, null, 80.0, "kilograms"),
                        ),
                    ),
                    WorkoutEngineExerciseSnapshot(
                        exerciseIndex = 1,
                        type = "weighted",
                        repsPerSet = 8,
                        supersetWithNext = false,
                        sets = listOf(
                            WorkoutEngineSetSnapshot(0, false, null, 60.0, "kilograms"),
                        ),
                    ),
                ),
                restTimerEndTime = 1234.0,
                error = null,
            ),
            listOf("Bench Press", "Row"),
        )

        assertEquals("session-1", state.sessionId)
        assertEquals(3, state.revision)
        assertEquals(1, state.completedSets)
        assertEquals(3, state.totalSets)
        assertEquals(1f / 3f, state.progress)
        assertEquals("Bench Press", state.exercises[0].name)
        assertEquals("A1", state.exercises[0].supersetLabel)
        assertEquals("A2", state.exercises[1].supersetLabel)
        assertTrue(state.exercises[0].isCurrent)
        assertEquals(1234.0, state.restTimerEndTime)
    }
}
