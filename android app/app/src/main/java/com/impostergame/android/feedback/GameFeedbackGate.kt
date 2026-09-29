package com.impostergame.android.feedback

internal class GameFeedbackGate(
    private val nowMillis: () -> Long,
    private val maximumStableEvents: Int = 128,
) {
    private val playedStableEvents = LinkedHashSet<String>()
    private val lastPlayedAt = mutableMapOf<GameFeedbackKind, Long>()

    fun shouldPlay(event: GameFeedbackEvent): Boolean {
        val key = event.stableId?.let { "${event.kind}:$it" }
        if (key != null && key in playedStableEvents) return false
        val now = nowMillis()
        val minimumInterval = if (event.kind == GameFeedbackKind.Ui) 70L else 180L
        val previousPlay = lastPlayedAt[event.kind]
        if (previousPlay != null && now - previousPlay < minimumInterval) return false
        lastPlayedAt[event.kind] = now
        if (key != null) {
            playedStableEvents.add(key)
            while (playedStableEvents.size > maximumStableEvents) {
                playedStableEvents.remove(playedStableEvents.first())
            }
        }
        return true
    }
}
