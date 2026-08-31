package expo.modules.workoutworker.utils

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkoutWorkerScopeTest {
    @Test
    fun `cancel stops child work without cancelling the service scope`() = runBlocking {
        val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val workerScope = WorkoutWorkerScope(serviceScope)
        val child = workerScope.scope.launch {
            delay(Long.MAX_VALUE)
        }

        assertTrue(child.isActive)
        workerScope.cancel()

        assertFalse(child.isActive)
        assertTrue(serviceScope.coroutineContext[Job]?.isActive == true)

        serviceScope.cancel()
    }
}
