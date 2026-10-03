package com.impostergame.android.gameplay

import com.impostergame.data.model.Assignment
import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.Meeting
import com.impostergame.data.model.Submission
import com.impostergame.designsystem.component.ConnectionState

enum class GameplayDestination {
    LOADING,
    SEALED_ROLE,
    TASKS,
    EVIDENCE,
    MEETING,
    RESULTS,
}

internal fun List<Assignment>.incompleteFirst(): List<Assignment> = sortedBy {
    it.status == "completed"
}

internal fun GameplayUiState.mayKill(targetId: String): Boolean {
    val self = snapshot?.self ?: return false
    return self.capabilities.contains("kill") && targetId in self.killableParticipantIds
}

internal fun GameplayUiState.mayCallMeeting(): Boolean {
    val snapshot = snapshot ?: return false
    val availableAt = snapshot.cooldowns.meetingAvailableAt
    val cooldownReady =
        availableAt == null ||
            runCatching {
                    java.time.Instant.parse(availableAt).epochSecond <=
                        java.time.Instant.now().epochSecond
                }
                .getOrDefault(false)
    return snapshot.self.lifeStatus == "alive" &&
        snapshot.self.capabilities.contains("call_meeting") &&
        snapshot.meetingRules.remainingForSelf > 0 &&
        (!snapshot.meetingRules.requiresCompletedTask || snapshot.meetingRules.hasCompletedTask) &&
        cooldownReady
}

internal fun GameplayUiState.mayReviewVote(): Boolean {
    val meeting = snapshot?.meeting ?: return false
    return remainingSeconds != 0L &&
        snapshot.self.lifeStatus == "alive" &&
        meeting.capabilities.contains("vote_review") &&
        reviewVoteSubmittedItemId != meeting.reviewItem?.id &&
        meeting.reviewItem?.ownDecision == null
}

internal fun GameplayUiState.mayEjectionVote(): Boolean {
    val meeting = snapshot?.meeting ?: return false
    return remainingSeconds != 0L &&
        snapshot.self.lifeStatus == "alive" &&
        meeting.capabilities.contains("vote_ejection") &&
        ejectionVoteSubmittedMeetingId != meeting.id &&
        !meeting.hasCastEjectionVote
}

internal fun messageAfterPhaseTransition(
    previousPhase: GamePhase?,
    nextPhase: GamePhase,
    currentMessage: String?,
): String? =
    if (nextPhase == GamePhase.TASK && previousPhase != GamePhase.TASK) {
        null
    } else {
        currentMessage
    }

internal fun GameSnapshot.meetingReason(): String =
    when (meeting?.triggerType) {
        "kill" -> {
            val reported =
                participants.firstOrNull { it.id == meeting?.reportedParticipantId }?.nickname
                    ?: "A player"
            "$reported was reported eliminated."
        }
        "task_deadline" -> "The task phase timer ended."
        else -> "A player called this meeting."
    }

internal fun GameSnapshot.winnerLabel(): String =
    when (winner) {
        "crew" -> "Crew wins"
        "imposters",
        "imposter" -> "Imposters win"
        else -> "Game ended"
    }

internal fun GameSnapshot.endReasonLabel(): String =
    when (endReason) {
        "tasks_completed" -> "Every crew task was completed. The ship is secure."
        "imposters_ejected" -> "Every imposter was identified and ejected."
        "imposter_parity" -> "The imposters matched the remaining crew and took control."
        "time_expired" -> "Time expired before the crew could secure the room."
        "abandoned" -> "This game was abandoned before a winner was decided."
        else -> endReason?.replace('_', ' ')?.replaceFirstChar(Char::uppercase) ?: "Final result"
    }

enum class UploadStage {
    IDLE,
    PREPARING,
    PREVIEW,
    REQUESTING_INTENT,
    UPLOADING,
    CONFIRMING,
    PROCESSING,
    COMPLETE,
    RETRYABLE_FAILURE,
    TERMINAL_FAILURE,
}

data class PreparedEvidence(
    val bytes: ByteArray,
    val previewBytes: ByteArray,
    val contentType: String,
    val checksum: String,
) {
    override fun equals(other: Any?): Boolean =
        other is PreparedEvidence && checksum == other.checksum

    override fun hashCode(): Int = checksum.hashCode()

    override fun toString(): String = "PreparedEvidence(bytes=██REDACTED██, checksum=██REDACTED██)"
}

data class GameplayUiState(
    val destination: GameplayDestination = GameplayDestination.LOADING,
    val snapshot: GameSnapshot? = null,
    val roleRevealed: Boolean = false,
    val roleViewed: Boolean = false,
    val selectedAssignmentId: String? = null,
    val activeUploadAssignmentId: String? = null,
    val uploadStage: UploadStage = UploadStage.IDLE,
    val preparedEvidence: PreparedEvidence? = null,
    val activeSubmissionId: String? = null,
    val submissions: List<Submission> = emptyList(),
    val evidenceImageBytes: Map<String, ByteArray> = emptyMap(),
    val selectedSubmissionId: String? = null,
    val previewImageBytes: ByteArray? = null,
    val previewImageLoading: Boolean = false,
    val selectedKillTargetId: String? = null,
    val statusPanelVisible: Boolean = false,
    val killPickerVisible: Boolean = false,
    val confirmMeetingCall: Boolean = false,
    val meetingAlertId: String? = null,
    val selectedReviewDecision: String? = null,
    val confirmReviewVote: Boolean = false,
    val reviewVoteSubmittedItemId: String? = null,
    val hasEjectionSelection: Boolean = false,
    val selectedEjectionTargetId: String? = null,
    val confirmEjectionVote: Boolean = false,
    val ejectionVoteSubmittedMeetingId: String? = null,
    val reviewImageBytes: ByteArray? = null,
    val resultDetailsExpanded: Boolean = false,
    val loading: Boolean = false,
    val remainingSeconds: Long? = null,
    val message: String? = null,
    val connectionState: ConnectionState = ConnectionState.Connected,
) {
    val canKill: Boolean
        get() = snapshot?.self?.capabilities?.contains("kill") == true

    val canSubmitEvidence: Boolean
        get() = snapshot?.self?.capabilities?.contains("submit_evidence") == true
}

internal fun Meeting.publicBallotsAllowed(voteVisibility: String): Boolean =
    voteVisibility == "public"
