package expo.modules.workoutworker.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WorkoutPreviewSnapshotParserTest {
    @Test
    fun `parses every schema v2 field used by native current-exercise selection`() {
        val snapshot = WorkoutPreviewSnapshotParser.parse(
            """
            {
              "schemaVersion": 2,
              "sessionId": "preview",
              "revision": 7,
              "status": "active",
              "exercises": [
                {
                  "exerciseIndex": 0,
                  "type": "weighted",
                  "repsPerSet": 8,
                  "supersetWithNext": false,
                  "sets": [
                    {
                      "setIndex": 0,
                      "completed": true,
                      "reps": 8,
                      "completionDateTime": "2026-08-31T15:00:00-03:00",
                      "weight": 80.0,
                      "weightUnit": "kilograms",
                      "durationSeconds": null,
                      "distanceValue": null,
                      "distanceUnit": null,
                      "resistance": null,
                      "incline": null,
                      "steps": null,
                      "currentBlockStartTime": null
                    }
                  ]
                },
                {
                  "exerciseIndex": 1,
                  "type": "cardio",
                  "repsPerSet": null,
                  "supersetWithNext": false,
                  "sets": [
                    {
                      "setIndex": 0,
                      "completed": false,
                      "reps": null,
                      "completionDateTime": null,
                      "weight": 20.0,
                      "weightUnit": "kilograms",
                      "durationSeconds": 12.5,
                      "distanceValue": 0.2,
                      "distanceUnit": "kilometre",
                      "resistance": 5.0,
                      "incline": 3.0,
                      "steps": 40,
                      "currentBlockStartTime": "2026-08-31T15:05:00-03:00"
                    }
                  ]
                }
              ],
              "restTimerEndTime": 1788203100,
              "error": null
            }
            """.trimIndent(),
        )

        val weighted = snapshot.exercises[0].sets[0]
        assertEquals("2026-08-31T15:00:00-03:00", weighted.completionDateTime)
        assertNull(weighted.currentBlockStartTime)

        val cardio = snapshot.exercises[1].sets[0]
        assertEquals(12.5, cardio.durationSeconds!!, 0.0)
        assertEquals(0.2, cardio.distanceValue!!, 0.0)
        assertEquals("kilometre", cardio.distanceUnit)
        assertEquals(5.0, cardio.resistance!!, 0.0)
        assertEquals(3.0, cardio.incline!!, 0.0)
        assertEquals(40, cardio.steps)
        assertEquals("2026-08-31T15:05:00-03:00", cardio.currentBlockStartTime)
        assertEquals(1788203100.0, snapshot.restTimerEndTime!!, 0.0)
    }

    @Test
    fun `delegates schema validation to the engine contract`() {
        val invalid = """
            {
              "schemaVersion": 1,
              "sessionId": "preview",
              "revision": 0,
              "status": "active",
              "exercises": [],
              "restTimerEndTime": null,
              "error": null
            }
        """.trimIndent()

        org.junit.Assert.assertThrows(WorkoutEngineException::class.java) {
            WorkoutPreviewSnapshotParser.parse(invalid)
        }
    }
}
