package com.impostergame.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

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
) {
    override fun toString(): String =
        "RoomSnapshot(id=██REDACTED██, code=██REDACTED██, status=$status, participants=${participants.size})"
}

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
) {
    override fun toString(): String = "GameSelf(██PRIVATE_ROLE_REDACTED██)"
}

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
) {
    override fun toString(): String = "PublicVote(██BALLOT_REDACTED██)"
}

@Serializable
data class Meeting(
    val id: String,
    val sequenceNumber: Int,
    val triggerType: String,
    val reportedParticipantId: String?,
    val phase: String,
    val deadlineAt: String?,
    val eligibleParticipants: List<MeetingParticipant>,
    val reviewItem: ReviewItem?,
    val ownEjectionTargetParticipantId: String?,
    val hasCastEjectionVote: Boolean,
    val votesCast: Int,
    val requiredVotes: Int,
    val publicVotes: List<PublicVote>,
    val result: MeetingResult?,
    val capabilities: List<String>,
) {
    override fun toString(): String =
        "Meeting(id=██REDACTED██, phase=$phase, votesCast=$votesCast, ballots=██REDACTED██)"
}

@Serializable data class MeetingUploader(val id: String, val nickname: String)

@Serializable
data class ReviewItem(
    val id: String,
    val submissionId: String,
    val position: Int,
    val total: Int,
    val uploader: MeetingUploader,
    val assignmentDescription: String,
    val ownDecision: String?,
    val votesCast: Int,
    val requiredVotes: Int,
)

@Serializable data class MeetingVoteTotal(val participantId: String, val votes: Int)

@Serializable
data class MeetingResult(
    val ejectedParticipantId: String?,
    val totals: List<MeetingVoteTotal>,
    val skipVotes: Int,
    val ballots: List<PublicVote> = emptyList(),
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
    val resultSummary: GameResultSummary?,
) {
    override fun toString(): String =
        "GameSnapshot(id=██REDACTED██, phase=$phase, stateVersion=$stateVersion, privateFields=██REDACTED██)"
}

@Serializable
data class GameResultPlayer(
    val id: String,
    val nickname: String,
    val avatarId: String,
    val role: String,
    val crewRole: MapRole?,
    val lifeStatus: String,
    val completedTasks: Int,
    val totalTasks: Int,
) {
    override fun toString(): String = "GameResultPlayer(privateFields=██REDACTED██)"
}

@Serializable
data class GameResultSummary(
    val durationSeconds: Int,
    val completedTasks: Int,
    val totalTasks: Int,
    val players: List<GameResultPlayer>,
)

@Serializable
data class ReviewVoteInput(val expectedStateVersion: Long, val decision: String) {
    override fun toString(): String =
        "ReviewVoteInput(expectedStateVersion=$expectedStateVersion, decision=██REDACTED██)"
}

@Serializable
data class CallMeetingInput(val expectedStateVersion: Long) {
    override fun toString(): String = "CallMeetingInput(expectedStateVersion=$expectedStateVersion)"
}

@Serializable
data class EjectionVoteInput(
    val expectedStateVersion: Long,
    val targetParticipantId: String?,
) {
    override fun toString(): String =
        "EjectionVoteInput(expectedStateVersion=$expectedStateVersion, target=██REDACTED██)"
}

@Serializable
data class VoteAcknowledgement(
    val stateVersion: Long,
    val votesCast: Int,
    val meetingId: String? = null,
    val targetParticipantId: String? = null,
    val resolved: Boolean? = null,
    val winner: String? = null,
) {
    override fun toString(): String =
        "VoteAcknowledgement(stateVersion=$stateVersion, ballot=██REDACTED██)"
}

@Serializable data class GameTaskPack(val name: String)

@Serializable
data class ApiMeta(
    val requestId: String,
    val serverTime: String,
    val nextCursor: String? = null,
)

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
) {
    override fun toString(): String =
        "UploadIntentInput(expectedStateVersion=$expectedStateVersion, contentType=$contentType, byteSize=$byteSize, checksum=██REDACTED██)"
}

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
        "SessionIssue(room=██REDACTED██, participant=██REDACTED██, sessionToken=██REDACTED██, sessionExpiresAt=$sessionExpiresAt)"
}
