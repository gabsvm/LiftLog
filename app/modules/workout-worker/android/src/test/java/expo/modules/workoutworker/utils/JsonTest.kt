package expo.modules.workoutworker.utils

import com.limajuice.liftlog.Rest
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.time.Duration

class JsonTest {
    @Test
    fun restDurationsRoundTripAsIsoStrings() {
        val rest = Rest(
            minRest = Duration.parseIsoString("PT1M30S"),
            maxRest = Duration.parseIsoString("PT3M"),
            failureRest = Duration.parseIsoString("PT5M"),
        )

        val encoded = Json.encodeToString(rest)
        assertEquals(
            "{\"minRest\":\"PT1M30S\",\"maxRest\":\"PT3M\",\"failureRest\":\"PT5M\"}",
            encoded,
        )

        val decoded = Json.decodeFromString<Rest>(encoded)
        assertEquals(rest, decoded)
    }
}
