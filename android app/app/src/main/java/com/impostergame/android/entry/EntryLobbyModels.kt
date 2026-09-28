package com.impostergame.android.entry

import com.impostergame.data.model.PublicTaskPack
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.designsystem.component.ConnectionState

enum class EntryDestination {
    BOOTSTRAP,
    HOME,
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
    val meetingCooldownSeconds: Int = 60,
    val imposterCooldownSeconds: Int = 60,
    val advancedExpanded: Boolean = false,
    val dirty: Boolean = false,
)

data class EntryLobbyUiState(
    val destination: EntryDestination = EntryDestination.BOOTSTRAP,
    val form: EntryForm = EntryForm(),
    val room: RoomSnapshot? = null,
    val taskPacks: List<PublicTaskPack> = emptyList(),
    val settings: LobbySettingsDraft = LobbySettingsDraft(),
    val loading: Boolean = false,
    val message: String? = null,
    val announce: String? = null,
    val confirmLeave: Boolean = false,
    val focusColorPicker: Boolean = false,
    val connectionState: ConnectionState = ConnectionState.Connected,
    val resumeFailed: Boolean = false,
    val validationTarget: EntryValidationTarget? = null,
) {
    val startBlockingReasons: List<String>
        get() {
            val snapshot = room ?: return listOf("Room details are still loading.")
            return buildList {
                if (settings.dirty) {
                    add("Apply pending settings.")
                }
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
