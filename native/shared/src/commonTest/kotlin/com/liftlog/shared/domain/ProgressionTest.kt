package com.liftlog.shared.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ProgressionTest {
    @Test
    fun increaseAllUsesTheHighestPreviousLoad() {
        val result = ProgressionCalculator.recommend(
            ProgressionRule(ProgressionMode.INCREASE_ALL, 2.5),
            listOf(60.0, 62.5, 60.0),
        )

        assertEquals(65.0, result?.nextWeight)
    }

    @Test
    fun increaseLowestUsesTheLowestPreviousLoad() {
        val result = ProgressionCalculator.recommend(
            ProgressionRule(ProgressionMode.INCREASE_LOWEST, 1.25),
            listOf(60.0, 62.5),
        )

        assertEquals(61.25, result?.nextWeight)
        assertNull(ProgressionCalculator.recommend(ProgressionRule(ProgressionMode.INCREASE_ALL, 2.5), emptyList()))
    }
}
