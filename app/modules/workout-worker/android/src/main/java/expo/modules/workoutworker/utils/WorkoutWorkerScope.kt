package expo.modules.workoutworker.utils

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob

/**
 * Owns coroutine work created by one worker handler while remaining attached
 * to the service lifecycle.
 */
internal class WorkoutWorkerScope(parent: CoroutineScope) {
    private val job: Job = SupervisorJob(parent.coroutineContext[Job])

    val scope: CoroutineScope = CoroutineScope(parent.coroutineContext + job)

    fun cancel() {
        job.cancel()
    }
}
