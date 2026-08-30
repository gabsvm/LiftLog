package expo.modules.workoutworker.handlers


import android.annotation.SuppressLint
import android.app.Notification
import android.util.Log
import com.limajuice.liftlog.DistanceCardioTarget
import com.limajuice.liftlog.RecordedCardioExercise
import com.limajuice.liftlog.RecordedCardioExerciseSet
import com.limajuice.liftlog.RecordedWeightedExercise
import com.limajuice.liftlog.TimeCardioTarget
import com.limajuice.liftlog.Translations
import com.limajuice.liftlog.Weight
import com.limajuice.liftlog.WeightUnit
import com.limajuice.liftlog.WorkoutMessage
import com.limajuice.liftlog.WorkoutUpdatedEvent
import expo.modules.workoutworker.utils.RepeatingTimerAction
import expo.modules.workoutworker.utils.WorkoutNotificationManager
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.DurationUnit.SECONDS
import kotlin.time.ExperimentalTime
import kotlin.time.toDuration


class WorkoutUpdatedHandler(
    private val notificationManager: WorkoutNotificationManager
) : WorkoutMessageHandler {
    override fun canHandle(event: WorkoutMessage): Boolean {
        return event.payload is WorkoutUpdatedEvent && event.appConfiguration.notificationsEnabled
    }

    val timer = RepeatingTimerAction(MainScope(), {}, intervalMs = 1_000L)

    override suspend fun handle(
        event: WorkoutMessage,
        dispatch: (type: String, event: WorkoutMessage) -> Unit
    ) {
        try {
            val workoutUpdatedEvent = event.payload as WorkoutUpdatedEvent

            when {
                workoutUpdatedEvent.restTimerInfo != null -> showRestTimerNotification(event.translations, workoutUpdatedEvent)
                workoutUpdatedEvent.cardioTimerInfo != null -> showCardioTimerNotification(event.translations, workoutUpdatedEvent)
                workoutUpdatedEvent.currentExerciseDetails != null -> showCurrentExerciseNotification(
                    event.translations,
                    workoutUpdatedEvent
                )

                else -> showFinishedNotification(event.translations, workoutUpdatedEvent)
            }
        } catch (e: Exception) {
            Log.e("WorkoutUpdatedHandler", "Failed to handle workout updated event", e)
        }
    }

    private fun showFinishedNotification(translations: Translations, event: WorkoutUpdatedEvent) {
        // We should not be in a timer anymore
        timer.stop()

        val messageTemplate: String =
            translations.workoutPersistentNotificationFinishedMessage
        val message = messageTemplate.replace(
            "\$WEIGHT$", formatWeight(event.totalWeightLifted)
        ).replace(
            "\$TIME$", formatDuration(event.workoutDuration)
        )

        val notifBuilder = notificationManager.createWorkoutNotificationBuilder()
            .setContentText(message)
        notificationManager.notifyPersistent(notifBuilder.build())
    }

    private fun showCurrentExerciseNotification(translations: Translations, event: WorkoutUpdatedEvent) {
        // We should not be in a timer anymore
        timer.stop()

        val notifBuilder = notificationManager.createWorkoutNotificationBuilder()
            .setContentText("${getCurrentExerciseMessage(translations, event)}\n${translations.workoutPersistentNotificationStartNowMessage}")
        notificationManager.notifyPersistent(notifBuilder.build())
    }

    @OptIn(ExperimentalTime::class)
    private fun showRestTimerNotification(
        translations: Translations,
        workoutUpdatedEvent: WorkoutUpdatedEvent,
    ) {
        val restTimerInfo = workoutUpdatedEvent.restTimerInfo ?: return
        val timeStartSecs = restTimerInfo.startedAt.epochSeconds
        val timePartiallyEndSecs = restTimerInfo.partiallyEndAt.epochSeconds
        val timeEndSecs = restTimerInfo.endAt.epochSeconds
        val partialProgressMax = timePartiallyEndSecs - timeStartSecs
        val fullProgressMax = timeEndSecs - timeStartSecs
        val currentExerciseMessage = getCurrentExerciseMessage(translations, workoutUpdatedEvent)

        fun getProgress(): Long = Clock.System.now().epochSeconds - timeStartSecs

        fun getRestMessage(now: Long): String = when {
            now < timePartiallyEndSecs -> translations.workoutPersistentNotificationRestBreakMessage
            now in timePartiallyEndSecs..timeEndSecs -> translations.workoutPersistentNotificationStartSoonMessage
            else -> translations.workoutPersistentNotificationStartNowMessage
        }

        fun getContentText(now: Long): String {
            val message = getRestMessage(now)
            return if (currentExerciseMessage.isEmpty()) {
                message
            } else {
                "$currentExerciseMessage\n$message"
            }
        }

        fun showPersistentRestState(now: Long) {
            val notifBuilder = notificationManager.createWorkoutNotificationBuilder()
                .setContentText(getContentText(now))
                // SystemUI owns the visible timer. This keeps the elapsed rest
                // time moving even while the React Native app is backgrounded,
                // without rebuilding the persistent notification every tick.
                .setWhen(timeStartSecs * 1_000L)
                .setUsesChronometer(true)
            notificationManager.notifyPersistent(notifBuilder.build())
        }

        showPersistentRestState(Clock.System.now().epochSeconds)

        var previousProgress = getProgress()
        if (fullProgressMax <= 0L || previousProgress >= fullProgressMax) {
            timer.stop()
            return
        }

        timer.updateCallback {
            val progress = getProgress()
            val now = Clock.System.now().epochSeconds
            val minimumCrossed =
                partialProgressMax in (previousProgress + 1)..progress && partialProgressMax != 0L
            val maximumCrossed =
                fullProgressMax in (previousProgress + 1)..progress && fullProgressMax != 0L

            val restNotif: Notification? = when {
                minimumCrossed -> notificationManager.createRestNotificationBuilder()
                    .setContentTitle(translations.workoutPersistentNotificationMinRestOverMessage)
                    .build()

                maximumCrossed -> notificationManager.createRestNotificationBuilder()
                    .setContentTitle(translations.workoutPersistentNotificationMaxRestOverMessage)
                    .build()

                else -> null
            }
            if (restNotif != null) {
                notificationManager.notifyRest(restNotif)

                MainScope().launch {
                    delay(10_000)
                    notificationManager.clearRestNotification()
                }
            }

            if (minimumCrossed || maximumCrossed) {
                // The chronometer itself is updated by Android. We only rebuild
                // when the semantic rest state changes.
                showPersistentRestState(now)
            }

            previousProgress = progress

            if (maximumCrossed) {
                // The native chronometer keeps running after max rest, so there
                // is no reason to keep a coroutine waking up once per second.
                timer.stop()
            }
        }
        timer.start()
    }


    @OptIn(ExperimentalTime::class)
    private fun showCardioTimerNotification(
        translations: Translations,
        workoutUpdatedEvent: WorkoutUpdatedEvent,
    ) {
        val cardioTimerInfo = workoutUpdatedEvent.cardioTimerInfo?:return
        val currentExerciseMessage = getCurrentExerciseMessage(translations, workoutUpdatedEvent)
        if(cardioTimerInfo.currentBlockStartTime == null){
            return
        }
        timer.updateCallback {
            val currentDuration = cardioTimerInfo.currentDuration
            val timeStartSecs =
                cardioTimerInfo.currentBlockStartTime.epochSeconds - currentDuration.toInt(SECONDS)
            val now = Clock.System.now().epochSeconds
            val timeMessage = formatDuration((now - timeStartSecs).toDuration(SECONDS))
            val notifBuilder =
                notificationManager.createWorkoutNotificationBuilder()
                    .setContentText(currentExerciseMessage)
                    .setSubText(timeMessage)

            notificationManager.notifyPersistent(notifBuilder.build())
        }
        timer.start()
    }

    @SuppressLint("DefaultLocale")
    private fun formatDuration(dur: Duration): String {
        return dur.toComponents { days: Long, hours: Int, minutes: Int, seconds: Int, _ ->
            when {
                days > 0 -> String.format("%d:%02d:%02d:%02d", days, hours, minutes, seconds)
                hours > 0 -> String.format("%d:%02d:%02d", hours, minutes, seconds)
                else -> String.format("%d:%02d", minutes, seconds)
            }
        }
    }

    private fun getCurrentExerciseMessage(translations: Translations, event: WorkoutUpdatedEvent): String {

        val currentExercise =
            event.currentExerciseDetails?.exercise
        val messageTemplate = translations.workoutPersistentNotificationCurrentExerciseMessage

        val nextSet =
            (event.currentExerciseDetails?.exercise as? RecordedWeightedExercise?)?.potentialSets?.firstOrNull { it.set == null }

        fun getCardioTarget(): String {
            var set: RecordedCardioExerciseSet
            if (event.cardioTimerInfo != null) {
                val exerciseIndex = event.cardioTimerInfo.exerciseIndex
                val setIndex = event.cardioTimerInfo.setIndex
                val exercise =
                    event.workout.recordedExercises[exerciseIndex.toInt()] as? RecordedCardioExercise?
                        ?: return ""
                set = exercise.sets[setIndex.toInt()]
            } else {
                val currentExercise = event.currentExerciseDetails?:return ""
                val setIndex = currentExercise.setIndex
                val exercise =
                    currentExercise.exercise as? RecordedCardioExercise?
                        ?: return ""
                set = exercise.sets[setIndex.toInt()]
            }
            return when (val cardioTarget = set.blueprint.target) {
                is TimeCardioTarget -> formatDuration(cardioTarget.value)

                is DistanceCardioTarget -> "${cardioTarget.value.value} ${cardioTarget.value.unit}"
                else -> ""
            }
        }

        return when {
            event.currentExerciseDetails == null -> ""
            currentExercise is RecordedWeightedExercise -> messageTemplate.replace(
                "\$EXERCISE_DESCRIPTOR$", "${currentExercise.blueprint.name} - ${currentExercise.blueprint.repsPerSet}${
                    if (nextSet?.weight != null) "x${formatWeight(nextSet.weight)}" else ""
                }"
            )

            currentExercise is RecordedCardioExercise-> messageTemplate.replace(
                "\$EXERCISE_DESCRIPTOR$", "${currentExercise.blueprint.name} - ${getCardioTarget()}"
            )

            else -> ""
        }
    }

    private fun formatWeight(weight: Weight): String {
        val weightValue = weight.value
        val shortUnit = when (weight.unit) {
            WeightUnit.kilograms -> "kg"
            WeightUnit.pounds -> "lbs"
            else -> "units"
        }
        return "$weightValue$shortUnit"
    }

    override fun onDestroy() {
        timer.destroy()
    }
}
