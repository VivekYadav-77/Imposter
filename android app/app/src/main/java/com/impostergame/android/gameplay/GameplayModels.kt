package com.impostergame.android.gameplay

import com.impostergame.data.model.Assignment
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.Submission

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
    val confirmKill: Boolean = false,
    val confirmFlag: Boolean = false,
    val loading: Boolean = false,
    val remainingSeconds: Long? = null,
    val message: String? = null,
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
