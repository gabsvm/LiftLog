package com.gabsvm.liftlog.nativeapp

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Mass
import com.liftlog.shared.domain.WeightUnit
import com.liftlog.shared.domain.WorkoutSession
import java.time.Instant
import java.time.ZoneOffset

/** Android-only adapter; the shared domain stays independent from Health Connect. */
class HealthConnectBridge(context: Context) {
    private val appContext = context.applicationContext

    fun isAvailable(): Boolean =
        HealthConnectClient.getSdkStatus(appContext) == HealthConnectClient.SDK_AVAILABLE

    suspend fun exportSession(session: WorkoutSession): Int {
        check(isAvailable()) { "Health Connect no está disponible en este dispositivo" }
        val client = HealthConnectClient.getOrCreate(appContext)
        val start = Instant.ofEpochMilli(session.startedAtEpochMillis)
        val end = Instant.ofEpochMilli(
            (session.completedAtEpochMillis ?: System.currentTimeMillis()).coerceAtLeast(session.startedAtEpochMillis),
        )
        val records = buildList<Record> {
            add(
                ExerciseSessionRecord(
                    startTime = start,
                    startZoneOffset = ZoneOffset.UTC,
                    endTime = end,
                    endZoneOffset = ZoneOffset.UTC,
                    exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
                    title = session.name,
                    notes = session.notes,
                    metadata = Metadata(),
                ),
            )
            session.bodyweight?.let { bodyweight ->
                val kilograms = if (session.bodyweightUnit == WeightUnit.POUNDS) bodyweight * 0.45359237 else bodyweight
                if (kilograms > 0.0) {
                    add(
                        WeightRecord(
                            time = end,
                            zoneOffset = ZoneOffset.UTC,
                            weight = Mass.kilograms(kilograms),
                            metadata = Metadata(),
                        ),
                    )
                }
            }
        }
        client.insertRecords(records)
        return records.size
    }

    companion object {
        val REQUIRED_PERMISSIONS = setOf(
            "android.permission.health.WRITE_EXERCISE",
            "android.permission.health.WRITE_WEIGHT",
        )
    }
}
