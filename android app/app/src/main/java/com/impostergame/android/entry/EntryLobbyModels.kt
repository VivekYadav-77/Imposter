package com.impostergame.android.entry

import com.impostergame.data.model.PublicTaskPack
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.designsystem.component.ConnectionState

enum class EntryDestination {
    BOOTSTRAP,
    HOME,
    SETTINGS,
    JOIN,
    CREATE,
    LOBBY,
    GAME,
    RESULTS,
}

enum class EntryValidationTarget {
    ROOM_CODE,
    NICKNAME,
    COLOR,
    CONSENTS,
}

data class EntryForm(
    val roomCode: String = "",
    val nickname: String = "",
    val minPlayers: Int = 3,
    val maxPlayers: Int = 15,
    val selectedColorId: String? = null,
    val ageAccepted: Boolean = false,
    val photoAccepted: Boolean = false,
    val privacyAccepted: Boolean = false,
    val availableColorIds: List<String> = emptyList(),
    val spotsRemaining: Int? = null,
    val codeError: String? = null,
    val nicknameError: String? = null,
) {
    val consentsAccepted: Boolean
        get() = ageAccepted && photoAccepted && privacyAccepted
}

data class LobbySettingsDraft(
    val selectedTaskPackId: String? = null,
    val taskPhaseMinutes: Int = 30,
    val meetingDurationSeconds: Int = 180,
    val meetingsPerPlayer: Int = 1,
    val meetingVotingMode: String = "timed",
    val voteVisibility: String = "private",
    val evidenceVisibility: String = "private",
    val imposterMeetingTaskRequirement: String = "none",
    val meetingCooldownSeconds: Int = 60,
    val imposterCooldownSeconds: Int = 60,
    val imposterCount: Int = 1,
    val taskCounts: Map<String, Int> = mapOf("easy" to 1, "medium" to 1, "hard" to 1),
    val roleCounts: Map<String, Int> = emptyMap(),
    val dirty: Boolean = false,
)

enum class SettingsSaveState {
    Clean,
    Dirty,
    Saving,
    Saved,
    Error,
}

data class EntryLobbyUiState(
    val destination: EntryDestination = EntryDestination.BOOTSTRAP,
    val form: EntryForm = EntryForm(),
    val room: RoomSnapshot? = null,
    val taskPacks: List<PublicTaskPack> = emptyList(),
    val settings: LobbySettingsDraft = LobbySettingsDraft(),
    val settingsSaveState: SettingsSaveState = SettingsSaveState.Clean,
    val loading: Boolean = false,
    val message: String? = null,
    val announce: String? = null,
    val confirmLeave: Boolean = false,
    val focusColorPicker: Boolean = false,
    val connectionState: ConnectionState = ConnectionState.Connected,
    val resumeFailed: Boolean = false,
    val validationTarget: EntryValidationTarget? = null,
) {
    val settingsValidationErrors: List<String>
        get() {
            val snapshot = room ?: return emptyList()
            val selectedPack = taskPacks.firstOrNull { it.id == settings.selectedTaskPackId }
            val totalTasks = settings.taskCounts.values.sum()
            val maximumCrew = (snapshot.participants.size - settings.imposterCount).coerceAtLeast(0)
            return buildList {
                if (settings.imposterCount !in snapshot.settings.allowedImposterCounts) {
                    add("Choose an allowed imposter count.")
                }
                if (totalTasks !in 1..15) add("Choose between 1 and 15 tasks per player.")
                if (selectedPack != null) {
                    val available =
                        mapOf(
                            "easy" to selectedPack.difficultyTaskCounts.easy,
                            "medium" to selectedPack.difficultyTaskCounts.medium,
                            "hard" to selectedPack.difficultyTaskCounts.hard,
                        )
                    settings.taskCounts.forEach { (difficulty, count) ->
                        if (count > (available[difficulty] ?: 0)) {
                            add("The selected map does not have enough $difficulty tasks.")
                        }
                    }
                    val roleNames = selectedPack.roles.map { it.name }.toSet()
                    if (settings.roleCounts.keys.any { it !in roleNames }) {
                        add("A selected crew role is not available on this map.")
                    }
                }
                if (settings.roleCounts.values.sum() > maximumCrew) {
                    add("Assigned crew roles exceed the available crewmates.")
                }
            }
        }

    val startBlockingReasons: List<String>
        get() {
            val snapshot = room ?: return listOf("Room details are still loading.")
            return buildList {
                if (settings.dirty) {
                    add("Apply pending settings.")
                }
                addAll(settingsValidationErrors)
                if (snapshot.participants.size < snapshot.minPlayers) {
                    val missing = snapshot.minPlayers - snapshot.participants.size
                    add("$missing more ${if (missing == 1) "player" else "players"} required.")
                }
                if (snapshot.participants.size > snapshot.maxPlayers) {
                    add("Too many players are in the room.")
                }
                if (!settings.dirty && snapshot.settings.selectedTaskPack == null) {
                    add("Select a published task pack.")
                }
            }
        }

    val canStart: Boolean
        get() = room?.self?.isHost == true && startBlockingReasons.isEmpty() && !loading
}

internal fun normalizeRoomCode(value: String): String =
    value.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }.take(6)

internal fun validateRoomCode(value: String): String? =
    if (value.length == 6) null else "Enter the six-character room code."

internal fun normalizeNickname(value: String): String = value.trim().replace(Regex("\\s+"), " ")

internal fun validateNickname(value: String): String? {
    val nickname = normalizeNickname(value)
    val length = nickname.codePointCount(0, nickname.length)
    return when {
        length !in 1..24 -> "Nickname must contain 1 to 24 characters."
        nickname.any { it.isISOControl() } -> "Nickname cannot contain control characters."
        else -> null
    }
}
