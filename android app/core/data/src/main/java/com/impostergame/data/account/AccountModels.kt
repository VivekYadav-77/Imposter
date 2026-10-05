package com.impostergame.data.account

import com.impostergame.data.model.RoomSnapshot
import kotlinx.serialization.Serializable

@Serializable
data class UserProfile(
    val id: String,
    val email: String,
    val displayName: String,
    val avatarId: String,
    val createdAt: String,
)

@Serializable
data class DashboardRoom(
    val participantId: String,
    val nickname: String,
    val avatarId: String,
    val roomId: String,
    val code: String,
    val status: String,
    val isHost: Boolean,
    val expiresAt: String,
    val rejoinable: Boolean,
)

@Serializable
data class DashboardStats(
    val games: Int,
    val wins: Int,
    val crewGames: Int,
    val imposterGames: Int,
    val tasksCompleted: Int,
    val tasksTotal: Int,
    val survived: Int,
    val hosted: Int,
    val winRate: Int,
    val taskCompletionRate: Int,
    val survivalRate: Int,
)

@Serializable
data class UserGameSummary(
    val id: String,
    val roomId: String,
    val code: String,
    val taskPackName: String,
    val winner: String?,
    val endReason: String?,
    val phase: String,
    val role: String,
    val lifeStatus: String,
    val playerCount: Int,
    val won: Boolean,
    val startedAt: String,
    val endedAt: String?,
)

@Serializable
data class DashboardData(
    val rooms: List<DashboardRoom>,
    val recentGames: List<UserGameSummary>,
    val stats: DashboardStats,
)

@Serializable
data class UserSession(
    val id: String,
    val deviceLabel: String,
    val issuedAt: String,
    val lastUsedAt: String?,
    val expiresAt: String,
    val current: Boolean,
)

@Serializable
data class HistoryPlayer(
    val id: String,
    val nickname: String,
    val avatarId: String,
    val role: String,
    val lifeStatus: String,
    val totalTasks: Int,
    val completedTasks: Int,
)

@Serializable data class HistoryBallot(val meeting: Int, val voter: String, val target: String?)

@Serializable
data class HistoryElimination(
    val type: String,
    val target: String,
    val actor: String?,
    val occurredAt: String,
)

@Serializable
data class UserGameDetail(
    val id: String,
    val code: String,
    val taskPackName: String,
    val winner: String?,
    val endReason: String?,
    val role: String,
    val lifeStatus: String,
    val startedAt: String,
    val endedAt: String?,
    val voteVisibility: String,
    val players: List<HistoryPlayer>,
    val ballots: List<HistoryBallot>,
    val eliminations: List<HistoryElimination>,
)

@Serializable
data class MobileGoogleChallenge(
    val transactionToken: String,
    val nonce: String,
    val expiresAt: String,
) {
    override fun toString(): String =
        "MobileGoogleChallenge(transactionToken=██REDACTED██, nonce=██REDACTED██, expiresAt=$expiresAt)"
}

@Serializable
data class AccountSessionIssue(
    val token: String,
    val expiresAt: String,
    val sessionId: String,
) {
    override fun toString(): String =
        "AccountSessionIssue(token=██REDACTED██, expiresAt=$expiresAt, sessionId=██REDACTED██)"
}

@Serializable
data class MobileGoogleCompletion(
    val intent: String,
    val returnTo: String,
    val participantId: String?,
    val user: UserProfile,
    val session: AccountSessionIssue?,
)

@Serializable
data class AccountRejoinIssue(
    val room: RoomSnapshot,
    val sessionToken: String,
    val sessionExpiresAt: String,
) {
    override fun toString(): String =
        "AccountRejoinIssue(room=██REDACTED██, sessionToken=██REDACTED██, sessionExpiresAt=$sessionExpiresAt)"
}

@Serializable
data class HistoryPage(
    val items: List<UserGameSummary>,
    val nextCursor: String?,
)
