package com.impostergame.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import androidx.compose.ui.unit.sp
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
import com.impostergame.designsystem.component.GameBackButton
import com.impostergame.designsystem.component.GameButton
import com.impostergame.designsystem.component.GameEyebrow
import com.impostergame.designsystem.component.GameOutlinedButton
import com.impostergame.designsystem.component.GameTopBar
import com.impostergame.designsystem.component.PlayerCard
import com.impostergame.designsystem.component.SignalBackground
import com.impostergame.designsystem.component.SignalCard
import com.impostergame.designsystem.component.SignalScene
import com.impostergame.designsystem.component.SignalSceneArt
import com.impostergame.designsystem.component.WebsiteCard
import com.impostergame.designsystem.component.WebsiteDialog
import com.impostergame.designsystem.component.WebsiteIcon
import com.impostergame.designsystem.component.WebsiteIconKind
import com.impostergame.designsystem.component.WebsiteLoadingPanel
import com.impostergame.designsystem.component.WebsitePhaseGlyph
import com.impostergame.designsystem.component.WebsiteSectionHeading
import com.impostergame.designsystem.component.WebsiteTrustItem
import com.impostergame.designsystem.theme.GameAccessibilityPreferences
import com.impostergame.designsystem.theme.GameMotion
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.ImposterGameTheme
import com.impostergame.designsystem.theme.LocalGameAccessibilityPreferences
import com.impostergame.designsystem.theme.WebsiteLayout
import com.impostergame.designsystem.theme.WebsiteTypeScale
import com.impostergame.designsystem.theme.gameColors
import kotlinx.coroutines.launch

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
    onMinimizeApp: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    BackHandler(
        enabled =
            state.destination in
                setOf(
                    EntryDestination.SETTINGS,
                    EntryDestination.JOIN,
                    EntryDestination.CREATE,
                    EntryDestination.LOBBY,
                )
    ) {
        when (state.destination) {
            EntryDestination.LOBBY -> {
                if (state.confirmLeave) viewModel.dismissLeave() else viewModel.requestLeave()
            }
            EntryDestination.SETTINGS,
            EntryDestination.JOIN,
            EntryDestination.CREATE -> viewModel.showHome()
            else -> Unit
        }
    }
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
                        darkTheme,
                        onThemeModeChanged,
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
                EntryDestination.LOBBY ->
                    LobbyScreen(
                        state,
                        viewModel,
                        onCopyCode,
                        onShareCode,
                        onToggleSound = { onSoundChanged(!preferences.soundEnabled) },
                        onToggleTheme = {
                            onThemeModeChanged(if (darkTheme) ThemeMode.Light else ThemeMode.Dark)
                        },
                    )
                EntryDestination.GAME ->
                    GameplayScreen(
                        viewModel = gameplayViewModel,
                        onMinimizeApp = onMinimizeApp,
                        onReplayRoom = { room ->
                            gameplayViewModel.clearForHome()
                            viewModel.enterReplayedRoom(room)
                        },
                        onReturnHome = {
                            gameplayViewModel.clearForHome()
                            viewModel.exitResults()
                        },
                        onToggleSound = { onSoundChanged(!preferences.soundEnabled) },
                        onToggleTheme = {
                            onThemeModeChanged(if (darkTheme) ThemeMode.Light else ThemeMode.Dark)
                        },
                    )
                EntryDestination.RESULTS ->
                    GameplayScreen(
                        viewModel = gameplayViewModel,
                        onMinimizeApp = onMinimizeApp,
                        onReplayRoom = { room ->
                            gameplayViewModel.clearForHome()
                            viewModel.enterReplayedRoom(room)
                        },
                        onReturnHome = {
                            gameplayViewModel.clearForHome()
                            viewModel.exitResults()
                        },
                        onToggleSound = { onSoundChanged(!preferences.soundEnabled) },
                        onToggleTheme = {
                            onThemeModeChanged(if (darkTheme) ThemeMode.Light else ThemeMode.Dark)
                        },
                    )
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
    darkTheme: Boolean,
    onThemeModeChanged: (ThemeMode) -> Unit,
) {
    var confirmDiagnostics by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }
    val scrollState = rememberScrollState()
    val scope = rememberCoroutineScope()
    val reduceMotion = LocalGameAccessibilityPreferences.current.reduceMotion
    fun scrollHomeTo(target: Int) {
        scope.launch {
            if (reduceMotion) scrollState.scrollTo(target) else scrollState.animateScrollTo(target)
        }
    }
    if (confirmDiagnostics) {
        WebsiteDialog(
            title = "Share support diagnostics?",
            onDismissRequest = { confirmDiagnostics = false },
            content = {
                Text(
                    "This shares the app version, environment, network status, and recent " +
                        "request IDs. It does not include your room, role, votes, photos, or token."
                )
            },
            actions = {
                GameOutlinedButton("Cancel", { confirmDiagnostics = false }, Modifier.weight(1f))
                GameButton(
                    "Continue",
                    {
                        confirmDiagnostics = false
                        onShareDiagnostics()
                    },
                    Modifier.weight(1f),
                )
            },
        )
    }
    SignalBackground {
        Column(modifier = Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(scrollState)) {
            Column(
                modifier =
                    Modifier.fillMaxWidth()
                        .padding(
                            horizontal = WebsiteLayout.headerHorizontal,
                            vertical = WebsiteLayout.headerVertical,
                        ),
                verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
            ) {
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    BrandHeader(
                        Modifier.fillMaxWidth().padding(end = 60.dp),
                        compact = maxWidth <= 384.dp,
                        trailing = {
                            GameOutlinedButton(
                                if (menuOpen) "Close" else "Menu",
                                { menuOpen = !menuOpen },
                            )
                        },
                    )
                    androidx.compose.material3.IconButton(
                        onClick = {
                            onThemeModeChanged(if (darkTheme) ThemeMode.Light else ThemeMode.Dark)
                        },
                        modifier =
                            Modifier.align(Alignment.CenterEnd)
                                .size(WebsiteLayout.themeControl)
                                .semantics {
                                    contentDescription =
                                        if (darkTheme) "Switch to light theme"
                                        else "Switch to dark theme"
                                },
                    ) {
                        WebsiteIcon(
                            if (darkTheme) WebsiteIconKind.Sun else WebsiteIconKind.Moon,
                            size = 20.dp,
                        )
                    }
                }
                AnimatedVisibility(
                    visible = menuOpen,
                    enter =
                        if (reduceMotion) EnterTransition.None
                        else fadeIn(tween(GameMotion.StandardMillis)) + expandVertically(),
                    exit =
                        if (reduceMotion) ExitTransition.None
                        else fadeOut(tween(GameMotion.QuickMillis)) + shrinkVertically(),
                ) {
                    SignalCard(Modifier.fillMaxWidth()) {
                        Column(
                            Modifier.padding(GameSpacing.sm),
                            verticalArrangement = Arrangement.spacedBy(GameSpacing.xxs),
                        ) {
                            GameOutlinedButton(
                                "How to play",
                                {
                                    menuOpen = false
                                    scrollHomeTo(1050)
                                },
                                Modifier.fillMaxWidth(),
                            )
                            GameOutlinedButton(
                                "Privacy & photos",
                                {
                                    menuOpen = false
                                    scrollHomeTo(scrollState.maxValue)
                                },
                                Modifier.fillMaxWidth(),
                            )
                            GameOutlinedButton("Join a room", onJoin, Modifier.fillMaxWidth())
                            GameOutlinedButton("App settings", onSettings, Modifier.fillMaxWidth())
                            GameButton("Start a room  →", onCreate, Modifier.fillMaxWidth())
                        }
                    }
                }
            }
            if (message != null || resumeFailed) {
                Column(
                    Modifier.fillMaxWidth()
                        .padding(
                            horizontal = WebsiteLayout.mobileGutter,
                            vertical = GameSpacing.sm,
                        ),
                    verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
                ) {
                    Message(message)
                    if (resumeFailed) {
                        GameButton(
                            "Retry secure resume",
                            onRetry,
                            Modifier.fillMaxWidth(),
                            loading = loading,
                        )
                    }
                }
            }
            Column(
                modifier =
                    Modifier.fillMaxWidth()
                        .padding(
                            start = WebsiteLayout.mobileGutter,
                            top = WebsiteLayout.heroTop,
                            end = WebsiteLayout.mobileGutter,
                            bottom = WebsiteLayout.heroBottom,
                        ),
                verticalArrangement = Arrangement.spacedBy(GameSpacing.lg),
            ) {
                GameEyebrow("A live social deduction game")
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val headingSize = WebsiteTypeScale.mobileHero(maxWidth.value)
                    val headingTracking = if (maxWidth <= 420.dp) -0.035f else -0.045f
                    Column {
                        Text(
                            "Everyone’s watching.",
                            modifier = Modifier.semantics { heading() },
                            style =
                                MaterialTheme.typography.displayLarge.copy(
                                    fontSize = headingSize.sp,
                                    lineHeight = (headingSize * 0.87f).sp,
                                    letterSpacing = (headingSize * headingTracking).sp,
                                ),
                        )
                        Text(
                            "Someone’s lying.",
                            style =
                                MaterialTheme.typography.displayLarge.copy(
                                    fontSize = headingSize.sp,
                                    lineHeight = (headingSize * 0.87f).sp,
                                    letterSpacing = (headingSize * headingTracking).sp,
                                ),
                            color = MaterialTheme.gameColors.accentStrong,
                        )
                    }
                }
                Text(
                    "Turn any hangout into a case of trust, bluffing, and photo-proof tasks. No download. No account required. One room code.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xs)) {
                    GameButton("Start a room  →", onCreate, Modifier.fillMaxWidth())
                    TextButton(
                        onClick = { scrollHomeTo(1050) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("See how it works")
                        WebsiteIcon(
                            WebsiteIconKind.Arrow,
                            Modifier.padding(start = 7.dp),
                            size = 17.dp,
                        )
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xxs)) {
                    WebsiteTrustItem("18+ private rooms")
                    WebsiteTrustItem("Up to 12 players")
                    WebsiteTrustItem("Photos auto-delete")
                }
                Box(Modifier.fillMaxWidth()) {
                    SignalSceneArt(SignalScene.Meeting)
                    HomeVisualNote(
                        "ROOM 7X3K9Q",
                        icon = WebsiteIconKind.Room,
                        modifier = Modifier.align(Alignment.TopStart).padding(top = GameSpacing.md),
                    )
                    HomeVisualNote(
                        "6 players connected",
                        live = true,
                        modifier =
                            Modifier.align(Alignment.BottomEnd).padding(bottom = GameSpacing.md),
                    )
                }
            }
            Column(
                modifier =
                    Modifier.fillMaxWidth()
                        .padding(
                            start = WebsiteLayout.mobileGutter,
                            top = WebsiteLayout.journeyTop,
                            end = WebsiteLayout.mobileGutter,
                            bottom = GameSpacing.lg,
                        ),
                verticalArrangement = Arrangement.spacedBy(GameSpacing.lg),
            ) {
                GameEyebrow("The round, at a glance")
                BoxWithConstraints {
                    val headingSize = WebsiteTypeScale.mobileSection(maxWidth.value)
                    Text(
                        "Play the room.\nNot the screen.",
                        modifier = Modifier.semantics { heading() },
                        style =
                            MaterialTheme.typography.displayMedium.copy(
                                fontSize = headingSize.sp,
                                lineHeight = (headingSize * 0.92f).sp,
                            ),
                    )
                }
                Text(
                    "Fast prompts on your phone. The real game happens face to face.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            val journeys =
                listOf(
                    HomeJourney(
                        "01",
                        SignalScene.Lobby,
                        "Gather the room",
                        "Create a private room, share one code, and get everyone ready.",
                    ),
                    HomeJourney(
                        "02",
                        SignalScene.Tasks,
                        "Prove your work",
                        "Finish real-world tasks and add private photo evidence.",
                    ),
                    HomeJourney(
                        "03",
                        SignalScene.Meeting,
                        "Read the table",
                        "Challenge suspicious proof and make your case out loud.",
                    ),
                    HomeJourney(
                        "04",
                        SignalScene.Verdict,
                        "Cast the verdict",
                        "Vote in private, reveal the result, and live with the room’s decision.",
                    ),
                )
            LazyRow(
                contentPadding =
                    PaddingValues(
                        start = WebsiteLayout.mobileGutter,
                        end = WebsiteLayout.mobileGutter,
                        bottom = WebsiteLayout.privacyPadding,
                    ),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                items(journeys) { journey -> HomeJourneyCard(journey) }
            }
            Text(
                "Swipe to explore  →",
                Modifier.fillMaxWidth().padding(bottom = WebsiteLayout.journeyBottom),
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
            )
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.gameColors.surfaceRaised,
                border =
                    androidx.compose.foundation.BorderStroke(
                        1.dp,
                        MaterialTheme.colorScheme.outlineVariant,
                    ),
            ) {
                Column(
                    Modifier.padding(
                        horizontal = WebsiteLayout.mobileGutter,
                        vertical = WebsiteLayout.bandVertical,
                    ),
                    verticalArrangement = Arrangement.spacedBy(GameSpacing.xl),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.sm)) {
                        GameEyebrow("Built for the glance")
                        Text(
                            "Look down for two seconds.\nLook back at your friends.",
                            modifier = Modifier.semantics { heading() },
                            style = MaterialTheme.typography.displayMedium,
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            HomePhaseSwatch("LOBBY", SignalScene.Lobby, Modifier.weight(1f))
                            HomePhaseSwatch("TASKS", SignalScene.Tasks, Modifier.weight(1f))
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            HomePhaseSwatch("MEETING", SignalScene.Meeting, Modifier.weight(1f))
                            HomePhaseSwatch("RESULTS", SignalScene.Verdict, Modifier.weight(1f))
                        }
                    }
                }
            }
            SignalCard(
                Modifier.fillMaxWidth()
                    .padding(
                        horizontal = GameSpacing.md,
                        vertical = WebsiteLayout.privacyMargin,
                    )
            ) {
                Column(
                    Modifier.padding(WebsiteLayout.privacyPadding),
                    verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
                ) {
                    Surface(
                        modifier = Modifier.size(88.dp),
                        shape = androidx.compose.foundation.shape.CircleShape,
                        border =
                            androidx.compose.foundation.BorderStroke(
                                1.dp,
                                MaterialTheme.gameColors.accentStrong,
                            ),
                        color = androidx.compose.ui.graphics.Color.Transparent,
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            WebsiteIcon(
                                WebsiteIconKind.Eye,
                                tint = MaterialTheme.gameColors.accentStrong,
                                size = 34.dp,
                            )
                        }
                    }
                    GameEyebrow("Your room stays your room")
                    Text(
                        "Evidence without the surveillance.",
                        modifier = Modifier.semantics { heading() },
                        style = MaterialTheme.typography.headlineLarge,
                    )
                    Text(
                        "Photos are visible only to your game room and are scheduled for deletion after the game. No public profiles, no session replay, no ad trackers on game screens.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TextButton(
                        onClick = {
                            scrollHomeTo(scrollState.maxValue)
                        }
                    ) {
                        Text("Read the photo policy")
                        WebsiteIcon(
                            WebsiteIconKind.Arrow,
                            Modifier.padding(start = 7.dp),
                            size = 17.dp,
                        )
                    }
                    GameButton("Open a case  →", onCreate, Modifier.fillMaxWidth())
                }
            }
            Column(
                Modifier.fillMaxWidth()
                    .padding(
                        start = WebsiteLayout.headerHorizontal,
                        end = WebsiteLayout.headerHorizontal,
                        bottom = WebsiteLayout.footerBottom,
                    ),
                verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
            ) {
                BrandHeader()
                Text(
                    "Trust no one. Prove everything.",
                    color = MaterialTheme.gameColors.accentStrong,
                )
                Text("18+ · Built for private rooms.", style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = { confirmDiagnostics = true }) {
                    Text("Share support diagnostics")
                }
            }
        }
    }
}

@Composable
private fun HomeVisualNote(
    text: String,
    modifier: Modifier = Modifier,
    icon: WebsiteIconKind? = null,
    live: Boolean = false,
) {
    Surface(
        modifier = modifier,
        shape = GameShapes.pill,
        color = androidx.compose.ui.graphics.Color(0xCC0C0F0D),
        border =
            androidx.compose.foundation.BorderStroke(
                1.dp,
                androidx.compose.ui.graphics.Color.White.copy(alpha = 0.24f),
            ),
        shadowElevation = 10.dp,
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
        ) {
            icon?.let {
                WebsiteIcon(it, tint = androidx.compose.ui.graphics.Color.White, size = 16.dp)
            }
            if (live) {
                Text(
                    "LIVE",
                    color = androidx.compose.ui.graphics.Color(0xFFF7BD62),
                    style = MaterialTheme.typography.labelSmall,
                )
            }
            Text(
                text,
                color = androidx.compose.ui.graphics.Color.White,
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

private data class HomeJourney(
    val number: String,
    val scene: SignalScene,
    val title: String,
    val body: String,
)

@Composable
private fun HomeJourneyCard(journey: HomeJourney) {
    SignalCard(Modifier.width(WebsiteLayout.journeyCardWidth)) {
        Column {
            SignalSceneArt(journey.scene)
            Box(
                Modifier.fillMaxWidth()
                    .height(WebsiteLayout.journeyCardBodyHeight)
                    .padding(horizontal = GameSpacing.lg, vertical = 22.dp)
            ) {
                Text(
                    journey.number,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.gameColors.textTertiary,
                )
                WebsitePhaseGlyph(
                    journey.scene,
                    Modifier.align(Alignment.TopEnd).padding(top = 0.dp),
                )
                Column(
                    Modifier.align(Alignment.BottomStart),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(journey.title, style = MaterialTheme.typography.titleLarge)
                    Text(journey.body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun HomePhaseSwatch(label: String, scene: SignalScene, modifier: Modifier = Modifier) {
    val color =
        when (scene) {
            SignalScene.Lobby -> MaterialTheme.gameColors.lobby
            SignalScene.Tasks -> MaterialTheme.gameColors.tasks
            SignalScene.Meeting -> MaterialTheme.gameColors.meeting
            SignalScene.Verdict -> MaterialTheme.gameColors.results
        }
    val icon =
        when (scene) {
            SignalScene.Lobby -> WebsiteIconKind.Lobby
            SignalScene.Tasks -> WebsiteIconKind.Tasks
            SignalScene.Meeting -> WebsiteIconKind.Meeting
            SignalScene.Verdict -> WebsiteIconKind.Verdict
        }
    Surface(
        modifier.height(WebsiteLayout.phaseSwatchHeight),
        shape = GameShapes.medium,
        color = color,
        shadowElevation = 8.dp,
    ) {
        Row(
            Modifier.fillMaxSize().padding(GameSpacing.sm),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            WebsiteIcon(icon, size = 20.dp, tint = androidx.compose.ui.graphics.Color.White)
            Text(
                label,
                Modifier.padding(start = GameSpacing.xs),
                color = androidx.compose.ui.graphics.Color.White,
                style = MaterialTheme.typography.labelMedium,
            )
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
                    GameBackButton("Home", onBack)
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
                    Column(
                        Modifier.padding(GameSpacing.sm),
                        verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
                    ) {
                        ThemeMode.entries.forEach { mode ->
                            val label =
                                when (mode) {
                                    ThemeMode.System -> "Follow device"
                                    ThemeMode.Light -> "Light"
                                    ThemeMode.Dark -> "Dark"
                                }
                            ThemeChoiceRow(
                                label = label,
                                selected = preferences.themeMode == mode,
                                onClick = { onThemeModeChanged(mode) },
                            )
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
private fun ThemeChoiceRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier =
            Modifier.fillMaxWidth()
                .selectable(selected = selected, role = Role.RadioButton, onClick = onClick),
        shape = GameShapes.small,
        color =
            if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
            else androidx.compose.ui.graphics.Color.Transparent,
        border =
            androidx.compose.foundation.BorderStroke(
                1.dp,
                if (selected) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.outlineVariant,
            ),
    ) {
        Row(
            Modifier.defaultMinSize(minHeight = 48.dp).padding(horizontal = GameSpacing.md),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm),
        ) {
            Box(
                Modifier.size(20.dp)
                    .border(
                        2.dp,
                        if (selected) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.outline,
                        androidx.compose.foundation.shape.CircleShape,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (selected) {
                    Box(
                        Modifier.size(10.dp)
                            .background(
                                MaterialTheme.colorScheme.primary,
                                androidx.compose.foundation.shape.CircleShape,
                            )
                    )
                }
            }
            Text(label, style = MaterialTheme.typography.bodyLarge)
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
        Box(
            modifier =
                Modifier.width(52.dp)
                    .height(30.dp)
                    .background(
                        if (checked) MaterialTheme.colorScheme.primary
                        else MaterialTheme.gameColors.surfaceHighest,
                        GameShapes.pill,
                    )
                    .border(1.dp, MaterialTheme.colorScheme.outline, GameShapes.pill)
        ) {
            Box(
                Modifier.align(if (checked) Alignment.CenterEnd else Alignment.CenterStart)
                    .padding(4.dp)
                    .size(20.dp)
                    .background(
                        if (checked) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        androidx.compose.foundation.shape.CircleShape,
                    )
            )
        }
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
                    GameBackButton("Home", viewModel::showHome)
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
                                selected = id == selectedId,
                                decorative = true,
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
    onToggleSound: () -> Unit,
    onToggleTheme: () -> Unit,
) {
    val room = state.room ?: return LoadingScreen("Loading lobby…")
    if (state.confirmLeave) {
        WebsiteDialog(
            title = if (room.self.isHost) "Leave as host?" else "Leave room?",
            onDismissRequest = viewModel::dismissLeave,
            content = {
                Text(
                    if (room.self.isHost) {
                        "Hosting may transfer or the room may end. This removes your seat."
                    } else {
                        "This removes your seat from the room."
                    }
                )
            },
            actions = {
                GameOutlinedButton("Cancel", viewModel::dismissLeave, Modifier.weight(1f))
                GameButton("Leave room", viewModel::confirmLeave, Modifier.weight(1f))
            },
        )
    }
    state.announce?.let { announcement ->
        LaunchedEffect(announcement) {
            kotlinx.coroutines.delay(2_000)
            viewModel.clearAnnouncement()
        }
    }
    SignalBackground(
        accent = MaterialTheme.gameColors.lobby,
        watermarkPlayerColorId = room.self.avatarId,
    ) {
        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
            val twoPane = maxWidth >= 600.dp || maxHeight < 480.dp
            Column(Modifier.fillMaxSize()) {
                GameTopBar(
                    phase = "Lobby",
                    timerText = "",
                    timerDescription = "Lobby",
                    nickname = room.self.nickname,
                    playerColorId = room.self.avatarId,
                    connectionState = state.connectionState,
                    onToggleSound = onToggleSound,
                    onToggleTheme = onToggleTheme,
                )
                LobbyHeader(room, onCopyCode)
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
) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        WebsiteCard(
            modifier = Modifier.fillMaxWidth(),
            accent = MaterialTheme.colorScheme.primary,
        ) {
            Column(
                Modifier.fillMaxWidth().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "INVITE YOUR CREW",
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    room.code,
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 4.sp,
                )
                Text(
                    "Share this code. Players can join from any phone, tablet, or computer.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                GameOutlinedButton("Copy room code", { onCopy(room.code) }, Modifier.fillMaxWidth())
            }
        }
        val joined = room.participants.size
        val ready = joined >= room.minPlayers
        WebsiteCard(Modifier.fillMaxWidth()) {
            Column(
                Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Text(
                    if (ready) "Ready to start" else "${room.minPlayers - joined} more needed",
                    fontWeight = FontWeight.Black,
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    "$joined joined · minimum ${room.minPlayers} · capacity ${room.maxPlayers}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                Box(
                    Modifier.fillMaxWidth()
                        .height(7.dp)
                        .background(
                            MaterialTheme.colorScheme.outlineVariant.copy(alpha = .45f),
                            GameShapes.pill,
                        )
                ) {
                    Box(
                        Modifier.fillMaxWidth((joined.toFloat() / room.minPlayers).coerceIn(0f, 1f))
                            .fillMaxHeight()
                            .background(MaterialTheme.gameColors.ready, GameShapes.pill)
                    )
                }
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
        WebsiteSectionHeading(
            eyebrow = "Players present",
            title = "Lobby roster",
            count = "$joined/${room.maxPlayers}",
            accent = MaterialTheme.gameColors.lobby,
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
    LaunchedEffect(state.settings, room.self.isHost) {
        if (room.self.isHost && state.settings.dirty && state.settingsValidationErrors.isEmpty()) {
            kotlinx.coroutines.delay(550)
            viewModel.applySettings()
        }
    }
    Column(
        modifier = contentModifier.padding(GameSpacing.md),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
    ) {
        WebsiteSectionHeading(
            eyebrow = if (room.self.isHost) "Host setup" else "Waiting for host",
            title = "Game settings",
            count =
                if (room.self.isHost) if (state.settings.dirty) "Saving…" else "Saved" else null,
            accent = MaterialTheme.gameColors.lobby,
        )
        if (room.self.isHost) {
            WebsiteCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    NumberedSettingsHeading("01", "Game basics")
                    TaskPackPicker(state, viewModel)
                    NumberSetting(
                        "Task phase (minutes)",
                        state.settings.taskPhaseMinutes,
                        5,
                        240,
                        viewModel::updateTaskMinutes,
                    )
                }
            }
            TextButton(onClick = viewModel::toggleAdvanced, modifier = Modifier.fillMaxWidth()) {
                Text(
                    if (state.settings.advancedExpanded) "Hide detailed settings  ↑"
                    else "Review detailed settings  ↓",
                    fontWeight = FontWeight.Bold,
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
private fun NumberedSettingsHeading(number: String, title: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            number,
            modifier =
                Modifier.background(
                        MaterialTheme.gameColors.lobby.copy(alpha = .12f),
                        GameShapes.small,
                    )
                    .padding(horizontal = 9.dp, vertical = 6.dp),
            color = MaterialTheme.gameColors.lobby,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Black,
        )
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
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
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        WebsiteCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                NumberedSettingsHeading("02", "Meeting voting")
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
            }
        }
        WebsiteCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                NumberedSettingsHeading("03", "Game balance")
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
            }
        }
        WebsiteCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                NumberedSettingsHeading("04", "Tasks per player")
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
                        val otherTotal =
                            settings.taskCounts.filterKeys { it != difficulty }.values.sum()
                        NumberSetting(
                            difficulty.replaceFirstChar(Char::uppercase),
                            settings.taskCounts[difficulty] ?: 0,
                            0,
                            minOf(
                                available.getValue(difficulty),
                                (15 - otherTotal).coerceAtLeast(0),
                            ),
                        ) {
                            viewModel.updateTaskCount(difficulty, it)
                        }
                    }
                    Text(
                        "${settings.taskCounts.values.sum()} tasks selected; choose 1–15 in total.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        WebsiteCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                NumberedSettingsHeading("05", "Crew roles")
                if (selectedPack?.roles.isNullOrEmpty()) {
                    Text("This task pack has no specialist crew roles.")
                } else {
                    val maximumCrew =
                        (room.participants.size - settings.imposterCount).coerceAtLeast(0)
                    selectedPack.roles.forEach { role ->
                        val otherTotal =
                            settings.roleCounts.filterKeys { it != role.name }.values.sum()
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
                RadioButton(
                    selected = value == id,
                    onClick = null,
                    modifier = Modifier.clearAndSetSemantics {},
                )
                Text(description, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun LobbyAction(state: EntryLobbyUiState, viewModel: EntryLobbyViewModel) {
    val host = state.room?.self?.isHost == true
    Surface(
        shadowElevation = 18.dp,
        shape = GameShapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier =
            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp).imePadding(),
    ) {
        Column(
            Modifier.padding(GameSpacing.xs),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
        ) {
            if (host) {
                if (state.settings.dirty) {
                    Text(
                        "Saving settings…",
                        color = MaterialTheme.colorScheme.primary,
                        textAlign = TextAlign.Center,
                    )
                }
                if (state.startBlockingReasons.isNotEmpty()) {
                    Text(
                        state.startBlockingReasons.joinToString(" "),
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                    )
                }
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
                ) {
                    GameOutlinedButton("Leave", viewModel::requestLeave, enabled = !state.loading)
                    GameButton(
                        "Start game",
                        viewModel::startGame,
                        Modifier.weight(1f),
                        enabled = state.canStart,
                        loading = state.loading,
                    )
                }
            } else {
                Text(
                    "Waiting for the host to start the game.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                GameOutlinedButton(
                    "Leave room",
                    viewModel::requestLeave,
                    Modifier.fillMaxWidth(),
                    enabled = !state.loading,
                )
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
    SignalBackground {
        Column(
            modifier =
                Modifier.fillMaxSize()
                    .safeDrawingPadding()
                    .padding(horizontal = 20.dp, vertical = GameSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.xl, Alignment.CenterVertically),
        ) {
            BrandHeader(Modifier.fillMaxWidth())
            WebsiteLoadingPanel(label)
            Text(
                "Your private room details stay sealed while we check for an active seat.",
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
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
