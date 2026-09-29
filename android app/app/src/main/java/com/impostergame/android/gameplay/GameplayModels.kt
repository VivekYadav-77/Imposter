package com.impostergame.android.gameplay

import com.impostergame.data.model.Assignment
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

internal fun GameplayUiState.mayFlag(submission: Submission): Boolean {
    val self = snapshot?.self ?: return false
    return self.capabilities.contains("flag_evidence") &&
        submission.uploader.id != self.participantId &&
        !submission.flaggedBySelf &&
        submission.processingStatus == "accepted"
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
        "crew" -> "Crewmates win"
        "imposters",
        "imposter" -> "Imposters win"
        else -> "Game ended"
    }

internal fun GameSnapshot.endReasonLabel(): String =
    when (endReason) {
        "tasks_completed" -> "All required tasks were completed."
        "imposters_ejected" -> "All imposters were ejected."
        "imposter_parity" -> "Imposters reached parity with the crew."
        "time_expired" -> "The game timer expired."
        "abandoned" -> "The game was abandoned."
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
    val uploadStage: UploadStage = UploadStage.IDLE,
    val preparedEvidence: PreparedEvidence? = null,
    val activeSubmissionId: String? = null,
    val submissions: List<Submission> = emptyList(),
    val selectedSubmissionId: String? = null,
    val previewImageBytes: ByteArray? = null,
    val selectedKillTargetId: String? = null,
    val statusPanelVisible: Boolean = false,
    val killPickerVisible: Boolean = false,
    val confirmKill: Boolean = false,
    val confirmMeetingCall: Boolean = false,
    val confirmFlag: Boolean = false,
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
    val isSensitive: Boolean
        get() = destination != GameplayDestination.LOADING

    val canKill: Boolean
        get() = snapshot?.self?.capabilities?.contains("kill") == true

    val canSubmitEvidence: Boolean
        get() = snapshot?.self?.capabilities?.contains("submit_evidence") == true

    val canFlagEvidence: Boolean
        get() = snapshot?.self?.capabilities?.contains("flag_evidence") == true
}

internal fun Meeting.publicBallotsAllowed(voteVisibility: String): Boolean =
    voteVisibility == "public"
