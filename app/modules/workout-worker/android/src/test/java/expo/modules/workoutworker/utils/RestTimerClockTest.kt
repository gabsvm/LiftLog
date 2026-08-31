package expo.modules.workoutworker.utils

import org.junit.Assert.assertEquals
import org.junit.Test

class RestTimerClockTest {
    @Test
    fun `recovers initial progress from wall clock then advances monotonically`() {
        var wallSeconds = 1_000L
        var elapsedMillis = 50_000L
        val clock = RestTimerClock(
            startedAtEpochSeconds = 970L,
            wallClockSeconds = { wallSeconds },
            monotonicMillis = { elapsedMillis },
        )

        assertEquals(30L, clock.progressSeconds())
        assertEquals(1_000L, clock.currentEpochSeconds())

        // A wall-clock correction must not move an active rest timer.
        wallSeconds = 800L
        elapsedMillis += 5_400L
        assertEquals(35L, clock.progressSeconds())
        assertEquals(1_005L, clock.currentEpochSeconds())
    }

    @Test
    fun `monotonic rollback is clamped and cannot produce negative progress`() {
        var elapsedMillis = 5_000L
        val clock = RestTimerClock(
            startedAtEpochSeconds = 1_000L,
            wallClockSeconds = { 995L },
            monotonicMillis = { elapsedMillis },
        )

        assertEquals(0L, clock.progressSeconds())
        elapsedMillis = 4_000L
        assertEquals(0L, clock.progressSeconds())
    }
}
