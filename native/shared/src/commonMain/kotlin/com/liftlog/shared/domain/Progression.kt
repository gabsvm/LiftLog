package com.liftlog.shared.domain

data class ProgressionRecommendation(
    val nextWeight: Double,
    val reason: String,
)

object ProgressionCalculator {
    fun recommend(
        rule: ProgressionRule,
        previousWeights: List<Double>,
    ): ProgressionRecommendation? {
        val validWeights = previousWeights.filter { it.isFinite() && it >= 0.0 }
        if (validWeights.isEmpty()) return null
        val base = when (rule.mode) {
            ProgressionMode.INCREASE_ALL -> validWeights.maxOrNull() ?: return null
            ProgressionMode.INCREASE_LOWEST -> validWeights.minOrNull() ?: return null
            ProgressionMode.NONE -> return null
        }
        return ProgressionRecommendation(
            nextWeight = base + rule.increment,
            reason = when (rule.mode) {
                ProgressionMode.INCREASE_ALL -> "Incrementa desde la carga más alta registrada"
                ProgressionMode.INCREASE_LOWEST -> "Incrementa desde la carga más baja registrada"
                ProgressionMode.NONE -> "Sin progresión"
            },
        )
    }
}
