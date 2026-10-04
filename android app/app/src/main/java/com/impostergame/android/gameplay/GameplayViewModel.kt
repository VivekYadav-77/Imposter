package com.impostergame.android.gameplay

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.impostergame.android.entry.GatewayResult
import com.impostergame.android.entry.messageFor
import com.impostergame.android.feedback.GameFeedbackEvent
import com.impostergame.android.feedback.GameFeedbackKind
import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.network.ApiFailure
import com.impostergame.designsystem.component.ConnectionState
import java.time.Clock
import java.util.UUID
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
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
    private val _feedback = MutableSharedFlow<GameFeedbackEvent>(extraBufferCapacity = 32)
    val feedback = _feedback.asSharedFlow()
    private var loaded = false
    private var refreshJob: Job? = null
    private var uploadJob: Job? = null
    private var pendingUpload: PendingUpload? = null
    private var pendingKill: PendingAction? = null
    private var pendingMeetingCall: PendingAction? = null
    private var pendingReviewVote: PendingAction? = null
    private var pendingEjectionVote: PendingAction? = null
    private var pendingReplay: PendingAction? = null
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
                        refreshSubmissions(loadOwnTaskThumbnails = true)
                    }
                }
            }
        }
    }

    fun revealRole() {
        val snapshot = _state.value.snapshot
        if (!_state.value.roleRevealed && snapshot != null) {
            emitFeedback(
                if (snapshot.self.role == "imposter") GameFeedbackKind.RoleImposter
                else GameFeedbackKind.RoleCrew,
                "${snapshot.id}:${snapshot.stateVersion}",
            )
        }
        update { it.copy(roleRevealed = true, roleViewed = true) }
    }

    fun resealRole() = update { it.copy(roleRevealed = false) }

    fun acknowledgeRole() {
        val enteringTasks = _state.value.roleViewed
        update {
            if (it.roleViewed) {
                it.copy(roleRevealed = false, destination = GameplayDestination.TASKS)
            } else {
                it
            }
        }
        if (enteringTasks) refreshSubmissions(loadOwnTaskThumbnails = true)
    }

    fun showTasks() = update { it.copy(destination = GameplayDestination.TASKS, message = null) }

    fun showEvidence() {
        update { it.copy(destination = GameplayDestination.EVIDENCE, message = null) }
        refreshSubmissions(loadThumbnails = true)
    }

    fun refreshEvidenceImages() = refreshSubmissions(loadThumbnails = true)

    fun showStatus() = update {
        it.copy(statusPanelVisible = true, killPickerVisible = false, message = null)
    }

    fun dismissStatus() = update { it.copy(statusPanelVisible = false) }

    fun showKillPicker() {
        if (_state.value.canKill) {
            update {
                it.copy(
                    killPickerVisible = true,
                    selectedKillTargetId = null,
                    message = null,
                )
            }
            emitFeedback(GameFeedbackKind.Ui)
        }
    }

    fun dismissKillPicker() = update {
        it.copy(killPickerVisible = false, selectedKillTargetId = null)
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
        emitFeedback(GameFeedbackKind.Ui)
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
        val assignmentId = _state.value.selectedAssignmentId ?: return
        uploadJob?.cancel()
        update {
            it.copy(
                selectedAssignmentId = null,
                activeUploadAssignmentId = assignmentId,
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
                    uploadJob = null
                    submitPreparedEvidence(assignmentId, evidence)
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
        val assignmentId =
            current.activeUploadAssignmentId ?: current.selectedAssignmentId ?: return
        val evidence = current.preparedEvidence ?: return
        submitPreparedEvidence(assignmentId, evidence)
    }

    private fun submitPreparedEvidence(assignmentId: String, evidence: PreparedEvidence) {
        if (uploadJob?.isActive == true) return
        val current = _state.value
        val snapshot = current.snapshot ?: return
        if (!snapshot.self.capabilities.contains("submit_evidence")) return
        val fingerprint = "$assignmentId|${snapshot.stateVersion}|${evidence.checksum}"
        val command =
            pendingUpload?.takeIf { it.fingerprint == fingerprint }
                ?: PendingUpload(fingerprint, newKey(), newKey()).also { pendingUpload = it }
        emitFeedback(GameFeedbackKind.UploadStart, "$assignmentId:${snapshot.stateVersion}")
        update {
            it.copy(
                selectedAssignmentId = null,
                activeUploadAssignmentId = assignmentId,
                message = null,
            )
        }
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
                            message = null,
                        )
                    }
                    emitFeedback(GameFeedbackKind.Upload, result.value.submission.id)
                    refresh()
                    refreshSubmissions(loadOwnTaskThumbnails = true)
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
                    emitFeedback(GameFeedbackKind.UploadFailure)
                    if (result.error is ApiFailure.Http && result.error.status == 409) refresh()
                }
            }
        }
    }

    fun selectEvidence(id: String) {
        val submission = _state.value.submissions.firstOrNull { it.id == id } ?: return
        val url = submission.image?.url
        val cached = _state.value.evidenceImageBytes[id]
        update {
            it.copy(
                selectedSubmissionId = id,
                previewImageBytes = cached,
                previewImageLoading = url != null && cached == null,
                message =
                    if (url == null) "This image is still processing or has expired." else null,
            )
        }
        if (url != null && cached == null) {
            viewModelScope.launch {
                when (val result = gateway.loadImage(url)) {
                    is GatewayResult.Success ->
                        update { current ->
                            current.copy(
                                evidenceImageBytes =
                                    current.evidenceImageBytes + (id to result.value),
                                previewImageBytes =
                                    if (current.selectedSubmissionId == id) result.value
                                    else current.previewImageBytes,
                                previewImageLoading =
                                    current.previewImageLoading &&
                                        current.selectedSubmissionId != id,
                            )
                        }
                    is GatewayResult.Failure ->
                        update { current ->
                            current.copy(
                                message =
                                    if (current.selectedSubmissionId == id)
                                        "Evidence image is unavailable. Refresh and try again."
                                    else current.message,
                                previewImageLoading =
                                    current.previewImageLoading &&
                                        current.selectedSubmissionId != id,
                            )
                        }
                }
            }
        }
    }

    fun dismissEvidencePreview() = update {
        it.copy(
            selectedSubmissionId = null,
            previewImageBytes = null,
            previewImageLoading = false,
        )
    }

    fun selectKillTarget(id: String) {
        if (_state.value.mayKill(id)) {
            update { it.copy(selectedKillTargetId = id, message = null) }
            emitFeedback(GameFeedbackKind.Ui)
        }
    }

    fun requestMeetingConfirmation() {
        if (_state.value.mayCallMeeting()) {
            update {
                it.copy(confirmMeetingCall = true, statusPanelVisible = false, message = null)
            }
        } else {
            showStatus()
        }
    }

    fun dismissMeetingConfirmation() = update { it.copy(confirmMeetingCall = false) }

    fun confirmMeetingCall() {
        val current = _state.value
        val snapshot = current.snapshot ?: return
        if (!current.mayCallMeeting()) return
        val fingerprint = "${snapshot.id}|${snapshot.stateVersion}|meeting"
        val command =
            pendingMeetingCall?.takeIf { it.fingerprint == fingerprint }
                ?: PendingAction(fingerprint, newKey()).also { pendingMeetingCall = it }
        launchOnce {
            when (val result = gateway.callMeeting(snapshot.stateVersion, command.key)) {
                is GatewayResult.Success -> {
                    pendingMeetingCall = null
                    update {
                        it.copy(
                            snapshot = result.value,
                            confirmMeetingCall = false,
                            destination = GameplayDestination.MEETING,
                            message = "Meeting called. Gather the room.",
                        )
                    }
                    emitFeedback(GameFeedbackKind.Meeting, result.value.meeting?.id ?: fingerprint)
                }
                is GatewayResult.Failure -> {
                    update {
                        it.copy(
                            confirmMeetingCall = false,
                            message = messageFor(result.error),
                        )
                    }
                    if (result.error is ApiFailure.Http && result.error.status == 409) refresh()
                }
            }
        }
    }

    fun dismissMeetingAlert() = update { it.copy(meetingAlertId = null) }

    fun selectReviewDecision(decision: String) {
        if (decision !in setOf("valid", "invalid") || !_state.value.mayReviewVote()) return
        update {
            it.copy(selectedReviewDecision = decision, confirmReviewVote = false, message = null)
        }
        emitFeedback(GameFeedbackKind.VoteSelect)
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
                    emitFeedback(GameFeedbackKind.VoteLock, item.id)
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
        emitFeedback(GameFeedbackKind.VoteSelect)
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
                    emitFeedback(GameFeedbackKind.VoteLock, meeting.id)
                    refresh()
                }
                is GatewayResult.Failure -> handleMeetingConflict(result.error, review = false)
            }
        }
    }

    fun toggleResultDetails() = update {
        it.copy(resultDetailsExpanded = !it.resultDetailsExpanded)
    }

    fun replay(onSuccess: (RoomSnapshot) -> Unit) {
        val snapshot = _state.value.snapshot ?: return
        if (snapshot.phase !in setOf(GamePhase.GAME_OVER, GamePhase.ABANDONED)) return
        val fingerprint = snapshot.id
        val command =
            pendingReplay?.takeIf { it.fingerprint == fingerprint }
                ?: PendingAction(fingerprint, newKey()).also { pendingReplay = it }
        launchOnce {
            when (val result = gateway.replay(command.key)) {
                is GatewayResult.Success -> {
                    pendingReplay = null
                    onSuccess(result.value)
                }
                is GatewayResult.Failure ->
                    update {
                        it.copy(
                            message = "The room could not be reset. ${messageFor(result.error)}"
                        )
                    }
            }
        }
    }

    fun refreshReviewEvidence() {
        refreshSubmissions(loadMeetingEvidence = true)
    }

    fun clearForHome() {
        refreshJob?.cancel()
        uploadJob?.cancel()
        pendingUpload = null
        pendingKill = null
        pendingMeetingCall = null
        pendingReviewVote = null
        pendingEjectionVote = null
        pendingReplay = null
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
                            killPickerVisible = false,
                            message = "Action accepted.",
                        )
                    }
                    emitFeedback(GameFeedbackKind.Kill, "$target:${result.value.stateVersion}")
                }
                is GatewayResult.Failure -> {
                    update {
                        it.copy(
                            selectedKillTargetId = null,
                            killPickerVisible = false,
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
        update {
            it.copy(
                previewImageBytes = null,
                previewImageLoading = false,
                evidenceImageBytes = emptyMap(),
                reviewImageBytes = null,
            )
        }
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
        val previous = _state.value.snapshot
        val meetingId = snapshot.meeting?.id
        val announceMeeting = meetingId != null && announcedMeetings.add(meetingId)
        val snapshotKillRemaining =
            remainingSecondsUntil(snapshot.cooldowns.killAvailableAt, clock.instant())
        update { current ->
            if ((current.snapshot?.stateVersion ?: Long.MIN_VALUE) > snapshot.stateVersion) {
                return@update current
            }
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
                killCooldownRemainingSeconds = snapshotKillRemaining,
                message =
                    messageAfterPhaseTransition(previous?.phase, snapshot.phase, current.message),
            )
        }
        if (announceMeeting) {
            emitFeedback(GameFeedbackKind.Meeting, requireNotNull(meetingId))
        }
        if (snapshot.meeting?.phase == "voting" && previous?.meeting?.phase != "voting") {
            emitFeedback(GameFeedbackKind.Vote, requireNotNull(meetingId))
        }
        if (previous?.self?.lifeStatus == "alive" && snapshot.self.lifeStatus != "alive") {
            emitFeedback(GameFeedbackKind.Eliminated, "${snapshot.id}:${snapshot.stateVersion}")
        }
        val terminal =
            snapshot.phase == GamePhase.GAME_OVER || snapshot.phase == GamePhase.ABANDONED
        val previouslyTerminal =
            previous?.phase == GamePhase.GAME_OVER || previous?.phase == GamePhase.ABANDONED
        if (terminal && !previouslyTerminal) {
            val won =
                when (snapshot.self.role) {
                    "imposter" -> snapshot.winner in setOf("imposter", "imposters")
                    else -> snapshot.winner == "crew"
                }
            emitFeedback(
                when {
                    snapshot.winner == null -> GameFeedbackKind.Result
                    won -> GameFeedbackKind.Victory
                    else -> GameFeedbackKind.Defeat
                },
                "${snapshot.id}:${snapshot.stateVersion}",
            )
        }
        updateCountdown()
        if (snapshot.phase == GamePhase.REVIEW && _state.value.reviewImageBytes == null) {
            refreshSubmissions(loadMeetingEvidence = true)
        }
    }

    private fun refreshSubmissions(
        loadMeetingEvidence: Boolean = false,
        loadThumbnails: Boolean = false,
        loadOwnTaskThumbnails: Boolean = false,
    ) {
        viewModelScope.launch {
            when (val result = gateway.submissions()) {
                is GatewayResult.Success -> {
                    val activeId = _state.value.activeSubmissionId
                    val active = result.value.firstOrNull { it.id == activeId }
                    val completedNow =
                        active?.processingStatus == "accepted" &&
                            _state.value.uploadStage != UploadStage.COMPLETE
                    update {
                        val currentIds =
                            result.value.mapTo(mutableSetOf()) { submission -> submission.id }
                        it.copy(
                            submissions = result.value,
                            evidenceImageBytes =
                                it.evidenceImageBytes.filterKeys(currentIds::contains),
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
                    if (completedNow && activeId != null) {
                        emitFeedback(GameFeedbackKind.TaskComplete, activeId)
                    }
                    if (loadMeetingEvidence) {
                        loadReviewImage(result.value)
                    }
                    if (loadThumbnails) loadEvidenceThumbnails(result.value)
                    if (loadOwnTaskThumbnails) {
                        val participantId = _state.value.snapshot?.self?.participantId
                        loadEvidenceThumbnails(
                            result.value.filter { submission ->
                                participantId != null &&
                                    submission.uploader.id == participantId &&
                                    submission.processingStatus == "accepted"
                            }
                        )
                    }
                }
                is GatewayResult.Failure -> update { it.copy(message = messageFor(result.error)) }
            }
        }
    }

    private suspend fun loadEvidenceThumbnails(
        submissions: List<com.impostergame.data.model.Submission>
    ) {
        submissions.forEach { submission ->
            val url = submission.image?.url ?: return@forEach
            if (_state.value.evidenceImageBytes.containsKey(submission.id)) return@forEach
            when (val image = gateway.loadImage(url)) {
                is GatewayResult.Success ->
                    update {
                        it.copy(
                            evidenceImageBytes =
                                it.evidenceImageBytes + (submission.id to image.value)
                        )
                    }
                is GatewayResult.Failure -> Unit
            }
        }
    }

    private fun updateCountdown() {
        val snapshot = _state.value.snapshot
        val now = clock.instant()
        val phaseRemaining = remainingSecondsUntil(snapshot?.phaseDeadlineAt, now)
        val killRemaining = remainingSecondsUntil(snapshot?.cooldowns?.killAvailableAt, now)
        val previousKillRemaining = _state.value.killCooldownRemainingSeconds
        update {
            it.copy(
                remainingSeconds = phaseRemaining,
                killCooldownRemainingSeconds = killRemaining,
            )
        }
        if (previousKillRemaining != null && previousKillRemaining > 0 && killRemaining == 0L) {
            emitFeedback(
                GameFeedbackKind.CooldownReady,
                "${snapshot?.id}:${snapshot?.cooldowns?.killAvailableAt}",
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

    /** Presentation-only result interaction; it never mutates authoritative game state. */
    fun playResultInteraction(revealed: Boolean) {
        emitFeedback(if (revealed) GameFeedbackKind.EasterEgg else GameFeedbackKind.Ui)
    }

    private fun emitFeedback(kind: GameFeedbackKind, stableId: String? = null) {
        _feedback.tryEmit(GameFeedbackEvent(kind, stableId))
    }

    private data class PendingUpload(
        val fingerprint: String,
        val intentKey: String,
        val confirmationKey: String,
    )

    private data class PendingAction(val fingerprint: String, val key: String)
}
