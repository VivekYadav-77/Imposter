package com.impostergame.android.gameplay

import com.impostergame.data.model.Assignment
import com.impostergame.data.model.Cooldowns
import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.GameProgress
import com.impostergame.data.model.GameSelf
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.GameTaskPack
import com.impostergame.data.model.MeetingRules
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
}
