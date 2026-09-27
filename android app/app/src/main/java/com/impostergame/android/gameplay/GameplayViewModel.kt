package com.impostergame.android.gameplay

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.impostergame.android.entry.GatewayResult
import com.impostergame.android.entry.messageFor
import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.network.ApiFailure
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
        update { it.copy(previewImageBytes = null) }
    }

    private fun refresh(showLoading: Boolean = false, forceRoleSeal: Boolean = false) {
        if (showLoading) update { it.copy(loading = true) }
        viewModelScope.launch {
            when (val result = gateway.snapshot()) {
                is GatewayResult.Success -> {
                    applySnapshot(result.value, forceRoleSeal)
                    update { it.copy(loading = false) }
                }
                is GatewayResult.Failure ->
                    update { it.copy(loading = false, message = messageFor(result.error)) }
            }
        }
    }

    private fun applySnapshot(snapshot: GameSnapshot, forceRoleSeal: Boolean = false) {
        update { current ->
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
            )
        }
        updateCountdown()
    }

    private fun refreshSubmissions() {
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
    }

    private fun launchOnce(block: suspend () -> Unit) {
        if (_state.value.loading) return
        viewModelScope.launch {
            update { it.copy(loading = true) }
            try {
                block()
            } finally {
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
