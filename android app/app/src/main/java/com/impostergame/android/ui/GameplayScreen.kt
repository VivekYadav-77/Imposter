package com.impostergame.android.ui

import android.graphics.BitmapFactory
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.impostergame.android.gameplay.GameplayDestination
import com.impostergame.android.gameplay.GameplayUiState
import com.impostergame.android.gameplay.GameplayViewModel
import com.impostergame.android.gameplay.UploadStage
import com.impostergame.android.gameplay.endReasonLabel
import com.impostergame.android.gameplay.mayCallMeeting
import com.impostergame.android.gameplay.mayEjectionVote
import com.impostergame.android.gameplay.mayFlag
import com.impostergame.android.gameplay.mayReviewVote
import com.impostergame.android.gameplay.meetingReason
import com.impostergame.android.gameplay.publicBallotsAllowed
import com.impostergame.android.gameplay.winnerLabel
import com.impostergame.data.model.Assignment
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.model.Submission
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.avatar.PlayerColors
import com.impostergame.designsystem.component.GameBackButton
import com.impostergame.designsystem.component.GameButton
import com.impostergame.designsystem.component.GameButtonStyle
import com.impostergame.designsystem.component.GameGlyph
import com.impostergame.designsystem.component.GameGlyphKind
import com.impostergame.designsystem.component.GameOutlinedButton
import com.impostergame.designsystem.component.GameTopBar
import com.impostergame.designsystem.component.PlayerCard
import com.impostergame.designsystem.component.SignalBackground
import com.impostergame.designsystem.component.SignalCard
import com.impostergame.designsystem.component.TaskCard
import com.impostergame.designsystem.component.UploadState
import com.impostergame.designsystem.component.WebsiteBallotRow
import com.impostergame.designsystem.component.WebsiteCard
import com.impostergame.designsystem.component.WebsiteDialog
import com.impostergame.designsystem.component.WebsiteIcon
import com.impostergame.designsystem.component.WebsiteIconKind
import com.impostergame.designsystem.theme.GameMotion
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.LocalGameAccessibilityPreferences
import com.impostergame.designsystem.theme.gameColors
import kotlinx.coroutines.delay

@Composable
fun GameplayScreen(
    viewModel: GameplayViewModel,
    onMinimizeApp: () -> Unit,
    onReplayRoom: (RoomSnapshot) -> Unit,
    onReturnHome: () -> Unit,
    onToggleSound: (() -> Unit)? = null,
    onToggleTheme: (() -> Unit)? = null,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmMinimize by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) { viewModel.load() }
    BackHandler(enabled = state.destination != GameplayDestination.LOADING) {
        when {
            state.confirmMeetingCall -> viewModel.dismissMeetingConfirmation()
            state.confirmReviewVote -> viewModel.dismissReviewVote()
            state.confirmEjectionVote -> viewModel.dismissEjectionVote()
            state.confirmKill -> viewModel.dismissKill()
            state.killPickerVisible -> viewModel.dismissKillPicker()
            state.statusPanelVisible -> viewModel.dismissStatus()
            state.confirmFlag -> viewModel.dismissFlag()
            state.meetingAlertId != null -> viewModel.dismissMeetingAlert()
            state.selectedAssignmentId != null -> viewModel.dismissTaskDetail()
            state.selectedSubmissionId != null -> viewModel.dismissEvidencePreview()
            state.destination == GameplayDestination.EVIDENCE -> viewModel.showTasks()
            state.destination == GameplayDestination.RESULTS -> onReturnHome()
            else -> {
                viewModel.resealRole()
                confirmMinimize = true
            }
        }
    }
    if (confirmMinimize) {
        WebsiteDialog(
            title = "Keep the game running?",
            onDismissRequest = { confirmMinimize = false },
            content = {
                Text(
                    "You are still in an active room. Going back will not leave the game. " +
                        "You can minimize the app and return to the same phase."
                )
            },
            actions = {
                GameOutlinedButton("Stay in game", { confirmMinimize = false }, Modifier.weight(1f))
                GameButton(
                    "Minimize app",
                    onClick = {
                        confirmMinimize = false
                        onMinimizeApp()
                    },
                    modifier = Modifier.weight(1f),
                )
            },
        )
    }
    val accent =
        when (state.destination) {
            GameplayDestination.LOADING -> MaterialTheme.gameColors.accentStrong
            GameplayDestination.SEALED_ROLE -> MaterialTheme.gameColors.voting
            GameplayDestination.TASKS -> MaterialTheme.gameColors.tasks
            GameplayDestination.EVIDENCE -> MaterialTheme.gameColors.tasks
            GameplayDestination.MEETING -> MaterialTheme.gameColors.meeting
            GameplayDestination.RESULTS -> MaterialTheme.gameColors.results
        }
    SignalBackground(
        accent = accent,
        watermarkPlayerColorId = state.snapshot?.self?.avatarId,
    ) {
        when (state.destination) {
            GameplayDestination.LOADING -> LoadingScreen("Loading the current game…")
            GameplayDestination.SEALED_ROLE ->
                RoleRevealScreen(state, viewModel, onToggleSound, onToggleTheme)
            GameplayDestination.TASKS ->
                TaskPhaseScreen(state, viewModel, onToggleSound, onToggleTheme)
            GameplayDestination.EVIDENCE ->
                EvidenceGalleryScreen(state, viewModel, onToggleSound, onToggleTheme)
            GameplayDestination.MEETING ->
                MeetingScreen(state, viewModel, onToggleSound, onToggleTheme)
            GameplayDestination.RESULTS ->
                FinalResultScreen(
                    state,
                    viewModel,
                    onReplayRoom,
                    onReturnHome,
                    onToggleSound,
                    onToggleTheme,
                )
        }
    }
}

@Composable
private fun MeetingScreen(
    state: GameplayUiState,
    viewModel: GameplayViewModel,
    onToggleSound: (() -> Unit)?,
    onToggleTheme: (() -> Unit)?,
) {
    val snapshot = state.snapshot ?: return LoadingScreen("Loading meeting…")
    val meeting = snapshot.meeting ?: return LoadingScreen("Waiting for meeting details…")
    state.meetingAlertId?.let {
        WebsiteDialog(
            title = "Meeting started",
            onDismissRequest = viewModel::dismissMeetingAlert,
            content = { Text(snapshot.meetingReason()) },
            actions = {
                GameButton("View meeting", viewModel::dismissMeetingAlert, Modifier.fillMaxWidth())
            },
        )
    }
    if (state.confirmReviewVote) ReviewVoteConfirmation(state, viewModel)
    if (state.confirmEjectionVote) EjectionVoteConfirmation(state, viewModel)
    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        GameTopBar(
            phase =
                when (meeting.phase) {
                    "voting" -> "Voting • Meeting ${meeting.sequenceNumber}"
                    "resolved" -> "Result • Meeting ${meeting.sequenceNumber}"
                    else -> "Meeting ${meeting.sequenceNumber}"
                },
            timerText = countdownText(state.remainingSeconds),
            timerDescription = countdownDescription(state.remainingSeconds),
            nickname =
                snapshot.self.let { self ->
                    snapshot.participants.firstOrNull { it.id == self.participantId }?.nickname
                        ?: "You"
                },
            playerColorId = snapshot.self.avatarId,
            connectionState = state.connectionState,
            onToggleSound = onToggleSound,
            onToggleTheme = onToggleTheme,
        )
        Column(
            Modifier.weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
        ) {
            Text(
                if (meeting.phase == "resolved") "MEETING VERDICT" else "EMERGENCY MEETING",
                color = MaterialTheme.gameColors.meeting,
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Black,
                modifier = Modifier.semantics { heading() },
            )
            MeetingProgress(meeting.phase)
            Text(
                snapshot.meetingReason(),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Message(state.message)
            if (snapshot.self.lifeStatus != "alive") {
                Message(
                    "You are ${snapshot.self.lifeStatus}. You can observe this meeting but cannot vote."
                )
            }
            when (meeting.phase) {
                "discussion" -> DiscussionPanel(state)
                "review" -> ReviewPanel(state, viewModel)
                "voting" -> EjectionVotingPanel(state, viewModel)
                "resolved" -> MeetingResultPanel(state)
                else -> Text("Waiting for the server to advance the meeting…")
            }
        }
    }
}

@Composable
private fun MeetingProgress(currentPhase: String) {
    val steps =
        listOf(
            "discussion" to "Discuss",
            "review" to "Review",
            "voting" to "Vote",
            "resolved" to "Result",
        )
    val currentIndex = steps.indexOfFirst { it.first == currentPhase }.coerceAtLeast(0)
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
    ) {
        steps.forEachIndexed { index, (_, label) ->
            val active = index == currentIndex
            val complete = index < currentIndex
            Surface(
                modifier =
                    Modifier.weight(1f).semantics {
                        stateDescription =
                            when {
                                active -> "Current step"
                                complete -> "Complete"
                                else -> "Upcoming"
                            }
                    },
                shape = RoundedCornerShape(18.dp),
                color =
                    if (active) MaterialTheme.gameColors.meeting.copy(alpha = 0.18f)
                    else MaterialTheme.colorScheme.surface,
                border =
                    BorderStroke(
                        if (active) 2.dp else 1.dp,
                        if (active) MaterialTheme.gameColors.meeting
                        else MaterialTheme.colorScheme.outlineVariant,
                    ),
            ) {
                Text(
                    text = if (complete) "✓ $label" else label,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = GameSpacing.sm),
                    color =
                        if (active || complete) MaterialTheme.gameColors.meeting
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun DiscussionPanel(state: GameplayUiState) {
    val meeting = state.snapshot?.meeting ?: return
    SignalCard(Modifier.fillMaxWidth(), accent = MaterialTheme.gameColors.meeting) {
        Column(
            Modifier.padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
        ) {
            Text(
                "Discussion",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Discuss what happened. Voting choices will appear only when the server opens them."
            )
            Text("${meeting.votesCast} of ${meeting.requiredVotes} required responses received")
            if (state.remainingSeconds == 0L) Text("Time is up. Waiting for the server…")
        }
    }
}

@Composable
private fun ReviewPanel(state: GameplayUiState, viewModel: GameplayViewModel) {
    val item =
        state.snapshot?.meeting?.reviewItem ?: return Text("Waiting for the next evidence item…")
    SignalCard(
        Modifier.fillMaxWidth(),
        accent = MaterialTheme.gameColors.meeting,
        emphasized = true,
    ) {
        Column(
            Modifier.padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
        ) {
            Text(
                "Evidence ${item.position} of ${item.total}",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(item.assignmentDescription)
            Text("Submitted by ${item.uploader.nickname}")
            state.reviewImageBytes?.let { EvidenceBitmap(it) }
                ?: GameOutlinedButton(
                    "Refresh evidence image",
                    viewModel::refreshReviewEvidence,
                    Modifier.fillMaxWidth(),
                )
            Text("${item.votesCast} of ${item.requiredVotes} review votes received")
            if (item.ownDecision != null || state.reviewVoteSubmittedItemId == item.id) {
                val decision = item.ownDecision ?: state.selectedReviewDecision ?: "submitted"
                Text("Your vote: ${decision.replaceFirstChar(Char::uppercase)} — locked")
            } else if (state.mayReviewVote()) {
                VoteChoice("✓ Valid evidence", state.selectedReviewDecision == "valid") {
                    viewModel.selectReviewDecision("valid")
                }
                VoteChoice("✕ Invalid evidence", state.selectedReviewDecision == "invalid") {
                    viewModel.selectReviewDecision("invalid")
                }
                GameButton(
                    "Review vote",
                    viewModel::requestReviewVoteConfirmation,
                    Modifier.fillMaxWidth(),
                    enabled = state.selectedReviewDecision != null && !state.loading,
                )
            } else {
                Text(
                    if (state.remainingSeconds == 0L) "Time is up. Waiting for the server…"
                    else "Observing review votes."
                )
            }
        }
    }
}

@Composable
private fun EjectionVotingPanel(state: GameplayUiState, viewModel: GameplayViewModel) {
    val snapshot = state.snapshot ?: return
    val meeting = snapshot.meeting ?: return
    Column(
        Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
    ) {
        Text(
            "MEETING ${meeting.sequenceNumber}",
            color = MaterialTheme.gameColors.accentStrong,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Black,
        )
        Text(
            "Who do you trust least?",
            modifier = Modifier.fillMaxWidth().semantics { heading() },
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
        Text(
            if (state.mayEjectionVote())
                "Choose carefully. Your ballot locks as soon as you confirm it."
            else "Your ballot is locked. Watch the remaining votes arrive.",
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
        )
        if (meeting.hasCastEjectionVote || state.ejectionVoteSubmittedMeetingId == meeting.id) {
            val name =
                meeting.ownEjectionTargetParticipantId?.let { id ->
                    meeting.eligibleParticipants.firstOrNull { it.id == id }?.nickname
                } ?: "Skip"
            Text("Your vote: $name — locked")
        } else if (state.mayEjectionVote()) {
            meeting.eligibleParticipants.forEach { participant ->
                WebsiteBallotRow(
                    nickname = participant.nickname,
                    playerColorId = participant.avatarId,
                    selected =
                        state.hasEjectionSelection &&
                            state.selectedEjectionTargetId == participant.id,
                    enabled = !state.loading,
                    onClick = { viewModel.selectEjectionTarget(participant.id) },
                )
            }
            WebsiteBallotRow(
                nickname = "Skip vote",
                playerColorId = "red",
                selected = state.hasEjectionSelection && state.selectedEjectionTargetId == null,
                enabled = !state.loading,
                isSkip = true,
                onClick = { viewModel.selectEjectionTarget(null) },
            )
            GameButton(
                "Review vote",
                viewModel::requestEjectionVoteConfirmation,
                Modifier.fillMaxWidth(),
                enabled = state.hasEjectionSelection && !state.loading,
            )
        } else {
            Text(
                if (state.remainingSeconds == 0L) "Time is up. Waiting for the server…"
                else "Observing the vote."
            )
        }
        LinearProgressIndicator(
            progress = { meeting.votesCast.toFloat() / meeting.requiredVotes.coerceAtLeast(1) },
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.gameColors.voting,
            trackColor = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            "${meeting.votesCast} of ${meeting.requiredVotes} required ballots locked",
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        if (meeting.publicBallotsAllowed(snapshot.meetingRules.voteVisibility)) {
            PublicBallots(meeting.publicVotes)
        } else {
            Text("Ballots are private. Only the aggregate count is shown.")
        }
    }
}

@Composable
private fun VoteChoice(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier =
            Modifier.fillMaxWidth()
                .selectable(
                    selected = selected,
                    role = Role.RadioButton,
                    onClick = onClick,
                ),
        shape = RoundedCornerShape(18.dp),
        color =
            if (selected) MaterialTheme.gameColors.voting.copy(alpha = 0.14f)
            else MaterialTheme.colorScheme.surface,
        border =
            BorderStroke(
                if (selected) 2.dp else 1.dp,
                if (selected) MaterialTheme.gameColors.voting
                else MaterialTheme.colorScheme.outlineVariant,
            ),
    ) {
        Row(
            modifier = Modifier.padding(GameSpacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(
                selected = selected,
                onClick = null,
                modifier = Modifier.clearAndSetSemantics {},
            )
            Text(label)
        }
    }
}

@Composable
private fun ReviewVoteConfirmation(state: GameplayUiState, viewModel: GameplayViewModel) {
    val decision = state.selectedReviewDecision ?: return
    WebsiteDialog(
        title = "Confirm review vote",
        onDismissRequest = viewModel::dismissReviewVote,
        content = {
            Text(
                "Mark this evidence ${decision.uppercase()}? Your accepted vote cannot be changed."
            )
        },
        actions = {
            GameOutlinedButton("Cancel", viewModel::dismissReviewVote, Modifier.weight(1f))
            GameButton("Submit vote", viewModel::confirmReviewVote, Modifier.weight(1f))
        },
    )
}

@Composable
private fun EjectionVoteConfirmation(state: GameplayUiState, viewModel: GameplayViewModel) {
    val meeting = state.snapshot?.meeting ?: return
    val target =
        state.selectedEjectionTargetId?.let { id ->
            meeting.eligibleParticipants.firstOrNull { it.id == id }
        }
    WebsiteDialog(
        title = "Confirm ejection vote",
        onDismissRequest = viewModel::dismissEjectionVote,
        content = {
            Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
                if (target != null) PlayerCard(target.nickname, target.avatarId)
                else Text("Skip — eject no one", fontWeight = FontWeight.Bold)
                Text("Your accepted vote cannot be changed.")
            }
        },
        actions = {
            GameOutlinedButton("Cancel", viewModel::dismissEjectionVote, Modifier.weight(1f))
            GameButton("Submit vote", viewModel::confirmEjectionVote, Modifier.weight(1f))
        },
    )
}

@Composable
private fun MeetingResultPanel(state: GameplayUiState) {
    val snapshot = state.snapshot ?: return
    val meeting = snapshot.meeting ?: return
    val result = meeting.result ?: return Text("Counting votes…")
    val ejected =
        result.ejectedParticipantId?.let { id ->
            snapshot.participants.firstOrNull { it.id == id }?.nickname
        }
    SignalCard(
        Modifier.fillMaxWidth(),
        accent = MaterialTheme.gameColors.results,
        emphasized = true,
    ) {
        Column(
            Modifier.padding(GameSpacing.md).semantics { liveRegion = LiveRegionMode.Assertive },
            verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
        ) {
            Text(
                ejected?.let { "$it was ejected" } ?: "No one was ejected",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            result.totals.forEach { total ->
                val name =
                    snapshot.participants.firstOrNull { it.id == total.participantId }?.nickname
                        ?: "Player"
                Text("$name: ${total.votes}")
            }
            Text("Skip: ${result.skipVotes}")
            if (meeting.publicBallotsAllowed(snapshot.meetingRules.voteVisibility))
                PublicBallots(result.ballots)
            else Text("Individual ballots are private.")
            Text("Waiting for the server to continue…")
        }
    }
}

@Composable
private fun PublicBallots(ballots: List<com.impostergame.data.model.PublicVote>) {
    if (ballots.isEmpty()) return
    Text("Public ballots", fontWeight = FontWeight.Bold)
    ballots.forEach { ballot ->
        Text("${ballot.voterNickname} → ${ballot.targetNickname ?: "Skip"}")
    }
}

@Composable
private fun FinalResultScreen(
    state: GameplayUiState,
    viewModel: GameplayViewModel,
    onReplayRoom: (RoomSnapshot) -> Unit,
    onReturnHome: () -> Unit,
    onToggleSound: (() -> Unit)?,
    onToggleTheme: (() -> Unit)?,
) {
    val snapshot = state.snapshot ?: return LoadingScreen("Loading final result…")
    val summary = snapshot.resultSummary
    var resultSecretTaps by rememberSaveable(snapshot.id) { mutableIntStateOf(0) }
    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        GameTopBar(
            phase = "Results",
            timerText = "",
            timerDescription = "Final results",
            nickname =
                snapshot.participants.firstOrNull { it.id == snapshot.self.participantId }?.nickname
                    ?: "You",
            playerColorId = snapshot.self.avatarId,
            connectionState = state.connectionState,
            onToggleSound = onToggleSound,
            onToggleTheme = onToggleTheme,
        )
        Column(
            Modifier.weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 14.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            WebsiteCard(
                Modifier.fillMaxWidth().widthIn(max = 720.dp),
                accent = MaterialTheme.gameColors.results,
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Surface(
                        modifier = Modifier.rotate(-4f),
                        color = MaterialTheme.gameColors.results.copy(alpha = .10f),
                        border = BorderStroke(2.dp, MaterialTheme.gameColors.results),
                        shape = RoundedCornerShape(4.dp),
                    ) {
                        Text(
                            "CASE CLOSED",
                            Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                            color = MaterialTheme.gameColors.results,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Black,
                        )
                    }
                    Text(
                        "FINAL OUTCOME",
                        color = MaterialTheme.gameColors.results,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Black,
                    )
                    Text(
                        snapshot.winnerLabel(),
                        modifier = Modifier.semantics { heading() },
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.Black,
                        textAlign = TextAlign.Center,
                    )
                    Text(snapshot.endReasonLabel(), textAlign = TextAlign.Center)
                    Text(
                        "You finished as ${snapshot.self.role.replaceFirstChar(Char::uppercase)} • ${snapshot.self.lifeStatus}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                    if (summary != null) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            ResultMetric(
                                "Players",
                                summary.players.size.toString(),
                                Modifier.weight(1f),
                            )
                            ResultMetric(
                                "Crew tasks",
                                "${summary.completedTasks}/${summary.totalTasks}",
                                Modifier.weight(1f),
                            )
                            ResultMetric(
                                "Duration",
                                formatDuration(summary.durationSeconds),
                                Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
            Message(state.message)
            GameOutlinedButton(
                if (state.resultDetailsExpanded) "Hide full results" else "See full results",
                viewModel::toggleResultDetails,
                Modifier.fillMaxWidth().widthIn(max = 520.dp),
            )
            val reduceMotion = LocalGameAccessibilityPreferences.current.reduceMotion
            AnimatedVisibility(
                visible = state.resultDetailsExpanded && summary != null,
                enter =
                    if (reduceMotion) EnterTransition.None
                    else
                        fadeIn(tween(GameMotion.StandardMillis)) +
                            expandVertically(
                                animationSpec =
                                    tween(
                                        GameMotion.EmphasisMillis,
                                        easing = GameMotion.EmphasisEasing,
                                    )
                            ),
                exit =
                    if (reduceMotion) ExitTransition.None
                    else
                        fadeOut(tween(GameMotion.QuickMillis)) +
                            shrinkVertically(tween(GameMotion.StandardMillis)),
            ) {
                if (summary != null)
                    WebsiteCard(
                        Modifier.fillMaxWidth().widthIn(max = 720.dp),
                        accent = MaterialTheme.gameColors.results,
                    ) {
                        Column(
                            Modifier.padding(GameSpacing.md),
                            verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
                        ) {
                            Text(
                                "Game summary",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                            )
                            Text("Duration: ${formatDuration(summary.durationSeconds)}")
                            Text("Tasks: ${summary.completedTasks}/${summary.totalTasks}")
                            Text("Task pack: ${snapshot.taskPack.name}")
                            summary.players.forEach { player ->
                                PlayerCard(
                                    nickname = player.nickname,
                                    playerColorId = player.avatarId,
                                    status = null,
                                    compact = true,
                                )
                                Text(
                                    "${player.role.replaceFirstChar(Char::uppercase)} • ${player.crewRole?.name ?: "No crew specialization"} • ${player.lifeStatus} • tasks ${player.completedTasks}/${player.totalTasks}"
                                )
                            }
                            val accepted =
                                state.submissions.filter { it.processingStatus == "accepted" }
                            Text(
                                "Accepted evidence: ${accepted.size}",
                                fontWeight = FontWeight.Bold,
                            )
                            accepted.forEach {
                                Text("Evidence ${it.id.take(8)} • ${it.reviewStatus}")
                            }
                            val meeting = snapshot.meeting
                            if (
                                meeting != null &&
                                    meeting.publicBallotsAllowed(
                                        snapshot.meetingRules.voteVisibility
                                    )
                            )
                                PublicBallots(meeting.result?.ballots.orEmpty())
                        }
                    }
            }
            TextButton(
                onClick = {
                    resultSecretTaps = (resultSecretTaps + 1).coerceAtMost(3)
                    viewModel.playResultInteraction(resultSecretTaps >= 3)
                }
            ) {
                Text(
                    if (resultSecretTaps >= 3)
                        "✦ The smallest operative was suspicious all along. ✦"
                    else "◉"
                )
            }
            WebsiteCard(
                Modifier.fillMaxWidth().widthIn(max = 720.dp),
                accent = MaterialTheme.gameColors.results,
            ) {
                Column(
                    Modifier.padding(GameSpacing.lg),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
                ) {
                    Text(
                        "Play again with this room?",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Black,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        "Return everyone to the lobby with the same room code, players, and game settings.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                    GameButton(
                        "Yes, play again",
                        { viewModel.replay(onReplayRoom) },
                        Modifier.fillMaxWidth(),
                        loading = state.loading,
                    )
                    GameOutlinedButton(
                        "Leave and return home",
                        onReturnHome,
                        Modifier.fillMaxWidth(),
                        enabled = !state.loading,
                    )
                }
            }
        }
    }
    LaunchedEffect(summary?.players?.size) {
        if (state.submissions.isEmpty()) viewModel.refreshReviewEvidence()
    }
}

@Composable
private fun ResultMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.gameColors.results.copy(alpha = 0.14f),
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        Column(
            Modifier.padding(horizontal = GameSpacing.xs, vertical = GameSpacing.sm),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                value,
                color = MaterialTheme.gameColors.results,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Black,
            )
            Text(
                label,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
                textAlign = TextAlign.Center,
            )
        }
    }
}

private fun formatDuration(seconds: Int): String = "${seconds / 60}m ${seconds % 60}s"

@Composable
private fun RoleRevealScreen(
    state: GameplayUiState,
    viewModel: GameplayViewModel,
    onToggleSound: (() -> Unit)?,
    onToggleTheme: (() -> Unit)?,
) {
    val snapshot = state.snapshot ?: return LoadingScreen("Sealing your private role…")
    val reduceMotion = LocalGameAccessibilityPreferences.current.reduceMotion
    val roleAccent = MaterialTheme.colorScheme.primary
    val surfaceTransition =
        tween<Color>(durationMillis = if (reduceMotion) 0 else GameMotion.StandardMillis)
    val cardSurface by
        animateColorAsState(
            if (state.roleRevealed) Color(0xFF272419) else MaterialTheme.colorScheme.surface,
            surfaceTransition,
            label = "roleCardSurface",
        )
    val cardContent by
        animateColorAsState(
            if (state.roleRevealed) Color(0xFFEDE7D8) else MaterialTheme.colorScheme.onSurface,
            surfaceTransition,
            label = "roleCardContentColor",
        )
    val cardBorder by
        animateColorAsState(
            if (state.roleRevealed) roleAccent else MaterialTheme.colorScheme.outlineVariant,
            surfaceTransition,
            label = "roleCardBorder",
        )
    val revealedCardScale by
        animateFloatAsState(
            targetValue = if (state.roleRevealed && !reduceMotion) 1.01f else 1f,
            animationSpec =
                tween(
                    durationMillis = if (reduceMotion) 0 else GameMotion.RevealMillis,
                    easing = GameMotion.EmphasisEasing,
                ),
            label = "roleCardRevealScale",
        )
    Surface(
        Modifier.fillMaxSize(),
        color = Color.Transparent,
        contentColor = MaterialTheme.colorScheme.onBackground,
    ) {
        Column(Modifier.fillMaxSize().safeDrawingPadding()) {
            GameTopBar(
                phase = "Role",
                timerText = "",
                timerDescription = "Private role",
                nickname =
                    snapshot.participants
                        .firstOrNull { it.id == snapshot.self.participantId }
                        ?.nickname ?: "You",
                playerColorId = snapshot.self.avatarId,
                connectionState = state.connectionState,
                onToggleSound = onToggleSound,
                onToggleTheme = onToggleTheme,
            )
            Box(
                Modifier.weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .verticalScroll(rememberScrollState()),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    Modifier.widthIn(max = 480.dp).fillMaxWidth().padding(vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        "PRIVATE BRIEFING",
                        modifier = Modifier.align(Alignment.Start),
                        color = roleAccent,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Black,
                    )
                    Surface(
                        modifier =
                            Modifier.fillMaxWidth()
                                .height(320.dp)
                                .scale(revealedCardScale)
                                .border(
                                    1.dp,
                                    cardBorder.copy(alpha = if (state.roleRevealed) .72f else 1f),
                                    RoundedCornerShape(30.dp),
                                )
                                .padding(8.dp)
                                .semantics {
                                    contentDescription =
                                        if (state.roleRevealed) "Private role revealed"
                                        else "Private role sealed"
                                    stateDescription =
                                        if (state.roleRevealed) "Role revealed" else "Role sealed"
                                },
                        shape = RoundedCornerShape(22.dp),
                        color = cardSurface,
                        contentColor = cardContent,
                        border = BorderStroke(1.dp, cardBorder),
                        tonalElevation = 0.dp,
                        shadowElevation = 18.dp,
                    ) {
                        Column(
                            Modifier.fillMaxSize().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement =
                                Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
                        ) {
                            WebsiteIcon(
                                WebsiteIconKind.Eye,
                                tint = roleAccent,
                                size = 26.dp,
                            )
                            Crossfade(
                                targetState = state.roleRevealed,
                                animationSpec =
                                    tween(
                                        durationMillis =
                                            if (reduceMotion) 0 else GameMotion.RevealMillis,
                                        easing = GameMotion.EmphasisEasing,
                                    ),
                                label = "roleCardContent",
                            ) { revealed ->
                                RoleCardContent(
                                    revealed = revealed,
                                    snapshot = snapshot,
                                    contentColor =
                                        if (revealed) Color(0xFFEDE7D8)
                                        else MaterialTheme.colorScheme.onSurface,
                                )
                            }
                        }
                    }
                    GameButton(
                        if (state.roleRevealed) "Hide role" else "Reveal role",
                        if (state.roleRevealed) viewModel::resealRole else viewModel::revealRole,
                        Modifier.fillMaxWidth(),
                        style =
                            if (state.roleRevealed) GameButtonStyle.Secondary
                            else GameButtonStyle.Primary,
                    )
                    GameOutlinedButton(
                        "I understand",
                        viewModel::acknowledgeRole,
                        Modifier.fillMaxWidth(),
                        enabled = state.roleRevealed,
                    )
                    Text(
                        "Your role will hide if you switch apps or lock your phone.",
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun RoleCardContent(
    revealed: Boolean,
    snapshot: GameSnapshot,
    contentColor: Color,
) {
    if (!revealed) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                "SEALED",
                modifier = Modifier.semantics { heading() },
                color = contentColor,
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                "Keep this screen to yourself.",
                color = contentColor,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
        }
        return
    }

    val roleTitle = if (snapshot.self.role == "imposter") "IMPOSTER" else "CREW"
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("Your role", color = contentColor, style = MaterialTheme.typography.titleSmall)
        Text(
            roleTitle,
            modifier = Modifier.semantics { heading() },
            color = contentColor,
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.ExtraBold,
        )
        Text(
            if (snapshot.self.role == "imposter") "Blend in. Eliminate quietly."
            else "Complete your tasks. Watch everyone.",
            color = contentColor,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        snapshot.self.crewRole?.let {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                Text(
                    it.name,
                    color = contentColor,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    it.specialization,
                    color = contentColor,
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    it.ability,
                    color = contentColor,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun TaskPhaseScreen(
    state: GameplayUiState,
    viewModel: GameplayViewModel,
    onToggleSound: (() -> Unit)?,
    onToggleTheme: (() -> Unit)?,
) {
    val snapshot = state.snapshot ?: return LoadingScreen("Loading tasks…")
    state.selectedAssignmentId?.let { assignmentId ->
        snapshot.assignments
            .firstOrNull { it.id == assignmentId }
            ?.let {
                TaskEvidenceDialog(it, state, viewModel)
            }
    }
    if (state.statusPanelVisible) StatusPanel(snapshot, state, viewModel)
    if (state.killPickerVisible) KillTargetPicker(snapshot, state, viewModel)
    if (state.confirmKill) KillConfirmation(state, viewModel)
    if (state.confirmMeetingCall) MeetingCallConfirmation(snapshot, viewModel)
    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        GameTopBar(
            phase = "Tasks",
            timerText = countdownText(state.remainingSeconds),
            timerDescription = countdownDescription(state.remainingSeconds),
            nickname =
                snapshot.participants.firstOrNull { it.id == snapshot.self.participantId }?.nickname
                    ?: "You",
            playerColorId = snapshot.self.avatarId,
            connectionState = state.connectionState,
            onToggleSound = onToggleSound,
            onToggleTheme = onToggleTheme,
        )
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val twoPane = maxWidth >= 700.dp || maxHeight < 480.dp
            if (twoPane) {
                Row(Modifier.fillMaxSize()) {
                    TaskList(snapshot, state, viewModel, Modifier.weight(1.2f), showKill = false)
                    StatusAndActions(snapshot, state, viewModel, Modifier.weight(0.8f))
                }
            } else {
                TaskList(snapshot, state, viewModel, Modifier.fillMaxSize(), showKill = true)
            }
        }
        if (snapshot.self.lifeStatus != "alive") {
            Text(
                "You are ${snapshot.self.lifeStatus}. Only currently authorized actions remain available.",
                Modifier.fillMaxWidth().padding(GameSpacing.sm),
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.error,
            )
        }
        GameActionBar(snapshot, state, viewModel)
    }
}

@Composable
private fun TaskList(
    snapshot: GameSnapshot,
    state: GameplayUiState,
    viewModel: GameplayViewModel,
    modifier: Modifier,
    showKill: Boolean,
) {
    val sorted = snapshot.assignments
    Column(
        modifier =
            modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 10.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    snapshot.taskPack.name.uppercase(),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.gameColors.tasks,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    if (snapshot.self.lifeStatus == "alive") "Your assignments"
                    else "Ghost assignments",
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Black,
                )
            }
            Box(Modifier.size(52.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = { snapshot.progress.percent / 100f },
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.gameColors.ready,
                    trackColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .55f),
                    strokeWidth = 4.dp,
                )
                Text(
                    "${snapshot.progress.percent}%",
                    color = MaterialTheme.colorScheme.onSurface,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Black,
                )
            }
        }
        Message(state.message)
        if (showKill && state.canKill) KillControl(snapshot, state, viewModel)
        if (sorted.isEmpty()) Text("You have no assigned tasks.")
        sorted.forEachIndexed { index, assignment ->
            var entered by remember(assignment.id) { mutableStateOf(false) }
            val reduceMotion = LocalGameAccessibilityPreferences.current.reduceMotion
            LaunchedEffect(assignment.id, reduceMotion) {
                if (!reduceMotion)
                    delay((index.coerceAtMost(4) * GameMotion.StaggerMillis).toLong())
                entered = true
            }
            AnimatedVisibility(
                visible = entered,
                enter =
                    if (reduceMotion) EnterTransition.None
                    else
                        fadeIn(
                            tween(GameMotion.ProgressMillis, easing = GameMotion.EmphasisEasing)
                        ) +
                            slideInVertically(
                                tween(GameMotion.ProgressMillis, easing = GameMotion.EmphasisEasing)
                            ) {
                                it / 5
                            },
            ) {
                TaskCard(
                    title = assignment.description,
                    description = "${assignment.difficulty.replaceFirstChar(Char::uppercase)} task",
                    taskNumber = index + 1,
                    statusLabel = if (assignment.status == "completed") "Done" else "To do",
                    uploadState =
                        when {
                            assignment.status == "completed" -> UploadState.Complete
                            assignment.id == state.selectedAssignmentId ->
                                state.uploadStage.toDesignUploadState()
                            else -> UploadState.Idle
                        },
                    actionLabel =
                        if (assignment.status == "completed" || !state.canSubmitEvidence) null
                        else "Add evidence",
                    onAction =
                        if (assignment.status == "completed" || !state.canSubmitEvidence) null
                        else ({ viewModel.selectAssignment(assignment.id) }),
                )
            }
        }
    }
}

@Composable
private fun StatusAndActions(
    snapshot: GameSnapshot,
    state: GameplayUiState,
    viewModel: GameplayViewModel,
    modifier: Modifier,
) {
    Column(
        modifier = modifier.verticalScroll(rememberScrollState()).padding(GameSpacing.md),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
    ) {
        Text("Status", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text("Life status: ${snapshot.self.lifeStatus}")
        Text("Task pack: ${snapshot.taskPack.name}")
        Text("Progress: ${snapshot.progress.percent}%")
        GameOutlinedButton("View evidence", viewModel::showEvidence, Modifier.fillMaxWidth())
        GameOutlinedButton(
            if (state.mayCallMeeting()) "Call emergency meeting"
            else "Meeting unavailable · ${snapshot.meetingRules.remainingForSelf} left",
            viewModel::requestMeetingConfirmation,
            Modifier.fillMaxWidth(),
            enabled = snapshot.self.lifeStatus == "alive" && !state.loading,
        )
        if (state.canKill) KillControl(snapshot, state, viewModel)
    }
}

@Composable
private fun GameActionBar(
    snapshot: GameSnapshot,
    state: GameplayUiState,
    viewModel: GameplayViewModel,
) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
        shape = RoundedCornerShape(18.dp),
        tonalElevation = 0.dp,
        shadowElevation = 14.dp,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(6.dp),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                GameActionButton(
                    icon = GameGlyphKind.Status,
                    label = "Status",
                    detail = "${snapshot.progress.percent}%",
                    onClick = viewModel::showStatus,
                    modifier = Modifier.weight(1f),
                )
                GameActionButton(
                    icon = GameGlyphKind.Evidence,
                    label = "Evidence",
                    detail =
                        state.submissions
                            .count { it.uploader.id == snapshot.self.participantId }
                            .toString(),
                    onClick = viewModel::showEvidence,
                    modifier = Modifier.weight(1f),
                )
                GameActionButton(
                    icon =
                        if (state.mayCallMeeting()) GameGlyphKind.Meeting else GameGlyphKind.Timer,
                    label = "Meeting",
                    detail =
                        if (state.mayCallMeeting()) {
                            "${snapshot.meetingRules.remainingForSelf} left"
                        } else {
                            "Unavailable"
                        },
                    onClick =
                        if (state.mayCallMeeting()) viewModel::requestMeetingConfirmation
                        else viewModel::showStatus,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun GameActionButton(
    icon: GameGlyphKind,
    label: String,
    detail: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.height(58.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(13.dp),
        color = Color.Transparent,
        tonalElevation = 0.dp,
        border = null,
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    GameGlyph(icon)
                    Text(
                        label,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
                Text(
                    detail,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun GameCloseButton(onClick: () -> Unit, label: String) {
    Surface(
        onClick = onClick,
        modifier = Modifier.size(44.dp).semantics { contentDescription = label },
        shape = CircleShape,
        color = Color.Transparent,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        tonalElevation = 0.dp,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text("×", style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
private fun StatusPanel(
    snapshot: GameSnapshot,
    state: GameplayUiState,
    viewModel: GameplayViewModel,
) {
    val self = snapshot.participants.firstOrNull { it.id == snapshot.self.participantId }
    var showRoleDetails by rememberSaveable { mutableStateOf(false) }
    val eliminated =
        snapshot.self.knownEliminatedParticipantIds.mapNotNull { id ->
            snapshot.participants.firstOrNull { it.id == id }
        }
    Dialog(
        onDismissRequest = viewModel::dismissStatus,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            Modifier.fillMaxSize().padding(12.dp),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Surface(
                modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth().heightIn(max = 760.dp),
                shape = RoundedCornerShape(22.dp),
                color = MaterialTheme.gameColors.surfaceRaised,
                tonalElevation = 0.dp,
                shadowElevation = 28.dp,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            ) {
                Column(Modifier.fillMaxWidth()) {
                    Box(
                        Modifier.fillMaxWidth().height(22.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            Modifier.size(width = 42.dp, height = 4.dp)
                                .background(
                                    MaterialTheme.colorScheme.outlineVariant,
                                    RoundedCornerShape(50),
                                )
                        )
                    }
                    Row(
                        Modifier.fillMaxWidth().padding(start = 16.dp, end = 10.dp, bottom = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Game status",
                            Modifier.weight(1f),
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Black,
                        )
                        GameCloseButton(viewModel::dismissStatus, "Close Game status")
                    }
                    Box(
                        Modifier.fillMaxWidth()
                            .height(1.dp)
                            .background(MaterialTheme.colorScheme.outlineVariant)
                    )
                    Column(
                        Modifier.weight(1f, fill = false)
                            .verticalScroll(rememberScrollState())
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        self?.let { player ->
                            WebsiteCard(Modifier.fillMaxWidth()) {
                                Column(
                                    Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    ) {
                                        PlayerAvatar(
                                            player.avatarId,
                                            42.dp,
                                            player.nickname,
                                            decorative = true,
                                        )
                                        Column(Modifier.weight(1f)) {
                                            Text(
                                                "Playing as",
                                                style = MaterialTheme.typography.bodySmall,
                                            )
                                            Text(
                                                player.nickname,
                                                style = MaterialTheme.typography.titleSmall,
                                                fontWeight = FontWeight.Black,
                                            )
                                            Text(
                                                "${stringResource(PlayerColors.fromTransportId(player.avatarId).nameResource)} · ${if (snapshot.self.role == "imposter") "Imposter" else snapshot.self.crewRole?.name ?: "Crewmate"}",
                                                style = MaterialTheme.typography.labelMedium,
                                                fontWeight = FontWeight.Bold,
                                            )
                                        }
                                    }
                                    GameOutlinedButton(
                                        "View role",
                                        { showRoleDetails = true },
                                        Modifier.fillMaxWidth(),
                                    )
                                }
                            }
                        }
                        WebsiteCard(Modifier.fillMaxWidth()) {
                            Column(
                                Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    WebsiteIcon(
                                        WebsiteIconKind.Tasks,
                                        tint = MaterialTheme.gameColors.tasks,
                                        size = 18.dp,
                                    )
                                    Text("Mission status", fontWeight = FontWeight.ExtraBold)
                                }
                                Row(Modifier.fillMaxWidth()) {
                                    Text(
                                        "Crew progress",
                                        Modifier.weight(1f),
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                    Text(
                                        "${snapshot.progress.percent}%",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                                LinearProgressIndicator(
                                    progress = { snapshot.progress.percent / 100f },
                                    modifier = Modifier.fillMaxWidth(),
                                    color = MaterialTheme.gameColors.ready,
                                    trackColor = MaterialTheme.colorScheme.outlineVariant,
                                )
                            }
                        }
                        if (snapshot.self.role == "imposter") {
                            WebsiteCard(Modifier.fillMaxWidth()) {
                                Column(
                                    Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    Text("Your eliminations", fontWeight = FontWeight.ExtraBold)
                                    if (eliminated.isEmpty()) Text("No confirmed eliminations yet.")
                                    else
                                        eliminated.forEach {
                                            Text("✓  ${it.nickname} · Eliminated by you")
                                        }
                                }
                            }
                        }
                        WebsiteCard(Modifier.fillMaxWidth()) {
                            Column(
                                Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    WebsiteIcon(
                                        WebsiteIconKind.Clock,
                                        tint = MaterialTheme.colorScheme.primary,
                                        size = 18.dp,
                                    )
                                    Text("Emergency meeting", fontWeight = FontWeight.ExtraBold)
                                }
                                Text(
                                    meetingAvailabilityLabel(snapshot, state),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                GameButton(
                                    "Call meeting",
                                    viewModel::requestMeetingConfirmation,
                                    enabled = state.mayCallMeeting() && !state.loading,
                                )
                            }
                        }
                    }
                    Surface(
                        color = MaterialTheme.gameColors.surfaceRaised,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    ) {
                        GameOutlinedButton(
                            "Close Game status",
                            viewModel::dismissStatus,
                            Modifier.fillMaxWidth().padding(10.dp),
                        )
                    }
                }
            }
        }
    }
    if (showRoleDetails) {
        val roleName =
            if (snapshot.self.role == "imposter") "Imposter"
            else snapshot.self.crewRole?.name ?: "Crewmate"
        WebsiteDialog(
            title = roleName,
            onDismissRequest = { showRoleDetails = false },
            content = {
                snapshot.self.crewRole?.let {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(it.specialization, fontWeight = FontWeight.Bold)
                        Text(it.ability, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                    ?: Text(
                        if (snapshot.self.role == "imposter") "Blend in. Eliminate quietly."
                        else "Complete your tasks. Watch everyone."
                    )
            },
            actions = {
                GameOutlinedButton(
                    "Close role",
                    { showRoleDetails = false },
                    Modifier.fillMaxWidth(),
                )
            },
        )
    }
}

private fun meetingAvailabilityLabel(snapshot: GameSnapshot, state: GameplayUiState): String =
    when {
        snapshot.self.lifeStatus != "alive" -> "Ghost players cannot call meetings."
        snapshot.meetingRules.remainingForSelf <= 0 -> "You have no meeting calls remaining."
        snapshot.meetingRules.requiresCompletedTask && !snapshot.meetingRules.hasCompletedTask ->
            "Complete one task before calling a meeting."
        snapshot.cooldowns.meetingAvailableAt != null && !state.mayCallMeeting() ->
            "Meeting cooldown is active."
        !snapshot.self.capabilities.contains("call_meeting") ->
            "Meeting is not currently available."
        else -> "Ready to gather the room."
    }

@Composable
private fun MeetingCallConfirmation(snapshot: GameSnapshot, viewModel: GameplayViewModel) {
    WebsiteDialog(
        title = "Call emergency meeting?",
        onDismissRequest = viewModel::dismissMeetingConfirmation,
        content = {
            Text(
                "The task phase will pause and the room will gather to review evidence and vote. " +
                    "You will have ${snapshot.meetingRules.remainingForSelf - 1} calls left."
            )
        },
        actions = {
            GameOutlinedButton("Cancel", viewModel::dismissMeetingConfirmation, Modifier.weight(1f))
            GameButton("Call meeting", viewModel::confirmMeetingCall, Modifier.weight(1f))
        },
    )
}

@Composable
private fun KillControl(
    snapshot: GameSnapshot,
    state: GameplayUiState,
    viewModel: GameplayViewModel,
) {
    SignalCard(Modifier.fillMaxWidth(), accent = MaterialTheme.colorScheme.error) {
        Column(
            Modifier.padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
        ) {
            Text(
                "Authorized elimination",
                color = MaterialTheme.colorScheme.error,
                fontWeight = FontWeight.Bold,
            )
            val targets =
                snapshot.participants.filter { it.id in snapshot.self.killableParticipantIds }
            Text(
                if (targets.isEmpty()) "Elimination recharging" else "Choose a living crew member",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                if (targets.isEmpty()) "The server will unlock this ability when it is ready."
                else "Your target choice stays private until you confirm it.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            GameButton(
                if (targets.isEmpty()) "Kill · Recharging" else "☠  Kill · Ready",
                viewModel::showKillPicker,
                Modifier.fillMaxWidth(),
                style = GameButtonStyle.Destructive,
                enabled = targets.isNotEmpty() && !state.loading,
            )
        }
    }
}

@Composable
private fun KillTargetPicker(
    snapshot: GameSnapshot,
    state: GameplayUiState,
    viewModel: GameplayViewModel,
) {
    val targets = snapshot.participants.filter { it.id in snapshot.self.killableParticipantIds }
    WebsiteDialog(
        title = "Choose a target",
        onDismissRequest = viewModel::dismissKillPicker,
        modifier = Modifier.heightIn(max = 720.dp),
        content = {
            Column(
                Modifier.weight(1f).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
            ) {
                Text("Only currently eligible living players are shown.")
                targets.forEach { target ->
                    WebsiteBallotRow(
                        nickname = target.nickname,
                        playerColorId = target.avatarId,
                        selected = state.selectedKillTargetId == target.id,
                        enabled = !state.loading,
                        trailingText =
                            if (state.selectedKillTargetId == target.id) "Target selected"
                            else "Select target",
                        onClick = { viewModel.selectKillTarget(target.id) },
                    )
                }
            }
        },
        actions = {
            GameOutlinedButton("Cancel", viewModel::dismissKillPicker, Modifier.weight(1f))
            GameButton(
                "Review",
                viewModel::requestKillConfirmation,
                Modifier.weight(1f),
                enabled = state.selectedKillTargetId != null,
                style = GameButtonStyle.Destructive,
            )
        },
    )
}

@Composable
private fun KillConfirmation(state: GameplayUiState, viewModel: GameplayViewModel) {
    val target =
        state.snapshot?.participants?.firstOrNull { it.id == state.selectedKillTargetId } ?: return
    WebsiteDialog(
        title = "Confirm elimination",
        onDismissRequest = viewModel::dismissKill,
        content = {
            Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
                PlayerCard(target.nickname, target.avatarId)
                Text("This immediately changes the game and may trigger a meeting.")
            }
        },
        actions = {
            GameOutlinedButton("Cancel", viewModel::dismissKill, Modifier.weight(1f))
            GameButton(
                "Eliminate",
                viewModel::confirmKill,
                Modifier.weight(1f),
                style = GameButtonStyle.Destructive,
            )
        },
    )
}

@Composable
private fun TaskEvidenceDialog(
    assignment: Assignment,
    state: GameplayUiState,
    viewModel: GameplayViewModel,
) {
    var cameraUri by remember { mutableStateOf<android.net.Uri?>(null) }
    val camera =
        rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
            cameraUri?.let { uri ->
                if (success) viewModel.prepareEvidence(uri, cameraCapture = true)
                else viewModel.discardCameraUri(uri)
            }
            cameraUri = null
        }
    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            uri?.let(viewModel::prepareEvidence)
        }
    Dialog(
        onDismissRequest = viewModel::dismissTaskDetail,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Surface(
                modifier =
                    Modifier.padding(12.dp)
                        .widthIn(max = 520.dp)
                        .fillMaxWidth()
                        .heightIn(max = 720.dp),
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                tonalElevation = 0.dp,
                shadowElevation = 20.dp,
            ) {
                Column(Modifier.fillMaxWidth()) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Upload task photo",
                            Modifier.weight(1f),
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Black,
                        )
                        GameCloseButton(viewModel::dismissTaskDetail, "Close upload task photo")
                    }
                    Box(
                        Modifier.fillMaxWidth()
                            .height(1.dp)
                            .background(MaterialTheme.colorScheme.outlineVariant)
                    )
                    Column(
                        Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            assignment.description,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        state.preparedEvidence?.let { evidence ->
                            EvidenceBitmap(evidence.previewBytes)
                        }
                        Message(state.message)
                        when (state.uploadStage) {
                            UploadStage.IDLE,
                            UploadStage.TERMINAL_FAILURE -> {
                                TaskPhotoChoice(
                                    icon = WebsiteIconKind.Camera,
                                    title = "Take photo",
                                    subtitle = "Open your camera",
                                    onClick = {
                                        viewModel.createCameraUri().also {
                                            cameraUri = it
                                            camera.launch(it)
                                        }
                                    },
                                )
                                TaskPhotoChoice(
                                    icon = WebsiteIconKind.Upload,
                                    title = "Choose from gallery",
                                    subtitle = "Select an existing photo",
                                    onClick = {
                                        picker.launch(
                                            PickVisualMediaRequest(
                                                ActivityResultContracts.PickVisualMedia.ImageOnly
                                            )
                                        )
                                    },
                                )
                                Text(
                                    "JPEG, PNG or WebP · upload continues in the background after selection",
                                    modifier = Modifier.fillMaxWidth(),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.bodySmall,
                                    textAlign = TextAlign.Center,
                                )
                            }
                            UploadStage.PREVIEW,
                            UploadStage.RETRYABLE_FAILURE -> {
                                GameOutlinedButton(
                                    "Choose another",
                                    viewModel::chooseAnother,
                                    Modifier.fillMaxWidth(),
                                )
                                GameButton(
                                    "Submit evidence",
                                    viewModel::submitEvidence,
                                    Modifier.fillMaxWidth(),
                                )
                            }
                            UploadStage.COMPLETE -> Text("Evidence accepted.")
                            else -> {
                                Text(
                                    uploadStageLabel(state.uploadStage),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                LinearProgressIndicator(Modifier.fillMaxWidth())
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TaskPhotoChoice(
    icon: WebsiteIconKind,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    val borderColor = MaterialTheme.colorScheme.outline
    Surface(
        modifier =
            Modifier.fillMaxWidth()
                .height(112.dp)
                .drawWithContent {
                    drawContent()
                    drawRoundRect(
                        color = borderColor,
                        cornerRadius = CornerRadius(10.dp.toPx()),
                        style =
                            Stroke(
                                width = 1.dp.toPx(),
                                pathEffect =
                                    PathEffect.dashPathEffect(
                                        floatArrayOf(5.dp.toPx(), 4.dp.toPx())
                                    ),
                            ),
                    )
                }
                .clickable(onClick = onClick),
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.background,
        tonalElevation = 0.dp,
    ) {
        Column(
            Modifier.fillMaxSize().padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            WebsiteIcon(icon, size = 24.dp)
            Text(
                title,
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                subtitle,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun EvidenceGalleryScreen(
    state: GameplayUiState,
    viewModel: GameplayViewModel,
    onToggleSound: (() -> Unit)?,
    onToggleTheme: (() -> Unit)?,
) {
    val snapshot = state.snapshot ?: return LoadingScreen("Loading evidence…")
    TaskPhaseScreen(state, viewModel, onToggleSound, onToggleTheme)
    state.selectedSubmissionId?.let {
        EvidencePreviewDialog(state, viewModel)
    }
    if (state.confirmFlag) {
        WebsiteDialog(
            title = "Flag this evidence?",
            onDismissRequest = viewModel::dismissFlag,
            content = {
                Text("The evidence will be queued for review. Misuse may disrupt the game.")
            },
            actions = {
                GameOutlinedButton("Cancel", viewModel::dismissFlag, Modifier.weight(1f))
                GameButton(
                    "Flag evidence",
                    viewModel::confirmFlag,
                    Modifier.weight(1f),
                    style = GameButtonStyle.Destructive,
                )
            },
        )
    }
    Dialog(
        onDismissRequest = viewModel::showTasks,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Surface(
                modifier =
                    Modifier.padding(12.dp)
                        .widthIn(max = 520.dp)
                        .fillMaxWidth()
                        .heightIn(
                            min = 350.dp,
                            max = 720.dp,
                        ),
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                tonalElevation = 0.dp,
                shadowElevation = 20.dp,
            ) {
                Column(Modifier.fillMaxWidth()) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Room evidence",
                            Modifier.weight(1f),
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Black,
                        )
                        GameCloseButton(viewModel::showTasks, "Close Room evidence")
                    }
                    Box(
                        Modifier.fillMaxWidth()
                            .height(1.dp)
                            .background(MaterialTheme.colorScheme.outlineVariant)
                    )
                    Column(
                        Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Message(state.message)
                        if (state.submissions.isEmpty()) {
                            Column(
                                Modifier.fillMaxWidth().padding(vertical = 48.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Surface(
                                    modifier = Modifier.size(46.dp),
                                    shape = CircleShape,
                                    color = Color.Transparent,
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary),
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(
                                            "⚠",
                                            color = MaterialTheme.colorScheme.primary,
                                            style = MaterialTheme.typography.titleLarge,
                                        )
                                    }
                                }
                                Text(
                                    "No evidence yet",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Black,
                                )
                                Text(
                                    "Accepted room photos will appear here when the server makes them available.",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        } else {
                            state.submissions.chunked(2).forEach { row ->
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    row.forEach { submission ->
                                        EvidenceCard(submission, viewModel, Modifier.weight(1f))
                                    }
                                    if (row.size == 1) Box(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EvidenceCard(
    submission: Submission,
    viewModel: GameplayViewModel,
    modifier: Modifier = Modifier,
) {
    WebsiteCard(modifier, accent = MaterialTheme.gameColors.tasks) {
        Column(
            Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
        ) {
            Text(submission.uploader.nickname, fontWeight = FontWeight.Bold)
            Text(
                submission.processingStatus.uppercase(),
                color = MaterialTheme.gameColors.tasks,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Black,
            )
            Text("Review · ${submission.reviewStatus}", style = MaterialTheme.typography.bodySmall)
            if (submission.flaggedBySelf) Text("Flagged by you")
            GameOutlinedButton(
                "View",
                { viewModel.selectEvidence(submission.id) },
                Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun EvidencePreviewDialog(state: GameplayUiState, viewModel: GameplayViewModel) {
    val submission = state.submissions.firstOrNull { it.id == state.selectedSubmissionId } ?: return
    Dialog(
        onDismissRequest = viewModel::dismissEvidencePreview,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
            Column(
                Modifier.fillMaxSize().padding(GameSpacing.md),
                verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Evidence from ${submission.uploader.nickname}",
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    GameBackButton("Evidence", viewModel::dismissEvidencePreview)
                }
                state.previewImageBytes?.let { ZoomableEvidenceBitmap(it) }
                    ?: Text(if (state.loading) "Loading image…" else "Image unavailable.")
                if (state.mayFlag(submission)) {
                    GameButton(
                        "Flag evidence",
                        viewModel::requestFlag,
                        Modifier.fillMaxWidth(),
                        style = GameButtonStyle.Destructive,
                    )
                }
            }
        }
    }
}

@Composable
private fun EvidenceBitmap(bytes: ByteArray) {
    val bitmap =
        remember(bytes) { BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap() }
    bitmap?.let {
        androidx.compose.foundation.Image(
            bitmap = it,
            contentDescription = "Prepared evidence preview",
            modifier = Modifier.fillMaxWidth().height(220.dp),
        )
    }
}

@Composable
private fun ZoomableEvidenceBitmap(bytes: ByteArray) {
    val bitmap =
        remember(bytes) { BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap() }
    var scale by remember { mutableFloatStateOf(1f) }
    val transform = rememberTransformableState { _, zoom, _, _ ->
        scale = (scale * zoom).coerceIn(1f, 5f)
    }
    bitmap?.let {
        Box(
            Modifier.fillMaxWidth()
                .height(360.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            androidx.compose.foundation.Image(
                bitmap = it,
                contentDescription = "Full-screen evidence preview. Pinch to zoom.",
                modifier = Modifier.fillMaxSize().scale(scale).transformable(transform),
            )
        }
    }
}

private fun uploadStageLabel(stage: UploadStage): String =
    when (stage) {
        UploadStage.IDLE -> "No photo"
        UploadStage.PREPARING -> "Preparing"
        UploadStage.PREVIEW -> "Ready to submit"
        UploadStage.REQUESTING_INTENT -> "Preparing secure upload"
        UploadStage.UPLOADING -> "Uploading"
        UploadStage.CONFIRMING -> "Confirming"
        UploadStage.PROCESSING -> "Processing"
        UploadStage.COMPLETE -> "Complete"
        UploadStage.RETRYABLE_FAILURE -> "Interrupted — retry"
        UploadStage.TERMINAL_FAILURE -> "Rejected or unavailable"
    }

private fun UploadStage.toDesignUploadState(): UploadState =
    when (this) {
        UploadStage.IDLE -> UploadState.Idle
        UploadStage.PREPARING -> UploadState.Preparing
        UploadStage.PREVIEW -> UploadState.Idle
        UploadStage.REQUESTING_INTENT -> UploadState.RequestingIntent
        UploadStage.UPLOADING -> UploadState.Uploading
        UploadStage.CONFIRMING -> UploadState.Confirming
        UploadStage.PROCESSING -> UploadState.Processing
        UploadStage.COMPLETE -> UploadState.Complete
        UploadStage.RETRYABLE_FAILURE -> UploadState.RetryableFailure
        UploadStage.TERMINAL_FAILURE -> UploadState.TerminalFailure
    }

internal fun countdownText(seconds: Long?): String {
    if (seconds == null) return "—"
    return "%02d:%02d".format(seconds / 60, seconds % 60)
}

internal fun countdownDescription(seconds: Long?): String =
    when {
        seconds == null -> "No phase deadline"
        seconds <= 0 -> "Time is up"
        seconds < 60 -> "Less than one minute remaining"
        else -> {
            val minutes = (seconds + 59) / 60
            "$minutes ${if (minutes == 1L) "minute" else "minutes"} remaining"
        }
    }
