package com.impostergame.android.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
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
import com.impostergame.android.entry.EntryValidationTarget
import com.impostergame.android.feedback.GameFeedbackEvent
import com.impostergame.android.gameplay.GameplayViewModel
import com.impostergame.android.preferences.AppPreferences
import com.impostergame.android.preferences.ThemeMode
import com.impostergame.data.model.RoomParticipant
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.avatar.PlayerColors
import com.impostergame.designsystem.avatar.PlayerStatus
import com.impostergame.designsystem.component.BrandHeader
import com.impostergame.designsystem.component.ConnectionState
import com.impostergame.designsystem.component.GameButton
import com.impostergame.designsystem.component.GameEyebrow
import com.impostergame.designsystem.component.GameOutlinedButton
import com.impostergame.designsystem.component.PlayerCard
import com.impostergame.designsystem.component.SignalBackground
import com.impostergame.designsystem.component.SignalCard
import com.impostergame.designsystem.component.SignalChip
import com.impostergame.designsystem.theme.GameAccessibilityPreferences
import com.impostergame.designsystem.theme.GameMotion
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.ImposterGameTheme
import com.impostergame.designsystem.theme.LocalGameAccessibilityPreferences
import com.impostergame.designsystem.theme.gameColors

@Composable
fun ImposterGameApp(
    viewModel: EntryLobbyViewModel,
    gameplayViewModel: GameplayViewModel,
    onCopyCode: (String) -> Unit,
    onShareCode: (String) -> Unit,
    onShareDiagnostics: () -> Unit,
    preferences: AppPreferences,
    onThemeModeChanged: (ThemeMode) -> Unit,
    onSoundChanged: (Boolean) -> Unit,
    onHapticsChanged: (Boolean) -> Unit,
    onReduceMotionChanged: (Boolean) -> Unit,
    onHighContrastChanged: (Boolean) -> Unit,
    onResolvedDarkTheme: (Boolean) -> Unit,
    onFeedback: (GameFeedbackEvent) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(viewModel) { viewModel.feedback.collect(onFeedback) }
    LaunchedEffect(gameplayViewModel) { gameplayViewModel.feedback.collect(onFeedback) }
    val systemDark = isSystemInDarkTheme()
    val darkTheme =
        when (preferences.themeMode) {
            ThemeMode.System -> systemDark
            ThemeMode.Light -> false
            ThemeMode.Dark -> true
        }
    SideEffect { onResolvedDarkTheme(darkTheme) }
    ImposterGameTheme(
        darkTheme = darkTheme,
        accessibilityPreferences =
            GameAccessibilityPreferences(
                reduceMotion = preferences.reduceMotion,
                soundEnabled = preferences.soundEnabled,
                hapticsEnabled = preferences.hapticsEnabled,
                highContrast = preferences.highContrast,
            ),
    ) {
        Surface(modifier = Modifier.fillMaxSize()) {
            when (state.destination) {
                EntryDestination.BOOTSTRAP -> LoadingScreen("Checking for an existing room…")
                EntryDestination.HOME ->
                    HomeScreen(
                        state.message,
                        state.resumeFailed,
                        state.loading,
                        viewModel::showJoin,
                        viewModel::showCreate,
                        viewModel::showSettings,
                        viewModel::bootstrap,
                        onShareDiagnostics,
                    )
                EntryDestination.SETTINGS ->
                    SettingsScreen(
                        preferences = preferences,
                        onBack = viewModel::showHome,
                        onThemeModeChanged = onThemeModeChanged,
                        onSoundChanged = onSoundChanged,
                        onHapticsChanged = onHapticsChanged,
                        onReduceMotionChanged = onReduceMotionChanged,
                        onHighContrastChanged = onHighContrastChanged,
                    )
                EntryDestination.JOIN,
                EntryDestination.CREATE -> EntryScreen(state, viewModel)
                EntryDestination.LOBBY -> LobbyScreen(state, viewModel, onCopyCode, onShareCode)
                EntryDestination.GAME ->
                    GameplayScreen(gameplayViewModel) {
                        gameplayViewModel.clearForHome()
                        viewModel.exitResults()
                    }
                EntryDestination.RESULTS ->
                    GameplayScreen(gameplayViewModel) {
                        gameplayViewModel.clearForHome()
                        viewModel.exitResults()
                    }
            }
        }
    }
}

@Composable
private fun HomeScreen(
    message: String?,
    resumeFailed: Boolean,
    loading: Boolean,
    onJoin: () -> Unit,
    onCreate: () -> Unit,
    onSettings: () -> Unit,
    onRetry: () -> Unit,
    onShareDiagnostics: () -> Unit,
) {
    var confirmDiagnostics by remember { mutableStateOf(false) }
    if (confirmDiagnostics) {
        AlertDialog(
            onDismissRequest = { confirmDiagnostics = false },
            title = { Text("Share support diagnostics?") },
            text = {
                Text(
                    "This shares the app version, environment, network status, and recent " +
                        "request IDs. It does not include your room, role, votes, photos, or token."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmDiagnostics = false
                        onShareDiagnostics()
                    }
                ) {
                    Text("Continue")
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDiagnostics = false }) { Text("Cancel") }
            },
        )
    }
    SignalBackground {
        Column(
            modifier =
                Modifier.fillMaxSize()
                    .safeDrawingPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(GameSpacing.lg)
                    .widthIn(max = 760.dp)
                    .align(Alignment.TopCenter),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.lg),
        ) {
            BrandHeader()
            GameEyebrow("A live social deduction game")
            Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xs)) {
                Text(
                    "Everyone’s watching.",
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    "Someone’s lying.",
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.gameColors.accentStrong,
                )
            }
            Text(
                "Join friends, finish missions, read the room, and expose the imposters before the final vote.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
            ) {
                SignalChip("18+")
                SignalChip("Private rooms", Modifier.weight(1f))
                SignalChip("Photos auto-delete", Modifier.weight(1f))
            }
            SignalCard(Modifier.fillMaxWidth(), emphasized = true) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(GameSpacing.lg),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(GameSpacing.lg),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        PlayerAvatar("wolf", 104.dp, "Crewmate")
                        SignalChip("LIVE", Modifier.align(Alignment.BottomCenter))
                    }
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
                    ) {
                        GameEyebrow("No account needed")
                        Text(
                            "Your next room is one code away.",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "Fast entry, clear phases, private roles, and a decisive result.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Message(message)
            if (resumeFailed) {
                GameButton(
                    "Retry secure resume",
                    onRetry,
                    Modifier.fillMaxWidth(),
                    loading = loading,
                )
            }
            GameButton("Join a room  →", onJoin, Modifier.fillMaxWidth())
            GameOutlinedButton("Create a private room", onCreate, Modifier.fillMaxWidth())
            GameOutlinedButton("App settings", onSettings, Modifier.fillMaxWidth())
            SignalCard(Modifier.fillMaxWidth()) {
                Column(
                    Modifier.padding(GameSpacing.md),
                    verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
                ) {
                    GameEyebrow("Privacy by design")
                    Text(
                        "Roles stay private, room access is controlled, and game photos are removed automatically.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            TextButton(
                modifier = Modifier.align(Alignment.CenterHorizontally),
                onClick = { confirmDiagnostics = true },
            ) {
                Text("Share support diagnostics")
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    preferences: AppPreferences,
    onBack: () -> Unit,
    onThemeModeChanged: (ThemeMode) -> Unit,
    onSoundChanged: (Boolean) -> Unit,
    onHapticsChanged: (Boolean) -> Unit,
    onReduceMotionChanged: (Boolean) -> Unit,
    onHighContrastChanged: (Boolean) -> Unit,
) {
    SignalBackground {
        Scaffold(
            modifier = Modifier.fillMaxSize().safeDrawingPadding(),
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            topBar = {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(GameSpacing.md),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm),
                ) {
                    TextButton(onClick = onBack) { Text("Back") }
                    Text(
                        "App settings",
                        modifier = Modifier.semantics { heading() },
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
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
                BrandHeader()
                GameEyebrow("Make the room yours")
                Text(
                    "App settings",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Black,
                )
                Text("Appearance", style = MaterialTheme.typography.titleLarge)
                Text(
                    "Choose how the game looks on this device.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                SignalCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(GameSpacing.md)) {
                        ThemeMode.entries.forEach { mode ->
                            val label =
                                when (mode) {
                                    ThemeMode.System -> "Follow device"
                                    ThemeMode.Light -> "Light"
                                    ThemeMode.Dark -> "Dark"
                                }
                            Row(
                                modifier =
                                    Modifier.fillMaxWidth()
                                        .selectable(
                                            selected = preferences.themeMode == mode,
                                            role = Role.RadioButton,
                                            onClick = { onThemeModeChanged(mode) },
                                        )
                                        .padding(vertical = GameSpacing.sm),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm),
                            ) {
                                RadioButton(
                                    selected = preferences.themeMode == mode,
                                    onClick = null,
                                )
                                Text(label, style = MaterialTheme.typography.bodyLarge)
                            }
                        }
                    }
                }
                GameEyebrow("Feedback and accessibility")
                SignalCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(horizontal = GameSpacing.md)) {
                        PreferenceSwitchRow(
                            title = "Game sounds",
                            description =
                                "Play short cues for game events. Important states still appear on screen.",
                            checked = preferences.soundEnabled,
                            onChecked = onSoundChanged,
                        )
                        PreferenceSwitchRow(
                            title = "Haptic feedback",
                            description =
                                "Use optional touch feedback for confirmations and alerts.",
                            checked = preferences.hapticsEnabled,
                            onChecked = onHapticsChanged,
                        )
                        PreferenceSwitchRow(
                            title = "Reduce motion",
                            description = "Remove nonessential movement and animated emphasis.",
                            checked = preferences.reduceMotion,
                            onChecked = onReduceMotionChanged,
                        )
                        PreferenceSwitchRow(
                            title = "High contrast",
                            description =
                                "Increase text and boundary contrast in the selected theme.",
                            checked = preferences.highContrast,
                            onChecked = onHighContrastChanged,
                        )
                    }
                }
                Text(
                    "These preferences stay on this device and never contain room, role, vote, or photo data.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun PreferenceSwitchRow(
    title: String,
    description: String,
    checked: Boolean,
    onChecked: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .toggleable(
                    value = checked,
                    role = Role.Switch,
                    onValueChange = onChecked,
                )
                .padding(vertical = GameSpacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(GameSpacing.md),
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            Text(
                description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = checked, onCheckedChange = null)
    }
}

@Composable
private fun EntryScreen(state: EntryLobbyUiState, viewModel: EntryLobbyViewModel) {
    val joining = state.destination == EntryDestination.JOIN
    val focusManager = LocalFocusManager.current
    val scrollState = rememberScrollState()
    val codeFocus = remember { FocusRequester() }
    val nicknameFocus = remember { FocusRequester() }
    val colorFocus = remember { FocusRequester() }
    LaunchedEffect(state.focusColorPicker) {
        if (state.focusColorPicker) colorFocus.requestFocus()
    }
    LaunchedEffect(state.validationTarget) {
        when (state.validationTarget) {
            EntryValidationTarget.ROOM_CODE -> {
                scrollState.animateScrollTo(0)
                codeFocus.requestFocus()
            }
            EntryValidationTarget.NICKNAME -> {
                scrollState.animateScrollTo(0)
                nicknameFocus.requestFocus()
            }
            EntryValidationTarget.COLOR -> {
                scrollState.animateScrollTo(scrollState.maxValue / 2)
                colorFocus.requestFocus()
            }
            EntryValidationTarget.CONSENTS -> scrollState.animateScrollTo(scrollState.maxValue)
            null -> Unit
        }
    }
    SignalBackground {
        Scaffold(
            modifier = Modifier.fillMaxSize().safeDrawingPadding().imePadding(),
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
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
                Surface(shadowElevation = 8.dp, color = MaterialTheme.gameColors.surfaceHighest) {
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
                        .verticalScroll(scrollState)
                        .padding(GameSpacing.lg)
                        .widthIn(max = 680.dp)
                        .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
            ) {
                BrandHeader()
                GameEyebrow(if (joining) "Enter a private room" else "Host a private room")
                Text(
                    if (joining) "Step into the room." else "Set the stage.",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    if (joining) "Use the invite code, choose your identity, and join the crew."
                    else "Choose your identity now. You can tune the game once the lobby opens.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (joining) {
                    OutlinedTextField(
                        value = state.form.roomCode,
                        onValueChange = viewModel::setCode,
                        modifier = Modifier.fillMaxWidth().focusRequester(codeFocus),
                        label = { Text("Room code") },
                        supportingText = { Text(state.form.codeError ?: "Six letters or numbers") },
                        isError = state.form.codeError != null,
                        singleLine = true,
                        keyboardOptions =
                            KeyboardOptions(
                                capitalization = KeyboardCapitalization.Characters,
                                imeAction = ImeAction.Next,
                            ),
                        keyboardActions =
                            KeyboardActions(onNext = { viewModel.fetchJoinOptions() }),
                    )
                    GameOutlinedButton(
                        "Check room",
                        viewModel::fetchJoinOptions,
                        Modifier.fillMaxWidth(),
                        enabled = !state.loading,
                    )
                    state.form.spotsRemaining?.let {
                        Text("$it ${if (it == 1) "spot" else "spots"} remaining")
                    }
                }
                OutlinedTextField(
                    value = state.form.nickname,
                    onValueChange = viewModel::setNickname,
                    modifier = Modifier.fillMaxWidth().focusRequester(nicknameFocus),
                    label = { Text("Nickname") },
                    supportingText = { Text(state.form.nicknameError ?: "1–24 characters") },
                    isError = state.form.nicknameError != null,
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                    keyboardActions =
                        KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
                )
                SignalCard(Modifier.fillMaxWidth()) {
                    ColorPicker(
                        state.form.availableColorIds,
                        state.form.selectedColorId,
                        viewModel::setColor,
                        Modifier.focusRequester(colorFocus).focusable().padding(GameSpacing.md),
                    )
                }
                GameEyebrow("Consent and privacy")
                SignalCard(Modifier.fillMaxWidth()) {
                    Column(
                        Modifier.padding(GameSpacing.md),
                        verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
                    ) {
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
                    }
                }
                Message(
                    state.message,
                    Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                )
                Spacer(Modifier.height(GameSpacing.xl))
            }
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
                                        role = Role.RadioButton,
                                        onClick = { onSelect(id) },
                                    )
                                    .semantics(mergeDescendants = true) {
                                        contentDescription = label
                                    }
                                    .padding(GameSpacing.xs)
                        ) {
                            PlayerAvatar(
                                id,
                                58.dp,
                                label,
                                modifier = Modifier.clearAndSetSemantics {},
                                selected = id == selectedId,
                            )
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
        modifier =
            Modifier.fillMaxWidth()
                .toggleable(
                    value = checked,
                    role = Role.Checkbox,
                    onValueChange = onChecked,
                )
                .semantics(mergeDescendants = true) { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = null,
            modifier = Modifier.clearAndSetSemantics {},
        )
        Text(
            label,
            modifier = Modifier.padding(start = GameSpacing.xs).clearAndSetSemantics {},
        )
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
    SignalBackground(accent = MaterialTheme.gameColors.lobby) {
        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
            val twoPane = maxWidth >= 600.dp || maxHeight < 480.dp
            Column(Modifier.fillMaxSize()) {
                LobbyHeader(room, onCopyCode, onShareCode, viewModel::requestLeave)
                if (state.connectionState != ConnectionState.Connected) {
                    Message(
                        if (state.connectionState == ConnectionState.Offline) {
                            "Offline. Room details will refresh when the connection returns."
                        } else {
                            "Reconnecting. You can still read the latest room details."
                        },
                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    )
                }
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
}

@Composable
private fun LobbyHeader(
    room: RoomSnapshot,
    onCopy: (String) -> Unit,
    onShare: (String) -> Unit,
    onLeave: () -> Unit,
) {
    SignalCard(
        modifier = Modifier.fillMaxWidth().padding(GameSpacing.md),
        accent = MaterialTheme.gameColors.lobby,
        emphasized = true,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(GameSpacing.md),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
        ) {
            Text(
                "LOBBY INVITE",
                color = MaterialTheme.gameColors.lobby,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
            )
            Text("Room code", style = MaterialTheme.typography.labelLarge)
            Text(
                room.code,
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Black,
            )
            Text(
                "Share this code only with people you want in the game.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
                GameOutlinedButton("Copy", { onCopy(room.code) })
                GameOutlinedButton("Share", { onShare(room.code) })
                TextButton(onClick = onLeave) { Text("Leave") }
            }
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
        val joined = room.participants.size
        val startProgress = (joined.toFloat() / room.minPlayers).coerceIn(0f, 1f)
        Text(
            "Players ($joined/${room.maxPlayers})",
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        Text(
            if (joined >= room.minPlayers) {
                "Enough players have joined. The host can start when settings are valid."
            } else {
                "${room.minPlayers - joined} more ${if (room.minPlayers - joined == 1) "player" else "players"} needed to start."
            },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        LinearProgressIndicator(
            progress = { startProgress },
            modifier =
                Modifier.fillMaxWidth().semantics {
                    contentDescription = "$joined of ${room.minPlayers} players needed to start"
                },
            color = MaterialTheme.gameColors.lobby,
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
        status = if (participant.presence == "away") PlayerStatus.Disconnected else null,
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
            TextButton(onClick = viewModel::toggleAdvanced) {
                Text(
                    if (state.settings.advancedExpanded) "Hide advanced settings"
                    else "Show advanced settings"
                )
            }
            val reduceMotion = LocalGameAccessibilityPreferences.current.reduceMotion
            AnimatedVisibility(
                visible = state.settings.advancedExpanded,
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
                AdvancedSettings(state, viewModel)
            }
        } else {
            Text("The host controls settings and starts the game.")
        }
    }
}

@Composable
private fun SetupChecklist(state: EntryLobbyUiState) {
    val room = state.room ?: return
    val selectedTaskPack = room.settings.selectedTaskPack
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
                !state.settings.dirty && selectedTaskPack != null,
                when {
                    state.settings.dirty -> "Apply pending settings"
                    selectedTaskPack != null -> "Task pack: ${selectedTaskPack.name}"
                    else -> "Choose a published task pack"
                },
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
                        role = Role.RadioButton,
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(
                    selected = state.settings.selectedTaskPackId == pack.id,
                    onClick = null,
                    modifier = Modifier.clearAndSetSemantics {},
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
    Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xs)) {
        Text(label, fontWeight = FontWeight.Bold)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
        ) {
            GameOutlinedButton(
                "−",
                { onChange((value - 1).coerceAtLeast(minimum)) },
                Modifier.size(52.dp),
                enabled = value > minimum,
            )
            OutlinedTextField(
                value = value.toString(),
                onValueChange = { text ->
                    text.toIntOrNull()?.let { onChange(it.coerceIn(minimum, maximum)) }
                },
                modifier = Modifier.weight(1f),
                supportingText = { Text("$minimum–$maximum") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
            )
            GameOutlinedButton(
                "+",
                { onChange((value + 1).coerceAtMost(maximum)) },
                Modifier.size(52.dp),
                enabled = value < maximum,
            )
        }
    }
}

@Composable
private fun AdvancedSettings(state: EntryLobbyUiState, viewModel: EntryLobbyViewModel) {
    val settings = state.settings
    val room = state.room ?: return
    val selectedPack = state.taskPacks.firstOrNull { it.id == settings.selectedTaskPackId }
    Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.lg)) {
        Text("Meeting voting", style = MaterialTheme.typography.titleLarge)
        ChoiceSetting(
            label = "Voting rule",
            value = settings.meetingVotingMode,
            choices =
                listOf(
                    "timed" to "Timed — voting ends when the timer expires",
                    "all_voted" to "All voted — end after every eligible ballot",
                ),
            onChange = viewModel::updateMeetingVotingMode,
        )
        if (settings.meetingVotingMode == "timed") {
            NumberSetting(
                "Meeting duration (seconds)",
                settings.meetingDurationSeconds,
                30,
                1800,
                viewModel::updateMeetingSeconds,
            )
        }
        ChoiceSetting(
            label = "Ballot visibility",
            value = settings.voteVisibility,
            choices =
                listOf(
                    "private" to "Private — show totals without individual choices",
                    "public" to "Public — show who voted for whom",
                ),
            onChange = viewModel::updateVoteVisibility,
        )
        ChoiceSetting(
            label = "Evidence visibility",
            value = settings.evidenceVisibility,
            choices =
                listOf(
                    "private" to "Private — players see only authorized photos",
                    "public" to "Shared — everyone can view accepted task photos",
                ),
            onChange = viewModel::updateEvidenceVisibility,
        )

        HorizontalDivider()
        Text("Game balance", style = MaterialTheme.typography.titleLarge)
        NumberSetting(
            "Meetings per player",
            settings.meetingsPerPlayer,
            0,
            10,
            viewModel::updateMeetingsPerPlayer,
        )
        NumberSetting(
            "Meeting cooldown (seconds)",
            settings.meetingCooldownSeconds,
            10,
            1800,
            viewModel::updateMeetingCooldown,
        )
        NumberSetting(
            "Imposter cooldown base (seconds)",
            settings.imposterCooldownSeconds,
            10,
            300,
            viewModel::updateImposterCooldown,
        )
        ChoiceSetting(
            label = "Imposter task needed to call a meeting",
            value = settings.imposterMeetingTaskRequirement,
            choices =
                listOf(
                    "one" to "One task — complete a task before calling",
                    "none" to "No task — cooldown and capability still apply",
                ),
            onChange = viewModel::updateImposterMeetingTaskRequirement,
        )
        val allowedImposters = room.settings.allowedImposterCounts
        NumberSetting(
            "Imposters",
            settings.imposterCount,
            allowedImposters.minOrNull() ?: 1,
            allowedImposters.maxOrNull() ?: 1,
            viewModel::updateImposterCount,
        )

        HorizontalDivider()
        Text("Tasks per player", style = MaterialTheme.typography.titleLarge)
        if (selectedPack == null) {
            Text("Choose a task pack before configuring task quantities.")
        } else {
            val available =
                mapOf(
                    "easy" to selectedPack.difficultyTaskCounts.easy,
                    "medium" to selectedPack.difficultyTaskCounts.medium,
                    "hard" to selectedPack.difficultyTaskCounts.hard,
                )
            listOf("easy", "medium", "hard").forEach { difficulty ->
                val otherTotal = settings.taskCounts.filterKeys { it != difficulty }.values.sum()
                NumberSetting(
                    difficulty.replaceFirstChar(Char::uppercase),
                    settings.taskCounts[difficulty] ?: 0,
                    0,
                    minOf(available.getValue(difficulty), (15 - otherTotal).coerceAtLeast(0)),
                ) {
                    viewModel.updateTaskCount(difficulty, it)
                }
            }
            Text(
                "${settings.taskCounts.values.sum()} tasks selected; choose 1–15 in total.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        HorizontalDivider()
        Text("Crew roles", style = MaterialTheme.typography.titleLarge)
        if (selectedPack?.roles.isNullOrEmpty()) {
            Text("This task pack has no specialist crew roles.")
        } else {
            val maximumCrew = (room.participants.size - settings.imposterCount).coerceAtLeast(0)
            selectedPack.roles.forEach { role ->
                val otherTotal = settings.roleCounts.filterKeys { it != role.name }.values.sum()
                NumberSetting(
                    role.name,
                    settings.roleCounts[role.name] ?: 0,
                    0,
                    (maximumCrew - otherTotal).coerceAtLeast(0),
                ) {
                    viewModel.updateRoleCount(role.name, it)
                }
                Text(
                    "${role.specialization}: ${role.ability}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                "${settings.roleCounts.values.sum()} of $maximumCrew available crewmates assigned a specialist role.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        state.settingsValidationErrors.forEach { error ->
            Text(error, color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun ChoiceSetting(
    label: String,
    value: String,
    choices: List<Pair<String, String>>,
    onChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xs)) {
        Text(label, fontWeight = FontWeight.Bold)
        choices.forEach { (id, description) ->
            Row(
                modifier =
                    Modifier.fillMaxWidth()
                        .selectable(
                            selected = value == id,
                            role = Role.RadioButton,
                            onClick = { onChange(id) },
                        )
                        .padding(vertical = GameSpacing.xs),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
            ) {
                RadioButton(selected = value == id, onClick = null)
                Text(description, modifier = Modifier.weight(1f))
            }
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
                if (state.settings.dirty) {
                    Text(
                        "Settings changed. Apply them before starting.",
                        color = MaterialTheme.colorScheme.primary,
                        textAlign = TextAlign.Center,
                    )
                    GameOutlinedButton(
                        "Apply settings",
                        viewModel::applySettings,
                        Modifier.fillMaxWidth().widthIn(max = 680.dp),
                        enabled = !state.loading,
                    )
                }
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
internal fun Message(message: String?, modifier: Modifier = Modifier) {
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
internal fun LoadingScreen(label: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(Modifier.size(40.dp))
            Text(label, Modifier.padding(top = GameSpacing.md))
        }
    }
}

@Composable
internal fun PlaceholderScreen(title: String, body: String) {
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
