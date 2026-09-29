package com.impostergame.android.ui

import android.app.Activity
import android.graphics.BitmapFactory
import android.os.Build
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
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
import com.impostergame.android.gameplay.incompleteFirst
import com.impostergame.android.gameplay.mayEjectionVote
import com.impostergame.android.gameplay.mayFlag
import com.impostergame.android.gameplay.mayReviewVote
import com.impostergame.android.gameplay.meetingReason
import com.impostergame.android.gameplay.publicBallotsAllowed
import com.impostergame.android.gameplay.winnerLabel
import com.impostergame.data.model.Assignment
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.Submission
import com.impostergame.designsystem.component.GameBackButton
import com.impostergame.designsystem.component.GameButton
import com.impostergame.designsystem.component.GameButtonStyle
import com.impostergame.designsystem.component.GameOutlinedButton
import com.impostergame.designsystem.component.GameTopBar
import com.impostergame.designsystem.component.PlayerCard
import com.impostergame.designsystem.component.SignalBackground
import com.impostergame.designsystem.component.SignalCard
import com.impostergame.designsystem.component.TaskCard
import com.impostergame.designsystem.component.UploadState
import com.impostergame.designsystem.theme.GameMotion
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.LocalGameAccessibilityPreferences
import com.impostergame.designsystem.theme.gameColors

@Composable
fun GameplayScreen(
    viewModel: GameplayViewModel,
    onMinimizeApp: () -> Unit,
    onReturnHome: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmMinimize by rememberSaveable { mutableStateOf(false) }
    SecureContent()
    LaunchedEffect(Unit) { viewModel.load() }
    BackHandler(enabled = state.destination != GameplayDestination.LOADING) {
        when {
            state.confirmReviewVote -> viewModel.dismissReviewVote()
            state.confirmEjectionVote -> viewModel.dismissEjectionVote()
            state.confirmKill -> viewModel.dismissKill()
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
        AlertDialog(
            onDismissRequest = { confirmMinimize = false },
            title = { Text("Keep the game running?") },
            text = {
                Text(
                    "You are still in an active room. Going back will not leave the game. " +
                        "You can minimize the app and return to the same phase."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmMinimize = false
                        onMinimizeApp()
                    }
                ) {
                    Text("Minimize app")
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmMinimize = false }) { Text("Stay in game") }
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
    SignalBackground(accent = accent) {
        when (state.destination) {
            GameplayDestination.LOADING -> LoadingScreen("Loading the current game…")
            GameplayDestination.SEALED_ROLE -> RoleRevealScreen(state, viewModel)
            GameplayDestination.TASKS -> TaskPhaseScreen(state, viewModel)
            GameplayDestination.EVIDENCE -> EvidenceGalleryScreen(state, viewModel)
            GameplayDestination.MEETING -> MeetingScreen(state, viewModel)
            GameplayDestination.RESULTS -> FinalResultScreen(state, viewModel, onReturnHome)
        }
    }
}

@Composable
private fun MeetingScreen(state: GameplayUiState, viewModel: GameplayViewModel) {
    val snapshot = state.snapshot ?: return LoadingScreen("Loading meeting…")
    val meeting = snapshot.meeting ?: return LoadingScreen("Waiting for meeting details…")
    state.meetingAlertId?.let {
        AlertDialog(
            onDismissRequest = viewModel::dismissMeetingAlert,
            title = { Text("Meeting started") },
            text = { Text(snapshot.meetingReason()) },
            confirmButton = {
                TextButton(onClick = viewModel::dismissMeetingAlert) { Text("View meeting") }
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
        )
        Column(
            Modifier.weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
        ) {
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
    SignalCard(
        Modifier.fillMaxWidth(),
        accent = MaterialTheme.gameColors.voting,
        emphasized = true,
    ) {
        Column(
            Modifier.padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
        ) {
            Text(
                "Vote to eject",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text("${meeting.votesCast} of ${meeting.requiredVotes} votes cast")
            if (meeting.hasCastEjectionVote || state.ejectionVoteSubmittedMeetingId == meeting.id) {
                val name =
                    meeting.ownEjectionTargetParticipantId?.let { id ->
                        meeting.eligibleParticipants.firstOrNull { it.id == id }?.nickname
                    } ?: "Skip"
                Text("Your vote: $name — locked")
            } else if (state.mayEjectionVote()) {
                meeting.eligibleParticipants.forEach { participant ->
                    PlayerCard(
                        nickname = participant.nickname,
                        playerColorId = participant.avatarId,
                        selected =
                            state.hasEjectionSelection &&
                                state.selectedEjectionTargetId == participant.id,
                        onSelected = { viewModel.selectEjectionTarget(participant.id) },
                    )
                }
                VoteChoice(
                    "Skip — eject no one",
                    state.hasEjectionSelection && state.selectedEjectionTargetId == null,
                ) {
                    viewModel.selectEjectionTarget(null)
                }
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
            if (meeting.publicBallotsAllowed(snapshot.meetingRules.voteVisibility)) {
                PublicBallots(meeting.publicVotes)
            } else {
                Text("Ballots are private. Only the aggregate count is shown.")
            }
        }
    }
}

@Composable
private fun VoteChoice(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        RadioButton(selected = selected, onClick = onClick)
        Text(label)
    }
}

@Composable
private fun ReviewVoteConfirmation(state: GameplayUiState, viewModel: GameplayViewModel) {
    val decision = state.selectedReviewDecision ?: return
    AlertDialog(
        onDismissRequest = viewModel::dismissReviewVote,
        title = { Text("Confirm review vote") },
        text = {
            Text(
                "Mark this evidence ${decision.uppercase()}? Your accepted vote cannot be changed."
            )
        },
        confirmButton = {
            TextButton(onClick = viewModel::confirmReviewVote) { Text("Submit vote") }
        },
        dismissButton = { TextButton(onClick = viewModel::dismissReviewVote) { Text("Cancel") } },
    )
}

@Composable
private fun EjectionVoteConfirmation(state: GameplayUiState, viewModel: GameplayViewModel) {
    val meeting = state.snapshot?.meeting ?: return
    val target =
        state.selectedEjectionTargetId?.let { id ->
            meeting.eligibleParticipants.firstOrNull { it.id == id }
        }
    AlertDialog(
        onDismissRequest = viewModel::dismissEjectionVote,
        title = { Text("Confirm ejection vote") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
                if (target != null) PlayerCard(target.nickname, target.avatarId)
                else Text("Skip — eject no one", fontWeight = FontWeight.Bold)
                Text("Your accepted vote cannot be changed.")
            }
        },
        confirmButton = {
            TextButton(onClick = viewModel::confirmEjectionVote) { Text("Submit vote") }
        },
        dismissButton = { TextButton(onClick = viewModel::dismissEjectionVote) { Text("Cancel") } },
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
    onReturnHome: () -> Unit,
) {
    val snapshot = state.snapshot ?: return LoadingScreen("Loading final result…")
    val summary = snapshot.resultSummary
    Column(
        Modifier.fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(GameSpacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
    ) {
        Text(
            "CASE CLOSED",
            color = MaterialTheme.gameColors.results,
            style = MaterialTheme.typography.labelLarge,
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
            "You finished as ${snapshot.self.role.replaceFirstChar(Char::uppercase)} • ${snapshot.self.lifeStatus}"
        )
        if (summary != null) {
            BoxWithConstraints(Modifier.fillMaxWidth().widthIn(max = 720.dp)) {
                val compact = maxWidth < 520.dp
                if (compact) {
                    Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
                        ResultMetric("Players", summary.players.size.toString())
                        ResultMetric(
                            "Crew tasks",
                            "${summary.completedTasks}/${summary.totalTasks}",
                        )
                        ResultMetric("Duration", formatDuration(summary.durationSeconds))
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
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
        GameButton(
            "Back to home",
            onReturnHome,
            Modifier.fillMaxWidth().widthIn(max = 520.dp),
            loading = state.loading,
        )
        GameOutlinedButton(
            if (state.resultDetailsExpanded) "Hide game details" else "Show game details",
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
                                tween(GameMotion.EmphasisMillis, easing = GameMotion.EmphasisEasing)
                        ),
            exit =
                if (reduceMotion) ExitTransition.None
                else
                    fadeOut(tween(GameMotion.QuickMillis)) +
                        shrinkVertically(tween(GameMotion.StandardMillis)),
        ) {
            if (summary != null)
                SignalCard(
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
                            )
                            Text(
                                "${player.role.replaceFirstChar(Char::uppercase)} • ${player.crewRole?.name ?: "No crew specialization"} • ${player.lifeStatus} • tasks ${player.completedTasks}/${player.totalTasks}"
                            )
                        }
                        val accepted =
                            state.submissions.filter { it.processingStatus == "accepted" }
                        Text("Accepted evidence: ${accepted.size}", fontWeight = FontWeight.Bold)
                        accepted.forEach { Text("Evidence ${it.id.take(8)} • ${it.reviewStatus}") }
                        val meeting = snapshot.meeting
                        if (
                            meeting != null &&
                                meeting.publicBallotsAllowed(snapshot.meetingRules.voteVisibility)
                        )
                            PublicBallots(meeting.result?.ballots.orEmpty())
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
            Modifier.padding(GameSpacing.md),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                value,
                color = MaterialTheme.gameColors.results,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Black,
            )
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun formatDuration(seconds: Int): String = "${seconds / 60}m ${seconds % 60}s"

@Composable
private fun SecureContent() {
    val view = LocalView.current
    DisposableEffect(view) {
        val window = (view.context as? Activity)?.window
        val wasSecure =
            ((window?.attributes?.flags ?: 0) and WindowManager.LayoutParams.FLAG_SECURE) != 0
        window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) window?.setHideOverlayWindows(true)
        onDispose {
            if (!wasSecure) window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) window?.setHideOverlayWindows(false)
        }
    }
}

@Composable
private fun RoleRevealScreen(state: GameplayUiState, viewModel: GameplayViewModel) {
    val snapshot = state.snapshot ?: return LoadingScreen("Sealing your private role…")
    Surface(
        modifier = Modifier.fillMaxSize().safeDrawingPadding(),
        color = MaterialTheme.gameColors.privateCanvas,
        contentColor = MaterialTheme.gameColors.privateText,
    ) {
        Column(
            modifier =
                Modifier.fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(GameSpacing.xl),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(GameSpacing.lg, Alignment.CenterVertically),
        ) {
            if (!state.roleRevealed) {
                Text(
                    "Private role sealed",
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    "Check that nobody can see your screen before revealing your role.",
                    textAlign = TextAlign.Center,
                )
                Surface(
                    modifier =
                        Modifier.size(220.dp)
                            .semantics {
                                contentDescription = "Hold to reveal private role"
                                stateDescription = "Role sealed"
                            }
                            .pointerInput(Unit) {
                                detectTapGestures(
                                    onPress = {
                                        viewModel.revealRole()
                                        tryAwaitRelease()
                                        viewModel.resealRole()
                                    }
                                )
                            },
                    shape = RoundedCornerShape(110.dp),
                    color = MaterialTheme.gameColors.privateSurface,
                    contentColor = MaterialTheme.gameColors.privateText,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            "Press and hold\nto reveal",
                            textAlign = TextAlign.Center,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                GameOutlinedButton(
                    "Reveal without holding",
                    viewModel::revealRole,
                    Modifier.fillMaxWidth().widthIn(max = 420.dp),
                )
                if (state.roleViewed) {
                    GameButton(
                        "I’ve seen my role — continue",
                        viewModel::acknowledgeRole,
                        Modifier.fillMaxWidth().widthIn(max = 420.dp),
                    )
                }
            } else {
                val roleTitle = if (snapshot.self.role == "imposter") "Imposter" else "Crewmate"
                Text(
                    roleTitle,
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.gameColors.accentStrong,
                )
                snapshot.self.crewRole?.let { role ->
                    Text(role.name, style = MaterialTheme.typography.headlineSmall)
                    Text(role.specialization, fontWeight = FontWeight.Bold)
                    Text(role.ability, textAlign = TextAlign.Center)
                }
                Text(
                    if (snapshot.self.role == "imposter") {
                        "Stay hidden and use only the actions the game authorizes."
                    } else {
                        "Complete your assigned tasks and help identify the imposters."
                    },
                    textAlign = TextAlign.Center,
                )
                GameButton(
                    "I understand — hide role",
                    viewModel::acknowledgeRole,
                    Modifier.fillMaxWidth().widthIn(max = 420.dp),
                )
            }
        }
    }
}

@Composable
private fun TaskPhaseScreen(state: GameplayUiState, viewModel: GameplayViewModel) {
    val snapshot = state.snapshot ?: return LoadingScreen("Loading tasks…")
    state.selectedAssignmentId?.let { assignmentId ->
        snapshot.assignments
            .firstOrNull { it.id == assignmentId }
            ?.let {
                TaskEvidenceDialog(it, state, viewModel)
            }
    }
    if (state.confirmKill) KillConfirmation(state, viewModel)
    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        GameTopBar(
            phase = "Task phase",
            timerText = countdownText(state.remainingSeconds),
            timerDescription = countdownDescription(state.remainingSeconds),
            nickname =
                snapshot.participants.firstOrNull { it.id == snapshot.self.participantId }?.nickname
                    ?: "You",
            playerColorId = snapshot.self.avatarId,
            connectionState = state.connectionState,
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
        LinearProgressIndicator(
            progress = { snapshot.progress.percent / 100f },
            modifier = Modifier.fillMaxWidth(),
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(GameSpacing.sm),
            horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm),
        ) {
            GameOutlinedButton("Status", {}, Modifier.weight(1f))
            GameOutlinedButton("Evidence", viewModel::showEvidence, Modifier.weight(1f))
        }
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
    val sorted = snapshot.assignments.incompleteFirst()
    Column(
        modifier = modifier.verticalScroll(rememberScrollState()).padding(GameSpacing.md),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
    ) {
        Text(
            "Crew progress ${snapshot.progress.percent}%",
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        Message(state.message)
        if (sorted.isEmpty()) Text("You have no assigned tasks.")
        sorted.forEachIndexed { index, assignment ->
            TaskCard(
                title = "${index + 1}. ${assignment.description}",
                description =
                    "Difficulty: ${assignment.difficulty.replaceFirstChar(Char::uppercase)}",
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
        if (showKill && state.canKill) KillControl(snapshot, state, viewModel)
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
        if (state.canKill) KillControl(snapshot, state, viewModel)
    }
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
            snapshot.cooldowns.killAvailableAt?.let { Text("Cooldown ends at $it") }
            val targets =
                snapshot.participants.filter { it.id in snapshot.self.killableParticipantIds }
            if (targets.isEmpty()) Text("No eligible target is currently available.")
            targets.forEach { target ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(
                        selected = state.selectedKillTargetId == target.id,
                        onClick = { viewModel.selectKillTarget(target.id) },
                    )
                    Text("${target.nickname} • ${target.lifeStatus}")
                }
            }
            GameButton(
                "Review elimination",
                viewModel::requestKillConfirmation,
                Modifier.fillMaxWidth(),
                style = GameButtonStyle.Destructive,
                enabled = state.selectedKillTargetId != null && !state.loading,
            )
        }
    }
}

@Composable
private fun KillConfirmation(state: GameplayUiState, viewModel: GameplayViewModel) {
    val target =
        state.snapshot?.participants?.firstOrNull { it.id == state.selectedKillTargetId } ?: return
    AlertDialog(
        onDismissRequest = viewModel::dismissKill,
        title = { Text("Confirm elimination") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
                PlayerCard(target.nickname, target.avatarId)
                Text("This immediately changes the game and may trigger a meeting.")
            }
        },
        confirmButton = {
            TextButton(onClick = viewModel::confirmKill) { Text("Confirm elimination") }
        },
        dismissButton = { TextButton(onClick = viewModel::dismissKill) { Text("Cancel") } },
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
    AlertDialog(
        onDismissRequest = viewModel::dismissTaskDetail,
        title = { Text(assignment.description) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
            ) {
                Text("Difficulty: ${assignment.difficulty}")
                Text("Evidence: ${uploadStageLabel(state.uploadStage)}")
                state.preparedEvidence?.let { evidence -> EvidenceBitmap(evidence.previewBytes) }
                Message(state.message)
                when (state.uploadStage) {
                    UploadStage.IDLE,
                    UploadStage.TERMINAL_FAILURE -> {
                        GameButton(
                            "Use camera",
                            {
                                viewModel.createCameraUri().also {
                                    cameraUri = it
                                    camera.launch(it)
                                }
                            },
                            Modifier.fillMaxWidth(),
                        )
                        GameOutlinedButton(
                            "Choose from device",
                            {
                                picker.launch(
                                    PickVisualMediaRequest(
                                        ActivityResultContracts.PickVisualMedia.ImageOnly
                                    )
                                )
                            },
                            Modifier.fillMaxWidth(),
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
                    else -> LinearProgressIndicator(Modifier.fillMaxWidth())
                }
            }
        },
        confirmButton = {
            GameBackButton("Tasks", viewModel::dismissTaskDetail)
        },
    )
}

@Composable
private fun EvidenceGalleryScreen(state: GameplayUiState, viewModel: GameplayViewModel) {
    val snapshot = state.snapshot ?: return LoadingScreen("Loading evidence…")
    state.selectedSubmissionId?.let {
        EvidencePreviewDialog(state, viewModel)
    }
    if (state.confirmFlag) {
        AlertDialog(
            onDismissRequest = viewModel::dismissFlag,
            title = { Text("Flag this evidence?") },
            text = { Text("The evidence will be queued for review. Misuse may disrupt the game.") },
            confirmButton = {
                TextButton(onClick = viewModel::confirmFlag) { Text("Flag evidence") }
            },
            dismissButton = { TextButton(onClick = viewModel::dismissFlag) { Text("Cancel") } },
        )
    }
    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        GameTopBar(
            phase = "Evidence",
            timerText = countdownText(state.remainingSeconds),
            timerDescription = countdownDescription(state.remainingSeconds),
            nickname =
                snapshot.participants.firstOrNull { it.id == snapshot.self.participantId }?.nickname
                    ?: "You",
            playerColorId = snapshot.self.avatarId,
            connectionState = state.connectionState,
            navigationLabel = "Tasks",
            onNavigationClick = viewModel::showTasks,
        )
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
        ) {
            Text(
                "Permitted evidence",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Message(state.message)
            if (state.submissions.isEmpty()) Text("No evidence is visible right now.")
            state.submissions.forEach { submission -> EvidenceCard(submission, viewModel) }
        }
        GameBackButton(
            "Tasks",
            viewModel::showTasks,
            Modifier.fillMaxWidth().padding(GameSpacing.md),
        )
    }
}

@Composable
private fun EvidenceCard(submission: Submission, viewModel: GameplayViewModel) {
    SignalCard(Modifier.fillMaxWidth(), accent = MaterialTheme.gameColors.tasks) {
        Column(
            Modifier.padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
        ) {
            Text(submission.uploader.nickname, fontWeight = FontWeight.Bold)
            Text("Processing: ${submission.processingStatus}")
            Text("Review: ${submission.reviewStatus}")
            if (submission.flaggedBySelf) Text("Flagged by you")
            GameOutlinedButton("View evidence", { viewModel.selectEvidence(submission.id) })
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
