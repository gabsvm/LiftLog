package expo.modules.workoutworker.utils

import com.limajuice.liftlog.CardioExerciseBlueprint
import com.limajuice.liftlog.CardioExerciseSetBlueprint
import com.limajuice.liftlog.CardioTarget
import com.limajuice.liftlog.CardioTimerInfo
import com.limajuice.liftlog.CurrentExerciseDetails
import com.limajuice.liftlog.Distance
import com.limajuice.liftlog.DistanceCardioTarget
import com.limajuice.liftlog.ExerciseBlueprint
import com.limajuice.liftlog.FinishWorkoutCommand
import com.limajuice.liftlog.IncreaseAllEvenlyProgressiveOverload
import com.limajuice.liftlog.IncreaseLowestSetProgressiveOverload
import com.limajuice.liftlog.NoProgressiveOverload
import com.limajuice.liftlog.ProgressiveOverload
import com.limajuice.liftlog.RecordedCardioExercise
import com.limajuice.liftlog.RecordedCardioExerciseSet
import com.limajuice.liftlog.RecordedExercise
import com.limajuice.liftlog.RecordedWeightedExercise
import com.limajuice.liftlog.Rest
import com.limajuice.liftlog.RestTimerInfo
import com.limajuice.liftlog.Session
import com.limajuice.liftlog.TimeCardioTarget
import com.limajuice.liftlog.WeightedExerciseBlueprint
import com.limajuice.liftlog.WorkoutEndedEvent
import com.limajuice.liftlog.WorkoutMessagePayload
import com.limajuice.liftlog.WorkoutStartedEvent
import com.limajuice.liftlog.WorkoutUpdatedEvent
import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import com.squareup.moshi.ToJson
import com.squareup.moshi.adapter
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.math.BigDecimal
import kotlin.time.Duration
import kotlin.time.Instant
import com.limajuice.liftlog.Weight

class DurationAdapter : JsonAdapter<Duration>() {
    @FromJson
    override fun fromJson(reader: JsonReader): Duration =
        Duration.parseIsoString(reader.nextString())

    @ToJson
    override fun toJson(writer: JsonWriter, value: Duration?) {
        writer.value(value?.toIsoString())
    }
}

class InstantAdapter : JsonAdapter<Instant>() {
    override fun fromJson(reader: JsonReader): Instant =
        Instant.parse(reader.nextString())

    override fun toJson(writer: JsonWriter, value: Instant?) {
        writer.value(value?.toString())
    }
}

class BigDecimalAdapter : JsonAdapter<BigDecimal>() {
    override fun fromJson(reader: JsonReader): BigDecimal =
        BigDecimal(reader.nextString())

    override fun toJson(writer: JsonWriter, value: BigDecimal?) {
        writer.value(value?.toString())
    }
}

object Json {
    val moshi: Moshi = Moshi.Builder()
        .add(
            PolymorphicJsonAdapterFactory.of(WorkoutMessagePayload::class.java, "type")
                .withSubtype(WorkoutStartedEvent::class.java, "WorkoutStartedEvent")
                .withSubtype(WorkoutUpdatedEvent::class.java, "WorkoutUpdatedEvent")
                .withSubtype(WorkoutEndedEvent::class.java, "WorkoutEndedEvent")
                .withSubtype(FinishWorkoutCommand::class.java, "FinishWorkoutCommand")
        )
        .add(
            PolymorphicJsonAdapterFactory.of(RecordedExercise::class.java, "type")
                .withSubtype(RecordedCardioExercise::class.java, "RecordedCardioExercise")
                .withSubtype(RecordedWeightedExercise::class.java, "RecordedWeightedExercise")
        )
        .add(
            PolymorphicJsonAdapterFactory.of(ExerciseBlueprint::class.java, "type")
                .withSubtype(WeightedExerciseBlueprint::class.java, "WeightedExerciseBlueprint")
                .withSubtype(CardioExerciseBlueprint::class.java, "CardioExerciseBlueprint")
        )
        .add(
            PolymorphicJsonAdapterFactory.of(CardioTarget::class.java, "type")
                .withSubtype(DistanceCardioTarget::class.java, "distance")
                .withSubtype(TimeCardioTarget::class.java, "time")
        )
        .add(
            PolymorphicJsonAdapterFactory.of(ProgressiveOverload::class.java, "type")
                .withSubtype(NoProgressiveOverload::class.java, "NoProgressiveOverload")
                .withSubtype(IncreaseAllEvenlyProgressiveOverload::class.java, "IncreaseAllEvenlyProgressiveOverload")
                .withSubtype(IncreaseLowestSetProgressiveOverload::class.java, "IncreaseLowestSetProgressiveOverload")
        )
        .add(Rest::class.java, RestJsonAdapter())
        .add(TimeCardioTarget::class.java, TimeCardioTargetJsonAdapter())
        .add(CardioTimerInfo::class.java, CardioTimerInfoJsonAdapter())
        .add(RecordedCardioExerciseSet::class.java, RecordedCardioExerciseSetJsonAdapter())
        .add(WorkoutUpdatedEvent::class.java, WorkoutUpdatedEventJsonAdapter())
        .add(Duration::class.java, DurationAdapter())
        .add(Instant::class.java, InstantAdapter())
        .add(BigDecimal::class.java, BigDecimalAdapter())
        .addLast(KotlinJsonAdapterFactory())
        .build()

    @OptIn(ExperimentalStdlibApi::class)
    inline fun <reified T> decodeFromString(json: String): T {


        val jsonAdapter: JsonAdapter<T> = moshi.adapter<T>()

        return jsonAdapter.fromJson(json) as T
    }

    @OptIn(ExperimentalStdlibApi::class)
    inline fun <reified T> encodeToString(value: T): String {


        val jsonAdapter: JsonAdapter<T> = moshi.adapter<T>()

        return jsonAdapter.toJson(value)
    }
}

private fun readDuration(reader: JsonReader): Duration =
    Duration.parseIsoString(reader.nextString())

private fun writeDuration(writer: JsonWriter, value: Duration) {
    writer.value(value.toIsoString())
}

private fun readNullableString(reader: JsonReader): String? =
    if (reader.peek() == JsonReader.Token.NULL) reader.nextNull() else reader.nextString()

private fun readNullableDuration(reader: JsonReader): Duration? =
    if (reader.peek() == JsonReader.Token.NULL) reader.nextNull() else readDuration(reader)

private fun readNullableLong(reader: JsonReader): Long? =
    if (reader.peek() == JsonReader.Token.NULL) reader.nextNull() else reader.nextLong()

private fun writeNullableString(writer: JsonWriter, value: String?) {
    if (value == null) writer.nullValue() else writer.value(value)
}

private fun writeNullableDuration(writer: JsonWriter, value: Duration?) {
    if (value == null) writer.nullValue() else writeDuration(writer, value)
}

private fun writeNullableLong(writer: JsonWriter, value: Long?) {
    if (value == null) writer.nullValue() else writer.value(value)
}

private class RestJsonAdapter : JsonAdapter<Rest>() {
    override fun fromJson(reader: JsonReader): Rest {
        var minRest: Duration? = null
        var maxRest: Duration? = null
        var failureRest: Duration? = null

        reader.beginObject()
        while (reader.hasNext()) {
            when (reader.nextName()) {
                "minRest" -> minRest = readDuration(reader)
                "maxRest" -> maxRest = readDuration(reader)
                "failureRest" -> failureRest = readDuration(reader)
                else -> reader.skipValue()
            }
        }
        reader.endObject()

        return Rest(
            minRest = requireNotNull(minRest) { "Missing Rest.minRest" },
            maxRest = requireNotNull(maxRest) { "Missing Rest.maxRest" },
            failureRest = requireNotNull(failureRest) { "Missing Rest.failureRest" },
        )
    }

    override fun toJson(writer: JsonWriter, value: Rest?) {
        if (value == null) {
            writer.nullValue()
            return
        }
        writer.beginObject()
        writer.name("minRest")
        writeDuration(writer, value.minRest)
        writer.name("maxRest")
        writeDuration(writer, value.maxRest)
        writer.name("failureRest")
        writeDuration(writer, value.failureRest)
        writer.endObject()
    }
}

private class TimeCardioTargetJsonAdapter : JsonAdapter<TimeCardioTarget>() {
    override fun fromJson(reader: JsonReader): TimeCardioTarget {
        var type: String? = null
        var value: Duration? = null

        reader.beginObject()
        while (reader.hasNext()) {
            when (reader.nextName()) {
                "type" -> type = reader.nextString()
                "value" -> value = readDuration(reader)
                else -> reader.skipValue()
            }
        }
        reader.endObject()

        return TimeCardioTarget(
            type = requireNotNull(type) { "Missing TimeCardioTarget.type" },
            value = requireNotNull(value) { "Missing TimeCardioTarget.value" },
        )
    }

    override fun toJson(writer: JsonWriter, value: TimeCardioTarget?) {
        if (value == null) {
            writer.nullValue()
            return
        }
        writer.beginObject()
        writer.name("type").value(value.type)
        writer.name("value")
        writeDuration(writer, value.value)
        writer.endObject()
    }
}

private class CardioTimerInfoJsonAdapter : JsonAdapter<CardioTimerInfo>() {
    private val instantAdapter by lazy { Json.moshi.adapter(Instant::class.java).nullSafe() }

    override fun fromJson(reader: JsonReader): CardioTimerInfo {
        var currentDuration: Duration? = null
        var currentBlockStartTime: Instant? = null
        var exerciseIndex: Long? = null
        var setIndex: Long? = null

        reader.beginObject()
        while (reader.hasNext()) {
            when (reader.nextName()) {
                "currentDuration" -> currentDuration = readDuration(reader)
                "currentBlockStartTime" -> currentBlockStartTime = instantAdapter.fromJson(reader)
                "exerciseIndex" -> exerciseIndex = reader.nextLong()
                "setIndex" -> setIndex = reader.nextLong()
                else -> reader.skipValue()
            }
        }
        reader.endObject()

        return CardioTimerInfo(
            currentDuration = requireNotNull(currentDuration) { "Missing CardioTimerInfo.currentDuration" },
            currentBlockStartTime = currentBlockStartTime,
            exerciseIndex = requireNotNull(exerciseIndex) { "Missing CardioTimerInfo.exerciseIndex" },
            setIndex = requireNotNull(setIndex) { "Missing CardioTimerInfo.setIndex" },
        )
    }

    override fun toJson(writer: JsonWriter, value: CardioTimerInfo?) {
        if (value == null) {
            writer.nullValue()
            return
        }
        writer.beginObject()
        writer.name("currentDuration")
        writeDuration(writer, value.currentDuration)
        writer.name("currentBlockStartTime")
        instantAdapter.toJson(writer, value.currentBlockStartTime)
        writer.name("exerciseIndex").value(value.exerciseIndex)
        writer.name("setIndex").value(value.setIndex)
        writer.endObject()
    }
}

private class RecordedCardioExerciseSetJsonAdapter : JsonAdapter<RecordedCardioExerciseSet>() {
    private val blueprintAdapter by lazy {
        Json.moshi.adapter(CardioExerciseSetBlueprint::class.java)
    }
    private val distanceAdapter by lazy { Json.moshi.adapter(Distance::class.java).nullSafe() }
    private val bigDecimalAdapter by lazy { Json.moshi.adapter(BigDecimal::class.java).nullSafe() }
    private val weightAdapter by lazy { Json.moshi.adapter(Weight::class.java).nullSafe() }

    override fun fromJson(reader: JsonReader): RecordedCardioExerciseSet {
        var blueprint: CardioExerciseSetBlueprint? = null
        var completionDateTime: java.lang.String? = null
        var duration: Duration? = null
        var distance: Distance? = null
        var resistance: BigDecimal? = null
        var incline: BigDecimal? = null
        var weight: Weight? = null
        var steps: Long? = null

        reader.beginObject()
        while (reader.hasNext()) {
            when (reader.nextName()) {
                "blueprint" -> blueprint = blueprintAdapter.fromJson(reader)
                "completionDateTime" -> completionDateTime = if (reader.peek() == JsonReader.Token.NULL) {
                    reader.nextNull()
                } else {
                    java.lang.String(reader.nextString().toCharArray())
                }
                "duration" -> duration = readNullableDuration(reader)
                "distance" -> distance = distanceAdapter.fromJson(reader)
                "resistance" -> resistance = bigDecimalAdapter.fromJson(reader)
                "incline" -> incline = bigDecimalAdapter.fromJson(reader)
                "weight" -> weight = weightAdapter.fromJson(reader)
                "steps" -> steps = readNullableLong(reader)
                else -> reader.skipValue()
            }
        }
        reader.endObject()

        return RecordedCardioExerciseSet(
            blueprint = requireNotNull(blueprint) { "Missing RecordedCardioExerciseSet.blueprint" },
            completionDateTime = completionDateTime,
            duration = duration,
            distance = distance,
            resistance = resistance,
            incline = incline,
            weight = weight,
            steps = steps,
        )
    }

    override fun toJson(writer: JsonWriter, value: RecordedCardioExerciseSet?) {
        if (value == null) {
            writer.nullValue()
            return
        }
        writer.beginObject()
        writer.name("blueprint")
        blueprintAdapter.toJson(writer, value.blueprint)
        writer.name("completionDateTime")
        writeNullableString(writer, value.completionDateTime?.toString())
        writer.name("duration")
        writeNullableDuration(writer, value.duration)
        writer.name("distance")
        distanceAdapter.toJson(writer, value.distance)
        writer.name("resistance")
        bigDecimalAdapter.toJson(writer, value.resistance)
        writer.name("incline")
        bigDecimalAdapter.toJson(writer, value.incline)
        writer.name("weight")
        weightAdapter.toJson(writer, value.weight)
        writer.name("steps")
        writeNullableLong(writer, value.steps)
        writer.endObject()
    }
}

private class WorkoutUpdatedEventJsonAdapter : JsonAdapter<WorkoutUpdatedEvent>() {
    private val sessionAdapter by lazy { Json.moshi.adapter(Session::class.java) }
    private val restTimerInfoAdapter by lazy { Json.moshi.adapter(RestTimerInfo::class.java).nullSafe() }
    private val cardioTimerInfoAdapter by lazy { Json.moshi.adapter(CardioTimerInfo::class.java).nullSafe() }
    private val currentExerciseDetailsAdapter by lazy {
        Json.moshi.adapter(CurrentExerciseDetails::class.java).nullSafe()
    }
    private val weightAdapter by lazy { Json.moshi.adapter(Weight::class.java) }

    override fun fromJson(reader: JsonReader): WorkoutUpdatedEvent {
        var type: String? = null
        var workout: Session? = null
        var restTimerInfo: RestTimerInfo? = null
        var cardioTimerInfo: CardioTimerInfo? = null
        var currentExerciseDetails: CurrentExerciseDetails? = null
        var totalWeightLifted: Weight? = null
        var workoutDuration: Duration? = null

        reader.beginObject()
        while (reader.hasNext()) {
            when (reader.nextName()) {
                "type" -> type = reader.nextString()
                "workout" -> workout = sessionAdapter.fromJson(reader)
                "restTimerInfo" -> restTimerInfo = restTimerInfoAdapter.fromJson(reader)
                "cardioTimerInfo" -> cardioTimerInfo = cardioTimerInfoAdapter.fromJson(reader)
                "currentExerciseDetails" -> currentExerciseDetails = currentExerciseDetailsAdapter.fromJson(reader)
                "totalWeightLifted" -> totalWeightLifted = weightAdapter.fromJson(reader)
                "workoutDuration" -> workoutDuration = readDuration(reader)
                else -> reader.skipValue()
            }
        }
        reader.endObject()

        return WorkoutUpdatedEvent(
            type = requireNotNull(type) { "Missing WorkoutUpdatedEvent.type" },
            workout = requireNotNull(workout) { "Missing WorkoutUpdatedEvent.workout" },
            restTimerInfo = restTimerInfo,
            cardioTimerInfo = cardioTimerInfo,
            currentExerciseDetails = currentExerciseDetails,
            totalWeightLifted = requireNotNull(totalWeightLifted) { "Missing WorkoutUpdatedEvent.totalWeightLifted" },
            workoutDuration = requireNotNull(workoutDuration) { "Missing WorkoutUpdatedEvent.workoutDuration" },
        )
    }

    override fun toJson(writer: JsonWriter, value: WorkoutUpdatedEvent?) {
        if (value == null) {
            writer.nullValue()
            return
        }
        writer.beginObject()
        writer.name("type").value(value.type)
        writer.name("workout")
        sessionAdapter.toJson(writer, value.workout)
        writer.name("restTimerInfo")
        restTimerInfoAdapter.toJson(writer, value.restTimerInfo)
        writer.name("cardioTimerInfo")
        cardioTimerInfoAdapter.toJson(writer, value.cardioTimerInfo)
        writer.name("currentExerciseDetails")
        currentExerciseDetailsAdapter.toJson(writer, value.currentExerciseDetails)
        writer.name("totalWeightLifted")
        weightAdapter.toJson(writer, value.totalWeightLifted)
        writer.name("workoutDuration")
        writeDuration(writer, value.workoutDuration)
        writer.endObject()
    }
}
