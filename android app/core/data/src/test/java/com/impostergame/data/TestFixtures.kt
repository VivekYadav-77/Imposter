package com.impostergame.data

import com.impostergame.data.model.Cooldowns
import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.GameProgress
import com.impostergame.data.model.GameSelf
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.GameTaskPack
import com.impostergame.data.model.MeetingRules
import com.impostergame.data.model.ParticipantSelf
import com.impostergame.data.model.RoomSettings
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.model.RoomStatus

internal const val ROOM_ID = "00000000-0000-4000-8000-000000000001"
internal const val PLAYER_ID = "00000000-0000-4000-8000-000000000002"
internal const val GAME_ID = "00000000-0000-4000-8000-000000000003"

internal fun roomSnapshot(status: RoomStatus = RoomStatus.LOBBY): RoomSnapshot =
    RoomSnapshot(
        id = ROOM_ID,
        code = "ABC123",
        status = status,
        minPlayers = 3,
        maxPlayers = 12,
        settings =
            RoomSettings(
                selectedTaskPack = null,
                taskPhaseSeconds = 60,
                meetingsPerPlayer = 1,
                meetingDurationSeconds = 30,
                meetingVotingMode = "timed",
                voteVisibility = "private",
                evidenceVisibility = "private",
                imposterMeetingTaskRequirement = "none",
                meetingCooldownSeconds = 10,
                imposterCooldownSeconds = 20,
                estimatedMeetingCooldownSeconds = 10,
                imposterCount = 1,
                allowedImposterCounts = listOf(1),
                taskCounts = mapOf("easy" to 1),
                roleCounts = emptyMap(),
            ),
        participants = emptyList(),
        self = ParticipantSelf(PLAYER_ID, "Player", "fox", true, emptyList()),
        expiresAt = "2026-09-28T00:00:00Z",
        gameId = if (status == RoomStatus.ACTIVE) GAME_ID else null,
    )

internal fun gameSnapshot(
    version: Long = 1,
    phase: GamePhase = GamePhase.TASK,
): GameSnapshot =
    GameSnapshot(
        id = GAME_ID,
        roomId = ROOM_ID,
        phase = phase,
        stateVersion = version,
        winner = null,
        endReason = null,
        taskPack = GameTaskPack("Standard"),
        phaseStartedAt = "2026-09-27T00:00:00Z",
        phaseDeadlineAt = null,
        participants = emptyList(),
        self =
            GameSelf(
                participantId = PLAYER_ID,
                avatarId = "fox",
                role = "crew",
                lifeStatus = "alive",
                capabilities = emptyList(),
                killableParticipantIds = emptyList(),
                knownEliminatedParticipantIds = emptyList(),
                crewRole = null,
            ),
        assignments = emptyList(),
        progress = GameProgress(0),
        evidenceVisibility = "private",
        cooldowns = Cooldowns(null, null, 10, 20),
        meetingRules = MeetingRules(30, "timed", "private", false, 1, 0, 1, false),
        meeting = null,
        resultSummary = null,
    )
