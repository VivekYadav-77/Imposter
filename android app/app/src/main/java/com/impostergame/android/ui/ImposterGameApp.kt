package com.impostergame.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.impostergame.android.entry.ConsentKind
import com.impostergame.android.entry.EntryDestination
import com.impostergame.android.entry.EntryLobbyUiState
import com.impostergame.android.entry.EntryLobbyViewModel
import com.impostergame.android.entry.EntryValidationTarget
import com.impostergame.android.entry.SettingsSaveState
import com.impostergame.android.feedback.GameFeedbackEvent
import com.impostergame.android.gameplay.GameplayViewModel
import com.impostergame.android.preferences.AppPreferences
import com.impostergame.android.preferences.ThemeMode
import com.impostergame.data.model.RoomParticipant
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.avatar.PlayerColors
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
                EntryDestination.CREATE ->
                    EntryScreen(
                        state = state,
                        viewModel = viewModel,
                        onToggleTheme = {
                            onThemeModeChanged(if (darkTheme) ThemeMode.Light else ThemeMode.Dark)
                        },
                    )
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
private fun EntryScreen(
    state: EntryLobbyUiState,
    viewModel: EntryLobbyViewModel,
    onToggleTheme: () -> Unit,
) {
    val joining = state.destination == EntryDestination.JOIN
    val scrollState = rememberScrollState()
    val codeFocus = remember { FocusRequester() }
    val nicknameFocus = remember { FocusRequester() }
    var colorPickerVisible by rememberSaveable { mutableStateOf(false) }
    var roomOptionsExpanded by rememberSaveable(joining) { mutableStateOf(false) }
    LaunchedEffect(state.focusColorPicker) {
        if (state.focusColorPicker) colorPickerVisible = true
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
                colorPickerVisible = true
            }
            EntryValidationTarget.CONSENTS -> scrollState.animateScrollTo(scrollState.maxValue)
            null -> Unit
        }
    }
    if (colorPickerVisible) {
        WebsiteDialog(
            title = "Choose your operative",
            onDismissRequest = { colorPickerVisible = false },
            content = {
                Text(
                    "One operative per player in this room.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Box(
                    Modifier.fillMaxWidth()
                        .heightIn(max = 540.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    ColorPicker(
                        ids = state.form.availableColorIds,
                        selectedId = state.form.selectedColorId,
                        onSelect = {
                            viewModel.setColor(it)
                            colorPickerVisible = false
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            actions = {
                GameOutlinedButton(
                    "Close",
                    { colorPickerVisible = false },
                    Modifier.fillMaxWidth(),
                )
            },
        )
    }
    val identityVisible = !joining || state.form.availableColorIds.isNotEmpty()
    SignalBackground {
        Column(
            modifier =
                Modifier.fillMaxSize()
                    .safeDrawingPadding()
                    .imePadding()
                    .verticalScroll(scrollState)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BrandHeader(modifier = Modifier.weight(1f))
                TextButton(onClick = viewModel::showHome) { Text("←  Back home") }
                Surface(
                    onClick = onToggleTheme,
                    modifier = Modifier.size(46.dp),
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    tonalElevation = 0.dp,
                    shadowElevation = 8.dp,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        WebsiteIcon(WebsiteIconKind.Moon, size = 21.dp)
                    }
                }
            }
            Spacer(Modifier.height(22.dp))
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                GameEyebrow("Enter the room")
                Text(
                    "How are you playing?",
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                )
                Text(
                    "It takes one code. Accounts are optional.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
            WebsiteCard(Modifier.fillMaxWidth()) {
                Column(
                    Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    EntryModePicker(
                        joining = joining,
                        onCreate = viewModel::showCreate,
                        onJoin = viewModel::showJoin,
                    )
                    if (joining) {
                        Text("Room code", fontWeight = FontWeight.Bold)
                        OutlinedTextField(
                            value = state.form.roomCode,
                            onValueChange = viewModel::setCode,
                            modifier = Modifier.fillMaxWidth().focusRequester(codeFocus),
                            placeholder = {
                                Text(
                                    "A B C 1 2 3",
                                    Modifier.fillMaxWidth(),
                                    textAlign = TextAlign.Center,
                                    fontWeight = FontWeight.Black,
                                    letterSpacing = 4.sp,
                                )
                            },
                            supportingText = state.form.codeError?.let { error -> { Text(error) } },
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
                            "Find room",
                            viewModel::fetchJoinOptions,
                            Modifier.fillMaxWidth(),
                            enabled = !state.loading && state.form.roomCode.length == 6,
                        )
                    }
                    if (identityVisible) {
                        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Text("Your nickname", fontWeight = FontWeight.Bold)
                            OutlinedTextField(
                                value = state.form.nickname,
                                onValueChange = viewModel::setNickname,
                                modifier = Modifier.fillMaxWidth().focusRequester(nicknameFocus),
                                placeholder = { Text("What should the room call you?") },
                                supportingText = {
                                    Text(
                                        state.form.nicknameError
                                            ?: "${state.form.nickname.length}/24 characters"
                                    )
                                },
                                isError = state.form.nicknameError != null,
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                            )
                        }
                        if (!joining) {
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = GameShapes.small,
                                color = MaterialTheme.gameColors.surfaceHighest,
                                border =
                                    BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                                tonalElevation = 0.dp,
                            ) {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    Row(
                                        Modifier.fillMaxWidth()
                                            .clickable {
                                                roomOptionsExpanded = !roomOptionsExpanded
                                            }
                                            .padding(horizontal = 14.dp, vertical = 13.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Column(Modifier.weight(1f)) {
                                            Text("Room options", fontWeight = FontWeight.Bold)
                                            Text(
                                                "${state.form.minPlayers} minimum · " +
                                                    "${state.form.maxPlayers} maximum",
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                style = MaterialTheme.typography.bodySmall,
                                            )
                                        }
                                        Text(
                                            if (roomOptionsExpanded) "⌃" else "⌄",
                                            fontWeight = FontWeight.Bold,
                                        )
                                    }
                                    AnimatedVisibility(
                                        visible = roomOptionsExpanded,
                                        enter =
                                            expandVertically(
                                                animationSpec = tween(GameMotion.StandardMillis)
                                            ) +
                                                fadeIn(
                                                    animationSpec = tween(GameMotion.StandardMillis)
                                                ),
                                        exit =
                                            shrinkVertically(
                                                animationSpec = tween(GameMotion.StandardMillis)
                                            ) +
                                                fadeOut(
                                                    animationSpec = tween(GameMotion.QuickMillis)
                                                ),
                                    ) {
                                        Column(
                                            Modifier.fillMaxWidth()
                                                .border(
                                                    width = 1.dp,
                                                    color =
                                                        MaterialTheme.colorScheme.outlineVariant,
                                                )
                                                .padding(14.dp),
                                            verticalArrangement = Arrangement.spacedBy(14.dp),
                                        ) {
                                            NumberSetting(
                                                label = "Minimum players",
                                                value = state.form.minPlayers,
                                                minimum = 3,
                                                maximum = state.form.maxPlayers,
                                                onChange = viewModel::setMinimumPlayers,
                                            )
                                            Text(
                                                "At least 3 players are required.",
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                style = MaterialTheme.typography.bodySmall,
                                            )
                                            NumberSetting(
                                                label = "Maximum players",
                                                value = state.form.maxPlayers,
                                                minimum = state.form.minPlayers,
                                                maximum = 15,
                                                onChange = viewModel::setMaximumPlayers,
                                            )
                                            Text(
                                                "Limited to 15 for reliable realtime play.",
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                style = MaterialTheme.typography.bodySmall,
                                            )
                                        }
                                    }
                                }
                            }
                        } else {
                            state.form.spotsRemaining?.let {
                                Text(
                                    "$it ${if (it == 1) "spot" else "spots"} remaining",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Text("Your operative", fontWeight = FontWeight.Bold)
                        OperativeSelect(
                            selectedId = state.form.selectedColorId,
                            onClick = { colorPickerVisible = true },
                        )
                        ConsentRow(
                            "I’m 18 or older and agree to the photo and privacy notice.",
                            state.form.consentsAccepted,
                        ) {
                            viewModel.setConsent(ConsentKind.AGE, it)
                            viewModel.setConsent(ConsentKind.PHOTO, it)
                            viewModel.setConsent(ConsentKind.PRIVACY, it)
                        }
                        GameButton(
                            if (joining) "Join room" else "Create room",
                            viewModel::submitEntry,
                            Modifier.fillMaxWidth(),
                            enabled =
                                state.form.nickname.trim().isNotEmpty() &&
                                    state.form.selectedColorId != null &&
                                    state.form.consentsAccepted,
                            loading = state.loading,
                        )
                    }
                    Message(
                        state.message,
                        Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                    )
                }
            }
            Spacer(Modifier.height(GameSpacing.xl))
        }
    }
}

@Composable
private fun EntryModePicker(joining: Boolean, onCreate: () -> Unit, onJoin: () -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .background(MaterialTheme.gameColors.surfaceHighest, GameShapes.medium)
            .padding(5.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        EntryModeChoice(
            title = "Start a room",
            detail = "Host a new game",
            selected = !joining,
            onClick = onCreate,
            modifier = Modifier.weight(1f),
        )
        EntryModeChoice(
            title = "Join a room",
            detail = "Use a 6-letter code",
            selected = joining,
            onClick = onJoin,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun EntryModeChoice(
    title: String,
    detail: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        modifier = modifier.heightIn(min = 66.dp),
        shape = GameShapes.small,
        color =
            if (selected) MaterialTheme.colorScheme.primary.copy(alpha = .12f)
            else MaterialTheme.colorScheme.surface,
        border =
            BorderStroke(
                1.dp,
                if (selected) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.outlineVariant,
            ),
        tonalElevation = 0.dp,
    ) {
        Column(
            Modifier.padding(horizontal = 11.dp, vertical = 9.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(title, fontWeight = FontWeight.Black)
            Text(
                detail,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun OperativeSelect(selectedId: String?, onClick: () -> Unit) {
    val selected = selectedId?.let(PlayerColors::fromTransportId)
    val selectedName = selected?.let { androidx.compose.ui.res.stringResource(it.nameResource) }
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().heightIn(min = 92.dp),
        shape = GameShapes.small,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        tonalElevation = 0.dp,
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (selectedId == null) {
                Box(
                    Modifier.size(54.dp)
                        .border(
                            1.dp,
                            MaterialTheme.colorScheme.outline,
                            androidx.compose.foundation.shape.CircleShape,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("?", fontWeight = FontWeight.Black)
                }
            } else {
                PlayerAvatar(selectedId, 54.dp, selectedName ?: "Operative", decorative = true)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(selectedName ?: "Choose an operative", fontWeight = FontWeight.Black)
                Text(
                    "One unique identity per player",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(
                if (selectedId == null) "Choose" else "Change",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Black,
                style = MaterialTheme.typography.labelLarge,
            )
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
        if (ids.isEmpty()) {
            Text("Check the room to see available colors.")
        } else {
            ids.chunked(3).forEach { rowIds ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    rowIds.forEach { id ->
                        val color = PlayerColors.fromTransportId(id)
                        val label = androidx.compose.ui.res.stringResource(color.nameResource)
                        Column(
                            modifier =
                                Modifier.weight(1f)
                                    .selectable(
                                        selected = id == selectedId,
                                        role = Role.RadioButton,
                                        onClick = { onSelect(id) },
                                    )
                                    .semantics(mergeDescendants = true) {
                                        contentDescription = label
                                    }
                                    .padding(vertical = GameSpacing.xs),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            PlayerAvatar(
                                id,
                                62.dp,
                                label,
                                selected = id == selectedId,
                                decorative = true,
                            )
                            Text(
                                label.uppercase(),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Black,
                            )
                        }
                    }
                    repeat(3 - rowIds.size) { Spacer(Modifier.weight(1f)) }
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
                if (twoPane) {
                    LobbyHeader(room, onCopyCode)
                    LobbyMessages(state)
                    Row(Modifier.weight(1f).fillMaxWidth()) {
                        Roster(room, Modifier.weight(1f).fillMaxHeight())
                        LobbySettings(state, viewModel, Modifier.weight(1f).fillMaxHeight())
                    }
                } else {
                    Box(
                        Modifier.weight(1f).fillMaxWidth(),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        Column(
                            Modifier.widthIn(max = 430.dp)
                                .fillMaxWidth()
                                .verticalScroll(rememberScrollState())
                        ) {
                            LobbyHeader(room, onCopyCode)
                            LobbyMessages(state)
                            Roster(room, scrollable = false)
                            LobbySettings(state, viewModel, scrollable = false)
                        }
                    }
                }
                LobbyAction(state, viewModel)
            }
        }
    }
}

@Composable
private fun LobbyMessages(state: EntryLobbyUiState) {
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
}

@Composable
private fun LobbyHeader(
    room: RoomSnapshot,
    onCopy: (String) -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = GameShapes.card,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .64f)),
            shadowElevation = 10.dp,
            tonalElevation = 0.dp,
        ) {
            Column(
                Modifier.fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            if (MaterialTheme.colorScheme.background.luminance() > .5f) {
                                listOf(Color(0xFFF5E0BB), Color(0xFFFFFDF8))
                            } else {
                                listOf(Color(0xFF3E3014), Color(0xFF191814))
                            }
                        )
                    )
                    .padding(horizontal = 18.dp, vertical = 16.dp),
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
                GameOutlinedButton(
                    "Copy room code",
                    { onCopy(room.code) },
                    Modifier.fillMaxWidth().padding(top = 4.dp),
                )
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
                val progress by
                    animateFloatAsState(
                        targetValue = (joined.toFloat() / room.minPlayers).coerceIn(0f, 1f),
                        animationSpec =
                            tween(
                                durationMillis = 240,
                                easing = GameMotion.EmphasisEasing,
                            ),
                        label = "Lobby readiness",
                    )
                Box(
                    Modifier.fillMaxWidth()
                        .height(10.dp)
                        .background(
                            MaterialTheme.colorScheme.outlineVariant.copy(alpha = .45f),
                            GameShapes.pill,
                        )
                ) {
                    Box(
                        Modifier.fillMaxWidth(progress)
                            .fillMaxHeight()
                            .background(
                                Brush.horizontalGradient(
                                    listOf(
                                        MaterialTheme.colorScheme.primary,
                                        MaterialTheme.gameColors.ready,
                                    )
                                ),
                                GameShapes.pill,
                            )
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
        modifier = contentModifier.padding(horizontal = 14.dp, vertical = 10.dp),
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
        showSelfBadge = false,
        presenceLabel = if (participant.presence == "connected") "In the room" else "Away",
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
    var meetingExpanded by rememberSaveable { mutableStateOf(false) }
    var balanceExpanded by rememberSaveable { mutableStateOf(false) }
    var tasksExpanded by rememberSaveable { mutableStateOf(false) }
    var rolesExpanded by rememberSaveable { mutableStateOf(false) }
    val contentModifier =
        if (scrollable) modifier.verticalScroll(rememberScrollState()) else modifier
    Column(
        modifier = contentModifier.padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (room.self.isHost) {
            WebsiteCard(Modifier.fillMaxWidth(), shadowElevation = 10.dp) {
                Column(
                    Modifier.padding(horizontal = 14.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Column(
                        Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Column {
                            Text(
                                "HOST SETUP",
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Black,
                            )
                            Text(
                                "Game settings",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Black,
                            )
                            Text(
                                "Configure the round below. Changes are grouped and saved when you pause.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        Text(
                            when (state.settingsSaveState) {
                                SettingsSaveState.Saving -> "SAVING"
                                SettingsSaveState.Error -> "RETRY"
                                SettingsSaveState.Dirty -> "PENDING"
                                else -> "SAVED"
                            },
                            modifier =
                                Modifier.clickable(
                                        enabled =
                                            state.settingsSaveState == SettingsSaveState.Error,
                                        onClick = viewModel::applySettings,
                                    )
                                    .border(
                                        1.dp,
                                        when (state.settingsSaveState) {
                                            SettingsSaveState.Error ->
                                                MaterialTheme.colorScheme.error
                                            SettingsSaveState.Dirty,
                                            SettingsSaveState.Saving ->
                                                MaterialTheme.colorScheme.primary
                                            else -> MaterialTheme.gameColors.ready
                                        },
                                        GameShapes.pill,
                                    )
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                            color =
                                when (state.settingsSaveState) {
                                    SettingsSaveState.Error -> MaterialTheme.colorScheme.error
                                    SettingsSaveState.Dirty,
                                    SettingsSaveState.Saving -> MaterialTheme.colorScheme.primary
                                    else -> MaterialTheme.gameColors.ready
                                },
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Black,
                        )
                        Spacer(
                            Modifier.fillMaxWidth()
                                .height(1.dp)
                                .background(MaterialTheme.colorScheme.outlineVariant)
                        )
                    }
                    Surface(
                        shape = GameShapes.small,
                        color = MaterialTheme.colorScheme.background.copy(alpha = .48f),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        tonalElevation = 0.dp,
                    ) {
                        Column(
                            Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            NumberedSettingsHeading(
                                "01",
                                "Game basics",
                                "Choose the map and total play time.",
                            )
                            TaskPackPicker(state, viewModel)
                            NumberSetting(
                                label = "Game time",
                                value = state.settings.taskPhaseMinutes,
                                minimum = 5,
                                maximum = 240,
                                onChange = viewModel::updateTaskMinutes,
                                unit = "min",
                                step = 5,
                                hint =
                                    "Enter a whole number from 5 to 240 minutes. Buttons change the time by 5 minutes.",
                            )
                        }
                    }
                    AdvancedSettings(
                        state = state,
                        viewModel = viewModel,
                        meetingExpanded = meetingExpanded,
                        onMeetingExpanded = { meetingExpanded = it },
                        balanceExpanded = balanceExpanded,
                        onBalanceExpanded = { balanceExpanded = it },
                        tasksExpanded = tasksExpanded,
                        onTasksExpanded = { tasksExpanded = it },
                        rolesExpanded = rolesExpanded,
                        onRolesExpanded = { rolesExpanded = it },
                    )
                    SetupCompletion(state)
                }
            }
        } else {
            WebsiteSectionHeading(
                eyebrow = "Waiting for host",
                title = "Game settings",
                accent = MaterialTheme.gameColors.lobby,
            )
            Text("The host controls settings and starts the game.")
        }
    }
}

@Composable
private fun NumberedSettingsHeading(
    number: String,
    title: String,
    description: String? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(30.dp)
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.primary,
                    androidx.compose.foundation.shape.CircleShape,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                number,
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Black,
            )
        }
        Column(Modifier.weight(1f)) {
            Text(
                title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.ExtraBold,
            )
            description?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style =
                        MaterialTheme.typography.bodySmall.copy(
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                        ),
                )
            }
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
    var expanded by rememberSaveable { mutableStateOf(false) }
    val selected = state.taskPacks.firstOrNull { it.id == state.settings.selectedTaskPackId }
    Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xs)) {
        Text("Map", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
        if (state.taskPacks.isEmpty()) Text("No published task packs available.")
        Surface(
            modifier =
                Modifier.fillMaxWidth().clickable(enabled = state.taskPacks.isNotEmpty()) {
                    expanded = !expanded
                },
            shape = GameShapes.small,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            tonalElevation = 0.dp,
        ) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    selected?.let { "${it.name} · ${it.activeTaskCount} tasks" }
                        ?: "Choose a published map",
                    modifier = Modifier.weight(1f),
                    color =
                        if (selected == null) MaterialTheme.colorScheme.onSurfaceVariant
                        else MaterialTheme.colorScheme.onSurface,
                )
                WebsiteIcon(
                    WebsiteIconKind.Chevron,
                    Modifier.rotate(if (expanded) 180f else 0f),
                    size = 17.dp,
                )
            }
        }
        AnimatedVisibility(
            visible = expanded,
            enter = fadeIn(tween(GameMotion.StandardMillis)) + expandVertically(),
            exit = fadeOut(tween(GameMotion.QuickMillis)) + shrinkVertically(),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                state.taskPacks.forEach { pack ->
                    val isSelected = state.settings.selectedTaskPackId == pack.id
                    Surface(
                        modifier =
                            Modifier.fillMaxWidth()
                                .selectable(
                                    selected = isSelected,
                                    onClick = {
                                        viewModel.selectTaskPack(pack.id)
                                        expanded = false
                                    },
                                    role = Role.RadioButton,
                                ),
                        shape = GameShapes.small,
                        color =
                            if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = .12f)
                            else MaterialTheme.colorScheme.surface,
                        border =
                            BorderStroke(
                                if (isSelected) 2.dp else 1.dp,
                                if (isSelected) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.outlineVariant,
                            ),
                        tonalElevation = 0.dp,
                    ) {
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(pack.name, fontWeight = FontWeight.Black)
                                Text(
                                    "${pack.activeTaskCount} tasks",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            if (isSelected) {
                                WebsiteIcon(
                                    WebsiteIconKind.Check,
                                    tint = MaterialTheme.colorScheme.primary,
                                    size = 17.dp,
                                )
                            }
                        }
                    }
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
    unit: String? = null,
    step: Int = 1,
    hint: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xs)) {
        Text(label, fontWeight = FontWeight.Bold)
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = GameShapes.small,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            tonalElevation = 0.dp,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().height(48.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                NumberStepButton(
                    icon = WebsiteIconKind.Minus,
                    description = "Decrease $label by $step",
                    onClick = { onChange((value - step).coerceAtLeast(minimum)) },
                    enabled = value > minimum,
                )
                Spacer(
                    Modifier.fillMaxHeight()
                        .width(1.dp)
                        .background(MaterialTheme.colorScheme.outlineVariant)
                )
                Row(
                    Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Text(value.toString(), fontWeight = FontWeight.Black)
                    unit?.let {
                        Text(
                            "  $it",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
                Spacer(
                    Modifier.fillMaxHeight()
                        .width(1.dp)
                        .background(MaterialTheme.colorScheme.outlineVariant)
                )
                NumberStepButton(
                    icon = WebsiteIconKind.Plus,
                    description = "Increase $label by $step",
                    onClick = { onChange((value + step).coerceAtMost(maximum)) },
                    enabled = value < maximum,
                )
            }
        }
        hint?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun NumberStepButton(
    icon: WebsiteIconKind,
    description: String,
    onClick: () -> Unit,
    enabled: Boolean,
) {
    Box(
        Modifier.size(48.dp)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        WebsiteIcon(
            icon,
            tint =
                if (enabled) MaterialTheme.colorScheme.onSurface
                else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = .45f),
            size = 18.dp,
        )
    }
}

@Composable
private fun AdvancedSettings(
    state: EntryLobbyUiState,
    viewModel: EntryLobbyViewModel,
    meetingExpanded: Boolean,
    onMeetingExpanded: (Boolean) -> Unit,
    balanceExpanded: Boolean,
    onBalanceExpanded: (Boolean) -> Unit,
    tasksExpanded: Boolean,
    onTasksExpanded: (Boolean) -> Unit,
    rolesExpanded: Boolean,
    onRolesExpanded: (Boolean) -> Unit,
) {
    val settings = state.settings
    val room = state.room ?: return
    val selectedPack = state.taskPacks.firstOrNull { it.id == settings.selectedTaskPackId }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SettingsDisclosure(
            number = "02",
            title = "Meeting voting",
            description = "Pick one clear rule for ending a vote.",
            expanded = meetingExpanded,
            onExpandedChange = onMeetingExpanded,
        ) {
            ChoiceSetting(
                label = "Voting rule",
                value = settings.meetingVotingMode,
                choices =
                    listOf(
                        "timed" to
                            "Timed vote — Ends when everyone votes or the selected time runs out.",
                        "all_voted" to
                            "Wait for everyone — Ends when every counting eligible player has voted.",
                    ),
                onChange = viewModel::updateMeetingVotingMode,
                horizontal = true,
                icons = listOf(WebsiteIconKind.Clock, WebsiteIconKind.Check),
            )
            if (settings.meetingVotingMode == "timed") {
                NumberSetting(
                    label = "Maximum voting time",
                    value = settings.meetingDurationSeconds,
                    minimum = 30,
                    maximum = 1800,
                    onChange = viewModel::updateMeetingSeconds,
                    unit = "seconds",
                    hint = "Enter a whole number from 30 to 1800 seconds.",
                )
            }
            ChoiceSetting(
                label = "Ballot visibility",
                value = settings.voteVisibility,
                choices =
                    listOf(
                        "private" to "Private — Only totals appear after voting.",
                        "public" to "Public — Everyone sees who voted for whom.",
                    ),
                onChange = viewModel::updateVoteVisibility,
                icons = listOf(WebsiteIconKind.Lock, WebsiteIconKind.Eye),
            )
            ChoiceSetting(
                label = "Evidence visibility",
                value = settings.evidenceVisibility,
                choices =
                    listOf(
                        "public" to "Shared — Everyone can view accepted task photos.",
                        "private" to "Private — Players can view only their own task photos.",
                    ),
                onChange = viewModel::updateEvidenceVisibility,
                icons = listOf(WebsiteIconKind.Eye, WebsiteIconKind.Lock),
            )
        }
        SettingsDisclosure(
            number = "03",
            title = "Game balance",
            description = "Control actions, meetings, and impostors.",
            expanded = balanceExpanded,
            onExpandedChange = onBalanceExpanded,
        ) {
            NumberSetting(
                label = "Impostor cooldown base",
                value = settings.imposterCooldownSeconds,
                minimum = 10,
                maximum = 300,
                onChange = viewModel::updateImposterCooldown,
                unit = "seconds",
                hint =
                    "The live cooldown subtracts the average game-time and crew-task completion from this base.",
            )
            NumberSetting(
                label = "Meeting cooldown",
                value = settings.meetingCooldownSeconds,
                minimum = 10,
                maximum = 1800,
                onChange = viewModel::updateMeetingCooldown,
                unit = "seconds",
                hint = "Time after a meeting ends before another meeting can be called.",
            )
            NumberSetting(
                label = "Meetings per player",
                value = settings.meetingsPerPlayer,
                minimum = 0,
                maximum = 10,
                onChange = viewModel::updateMeetingsPerPlayer,
            )
            ChoiceSetting(
                label = "Impostor task needed to call a meeting",
                value = settings.imposterMeetingTaskRequirement,
                choices =
                    listOf(
                        "one" to
                            "One task — Impostors must complete at least one task before calling.",
                        "none" to
                            "No task — Impostors can call immediately when the cooldown is ready.",
                    ),
                onChange = viewModel::updateImposterMeetingTaskRequirement,
            )
            Text(
                "Crew members always need one completed task. The caller’s identity is never shown.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
            val allowedImposters = room.settings.allowedImposterCounts
            NumberSetting(
                label = "Impostors",
                value = settings.imposterCount,
                minimum = allowedImposters.minOrNull() ?: 1,
                maximum = allowedImposters.maxOrNull() ?: 1,
                onChange = viewModel::updateImposterCount,
                hint =
                    "Choose up to ${allowedImposters.maxOrNull() ?: 1} for a ${room.maxPlayers}-player room. Game start uses the safest maximum for the players actually present.",
            )
        }
        SettingsDisclosure(
            number = "04",
            title = "Tasks per player",
            description = "${settings.taskCounts.values.sum()} tasks selected",
            expanded = tasksExpanded,
            onExpandedChange = onTasksExpanded,
        ) {
            if (selectedPack == null) {
                Text("Choose a map before configuring task quantities.")
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
                    val maximum =
                        minOf(
                            available.getValue(difficulty),
                            (15 - otherTotal).coerceAtLeast(0),
                        )
                    NumberSetting(
                        label = difficulty.replaceFirstChar(Char::uppercase),
                        value = settings.taskCounts[difficulty] ?: 0,
                        minimum = 0,
                        maximum = maximum,
                        onChange = { viewModel.updateTaskCount(difficulty, it) },
                        hint = "${available.getValue(difficulty)} active on this map",
                    )
                }
            }
        }
        if (!selectedPack?.roles.isNullOrEmpty()) {
            SettingsDisclosure(
                number = "05",
                title = "Crew roles",
                description = "Optional specialist allocation",
                expanded = rolesExpanded,
                onExpandedChange = onRolesExpanded,
            ) {
                val maximumCrew = (room.participants.size - settings.imposterCount).coerceAtLeast(0)
                selectedPack.roles.forEach { role ->
                    val otherTotal = settings.roleCounts.filterKeys { it != role.name }.values.sum()
                    NumberSetting(
                        label = role.name,
                        value = settings.roleCounts[role.name] ?: 0,
                        minimum = 0,
                        maximum = (maximumCrew - otherTotal).coerceAtLeast(0),
                        onChange = { viewModel.updateRoleCount(role.name, it) },
                        hint = "${role.specialization}: ${role.ability}",
                    )
                }
            }
        }
        state.settingsValidationErrors.forEach { error ->
            Text(error, color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun SettingsDisclosure(
    number: String,
    title: String,
    description: String,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val reduceMotion = LocalGameAccessibilityPreferences.current.reduceMotion
    val chevronRotation by
        animateFloatAsState(
            targetValue = if (expanded) 180f else 0f,
            animationSpec = tween(if (reduceMotion) 0 else 180, easing = GameMotion.EmphasisEasing),
            label = "$title disclosure",
        )
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = GameShapes.small,
        color = MaterialTheme.colorScheme.background.copy(alpha = .48f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        tonalElevation = 0.dp,
    ) {
        Column {
            Row(
                Modifier.fillMaxWidth().clickable { onExpandedChange(!expanded) }.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                NumberedSettingsHeading(number, title, description, Modifier.weight(1f))
                WebsiteIcon(
                    WebsiteIconKind.Chevron,
                    Modifier.rotate(chevronRotation),
                    size = 17.dp,
                )
            }
            AnimatedVisibility(
                visible = expanded,
                enter =
                    if (reduceMotion) EnterTransition.None
                    else
                        fadeIn(tween(180, easing = GameMotion.EmphasisEasing)) +
                            expandVertically(
                                animationSpec = tween(180, easing = GameMotion.EmphasisEasing),
                                expandFrom = Alignment.Top,
                            ),
                exit =
                    if (reduceMotion) ExitTransition.None
                    else
                        fadeOut(tween(120, easing = GameMotion.EmphasisEasing)) +
                            shrinkVertically(
                                animationSpec = tween(180, easing = GameMotion.EmphasisEasing),
                                shrinkTowards = Alignment.Top,
                            ),
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    content()
                    Surface(
                        modifier =
                            Modifier.fillMaxWidth().padding(top = 14.dp).clickable(
                                role = Role.Button
                            ) {
                                onExpandedChange(false)
                            },
                        shape = GameShapes.small,
                        color = MaterialTheme.colorScheme.surface.copy(alpha = .84f),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        tonalElevation = 0.dp,
                    ) {
                        Row(
                            Modifier.fillMaxWidth()
                                .heightIn(min = 46.dp)
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                        ) {
                            Text(
                                "Close $title",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                            )
                            WebsiteIcon(
                                WebsiteIconKind.Chevron,
                                Modifier.padding(start = 7.dp).rotate(180f),
                                size = 16.dp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SetupCompletion(state: EntryLobbyUiState) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = GameShapes.small,
        color = MaterialTheme.colorScheme.primary.copy(alpha = .06f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .55f)),
        tonalElevation = 0.dp,
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                "READY CHECK",
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Black,
            )
            Text(
                if (state.canStart) "READY TO LAUNCH" else "COMPLETE SETUP",
                fontWeight = FontWeight.Black,
            )
            Text(
                state.startBlockingReasons.firstOrNull()
                    ?: "The configured game is ready to start.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun ChoiceSetting(
    label: String,
    value: String,
    choices: List<Pair<String, String>>,
    onChange: (String) -> Unit,
    horizontal: Boolean = false,
    icons: List<WebsiteIconKind> = emptyList(),
) {
    Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xs)) {
        Text(label, fontWeight = FontWeight.Bold)
        if (horizontal) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                choices.forEachIndexed { index, choice ->
                    ChoiceOption(
                        choice = choice,
                        selected = value == choice.first,
                        onClick = { onChange(choice.first) },
                        icon = icons.getOrNull(index),
                        modifier = Modifier.weight(1f).heightIn(min = 112.dp),
                        stacked = true,
                    )
                }
            }
        } else {
            choices.forEachIndexed { index, choice ->
                ChoiceOption(
                    choice = choice,
                    selected = value == choice.first,
                    onClick = { onChange(choice.first) },
                    icon = icons.getOrNull(index),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun ChoiceOption(
    choice: Pair<String, String>,
    selected: Boolean,
    onClick: () -> Unit,
    icon: WebsiteIconKind?,
    modifier: Modifier,
    stacked: Boolean = false,
) {
    val title = choice.second.substringBefore(" — ")
    val detail = choice.second.substringAfter(" — ", "")
    Surface(
        modifier =
            modifier.selectable(
                selected = selected,
                role = Role.RadioButton,
                onClick = onClick,
            ),
        shape = GameShapes.xSmall,
        color =
            if (selected) MaterialTheme.colorScheme.primary.copy(alpha = .14f)
            else MaterialTheme.gameColors.surfaceRaised.copy(alpha = .34f),
        border =
            BorderStroke(
                1.dp,
                if (selected) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.outlineVariant,
            ),
        tonalElevation = 0.dp,
    ) {
        if (stacked) {
            Column(
                Modifier.fillMaxSize().padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                icon?.let {
                    Box(
                        Modifier.size(28.dp)
                            .background(
                                MaterialTheme.colorScheme.primary.copy(alpha = .12f),
                                androidx.compose.foundation.shape.CircleShape,
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        WebsiteIcon(it, tint = MaterialTheme.colorScheme.primary, size = 16.dp)
                    }
                }
                Text(title, fontWeight = FontWeight.Black)
                if (detail.isNotEmpty()) {
                    Text(
                        detail,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        } else {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                icon?.let {
                    WebsiteIcon(it, tint = MaterialTheme.colorScheme.onSurface, size = 18.dp)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(title, fontWeight = FontWeight.Black)
                    if (detail.isNotEmpty()) {
                        Text(
                            detail,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                if (selected) {
                    WebsiteIcon(
                        WebsiteIconKind.Check,
                        tint = MaterialTheme.colorScheme.primary,
                        size = 17.dp,
                    )
                }
            }
        }
    }
}

@Composable
private fun LobbyAction(state: EntryLobbyUiState, viewModel: EntryLobbyViewModel) {
    val host = state.room?.self?.isHost == true
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Surface(
            shadowElevation = 18.dp,
            shape = GameShapes.medium,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            modifier =
                Modifier.widthIn(max = 430.dp)
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp)
                    .imePadding(),
        ) {
            Column(
                Modifier.padding(GameSpacing.xs),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
            ) {
                if (host) {
                    val statusText =
                        when (state.settingsSaveState) {
                            SettingsSaveState.Saving -> "Saving settings…"
                            SettingsSaveState.Error ->
                                "Settings could not be saved. Tap Retry above."
                            else -> state.startBlockingReasons.firstOrNull()
                        }
                    if (statusText != null) {
                        Text(
                            statusText,
                            color =
                                if (state.settingsSaveState == SettingsSaveState.Saving) {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                } else {
                                    MaterialTheme.colorScheme.error
                                },
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
                    ) {
                        GameButton(
                            "Start game",
                            viewModel::startGame,
                            Modifier.weight(1f),
                            enabled = state.canStart,
                            loading = state.loading,
                            retainPrimaryWhenDisabled = true,
                        )
                        GameOutlinedButton(
                            "Leave room",
                            viewModel::requestLeave,
                            Modifier.weight(.62f),
                            enabled = !state.loading,
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
