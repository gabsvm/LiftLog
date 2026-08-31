package expo.modules.workoutworker.engine

import androidx.core.os.bundleOf
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
    override fun definition() = ModuleDefinition {
        Name("WorkoutEngine")

        Events("onSnapshot")

        Function("getSnapshot") { snapshotJson: String ->
            WorkoutEngine.encodeSnapshot(WorkoutEngine.decodeSnapshot(snapshotJson))
        }

        Function("applyCommand") { snapshotJson: String, commandJson: String ->
            val nextSnapshot = WorkoutEngine.applyJson(snapshotJson, commandJson)
            sendEvent("onSnapshot", bundleOf("snapshotJson" to nextSnapshot))
            nextSnapshot
        }
    }
}
