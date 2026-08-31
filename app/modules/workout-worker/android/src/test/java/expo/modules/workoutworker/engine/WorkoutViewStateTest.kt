package expo.modules.workoutworker.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkoutViewStateTest {
    private fun weightedSet(
        index: Int,
        completed: Boolean,
        time: String? = null,
    ) = WorkoutEngineSetSnapshot(
        setIndex = index,
        completed = completed,
        reps = if (completed) 8 else null,
        weight = 80.0,
        weightUnit = "kilograms",
        completionDateTime = time,
    )

    private fun weightedExercise(
        index: Int,
        supersetWithNext: Boolean,
        sets: List<WorkoutEngineSetSnapshot>,
    ) = WorkoutEngineExerciseSnapshot(
        exerciseIndex = index,
        type = "weighted",
        repsPerSet = 8,
        supersetWithNext = supersetWithNext,
        sets = sets,
    )

    private fun snapshot(
        exercises: List<WorkoutEngineExerciseSnapshot>,
    ) = WorkoutEngineSnapshot(
        schemaVersion = 2,
        sessionId = "session-1",
        revision = 3,
        status = "active",
        exercises = exercises,
        restTimerEndTime = 1234.0,
        error = null,
    )

    @Test
    fun `maps the engine snapshot into stable workout display state`() {
        val state = WorkoutViewState.fromSnapshot(
            snapshot(
                listOf(
                    weightedExercise(
                        0,
                        supersetWithNext = true,
                        sets = listOf(
                            weightedSet(0, true, "2026-08-31T15:00:00-03:00"),
                            weightedSet(1, false),
                        ),
                    ),
                    weightedExercise(
                        1,
                        supersetWithNext = false,
                        sets = listOf(weightedSet(0, false)),
                    ),
                ),
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
        assertFalse(state.exercises[0].isCurrent)
        assertTrue(state.exercises[1].isCurrent)
        assertEquals(1234.0, state.restTimerEndTime)
    }

    @Test
    fun `loops back to the first incomplete superset member after A2`() {
        val state = WorkoutViewState.fromSnapshot(
            snapshot(
                listOf(
                    weightedExercise(
                        0,
                        supersetWithNext = true,
                        sets = listOf(
                            weightedSet(0, true, "2026-08-31T15:00:00-03:00"),
                            weightedSet(1, false),
                        ),
                    ),
                    weightedExercise(
                        1,
                        supersetWithNext = false,
                        sets = listOf(
                            weightedSet(0, true, "2026-08-31T15:01:00-03:00"),
                            weightedSet(1, false),
                        ),
                    ),
                ),
            ),
            listOf("Bench Press", "Row"),
        )

        assertTrue(state.exercises[0].isCurrent)
        assertFalse(state.exercises[1].isCurrent)
    }

    @Test
    fun `running cardio timer takes precedence over timestamp ordering`() {
        val cardio = WorkoutEngineExerciseSnapshot(
            exerciseIndex = 1,
            type = "cardio",
            repsPerSet = null,
            supersetWithNext = false,
            sets = listOf(
                WorkoutEngineSetSnapshot(
                    setIndex = 0,
                    completed = false,
                    reps = null,
                    weight = null,
                    weightUnit = null,
                    currentBlockStartTime = "2026-08-31T15:05:00-03:00",
                ),
            ),
        )
        val state = WorkoutViewState.fromSnapshot(
            snapshot(
                listOf(
                    weightedExercise(
                        0,
                        supersetWithNext = false,
                        sets = listOf(
                            weightedSet(0, true, "2026-08-31T15:10:00-03:00"),
                            weightedSet(1, false),
                        ),
                    ),
                    cardio,
                ),
            ),
            listOf("Bench Press", "Bike"),
        )

        assertFalse(state.exercises[0].isCurrent)
        assertTrue(state.exercises[1].isCurrent)
    }
}
