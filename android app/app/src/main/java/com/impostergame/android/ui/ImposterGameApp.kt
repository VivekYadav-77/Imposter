package com.impostergame.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.impostergame.android.entry.ConsentKind
import com.impostergame.android.entry.EntryDestination
import com.impostergame.android.entry.EntryLobbyUiState
import com.impostergame.android.entry.EntryLobbyViewModel
import com.impostergame.android.entry.LobbySettingsDraft
import com.impostergame.data.model.RoomParticipant
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.avatar.PlayerColors
import com.impostergame.designsystem.avatar.PlayerStatus
import com.impostergame.designsystem.component.GameButton
import com.impostergame.designsystem.component.GameOutlinedButton
import com.impostergame.designsystem.component.PlayerCard
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.ImposterGameTheme

@Composable
fun ImposterGameApp(
    viewModel: EntryLobbyViewModel,
    onCopyCode: (String) -> Unit,
    onShareCode: (String) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ImposterGameTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            when (state.destination) {
                EntryDestination.BOOTSTRAP -> LoadingScreen("Checking for an existing room…")
                EntryDestination.HOME ->
                    HomeScreen(state.message, viewModel::showJoin, viewModel::showCreate)
                EntryDestination.JOIN,
                EntryDestination.CREATE -> EntryScreen(state, viewModel)
                EntryDestination.LOBBY -> LobbyScreen(state, viewModel, onCopyCode, onShareCode)
                EntryDestination.GAME ->
                    PlaceholderScreen("Game starting", "Your role is being prepared.")
                EntryDestination.RESULTS ->
                    PlaceholderScreen("Game results", "Your results are ready.")
            }
        }
    }
}

@Composable
private fun HomeScreen(message: String?, onJoin: () -> Unit, onCreate: () -> Unit) {
    CenteredScrollableColumn {
        PlayerAvatar("wolf", 112.dp, "Imposter Game")
        Text(
            "Ready to play?",
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Black,
        )
        Text(
            "Join friends in a private room. No account needed.",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Message(message)
        GameButton("Join room", onJoin, Modifier.fillMaxWidth())
        GameOutlinedButton("Create room", onCreate, Modifier.fillMaxWidth())
        HorizontalDivider(Modifier.padding(vertical = GameSpacing.sm))
        Text("How to play  •  Privacy  •  Accessibility  •  Settings")
    }
}

@Composable
private fun EntryScreen(state: EntryLobbyUiState, viewModel: EntryLobbyViewModel) {
    val joining = state.destination == EntryDestination.JOIN
    val focusManager = LocalFocusManager.current
    val colorFocus = FocusRequester()
    LaunchedEffect(state.focusColorPicker) {
        if (state.focusColorPicker) colorFocus.requestFocus()
    }
    Scaffold(
        modifier = Modifier.safeDrawingPadding().imePadding(),
        topBar = {
            Row(
                modifier = Modifier.fillMaxWidth().padding(GameSpacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = viewModel::showHome) { Text("Back") }
                Text(
                    if (joining) "Join room" else "Create room",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
            }
        },
        bottomBar = {
            Surface(shadowElevation = 8.dp) {
                GameButton(
                    if (joining) "Join room" else "Create room",
                    viewModel::submitEntry,
                    Modifier.fillMaxWidth().padding(GameSpacing.md),
                    loading = state.loading,
                )
            }
        },
    ) { padding ->
        Column(
            modifier =
                Modifier.padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(GameSpacing.lg)
                    .widthIn(max = 680.dp)
                    .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
        ) {
            if (joining) {
                OutlinedTextField(
                    value = state.form.roomCode,
                    onValueChange = viewModel::setCode,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Room code") },
                    supportingText = { Text(state.form.codeError ?: "Six letters or numbers") },
                    isError = state.form.codeError != null,
                    singleLine = true,
                    keyboardOptions =
                        KeyboardOptions(
                            capitalization = KeyboardCapitalization.Characters,
                            imeAction = ImeAction.Next,
                        ),
                    keyboardActions = KeyboardActions(onNext = { viewModel.fetchJoinOptions() }),
                )
                GameOutlinedButton(
                    "Check room",
                    viewModel::fetchJoinOptions,
                    Modifier.fillMaxWidth(),
                    enabled = !state.loading,
                )
                state.form.spotsRemaining?.let { Text("$it spot(s) remaining") }
            }
            OutlinedTextField(
                value = state.form.nickname,
                onValueChange = viewModel::setNickname,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Nickname") },
                supportingText = { Text(state.form.nicknameError ?: "1–24 characters") },
                isError = state.form.nicknameError != null,
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                keyboardActions =
                    KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
            )
            ColorPicker(
                state.form.availableColorIds,
                state.form.selectedColorId,
                viewModel::setColor,
                Modifier.focusRequester(colorFocus).focusable(),
            )
            ConsentRow("I meet the age requirement.", state.form.ageAccepted) {
                viewModel.setConsent(ConsentKind.AGE, it)
            }
            ConsentRow(
                "I have permission to capture and share game photos.",
                state.form.photoAccepted,
            ) {
                viewModel.setConsent(ConsentKind.PHOTO, it)
            }
            ConsentRow("I accept the privacy notice.", state.form.privacyAccepted) {
                viewModel.setConsent(ConsentKind.PRIVACY, it)
            }
            Message(state.message)
            Spacer(Modifier.height(GameSpacing.xl))
        }
    }
}

@Composable
private fun ColorPicker(
    ids: List<String>,
    selectedId: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
        Text(
            "Player color",
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        if (ids.isEmpty()) {
            Text("Check the room to see available colors.")
        } else {
            ids.chunked(4).forEach { rowIds ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    rowIds.forEach { id ->
                        val color = PlayerColors.fromTransportId(id)
                        val label = androidx.compose.ui.res.stringResource(color.nameResource)
                        Box(
                            modifier =
                                Modifier.selectable(
                                        selected = id == selectedId,
                                        onClick = { onSelect(id) },
                                    )
                                    .padding(GameSpacing.xs)
                        ) {
                            PlayerAvatar(id, 58.dp, label, selected = id == selectedId)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConsentRow(label: String, checked: Boolean, onChecked: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable { onChecked(!checked) },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, onCheckedChange = onChecked)
        Text(label, modifier = Modifier.padding(start = GameSpacing.xs))
    }
}

@Composable
private fun LobbyScreen(
    state: EntryLobbyUiState,
    viewModel: EntryLobbyViewModel,
    onCopyCode: (String) -> Unit,
    onShareCode: (String) -> Unit,
) {
    val room = state.room ?: return LoadingScreen("Loading lobby…")
    if (state.confirmLeave) {
        AlertDialog(
            onDismissRequest = viewModel::dismissLeave,
            title = { Text(if (room.self.isHost) "Leave as host?" else "Leave room?") },
            text = {
                Text(
                    if (room.self.isHost) {
                        "Hosting may transfer or the room may end. This removes your seat."
                    } else {
                        "This removes your seat from the room."
                    }
                )
            },
            confirmButton = {
                TextButton(onClick = viewModel::confirmLeave) { Text("Leave room") }
            },
            dismissButton = { TextButton(onClick = viewModel::dismissLeave) { Text("Cancel") } },
        )
    }
    state.announce?.let { announcement ->
        LaunchedEffect(announcement) {
            kotlinx.coroutines.delay(2_000)
            viewModel.clearAnnouncement()
        }
    }
    BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
        val twoPane = maxWidth >= 600.dp || maxHeight < 480.dp
        Column(Modifier.fillMaxSize()) {
            LobbyHeader(room, onCopyCode, onShareCode, viewModel::requestLeave)
            Message(state.announce, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            Message(state.message)
            if (twoPane) {
                Row(Modifier.weight(1f).fillMaxWidth()) {
                    Roster(room, Modifier.weight(1f).fillMaxHeight())
                    LobbySettings(state, viewModel, Modifier.weight(1f).fillMaxHeight())
                }
            } else {
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                    Roster(room, scrollable = false)
                    LobbySettings(state, viewModel, scrollable = false)
                }
            }
            LobbyAction(state, viewModel)
        }
    }
}

@Composable
private fun LobbyHeader(
    room: RoomSnapshot,
    onCopy: (String) -> Unit,
    onShare: (String) -> Unit,
    onLeave: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(GameSpacing.md),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
    ) {
        Text("Room code", style = MaterialTheme.typography.labelLarge)
        Text(
            room.code,
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Black,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
            GameOutlinedButton("Copy", { onCopy(room.code) })
            GameOutlinedButton("Share", { onShare(room.code) })
            TextButton(onClick = onLeave) { Text("Leave") }
        }
    }
}

@Composable
private fun Roster(
    room: RoomSnapshot,
    modifier: Modifier = Modifier,
    scrollable: Boolean = true,
) {
    val contentModifier =
        if (scrollable) modifier.verticalScroll(rememberScrollState()) else modifier
    Column(
        modifier = contentModifier.padding(GameSpacing.md),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
    ) {
        Text(
            "Players (${room.participants.size}/${room.maxPlayers})",
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        room.participants.forEach { participant -> ParticipantRow(participant, room) }
    }
}

@Composable
private fun ParticipantRow(participant: RoomParticipant, room: RoomSnapshot) {
    PlayerCard(
        nickname = participant.nickname,
        playerColorId = participant.avatarId,
        isHost = participant.isHost,
        isSelf = participant.id == room.self.participantId,
        status =
            if (participant.presence == "away") PlayerStatus.Disconnected
            else if (participant.isHost) PlayerStatus.Host
            else if (participant.id == room.self.participantId) PlayerStatus.Self else null,
    )
}

@Composable
private fun LobbySettings(
    state: EntryLobbyUiState,
    viewModel: EntryLobbyViewModel,
    modifier: Modifier = Modifier,
    scrollable: Boolean = true,
) {
    val room = state.room ?: return
    val contentModifier =
        if (scrollable) modifier.verticalScroll(rememberScrollState()) else modifier
    Column(
        modifier = contentModifier.padding(GameSpacing.md),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
    ) {
        Text(
            if (room.self.isHost) "Game setup" else "Waiting for host",
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        SetupChecklist(state)
        if (room.self.isHost) {
            TaskPackPicker(state, viewModel)
            NumberSetting(
                "Task phase (minutes)",
                state.settings.taskPhaseMinutes,
                5,
                240,
                viewModel::updateTaskMinutes,
            )
            NumberSetting(
                "Meeting duration (seconds)",
                state.settings.meetingDurationSeconds,
                30,
                1800,
                viewModel::updateMeetingSeconds,
            )
            TextButton(onClick = viewModel::toggleAdvanced) {
                Text(
                    if (state.settings.advancedExpanded) "Hide advanced settings"
                    else "Show advanced settings"
                )
            }
            if (state.settings.advancedExpanded) AdvancedSettingsSummary(state.settings)
            GameOutlinedButton(
                "Apply settings",
                viewModel::applySettings,
                Modifier.fillMaxWidth(),
                enabled = state.settings.dirty && !state.loading,
            )
        } else {
            Text("The host controls settings and starts the game.")
        }
    }
}

@Composable
private fun SetupChecklist(state: EntryLobbyUiState) {
    val room = state.room ?: return
    Card(Modifier.fillMaxWidth()) {
        Column(
            Modifier.padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
        ) {
            Text("Setup checklist", fontWeight = FontWeight.Bold)
            ChecklistItem(
                room.participants.size >= room.minPlayers,
                "At least ${room.minPlayers} players (${room.participants.size} joined)",
            )
            ChecklistItem(
                room.settings.selectedTaskPack != null,
                room.settings.selectedTaskPack?.let { "Task pack: ${it.name}" }
                    ?: "Choose a published task pack",
            )
            ChecklistItem(true, "Task phase: ${room.settings.taskPhaseSeconds / 60} minutes")
            ChecklistItem(
                true,
                "Meeting: ${room.settings.meetingDurationSeconds} seconds, ${room.settings.meetingVotingMode.replace('_', ' ')}",
            )
            ChecklistItem(
                true,
                "Votes ${room.settings.voteVisibility}; evidence ${room.settings.evidenceVisibility}",
            )
            ChecklistItem(true, "Meeting limit: ${room.settings.meetingsPerPlayer} per player")
        }
    }
}

@Composable
private fun ChecklistItem(done: Boolean, text: String) {
    Text(
        "${if (done) "✓" else "○"} $text",
        color = if (done) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error,
    )
}

@Composable
private fun TaskPackPicker(state: EntryLobbyUiState, viewModel: EntryLobbyViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xs)) {
        Text("Task pack", fontWeight = FontWeight.Bold)
        if (state.taskPacks.isEmpty()) Text("No published task packs available.")
        state.taskPacks.forEach { pack ->
            Row(
                Modifier.fillMaxWidth()
                    .selectable(
                        selected = state.settings.selectedTaskPackId == pack.id,
                        onClick = { viewModel.selectTaskPack(pack.id) },
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(
                    selected = state.settings.selectedTaskPackId == pack.id,
                    onClick = { viewModel.selectTaskPack(pack.id) },
                )
                Column {
                    Text(pack.name)
                    Text(
                        "${pack.activeTaskCount} tasks",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun NumberSetting(
    label: String,
    value: Int,
    minimum: Int,
    maximum: Int,
    onChange: (Int) -> Unit,
) {
    OutlinedTextField(
        value = value.toString(),
        onValueChange = { text ->
            text.toIntOrNull()?.let { onChange(it.coerceIn(minimum, maximum)) }
        },
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        supportingText = { Text("$minimum–$maximum") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        singleLine = true,
    )
}

@Composable
private fun AdvancedSettingsSummary(settings: LobbySettingsDraft) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(GameSpacing.md)) {
            Text("Meeting mode: ${settings.meetingVotingMode.replace('_', ' ')}")
            Text("Vote visibility: ${settings.voteVisibility}")
            Text("Evidence visibility: ${settings.evidenceVisibility}")
            Text("Meeting cooldown: ${settings.meetingCooldownSeconds} seconds")
            Text("Imposter cooldown: ${settings.imposterCooldownSeconds} seconds")
        }
    }
}

@Composable
private fun LobbyAction(state: EntryLobbyUiState, viewModel: EntryLobbyViewModel) {
    val host = state.room?.self?.isHost == true
    Surface(shadowElevation = 8.dp, modifier = Modifier.fillMaxWidth().imePadding()) {
        Column(
            Modifier.padding(GameSpacing.md),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (host) {
                if (state.startBlockingReasons.isNotEmpty()) {
                    Text(
                        state.startBlockingReasons.joinToString(" "),
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                    )
                }
                GameButton(
                    "Start game",
                    viewModel::startGame,
                    Modifier.fillMaxWidth().widthIn(max = 680.dp),
                    enabled = state.canStart,
                    loading = state.loading,
                )
            } else {
                Text("Waiting for host to start", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun Message(message: String?, modifier: Modifier = Modifier) {
    if (message != null) {
        Text(
            message,
            modifier =
                modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant, GameShapes.small)
                    .padding(GameSpacing.sm),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun LoadingScreen(label: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(Modifier.size(40.dp))
            Text(label, Modifier.padding(top = GameSpacing.md))
        }
    }
}

@Composable
private fun PlaceholderScreen(title: String, body: String) {
    CenteredScrollableColumn {
        Text(title, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(body)
    }
}

@Composable
private fun CenteredScrollableColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier =
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(GameSpacing.xl),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.md, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
        content = content,
    )
}
