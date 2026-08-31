package expo.modules.workoutworker.engine

import java.io.File
import java.nio.file.Files
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test

class WorkoutEngineStorageTest {
    @Test
    fun `failed move keeps the previous value and removes the temporary file`() {
        val directory = Files.createTempDirectory("workout-engine-storage").toFile()
        try {
            val target = File(directory, "CurrentSessionStateV1")
            target.writeText("previous")
            val storage = WorkoutEngineStorage(directory) { _, _ -> false }

            assertThrows(java.io.IOException::class.java) {
                runBlocking {
                    storage.write("CurrentSessionStateV1", "replacement".toByteArray())
                }
            }

            assertEquals("previous", target.readText())
            assertFalse(directory.listFiles()!!.any { it.name.contains("-tmp-") })
        } finally {
            directory.deleteRecursively()
        }
    }

    @Test
    fun `successful writes replace the value without leaving extra files`() = runBlocking {
        val directory = Files.createTempDirectory("workout-engine-storage").toFile()
        try {
            val storage = WorkoutEngineStorage(directory)

            storage.write("CurrentSessionStateV1", "first".toByteArray())
            storage.write("CurrentSessionStateV1", "second".toByteArray())

            assertEquals("second", String(storage.read("CurrentSessionStateV1")!!))
            assertEquals(1, directory.listFiles()!!.size)
        } finally {
            directory.deleteRecursively()
        }
    }
}
