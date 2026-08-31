package expo.modules.workoutworker.engine

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

internal fun interface WorkoutEngineMoveFile {
    fun move(tempFile: File, targetFile: File): Boolean
}

private fun replaceFile(tempFile: File, targetFile: File): Boolean {
    if (targetFile.exists() && !targetFile.delete()) return false
    return tempFile.renameTo(targetFile)
}

/**
 * Serializes snapshot writes and preserves the existing file protocol.
 *
 * The caller supplies the already-resolved KeyValueStore key. This class never
 * invents a second key or changes the JSON format used by TypeScript.
 */
internal class WorkoutEngineStorage(
    private val directory: File,
    private val moveFile: WorkoutEngineMoveFile = WorkoutEngineMoveFile(::replaceFile),
) {
    private val writeLock = Mutex()
    private val tempSequence = AtomicLong(0)

    suspend fun write(key: String, value: ByteArray) {
        writeLock.withLock {
            writeLocked(key, value)
        }
    }

    suspend fun read(key: String): ByteArray? = writeLock.withLock {
        targetFile(key).takeIf { it.isFile }?.readBytes()
    }

    suspend fun remove(key: String) {
        writeLock.withLock {
            targetFile(key).takeIf { it.exists() }?.let { target ->
                if (!target.delete()) {
                    throw IOException("Could not delete snapshot key $key")
                }
            }
        }
    }

    private fun writeLocked(key: String, value: ByteArray) {
        validateKey(key)
        if (!directory.exists() && !directory.mkdirs()) {
            throw IOException("Could not create snapshot directory")
        }

        val target = File(directory, key)
        val temp = nextTempFile(key)
        try {
            FileOutputStream(temp).use { output ->
                output.write(value)
                output.fd.sync()
            }
            if (!moveFile.move(temp, target)) {
                throw IOException("Could not replace snapshot key $key")
            }
        } finally {
            if (temp.exists() && !temp.delete()) {
                temp.deleteOnExit()
            }
        }
    }

    private fun targetFile(key: String): File {
        validateKey(key)
        return File(directory, key)
    }

    private fun nextTempFile(key: String): File {
        do {
            val suffix = "${System.currentTimeMillis().toString(36)}-${tempSequence.incrementAndGet().toString(36)}"
            val candidate = File(directory, "$key-tmp-$suffix")
            if (!candidate.exists()) return candidate
        } while (true)
    }

    private fun validateKey(key: String) {
        require(key.isNotBlank()) { "Snapshot key must not be blank" }
        require(key != "." && key != "..") { "Snapshot key must be a file name" }
        require('/' !in key && '\\' !in key) { "Snapshot key must not contain a path" }
    }
}
