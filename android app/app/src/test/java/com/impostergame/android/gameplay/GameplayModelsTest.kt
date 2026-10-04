package com.impostergame.android.gameplay

import com.impostergame.android.ui.countdownDescription
import com.impostergame.data.model.Assignment
import com.impostergame.data.model.Cooldowns
import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.GameProgress
import com.impostergame.data.model.GameSelf
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.GameTaskPack
import com.impostergame.data.model.Meeting
import com.impostergame.data.model.MeetingParticipant
import com.impostergame.data.model.MeetingRules
import com.impostergame.data.model.MeetingUploader
import com.impostergame.data.model.ReviewItem
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GameplayModelsTest {
    @Test
    fun incompleteTasksSortBeforeCompletedWithoutChangingGroupOrder() {
        val complete = assignment("complete", "completed")
        val first = assignment("first", "assigned")
        val second = assignment("second", "assigned")

        assertEquals(
            listOf("first", "second", "complete"),
            listOf(complete, first, second).incompleteFirst().map(Assignment::id),
        )
    }

    @Test
    fun killRequiresCapabilityServerTargetAndElapsedAuthoritativeCooldown() {
        val roleWithoutCapability = state(capabilities = emptyList(), killable = listOf("target"))
        assertFalse(roleWithoutCapability.mayKill("target"))

        val authorized = state(capabilities = listOf("kill"), killable = listOf("target"))
        assertTrue(authorized.mayKill("target"))
        assertFalse(authorized.mayKill("someone-else"))

        val coolingSnapshot =
            requireNotNull(authorized.snapshot)
                .copy(cooldowns = Cooldowns("2026-10-03T12:00:30Z", null, 60, 60))
        val cooling = GameplayUiState(snapshot = coolingSnapshot, killCooldownRemainingSeconds = 30)
        assertFalse(cooling.canKill)
        assertFalse(cooling.mayKill("target"))
        assertTrue(cooling.copy(killCooldownRemainingSeconds = 0).mayKill("target"))
    }

    @Test
    fun cooldownCountdownUsesTheServerDeadlineAndClampsAtZero() {
        assertEquals(
            30L,
            remainingSecondsUntil(
                "2026-10-03T12:00:30Z",
                Instant.parse("2026-10-03T12:00:00Z"),
            ),
        )
        assertEquals(
            0L,
            remainingSecondsUntil(
                "2026-10-03T12:00:00Z",
                Instant.parse("2026-10-03T12:00:01Z"),
            ),
        )
        assertNull(remainingSecondsUntil(null, Instant.parse("2026-10-03T12:00:00Z")))
        assertNull(remainingSecondsUntil("invalid", Instant.parse("2026-10-03T12:00:00Z")))
    }

    @Test
    fun meetingReasonUsesOnlyAuthorizedTriggerInformation() {
        val victim =
            com.impostergame.data.model.GameParticipant("victim", "Ari", "owl", false, "dead")
        val kill =
            snapshot(emptyList(), emptyList())
                .copy(
                    participants = listOf(victim),
                    meeting = meeting("kill", "victim"),
                )
        assertEquals("Ari was reported eliminated.", kill.meetingReason())
        assertEquals(
            "The task phase timer ended.",
            kill.copy(meeting = meeting("task_deadline")).meetingReason(),
        )
        assertEquals(
            "A player called this meeting.",
            kill.copy(meeting = meeting("player_called")).meetingReason(),
        )
    }

    @Test
    fun meetingControlsRequireAliveCapabilityAndOpenDeadline() {
        val base =
            snapshot(listOf("vote_review", "vote_ejection"), emptyList())
                .copy(meeting = meeting("deadline"))
        assertTrue(GameplayUiState(snapshot = base, remainingSeconds = 10).mayReviewVote())
        assertTrue(GameplayUiState(snapshot = base, remainingSeconds = 10).mayEjectionVote())
        assertFalse(GameplayUiState(snapshot = base, remainingSeconds = 0).mayReviewVote())
        val observer = base.copy(self = base.self.copy(lifeStatus = "dead"))
        assertFalse(GameplayUiState(snapshot = observer, remainingSeconds = 10).mayEjectionVote())
    }

    @Test
    fun meetingSuccessMessageIsClearedWhenTaskPhaseResumes() {
        assertNull(
            messageAfterPhaseTransition(
                GamePhase.VOTING,
                GamePhase.TASK,
                "Vote accepted and locked.",
            )
        )
        assertEquals(
            "Upload complete.",
            messageAfterPhaseTransition(GamePhase.TASK, GamePhase.TASK, "Upload complete."),
        )
    }

    @Test
    fun meetingCallRequiresServerCapabilityLifeAndRemainingCall() {
        val ready = state(capabilities = listOf("call_meeting"))
        val readySnapshot = requireNotNull(ready.snapshot)
        assertTrue(ready.mayCallMeeting())
        assertFalse(state(capabilities = emptyList()).mayCallMeeting())
        val dead = readySnapshot.copy(self = readySnapshot.self.copy(lifeStatus = "killed"))
        assertFalse(GameplayUiState(snapshot = dead).mayCallMeeting())
        val exhausted =
            readySnapshot.copy(meetingRules = readySnapshot.meetingRules.copy(remainingForSelf = 0))
        assertFalse(GameplayUiState(snapshot = exhausted).mayCallMeeting())
        val taskRequired =
            readySnapshot.copy(
                meetingRules =
                    readySnapshot.meetingRules.copy(
                        requiresCompletedTask = true,
                        hasCompletedTask = false,
                    )
            )
        assertFalse(GameplayUiState(snapshot = taskRequired).mayCallMeeting())
    }

    @Test
    fun privateBallotsAreNeverRenderedAsPublic() {
        val meeting = meeting("deadline")
        assertFalse(meeting.publicBallotsAllowed("private"))
        assertTrue(meeting.publicBallotsAllowed("public"))
    }

    @Test
    fun terminalLabelsCoverWinnerAndAbandonedReason() {
        val base = snapshot(emptyList(), emptyList())
        assertEquals("Crew wins", base.copy(winner = "crew").winnerLabel())
        assertEquals("Imposters win", base.copy(winner = "imposters").winnerLabel())
        assertEquals(
            "Every crew task was completed. The ship is secure.",
            base.copy(endReason = "tasks_completed").endReasonLabel(),
        )
        assertEquals(
            "Every imposter was identified and ejected.",
            base.copy(endReason = "imposters_ejected").endReasonLabel(),
        )
        assertEquals(
            "The imposters matched the remaining crew and took control.",
            base.copy(endReason = "imposter_parity").endReasonLabel(),
        )
        assertEquals(
            "Time expired before the crew could secure the room.",
            base.copy(endReason = "time_expired").endReasonLabel(),
        )
        assertEquals(
            "This game was abandoned before a winner was decided.",
            base.copy(endReason = "abandoned").endReasonLabel(),
        )
    }

    @Test
    fun countdownAccessibilityTextChangesOnlyAtMeaningfulBoundaries() {
        assertEquals("2 minutes remaining", countdownDescription(120))
        assertEquals("2 minutes remaining", countdownDescription(61))
        assertEquals("Less than one minute remaining", countdownDescription(59))
        assertEquals("Time is up", countdownDescription(0))
        assertEquals("No phase deadline", countdownDescription(null))
    }

    private fun state(
        capabilities: List<String>,
        killable: List<String> = emptyList(),
    ): GameplayUiState = GameplayUiState(snapshot = snapshot(capabilities, killable))

    private fun snapshot(capabilities: List<String>, killable: List<String>): GameSnapshot =
        GameSnapshot(
            id = "game",
            roomId = "room",
            phase = GamePhase.TASK,
            stateVersion = 3,
            winner = null,
            endReason = null,
            taskPack = GameTaskPack("Station"),
            phaseStartedAt = "2026-09-28T00:00:00Z",
            phaseDeadlineAt = "2026-09-28T01:00:00Z",
            participants = emptyList(),
            self =
                GameSelf(
                    participantId = "self",
                    avatarId = "fox",
                    role = "imposter",
                    lifeStatus = "alive",
                    capabilities = capabilities,
                    killableParticipantIds = killable,
                    knownEliminatedParticipantIds = emptyList(),
                    crewRole = null,
                ),
            assignments = emptyList(),
            progress = GameProgress(0),
            evidenceVisibility = "public",
            cooldowns = Cooldowns(null, null, 60, 60),
            meetingRules = MeetingRules(180, "timed", "private", false, 1, 0, 1, false),
            meeting = null,
            resultSummary = null,
        )

    private fun assignment(id: String, status: String) =
        Assignment(id, "Task $id", status, null, "easy")

    private fun meeting(trigger: String, reported: String? = null) =
        Meeting(
            id = "meeting",
            sequenceNumber = 1,
            triggerType = trigger,
            reportedParticipantId = reported,
            phase = "review",
            deadlineAt = "2026-09-28T00:01:00Z",
            eligibleParticipants = listOf(MeetingParticipant("self", "Self", "fox")),
            reviewItem =
                ReviewItem(
                    "review",
                    "submission",
                    1,
                    1,
                    MeetingUploader("other", "Other"),
                    "Check the panel",
                    null,
                    0,
                    1,
                ),
            ownEjectionTargetParticipantId = null,
            hasCastEjectionVote = false,
            votesCast = 0,
            requiredVotes = 1,
            publicVotes = emptyList(),
            result = null,
            capabilities = listOf("vote_review", "vote_ejection"),
        )
}
