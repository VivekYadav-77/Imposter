package com.impostergame.android.gameplay

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.impostergame.android.entry.GatewayResult
import com.impostergame.android.entry.messageFor
import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.network.ApiFailure
import com.impostergame.designsystem.component.ConnectionState
import java.time.Clock
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class GameplayViewModel(
    private val gateway: GameplayGateway,
    private val evidenceProcessor: EvidenceProcessor,
    private val clock: Clock = Clock.systemUTC(),
    private val newKey: () -> String = { UUID.randomUUID().toString() },
) : ViewModel() {
    private val _state = kotlinx.coroutines.flow.MutableStateFlow(GameplayUiState())
    val state: kotlinx.coroutines.flow.StateFlow<GameplayUiState> = _state
    private var loaded = false
    private var refreshJob: Job? = null
    private var uploadJob: Job? = null
    private var pendingUpload: PendingUpload? = null
    private var pendingKill: PendingAction? = null
    private var pendingFlag: PendingAction? = null
    private var pendingReviewVote: PendingAction? = null
    private var pendingEjectionVote: PendingAction? = null
    private var commandInFlight = false
    private val announcedMeetings = mutableSetOf<String>()
    private var refreshedExpiredDeadline: String? = null

    init {
        viewModelScope.launch {
            while (isActive) {
                updateCountdown()
                delay(1_000)
            }
        }
    }

    fun load() {
        if (loaded) return
        loaded = true
        refresh(showLoading = true, forceRoleSeal = true)
        refreshJob = viewModelScope.launch {
            while (isActive) {
                delay(5_000)
                if (!_state.value.loading && uploadJob?.isActive != true) {
                    refresh()
                    if (_state.value.uploadStage == UploadStage.PROCESSING) {
                        refreshSubmissions()
                    }
                }
            }
        }
    }

    fun revealRole() = update { it.copy(roleRevealed = true, roleViewed = true) }

    fun resealRole() = update { it.copy(roleRevealed = false) }

    fun acknowledgeRole() = update {
        if (it.roleViewed) {
            it.copy(roleRevealed = false, destination = GameplayDestination.TASKS)
        } else {
            it
        }
    }

    fun showTasks() = update { it.copy(destination = GameplayDestination.TASKS, message = null) }

    fun showEvidence() {
        update { it.copy(destination = GameplayDestination.EVIDENCE, message = null) }
        refreshSubmissions()
    }

    fun selectAssignment(id: String) {
        val snapshot = _state.value.snapshot ?: return
        val assignment = snapshot.assignments.firstOrNull { it.id == id } ?: return
        if (
            !snapshot.self.capabilities.contains("submit_evidence") ||
                assignment.status == "completed"
        ) {
            return
        }
        update {
            it.copy(
                selectedAssignmentId = id,
                uploadStage = UploadStage.IDLE,
                preparedEvidence = null,
                message = null,
            )
        }
    }

    fun dismissTaskDetail() {
        uploadJob?.cancel()
        pendingUpload = null
        update {
            it.copy(
                selectedAssignmentId = null,
                uploadStage = UploadStage.IDLE,
                preparedEvidence = null,
            )
        }
    }

    fun createCameraUri(): Uri = evidenceProcessor.createCameraUri()

    fun discardCameraUri(uri: Uri) = evidenceProcessor.cleanupCameraUri(uri)

    fun prepareEvidence(uri: Uri, cameraCapture: Boolean = false) {
        uploadJob?.cancel()
        update {
            it.copy(
                uploadStage = UploadStage.PREPARING,
                preparedEvidence = null,
                message = null,
            )
        }
        uploadJob = viewModelScope.launch {
            val result = evidenceProcessor.prepare(uri)
            if (cameraCapture) evidenceProcessor.cleanupCameraUri(uri)
            result.fold(
                onSuccess = { evidence ->
                    pendingUpload = null
                    update {
                        it.copy(
                            uploadStage = UploadStage.PREVIEW,
                            preparedEvidence = evidence,
                        )
                    }
                },
                onFailure = { error ->
                    update {
                        it.copy(
                            uploadStage = UploadStage.TERMINAL_FAILURE,
                            message = error.message ?: "The selected image could not be prepared.",
                        )
                    }
                },
            )
        }
    }

    fun chooseAnother() {
        pendingUpload = null
        update {
            it.copy(
                uploadStage = UploadStage.IDLE,
                preparedEvidence = null,
                message = null,
            )
        }
    }

    fun submitEvidence() {
        if (uploadJob?.isActive == true) return
        val current = _state.value
        val snapshot = current.snapshot ?: return
        val assignmentId = current.selectedAssignmentId ?: return
        val evidence = current.preparedEvidence ?: return
        if (!snapshot.self.capabilities.contains("submit_evidence")) return
        val fingerprint = "$assignmentId|${snapshot.stateVersion}|${evidence.checksum}"
        val command =
            pendingUpload?.takeIf { it.fingerprint == fingerprint }
                ?: PendingUpload(fingerprint, newKey(), newKey()).also { pendingUpload = it }
        uploadJob = viewModelScope.launch {
            val result =
                gateway.submitEvidence(
                    assignmentId,
                    snapshot.stateVersion,
                    evidence,
                    command.intentKey,
                    command.confirmationKey,
                ) { stage ->
                    update { it.copy(uploadStage = stage) }
                }
            when (result) {
                is GatewayResult.Success -> {
                    pendingUpload = null
                    update {
                        it.copy(
                            uploadStage = UploadStage.PROCESSING,
                            preparedEvidence = null,
                            activeSubmissionId = result.value.submission.id,
                            message = "Evidence received and processing.",
                        )
                    }
                    refresh()
                    refreshSubmissions()
                }
                is GatewayResult.Failure -> {
                    val retryable =
                        result.error is ApiFailure.Transport ||
                            (result.error is ApiFailure.Http && result.error.status >= 500)
                    update {
                        it.copy(
                            uploadStage =
                                if (retryable) UploadStage.RETRYABLE_FAILURE
                                else UploadStage.TERMINAL_FAILURE,
                            message = messageFor(result.error),
                        )
                    }
                    if (result.error is ApiFailure.Http && result.error.status == 409) refresh()
                }
            }
        }
    }

    fun selectEvidence(id: String) {
        val submission = _state.value.submissions.firstOrNull { it.id == id } ?: return
        val url = submission.image?.url
        update {
            it.copy(
                selectedSubmissionId = id,
                previewImageBytes = null,
                loading = url != null,
                message =
                    if (url == null) "This image is still processing or has expired." else null,
            )
        }
        if (url != null) {
            viewModelScope.launch {
                when (val result = gateway.loadImage(url)) {
                    is GatewayResult.Success ->
                        update { it.copy(previewImageBytes = result.value, loading = false) }
                    is GatewayResult.Failure ->
                        update { it.copy(message = messageFor(result.error), loading = false) }
                }
            }
        }
    }

    fun dismissEvidencePreview() = update {
        it.copy(
            selectedSubmissionId = null,
            previewImageBytes = null,
            confirmFlag = false,
        )
    }

    fun requestFlag() {
        val state = _state.value
        val submission =
            state.submissions.firstOrNull { it.id == state.selectedSubmissionId } ?: return
        if (state.mayFlag(submission)) {
            update { it.copy(confirmFlag = true) }
        }
    }

    fun dismissFlag() = update { it.copy(confirmFlag = false) }

    fun confirmFlag() {
        val current = _state.value
        val snapshot = current.snapshot ?: return
        val submissionId = current.selectedSubmissionId ?: return
        val fingerprint = "$submissionId|${snapshot.stateVersion}"
        val command =
            pendingFlag?.takeIf { it.fingerprint == fingerprint }
                ?: PendingAction(fingerprint, newKey()).also { pendingFlag = it }
        launchOnce {
            when (val result = gateway.flag(submissionId, snapshot.stateVersion, command.key)) {
                is GatewayResult.Success -> {
                    pendingFlag = null
                    update {
                        it.copy(
                            confirmFlag = false,
                            message = "Evidence flagged for review.",
                        )
                    }
                    refreshSubmissions()
                }
                is GatewayResult.Failure -> {
                    update { it.copy(confirmFlag = false, message = messageFor(result.error)) }
                    if (result.error is ApiFailure.Http && result.error.status == 409) {
                        refreshSubmissions()
                    }
                }
            }
        }
    }

    fun selectKillTarget(id: String) {
        if (_state.value.mayKill(id)) {
            update { it.copy(selectedKillTargetId = id, confirmKill = false, message = null) }
        }
    }

    fun requestKillConfirmation() {
        if (_state.value.selectedKillTargetId != null) update { it.copy(confirmKill = true) }
    }

    fun dismissKill() = update { it.copy(confirmKill = false) }

    fun dismissMeetingAlert() = update { it.copy(meetingAlertId = null) }

    fun selectReviewDecision(decision: String) {
        if (decision !in setOf("valid", "invalid") || !_state.value.mayReviewVote()) return
        update {
            it.copy(selectedReviewDecision = decision, confirmReviewVote = false, message = null)
        }
    }

    fun requestReviewVoteConfirmation() {
        if (_state.value.mayReviewVote() && _state.value.selectedReviewDecision != null) {
            update { it.copy(confirmReviewVote = true) }
        }
    }

    fun dismissReviewVote() = update { it.copy(confirmReviewVote = false) }

    fun confirmReviewVote() {
        val current = _state.value
        val snapshot = current.snapshot ?: return
        val item = snapshot.meeting?.reviewItem ?: return
        val decision = current.selectedReviewDecision ?: return
        if (!current.mayReviewVote()) return
        val fingerprint = "${item.id}|${snapshot.stateVersion}|$decision"
        val command =
            pendingReviewVote?.takeIf { it.fingerprint == fingerprint }
                ?: PendingAction(fingerprint, newKey()).also { pendingReviewVote = it }
        launchOnce {
            when (
                val result =
                    gateway.reviewVote(item.id, snapshot.stateVersion, decision, command.key)
            ) {
                is GatewayResult.Success -> {
                    pendingReviewVote = null
                    update {
                        it.copy(
                            confirmReviewVote = false,
                            reviewVoteSubmittedItemId = item.id,
                            message = "Review vote accepted and locked.",
                        )
                    }
                    refresh()
                }
                is GatewayResult.Failure -> handleMeetingConflict(result.error, review = true)
            }
        }
    }

    fun selectEjectionTarget(targetId: String?) {
        val current = _state.value
        val eligible =
            current.snapshot?.meeting?.eligibleParticipants.orEmpty().any { it.id == targetId }
        if (!current.mayEjectionVote() || (targetId != null && !eligible)) return
        update {
            it.copy(
                hasEjectionSelection = true,
                selectedEjectionTargetId = targetId,
                confirmEjectionVote = false,
                message = null,
            )
        }
    }

    fun requestEjectionVoteConfirmation() {
        if (_state.value.mayEjectionVote() && _state.value.hasEjectionSelection) {
            update { it.copy(confirmEjectionVote = true) }
        }
    }

    fun dismissEjectionVote() = update { it.copy(confirmEjectionVote = false) }

    fun confirmEjectionVote() {
        val current = _state.value
        val snapshot = current.snapshot ?: return
        val meeting = snapshot.meeting ?: return
        if (!current.mayEjectionVote() || !current.hasEjectionSelection) return
        val target = current.selectedEjectionTargetId
        val fingerprint = "${meeting.id}|${snapshot.stateVersion}|${target ?: "skip"}"
        val command =
            pendingEjectionVote?.takeIf { it.fingerprint == fingerprint }
                ?: PendingAction(fingerprint, newKey()).also { pendingEjectionVote = it }
        launchOnce {
            when (
                val result =
                    gateway.ejectionVote(meeting.id, snapshot.stateVersion, target, command.key)
            ) {
                is GatewayResult.Success -> {
                    pendingEjectionVote = null
                    update {
                        it.copy(
                            confirmEjectionVote = false,
                            ejectionVoteSubmittedMeetingId = meeting.id,
                            message = "Vote accepted and locked.",
                        )
                    }
                    refresh()
                }
                is GatewayResult.Failure -> handleMeetingConflict(result.error, review = false)
            }
        }
    }

    fun toggleResultDetails() = update {
        it.copy(resultDetailsExpanded = !it.resultDetailsExpanded)
    }

    fun refreshReviewEvidence() {
        refreshSubmissions(loadMeetingEvidence = true)
    }

    fun clearForHome() {
        refreshJob?.cancel()
        uploadJob?.cancel()
        pendingUpload = null
        pendingKill = null
        pendingFlag = null
        pendingReviewVote = null
        pendingEjectionVote = null
        announcedMeetings.clear()
        refreshedExpiredDeadline = null
        update { GameplayUiState() }
        loaded = false
    }

    fun confirmKill() {
        val current = _state.value
        val snapshot = current.snapshot ?: return
        val target = current.selectedKillTargetId ?: return
        if (!current.mayKill(target)) return
        val fingerprint = "$target|${snapshot.stateVersion}"
        val command =
            pendingKill?.takeIf { it.fingerprint == fingerprint }
                ?: PendingAction(fingerprint, newKey()).also { pendingKill = it }
        launchOnce {
            when (val result = gateway.kill(target, snapshot.stateVersion, command.key)) {
                is GatewayResult.Success -> {
                    pendingKill = null
                    applySnapshot(result.value)
                    update {
                        it.copy(
                            selectedKillTargetId = null,
                            confirmKill = false,
                            message = "Action accepted.",
                        )
                    }
                }
                is GatewayResult.Failure -> {
                    update {
                        it.copy(
                            selectedKillTargetId = null,
                            confirmKill = false,
                            message = "The opportunity changed. ${messageFor(result.error)}",
                        )
                    }
                    refresh()
                }
            }
        }
    }

    fun onAppBackgrounded() {
        resealRole()
        if (uploadJob?.isActive == true) {
            uploadJob?.cancel()
            update {
                it.copy(
                    uploadStage = UploadStage.RETRYABLE_FAILURE,
                    message = "Upload paused when the app left the foreground. Try again.",
                )
            }
        }
        update { it.copy(previewImageBytes = null, reviewImageBytes = null) }
    }

    private fun refresh(showLoading: Boolean = false, forceRoleSeal: Boolean = false) {
        if (showLoading) update { it.copy(loading = true) }
        viewModelScope.launch {
            when (val result = gateway.snapshot()) {
                is GatewayResult.Success -> {
                    applySnapshot(result.value, forceRoleSeal)
                    update {
                        it.copy(loading = false, connectionState = ConnectionState.Connected)
                    }
                }
                is GatewayResult.Failure ->
                    update {
                        it.copy(
                            loading = false,
                            message = messageFor(result.error),
                            connectionState =
                                if (it.snapshot == null) ConnectionState.Offline
                                else ConnectionState.Reconnecting,
                        )
                    }
            }
        }
    }

    private fun applySnapshot(snapshot: GameSnapshot, forceRoleSeal: Boolean = false) {
        update { current ->
            if ((current.snapshot?.stateVersion ?: Long.MIN_VALUE) > snapshot.stateVersion) {
                return@update current
            }
            val meetingId = snapshot.meeting?.id
            val announceMeeting = meetingId != null && announcedMeetings.add(meetingId)
            val sameReviewItem =
                current.snapshot?.meeting?.reviewItem?.id == snapshot.meeting?.reviewItem?.id
            val sameMeeting = current.snapshot?.meeting?.id == meetingId
            val destination =
                when (snapshot.phase) {
                    GamePhase.TASK ->
                        if (forceRoleSeal || current.destination == GameplayDestination.LOADING) {
                            GameplayDestination.SEALED_ROLE
                        } else if (
                            current.destination == GameplayDestination.MEETING ||
                                current.destination == GameplayDestination.RESULTS
                        ) {
                            GameplayDestination.TASKS
                        } else {
                            current.destination
                        }
                    GamePhase.GAME_OVER,
                    GamePhase.ABANDONED -> GameplayDestination.RESULTS
                    else -> GameplayDestination.MEETING
                }
            current.copy(
                snapshot = snapshot,
                destination = destination,
                roleRevealed = if (forceRoleSeal) false else current.roleRevealed,
                roleViewed = if (forceRoleSeal) false else current.roleViewed,
                selectedKillTargetId =
                    current.selectedKillTargetId?.takeIf {
                        it in snapshot.self.killableParticipantIds
                    },
                meetingAlertId = if (announceMeeting) meetingId else current.meetingAlertId,
                selectedReviewDecision =
                    if (sameReviewItem && snapshot.meeting?.reviewItem?.ownDecision == null) {
                        current.selectedReviewDecision
                    } else null,
                confirmReviewVote =
                    current.confirmReviewVote &&
                        sameReviewItem &&
                        snapshot.meeting?.reviewItem?.ownDecision == null,
                reviewVoteSubmittedItemId =
                    current.reviewVoteSubmittedItemId?.takeIf {
                        it == snapshot.meeting?.reviewItem?.id
                    },
                hasEjectionSelection =
                    current.hasEjectionSelection &&
                        sameMeeting &&
                        snapshot.meeting?.hasCastEjectionVote == false,
                selectedEjectionTargetId =
                    current.selectedEjectionTargetId?.takeIf { target ->
                        snapshot.meeting?.eligibleParticipants?.any { it.id == target } == true
                    },
                confirmEjectionVote =
                    current.confirmEjectionVote &&
                        sameMeeting &&
                        snapshot.meeting?.hasCastEjectionVote == false,
                ejectionVoteSubmittedMeetingId =
                    current.ejectionVoteSubmittedMeetingId?.takeIf { it == meetingId },
                reviewImageBytes = if (sameReviewItem) current.reviewImageBytes else null,
            )
        }
        updateCountdown()
        if (snapshot.phase == GamePhase.REVIEW && _state.value.reviewImageBytes == null) {
            refreshSubmissions(loadMeetingEvidence = true)
        }
    }

    private fun refreshSubmissions(loadMeetingEvidence: Boolean = false) {
        viewModelScope.launch {
            when (val result = gateway.submissions()) {
                is GatewayResult.Success -> {
                    val activeId = _state.value.activeSubmissionId
                    val active = result.value.firstOrNull { it.id == activeId }
                    update {
                        it.copy(
                            submissions = result.value,
                            uploadStage =
                                when (active?.processingStatus) {
                                    "accepted" -> UploadStage.COMPLETE
                                    "rejected",
                                    "deleted" -> UploadStage.TERMINAL_FAILURE
                                    "pending" -> UploadStage.PROCESSING
                                    else -> it.uploadStage
                                },
                        )
                    }
                    if (loadMeetingEvidence) {
                        loadReviewImage(result.value)
                    }
                }
                is GatewayResult.Failure -> update { it.copy(message = messageFor(result.error)) }
            }
        }
    }

    private fun updateCountdown() {
        val deadline =
            _state.value.snapshot?.phaseDeadlineAt?.let { runCatching(Instant::parse).getOrNull() }
        update {
            it.copy(
                remainingSeconds =
                    deadline?.let { value ->
                        (value.epochSecond - clock.instant().epochSecond).coerceAtLeast(0)
                    }
            )
        }
        val deadlineText = _state.value.snapshot?.phaseDeadlineAt
        if (
            _state.value.remainingSeconds == 0L &&
                deadlineText != null &&
                refreshedExpiredDeadline != deadlineText
        ) {
            refreshedExpiredDeadline = deadlineText
            refresh()
        }
    }

    private suspend fun loadReviewImage(submissions: List<com.impostergame.data.model.Submission>) {
        val submissionId = _state.value.snapshot?.meeting?.reviewItem?.submissionId ?: return
        val url = submissions.firstOrNull { it.id == submissionId }?.image?.url
        if (url == null) {
            update {
                it.copy(
                    reviewImageBytes = null,
                    message =
                        "Evidence image is processing or its link expired. Refresh to try again.",
                )
            }
            return
        }
        when (val image = gateway.loadImage(url)) {
            is GatewayResult.Success -> update { it.copy(reviewImageBytes = image.value) }
            is GatewayResult.Failure ->
                update { it.copy(reviewImageBytes = null, message = messageFor(image.error)) }
        }
    }

    private fun handleMeetingConflict(error: ApiFailure, review: Boolean) {
        val changed = error is ApiFailure.Http && error.status == 409
        update {
            it.copy(
                selectedReviewDecision = if (review) null else it.selectedReviewDecision,
                confirmReviewVote = false,
                hasEjectionSelection = if (review) it.hasEjectionSelection else false,
                selectedEjectionTargetId = if (review) it.selectedEjectionTargetId else null,
                confirmEjectionVote = false,
                message =
                    if (changed)
                        "The meeting advanced before that vote was accepted. Refreshing the authoritative state."
                    else messageFor(error),
            )
        }
        refresh()
    }

    private fun launchOnce(block: suspend () -> Unit) {
        if (commandInFlight) return
        commandInFlight = true
        viewModelScope.launch {
            update { it.copy(loading = true) }
            try {
                block()
            } finally {
                commandInFlight = false
                update { it.copy(loading = false) }
            }
        }
    }

    private fun update(transform: (GameplayUiState) -> GameplayUiState) {
        _state.value = transform(_state.value)
    }

    private data class PendingUpload(
        val fingerprint: String,
        val intentKey: String,
        val confirmationKey: String,
    )

    private data class PendingAction(val fingerprint: String, val key: String)
}
