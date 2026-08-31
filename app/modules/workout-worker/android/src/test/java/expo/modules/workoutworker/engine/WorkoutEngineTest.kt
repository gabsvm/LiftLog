package expo.modules.workoutworker.engine

import com.squareup.moshi.JsonClass
import com.squareup.moshi.adapter
import expo.modules.workoutworker.utils.Json
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

@JsonClass(generateAdapter = false)
private data class WorkoutEngineParityFixture(
    val initial: WorkoutEngineSnapshot,
    val commands: List<WorkoutEngineCommand>,
    val expected: WorkoutEngineSnapshot,
)

class WorkoutEngineTest {
    private fun set(
        index: Int,
        completed: Boolean = false,
        reps: Int? = null,
        completionDateTime: String? = null,
        weight: Double? = 80.0,
        weightUnit: String? = "kilograms",
    ) = WorkoutEngineSetSnapshot(
        setIndex = index,
        completed = completed,
        reps = reps,
        completionDateTime = completionDateTime,
        weight = weight,
        weightUnit = weightUnit,
        durationSeconds = null,
        distanceValue = null,
        distanceUnit = null,
        resistance = null,
        incline = null,
        steps = null,
        currentBlockStartTime = null,
    )

    private fun snapshot(): WorkoutEngineSnapshot = WorkoutEngineSnapshot(
        schemaVersion = 2,
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
                    set(0),
                    set(1),
                    set(2, completed = true, reps = 7, completionDateTime = "2026-08-31T14:59:00-03:00"),
                ),
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
        completionDateTime: String? = null,
        weight: Double? = null,
        weightUnit: String? = null,
        applyTo: String? = null,
        endTime: Double? = null,
        sessionId: String = "session-1",
    ) = WorkoutEngineCommand(
        schemaVersion = 2,
        sessionId = sessionId,
        revision = revision,
        type = type,
        exerciseIndex = exerciseIndex,
        setIndex = setIndex,
        reps = reps,
        completionDateTime = completionDateTime,
        weight = weight,
        weightUnit = weightUnit,
        applyTo = applyTo,
        endTime = endTime,
    )

    @Test
    fun `shared fixture produces the same golden snapshot`() {
        val fixture = loadParityFixture()
        val actual = fixture.commands.fold(fixture.initial) { current, next ->
            WorkoutEngine.apply(current, next)
        }

        assertEquals(fixture.expected, actual)
    }

    @Test
    fun `toggle preserves original completion time while decrementing`() {
        val completed = WorkoutEngine.apply(
            snapshot(),
            command(
                "toggle-set",
                exerciseIndex = 0,
                setIndex = 0,
                completionDateTime = "2026-08-31T15:00:00-03:00",
            ),
        )
        val decremented = WorkoutEngine.apply(
            completed,
            command(
                "toggle-set",
                revision = 2,
                exerciseIndex = 0,
                setIndex = 0,
                completionDateTime = "2026-08-31T15:01:00-03:00",
            ),
        )

        assertEquals(8, completed.exercises[0].sets[0].reps)
        assertEquals("2026-08-31T15:00:00-03:00", completed.exercises[0].sets[0].completionDateTime)
        assertEquals(7, decremented.exercises[0].sets[0].reps)
        assertEquals("2026-08-31T15:00:00-03:00", decremented.exercises[0].sets[0].completionDateTime)
    }

    @Test
    fun `update reps can clear a recorded set and its timestamp`() {
        val cleared = WorkoutEngine.apply(
            snapshot(),
            command(
                "update-reps",
                exerciseIndex = 0,
                setIndex = 2,
                reps = null,
                completionDateTime = null,
            ),
        )

        assertFalse(cleared.exercises[0].sets[2].completed)
        assertNull(cleared.exercises[0].sets[2].reps)
        assertNull(cleared.exercises[0].sets[2].completionDateTime)
    }

    @Test
    fun `weight applyTo matches the TypeScript session model`() {
        val thisSet = WorkoutEngine.apply(
            snapshot(),
            command(
                "update-weight",
                exerciseIndex = 0,
                setIndex = 0,
                weight = 81.0,
                weightUnit = "kilograms",
                applyTo = "thisSet",
            ),
        )
        assertEquals(listOf(81.0, 80.0, 80.0), thisSet.exercises[0].sets.map { it.weight })

        val uncompleted = WorkoutEngine.apply(
            snapshot(),
            command(
                "update-weight",
                exerciseIndex = 0,
                setIndex = 0,
                weight = 82.0,
                weightUnit = "kilograms",
                applyTo = "uncompletedSets",
            ),
        )
        assertEquals(listOf(82.0, 82.0, 80.0), uncompleted.exercises[0].sets.map { it.weight })

        val all = WorkoutEngine.apply(
            snapshot(),
            command(
                "update-weight",
                exerciseIndex = 0,
                setIndex = 0,
                weight = 83.0,
                weightUnit = "kilograms",
                applyTo = "allSets",
            ),
        )
        assertEquals(listOf(83.0, 83.0, 83.0), all.exercises[0].sets.map { it.weight })
    }

    @Test
    fun `retries are idempotent and incompatible revisions are rejected`() {
        val first = command(
            "toggle-set",
            exerciseIndex = 0,
            setIndex = 0,
            completionDateTime = "2026-08-31T15:00:00-03:00",
        )
        val applied = WorkoutEngine.apply(snapshot(), first)
        assertEquals(applied, WorkoutEngine.apply(applied, first))
        assertThrows(WorkoutEngineException::class.java) {
            WorkoutEngine.apply(snapshot(), command("finish", revision = 2))
        }
        assertThrows(WorkoutEngineException::class.java) {
            WorkoutEngine.apply(snapshot(), command("finish", sessionId = "other"))
        }
    }

    @Test
    fun `timer and finish remain revisioned commands`() {
        val withTimer = WorkoutEngine.apply(
            snapshot(),
            command("start-rest", endTime = 123456.0),
        )
        val reset = WorkoutEngine.apply(withTimer, command("reset-rest", revision = 2))
        val finished = WorkoutEngine.apply(reset, command("finish", revision = 3))

        assertEquals(123456.0, withTimer.restTimerEndTime!!, 0.0)
        assertNull(reset.restTimerEndTime)
        assertEquals("finished", finished.status)
        assertTrue(finished.exercises[0].supersetWithNext)
    }

    @OptIn(ExperimentalStdlibApi::class)
    private fun loadParityFixture(): WorkoutEngineParityFixture {
        val fixtureFile = findFixtureFile()
        return Json.moshi.adapter<WorkoutEngineParityFixture>().fromJson(fixtureFile.readText())
            ?: error("Could not parse ${fixtureFile.path}")
    }

    private fun findFixtureFile(): File {
        var current: File? = File(System.getProperty("user.dir")).absoluteFile
        repeat(10) {
            val directory = current ?: return@repeat
            val direct = File(directory, "fixtures/workout-engine-parity-v2.json")
            if (direct.isFile) return direct
            val repoRelative = File(directory, "app/modules/workout-worker/fixtures/workout-engine-parity-v2.json")
            if (repoRelative.isFile) return repoRelative
            current = directory.parentFile
        }
        error("Could not locate shared workout-engine-parity-v2.json from ${System.getProperty("user.dir")}")
    }
}
