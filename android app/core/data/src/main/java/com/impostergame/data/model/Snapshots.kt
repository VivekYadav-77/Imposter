package com.impostergame.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
enum class RoomStatus {
    @SerialName("lobby") LOBBY,
    @SerialName("active") ACTIVE,
    @SerialName("completed") COMPLETED,
    @SerialName("abandoned") ABANDONED,
    @SerialName("expired") EXPIRED,
}

@Serializable
enum class GamePhase {
    @SerialName("task") TASK,
    @SerialName("discussion") DISCUSSION,
    @SerialName("review") REVIEW,
    @SerialName("voting") VOTING,
    @SerialName("result") RESULT,
    @SerialName("game_over") GAME_OVER,
    @SerialName("abandoned") ABANDONED,
}

@Serializable
data class ParticipantSelf(
    val participantId: String,
    val nickname: String,
    val avatarId: String,
    val isHost: Boolean,
    val capabilities: List<String>,
)

@Serializable data class MapRole(val name: String, val specialization: String, val ability: String)

@Serializable
data class TaskPack(
    val id: String,
    val name: String,
    val revision: Int,
    val roles: List<MapRole>,
    val difficultyTaskCounts: DifficultyTaskCounts,
)

@Serializable data class DifficultyTaskCounts(val easy: Int, val medium: Int, val hard: Int)

@Serializable
data class RoomSettings(
    val selectedTaskPack: TaskPack?,
    val taskPhaseSeconds: Int,
    val meetingsPerPlayer: Int,
    val meetingDurationSeconds: Int,
    val meetingVotingMode: String,
    val voteVisibility: String,
    val evidenceVisibility: String,
    val imposterMeetingTaskRequirement: String,
    val meetingCooldownSeconds: Int,
    val imposterCooldownSeconds: Int,
    val estimatedMeetingCooldownSeconds: Int,
    val imposterCount: Int,
    val allowedImposterCounts: List<Int>,
    val taskCounts: Map<String, Int>,
    val roleCounts: Map<String, Int>,
)

@Serializable
data class RoomParticipant(
    val id: String,
    val nickname: String,
    val avatarId: String,
    val isHost: Boolean,
    val presence: String,
    val joinedAt: String,
)

@Serializable
data class RoomSnapshot(
    val id: String,
    val code: String,
    val status: RoomStatus,
    val minPlayers: Int,
    val maxPlayers: Int,
    val settings: RoomSettings,
    val participants: List<RoomParticipant>,
    val self: ParticipantSelf,
    val expiresAt: String,
    val gameId: String?,
)

@Serializable
data class GameParticipant(
    val id: String,
    val nickname: String,
    val avatarId: String,
    val isHost: Boolean,
    val lifeStatus: String,
)

@Serializable
data class GameSelf(
    val participantId: String,
    val avatarId: String,
    val role: String,
    val lifeStatus: String,
    val capabilities: List<String>,
    val killableParticipantIds: List<String>,
    val knownEliminatedParticipantIds: List<String>,
    val crewRole: MapRole?,
)

@Serializable
data class Assignment(
    val id: String,
    val description: String,
    val status: String,
    val completedAt: String?,
    val difficulty: String,
)

@Serializable data class GameProgress(val percent: Int)

@Serializable
data class Cooldowns(
    val killAvailableAt: String?,
    val meetingAvailableAt: String?,
    val meetingCooldownSeconds: Int,
    val killCooldownSeconds: Int,
)

@Serializable
data class MeetingRules(
    val durationSeconds: Int,
    val votingMode: String,
    val voteVisibility: String,
    val requiresCompletedTask: Boolean,
    val maxPerPlayer: Int,
    val calledBySelf: Int,
    val remainingForSelf: Int,
    val hasCompletedTask: Boolean,
)

@Serializable
data class MeetingParticipant(val id: String, val nickname: String, val avatarId: String)

@Serializable
data class PublicVote(
    val voterParticipantId: String,
    val voterNickname: String,
    val voterAvatarId: String,
    val targetParticipantId: String?,
    val targetNickname: String?,
    val targetAvatarId: String?,
)

@Serializable
data class Meeting(
    val id: String,
    val sequenceNumber: Int,
    val triggerType: String,
    val reportedParticipantId: String?,
    val phase: String,
    val deadlineAt: String?,
    val eligibleParticipants: List<MeetingParticipant>,
    val reviewItem: JsonObject?,
    val ownEjectionTargetParticipantId: String?,
    val hasCastEjectionVote: Boolean,
    val votesCast: Int,
    val requiredVotes: Int,
    val publicVotes: List<PublicVote>,
    val result: JsonObject?,
    val capabilities: List<String>,
)

@Serializable
data class GameSnapshot(
    val id: String,
    val roomId: String,
    val phase: GamePhase,
    val stateVersion: Long,
    val winner: String?,
    val endReason: String?,
    val taskPack: GameTaskPack,
    val phaseStartedAt: String,
    val phaseDeadlineAt: String?,
    val participants: List<GameParticipant>,
    val self: GameSelf,
    val assignments: List<Assignment>,
    val progress: GameProgress,
    val evidenceVisibility: String,
    val cooldowns: Cooldowns,
    val meetingRules: MeetingRules,
    val meeting: Meeting?,
    val resultSummary: JsonObject?,
)

@Serializable data class GameTaskPack(val name: String)

@Serializable data class ApiMeta(val requestId: String, val serverTime: String)

@Serializable data class ApiEnvelope<T>(val data: T, val meta: ApiMeta)

@Serializable
data class RoomCreationInput(
    val nickname: String,
    val avatarId: String? = null,
    val minPlayers: Int = 3,
    val maxPlayers: Int = 15,
)

@Serializable data class RoomMembershipInput(val nickname: String, val avatarId: String? = null)

@Serializable
data class RoomJoinOptions(val availableAvatarIds: List<String>, val spotsRemaining: Int)

@Serializable
data class RoomSettingsInput(
    val selectedTaskPackId: String? = null,
    val taskPhaseSeconds: Int? = null,
    val meetingsPerPlayer: Int? = null,
    val meetingDurationSeconds: Int? = null,
    val meetingVotingMode: String? = null,
    val voteVisibility: String? = null,
    val evidenceVisibility: String? = null,
    val imposterMeetingTaskRequirement: String? = null,
    val meetingCooldownSeconds: Int? = null,
    val imposterCooldownSeconds: Int? = null,
    val imposterCount: Int? = null,
    val taskCounts: Map<String, Int>? = null,
    val roleCounts: Map<String, Int>? = null,
)

@Serializable
data class PublicTaskPack(
    val id: String,
    val name: String,
    val description: String?,
    val activeTaskCount: Int,
    val difficultyTaskCounts: DifficultyTaskCounts,
    val revision: Int,
    val roles: List<MapRole>,
)

@Serializable
data class EvidencePolicy(
    val version: String,
    val minimumAge: Int,
    val retentionHours: Int,
    val notice: String,
)

@Serializable
data class UploadIntent(
    val uploadId: String,
    val expiresAt: String,
    val method: String,
    val url: String,
    val headers: Map<String, String>,
    val policy: EvidencePolicy,
) {
    override fun toString(): String =
        "UploadIntent(uploadId=$uploadId, expiresAt=$expiresAt, method=$method, url=██REDACTED██, headers=██REDACTED██, policy=$policy)"
}

@Serializable
data class UploadIntentInput(
    val expectedStateVersion: Long,
    val contentType: String,
    val byteSize: Long,
    val checksum: String? = null,
)

@Serializable
data class ConfirmSubmissionInput(val expectedStateVersion: Long, val uploadId: String)

@Serializable
data class SubmissionSummary(
    val id: String,
    val assignmentId: String,
    val processingStatus: String,
    val reviewStatus: String,
    val createdAt: String,
)

@Serializable data class SubmissionUploader(val id: String, val nickname: String)

@Serializable
data class SubmissionImage(val url: String, val expiresAt: String) {
    override fun toString(): String = "SubmissionImage(url=██REDACTED██, expiresAt=$expiresAt)"
}

@Serializable
data class Submission(
    val id: String,
    val assignmentId: String,
    val uploader: SubmissionUploader,
    val processingStatus: String,
    val reviewStatus: String,
    val createdAt: String,
    val image: SubmissionImage?,
    val flaggedBySelf: Boolean,
)

@Serializable
data class SubmissionConfirmation(
    val submission: SubmissionSummary,
    val assignmentStatus: String,
    val progress: GameProgress,
    val stateVersion: Long,
)

@Serializable
data class FlagSubmissionInput(val expectedStateVersion: Long, val reason: String? = null)

@Serializable
data class FlagAcknowledgement(
    val submissionId: String,
    val reviewStatus: String,
    val stateVersion: Long,
)

@Serializable data class KillInput(val expectedStateVersion: Long, val targetParticipantId: String)

@Serializable
data class SessionCredential(val sessionToken: String, val sessionExpiresAt: String) {
    override fun toString(): String =
        "SessionCredential(sessionToken=██REDACTED██, sessionExpiresAt=$sessionExpiresAt)"
}

@Serializable
data class SessionIssue(
    val room: RoomSnapshot,
    val participant: ParticipantSelf,
    val sessionToken: String,
    val sessionExpiresAt: String,
) {
    override fun toString(): String =
        "SessionIssue(room=$room, participant=$participant, sessionToken=██REDACTED██, sessionExpiresAt=$sessionExpiresAt)"
}
