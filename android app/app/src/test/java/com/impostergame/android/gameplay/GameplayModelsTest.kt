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
import com.impostergame.data.model.Submission
import com.impostergame.data.model.SubmissionUploader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
    fun killIsDrivenByCapabilityAndServerTargetList() {
        val roleWithoutCapability = state(capabilities = emptyList(), killable = listOf("target"))
        assertFalse(roleWithoutCapability.mayKill("target"))

        val authorized = state(capabilities = listOf("kill"), killable = listOf("target"))
        assertTrue(authorized.mayKill("target"))
        assertFalse(authorized.mayKill("someone-else"))
    }

    @Test
    fun flagRequiresCapabilityAcceptedEvidenceAndDifferentUploader() {
        val authorized = state(capabilities = listOf("flag_evidence"))
        assertTrue(authorized.mayFlag(submission("other", "accepted", flagged = false)))
        assertFalse(authorized.mayFlag(submission("self", "accepted", flagged = false)))
        assertFalse(authorized.mayFlag(submission("other", "pending", flagged = false)))
        assertFalse(authorized.mayFlag(submission("other", "accepted", flagged = true)))
    }

    @Test
    fun everyGameplayDestinationIsSecure() {
        GameplayDestination.entries
            .filterNot { it == GameplayDestination.LOADING }
            .forEach { destination ->
                assertTrue(GameplayUiState(destination = destination).isSensitive)
            }
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
    fun privateBallotsAreNeverRenderedAsPublic() {
        val meeting = meeting("deadline")
        assertFalse(meeting.publicBallotsAllowed("private"))
        assertTrue(meeting.publicBallotsAllowed("public"))
    }

    @Test
    fun terminalLabelsCoverWinnerAndAbandonedReason() {
        val base = snapshot(emptyList(), emptyList())
        assertEquals("Crewmates win", base.copy(winner = "crew").winnerLabel())
        assertEquals("Imposters win", base.copy(winner = "imposters").winnerLabel())
        assertEquals(
            "All required tasks were completed.",
            base.copy(endReason = "tasks_completed").endReasonLabel(),
        )
        assertEquals(
            "All imposters were ejected.",
            base.copy(endReason = "imposters_ejected").endReasonLabel(),
        )
        assertEquals(
            "Imposters reached parity with the crew.",
            base.copy(endReason = "imposter_parity").endReasonLabel(),
        )
        assertEquals(
            "The game timer expired.",
            base.copy(endReason = "time_expired").endReasonLabel(),
        )
        assertEquals("The game was abandoned.", base.copy(endReason = "abandoned").endReasonLabel())
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

    private fun submission(uploader: String, status: String, flagged: Boolean) =
        Submission(
            id = "submission-$uploader-$status-$flagged",
            assignmentId = "assignment",
            uploader = SubmissionUploader(uploader, uploader),
            processingStatus = status,
            reviewStatus = "valid",
            createdAt = "2026-09-28T00:00:00Z",
            image = null,
            flaggedBySelf = flagged,
        )

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
