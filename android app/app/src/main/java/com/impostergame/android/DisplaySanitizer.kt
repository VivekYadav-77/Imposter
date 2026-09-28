package com.impostergame.android

import com.impostergame.data.model.GameResultPlayer
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.MapRole
import com.impostergame.data.model.Meeting
import com.impostergame.data.model.PublicTaskPack
import com.impostergame.data.model.PublicVote
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.model.Submission
import com.impostergame.data.network.UntrustedText

internal fun RoomSnapshot.sanitizedForDisplay(): RoomSnapshot =
    copy(
        settings =
            settings.copy(
                selectedTaskPack =
                    settings.selectedTaskPack?.let { pack ->
                        pack.copy(
                            name = UntrustedText.display(pack.name, "Unnamed task pack"),
                            roles = pack.roles.map(MapRole::sanitizedForDisplay),
                        )
                    }
            ),
        participants =
            participants.map { it.copy(nickname = UntrustedText.display(it.nickname, "Player")) },
        self = self.copy(nickname = UntrustedText.display(self.nickname, "You")),
    )

internal fun PublicTaskPack.sanitizedForDisplay(): PublicTaskPack =
    copy(
        name = UntrustedText.display(name, "Unnamed task pack"),
        description = description?.let { UntrustedText.display(it, "") },
        roles = roles.map(MapRole::sanitizedForDisplay),
    )

internal fun GameSnapshot.sanitizedForDisplay(): GameSnapshot =
    copy(
        taskPack = taskPack.copy(name = UntrustedText.display(taskPack.name, "Task pack")),
        participants =
            participants.map { it.copy(nickname = UntrustedText.display(it.nickname, "Player")) },
        self =
            self.copy(
                role = UntrustedText.display(self.role, "Private role"),
                crewRole = self.crewRole?.sanitizedForDisplay(),
            ),
        assignments =
            assignments.map {
                it.copy(description = UntrustedText.display(it.description, "Task"))
            },
        meeting = meeting?.sanitizedForDisplay(),
        resultSummary =
            resultSummary?.let { summary ->
                summary.copy(
                    players = summary.players.map(GameResultPlayer::sanitizedForDisplay)
                )
            },
    )

internal fun Submission.sanitizedForDisplay(): Submission =
    copy(uploader = uploader.copy(nickname = UntrustedText.display(uploader.nickname, "Player")))

private fun MapRole.sanitizedForDisplay(): MapRole =
    copy(
        name = UntrustedText.display(name, "Role"),
        specialization = UntrustedText.display(specialization, ""),
        ability = UntrustedText.display(ability, ""),
    )

private fun Meeting.sanitizedForDisplay(): Meeting =
    copy(
        eligibleParticipants =
            eligibleParticipants.map {
                it.copy(nickname = UntrustedText.display(it.nickname, "Player"))
            },
        reviewItem =
            reviewItem?.let { item ->
                item.copy(
                    uploader =
                        item.uploader.copy(
                            nickname = UntrustedText.display(item.uploader.nickname, "Player")
                        ),
                    assignmentDescription =
                        UntrustedText.display(item.assignmentDescription, "Task"),
                )
            },
        publicVotes = publicVotes.map(PublicVote::sanitizedForDisplay),
        result = result?.copy(ballots = result.ballots.map(PublicVote::sanitizedForDisplay)),
    )

private fun PublicVote.sanitizedForDisplay(): PublicVote =
    copy(
        voterNickname = UntrustedText.display(voterNickname, "Player"),
        targetNickname = targetNickname?.let { UntrustedText.display(it, "Player") },
    )

private fun GameResultPlayer.sanitizedForDisplay(): GameResultPlayer =
    copy(
        nickname = UntrustedText.display(nickname, "Player"),
        role = UntrustedText.display(role, "Role"),
        crewRole = crewRole?.sanitizedForDisplay(),
    )
