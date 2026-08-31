package expo.modules.workoutworker.utils

import android.os.SystemClock
import kotlin.math.max

/**
 * Recovers an active timer once from wall clock, then advances it from Android's
 * monotonic elapsedRealtime clock. This prevents NTP/manual clock changes from
 * making an in-flight rest jump forward or backward while still allowing
 * process recreation to recover elapsed time from the persisted wall timestamp.
 */
internal class RestTimerClock(
    private val startedAtEpochSeconds: Long,
    wallClockSeconds: () -> Long = { System.currentTimeMillis() / 1_000L },
    private val monotonicMillis: () -> Long = { SystemClock.elapsedRealtime() },
) {
    private val anchorProgressSeconds = max(0L, wallClockSeconds() - startedAtEpochSeconds)
    private val anchorMonotonicMillis = monotonicMillis()

    fun progressSeconds(): Long {
        val monotonicDelta = max(0L, monotonicMillis() - anchorMonotonicMillis)
        return anchorProgressSeconds + monotonicDelta / 1_000L
    }

    fun currentEpochSeconds(): Long = startedAtEpochSeconds + progressSeconds()
}
