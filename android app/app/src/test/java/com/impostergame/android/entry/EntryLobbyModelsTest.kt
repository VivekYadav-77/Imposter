package com.impostergame.android.entry

import com.impostergame.data.model.DifficultyTaskCounts
import com.impostergame.data.model.MapRole
import com.impostergame.data.model.ParticipantSelf
import com.impostergame.data.model.PublicTaskPack
import com.impostergame.data.model.RoomParticipant
import com.impostergame.data.model.RoomSettings
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.model.RoomStatus
import com.impostergame.data.model.TaskPack
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EntryLobbyModelsTest {
    @Test
    fun roomCodeNormalizationIsVisibleAndBounded() {
        assertEquals("AB12CD", normalizeRoomCode(" a-b 12_cd9 "))
        assertNull(validateRoomCode("AB12CD"))
        assertEquals("Enter the six-character room code.", validateRoomCode("ABC"))
    }

    @Test
    fun nicknameValidationMatchesServerCharacterRules() {
        assertEquals("Ada Lovelace", normalizeNickname("  Ada   Lovelace  "))
        assertNull(validateNickname("Ada Lovelace"))
        assertEquals("Nickname must contain 1 to 24 characters.", validateNickname(" "))
        assertEquals("Nickname cannot contain control characters.", validateNickname("Ada\u0007"))
    }

    @Test
    fun startExplainsEveryLocallyKnowableReadinessCause() {
        val missingBoth = EntryLobbyUiState(room = room(participantCount = 1, hasPack = false))
        assertEquals(2, missingBoth.startBlockingReasons.size)
        assertFalse(missingBoth.canStart)

        val ready = EntryLobbyUiState(room = room(participantCount = 3, hasPack = true))
        assertTrue(ready.startBlockingReasons.isEmpty())
        assertTrue(ready.canStart)

        val pendingSettings =
            EntryLobbyUiState(
                room = room(participantCount = 3, hasPack = true),
                settings = LobbySettingsDraft(dirty = true),
            )
        assertEquals(listOf("Apply pending settings."), pendingSettings.startBlockingReasons)
        assertFalse(pendingSettings.canStart)
    }

    @Test
    fun settingsValidationRejectsUnavailableTasksAndTooManyRoles() {
        val snapshot = room(participantCount = 3, hasPack = true)
        val state =
            EntryLobbyUiState(
                room = snapshot,
                taskPacks =
                    listOf(
                        PublicTaskPack(
                            id = "pack",
                            name = "Station",
                            description = null,
                            activeTaskCount = 3,
                            difficultyTaskCounts = DifficultyTaskCounts(1, 1, 1),
                            revision = 1,
                            roles = listOf(MapRole("Engineer", "Repair", "Fix")),
                        )
                    ),
                settings =
                    LobbySettingsDraft(
                        selectedTaskPackId = "pack",
                        imposterCount = 1,
                        taskCounts = mapOf("easy" to 2, "medium" to 1, "hard" to 1),
                        roleCounts = mapOf("Engineer" to 3),
                        dirty = true,
                    ),
            )

        assertTrue(state.settingsValidationErrors.any { it.contains("enough easy tasks") })
        assertTrue(state.settingsValidationErrors.any { it.contains("available crewmates") })
        assertFalse(state.canStart)
    }

    private fun room(participantCount: Int, hasPack: Boolean): RoomSnapshot {
        val participants =
            (1..participantCount).map { index ->
                RoomParticipant(
                    id = "p$index",
                    nickname = "Player $index",
                    avatarId = if (index == 1) "fox" else "owl",
                    isHost = index == 1,
                    presence = "connected",
                    joinedAt = "2026-09-27T00:00:00Z",
                )
            }
        return RoomSnapshot(
            id = "room",
            code = "ABC123",
            status = RoomStatus.LOBBY,
            minPlayers = 3,
            maxPlayers = 15,
            settings =
                RoomSettings(
                    selectedTaskPack =
                        if (hasPack) {
                            TaskPack(
                                "pack",
                                "Station",
                                1,
                                listOf(MapRole("Engineer", "Repair", "Fix")),
                                DifficultyTaskCounts(1, 1, 1),
                            )
                        } else null,
                    taskPhaseSeconds = 1800,
                    meetingsPerPlayer = 1,
                    meetingDurationSeconds = 180,
                    meetingVotingMode = "timed",
                    voteVisibility = "private",
                    evidenceVisibility = "private",
                    imposterMeetingTaskRequirement = "none",
                    meetingCooldownSeconds = 60,
                    imposterCooldownSeconds = 60,
                    estimatedMeetingCooldownSeconds = 60,
                    imposterCount = 1,
                    allowedImposterCounts = listOf(1),
                    taskCounts = mapOf("easy" to 1, "medium" to 1, "hard" to 1),
                    roleCounts = emptyMap(),
                ),
            participants = participants,
            self = ParticipantSelf("p1", "Player 1", "fox", true, listOf("room.start")),
            expiresAt = "2026-09-28T00:00:00Z",
            gameId = null,
        )
    }
}
