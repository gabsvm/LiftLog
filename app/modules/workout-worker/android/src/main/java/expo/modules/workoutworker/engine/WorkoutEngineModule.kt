package expo.modules.workoutworker.engine

import androidx.core.os.bundleOf
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Small, opt-in bridge for parity testing the pure session engine.
 *
 * It deliberately does not read or write SQLite, KeyValueStore, notifications,
 * or the existing workout worker. The current React Native session remains the
 * only production path until a device parity gate enables a native consumer.
 */
class WorkoutEngineModule : Module() {
    private var storage: WorkoutEngineStorage? = null

    override fun definition() = ModuleDefinition {
        Name("WorkoutEngine")

        Events("onSnapshot")

        OnCreate {
            storage = WorkoutEngineStorage(appContext.persistentFilesDirectory)
        }

        OnDestroy {
            storage = null
        }

        Function("getSnapshot") { snapshotJson: String ->
            WorkoutEngine.encodeSnapshot(WorkoutEngine.decodeSnapshot(snapshotJson))
        }

        Function("applyCommand") { snapshotJson: String, commandJson: String ->
            val nextSnapshot = WorkoutEngine.applyJson(snapshotJson, commandJson)
            sendEvent("onSnapshot", bundleOf("snapshotJson" to nextSnapshot))
            nextSnapshot
        }

        AsyncFunction("writeSnapshot") Coroutine { key: String, snapshotJson: String ->
            storageOrThrow().write(key, snapshotJson.toByteArray(Charsets.UTF_8))
            null
        }

        AsyncFunction("readSnapshot") Coroutine { key: String ->
            storageOrThrow().read(key)?.toString(Charsets.UTF_8)
        }

        AsyncFunction("removeSnapshot") Coroutine { key: String ->
            storageOrThrow().remove(key)
            null
        }
    }

    private fun storageOrThrow(): WorkoutEngineStorage {
        return storage ?: error("WorkoutEngine storage is not available")
    }
}
