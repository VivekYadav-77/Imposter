package com.impostergame.android.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.impostergame.android.account.AccountDestination
import com.impostergame.android.account.AccountUiState
import com.impostergame.android.account.AccountViewModel
import com.impostergame.android.account.PendingGuestEntry
import com.impostergame.data.account.DashboardRoom
import com.impostergame.data.account.UserGameSummary
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.avatar.PlayerColors
import com.impostergame.designsystem.component.BrandHeader
import com.impostergame.designsystem.component.GameButton
import com.impostergame.designsystem.component.GameButtonStyle
import com.impostergame.designsystem.component.GameOutlinedButton
import com.impostergame.designsystem.component.GoogleSignInButton
import com.impostergame.designsystem.component.SignalBackground
import com.impostergame.designsystem.component.WebsiteDialog
import com.impostergame.designsystem.component.WebsiteIcon
import com.impostergame.designsystem.component.WebsiteIconKind
import com.impostergame.designsystem.component.WebsiteLoadingPanel
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.WebsiteLayout

@Composable
fun AccountSurface(
    state: AccountUiState,
    viewModel: AccountViewModel,
    onGuestEntry: (PendingGuestEntry) -> Unit,
    onRoomReady: () -> Unit,
    darkTheme: Boolean,
    onToggleTheme: () -> Unit,
) {
    LaunchedEffect(state.rejoinedRoom) {
        if (state.rejoinedRoom != null) {
            onRoomReady()
            viewModel.consumeRejoinedRoom()
        }
    }
    when (state.destination) {
        AccountDestination.NONE -> Unit
        AccountDestination.AUTH_CHOICE ->
            AuthChoice(
                state = state,
                onDismiss = viewModel::dismiss,
                onGoogle = { viewModel.continueWithGoogle("play") },
                onGuest = {
                    val entry = state.pendingGuestEntry
                    viewModel.dismiss()
                    onGuestEntry(entry)
                },
            )
        AccountDestination.DASHBOARD ->
            DashboardScreen(state, viewModel, darkTheme, onToggleTheme) {
                viewModel.dismiss()
                onGuestEntry(PendingGuestEntry.CREATE)
            }
        AccountDestination.HISTORY -> HistoryScreen(state, viewModel, darkTheme, onToggleTheme)
        AccountDestination.GAME_DETAIL ->
            GameDetailScreen(state, viewModel, darkTheme, onToggleTheme)
        AccountDestination.SETTINGS ->
            AccountSettingsScreen(state, viewModel, darkTheme, onToggleTheme)
    }
}

@Composable
private fun AuthChoice(
    state: AccountUiState,
    onDismiss: () -> Unit,
    onGoogle: () -> Unit,
    onGuest: () -> Unit,
) {
    WebsiteDialog(
        title = "Choose how to play",
        onDismissRequest = onDismiss,
        showCloseButton = true,
        content = {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(
                    "Jump in as a guest, or use Google to keep game results and rooms in your dashboard."
                )
                state.message?.let { AccountMessage(it) }
                GoogleSignInButton(
                    onClick = onGoogle,
                    modifier = Modifier.fillMaxWidth(),
                    loading = state.signingIn,
                )
                GameOutlinedButton(
                    "Play as a guest",
                    onGuest,
                    Modifier.fillMaxWidth(),
                    enabled = !state.signingIn,
                )
                Text(
                    "Google is only used for your player account. Guest play needs no account.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        actions = {},
    )
}

@Composable
private fun DashboardFrame(
    selected: AccountDestination,
    viewModel: AccountViewModel,
    darkTheme: Boolean,
    onToggleTheme: () -> Unit,
    content: @Composable () -> Unit,
) {
    SignalBackground {
        Column(Modifier.fillMaxSize().safeDrawingPadding()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                BrandHeader(Modifier.weight(1f))
                androidx.compose.material3.IconButton(
                    onClick = onToggleTheme,
                    modifier =
                        Modifier.size(WebsiteLayout.themeControl).semantics {
                            contentDescription =
                                if (darkTheme) "Switch to light theme" else "Switch to dark theme"
                        },
                ) {
                    WebsiteIcon(
                        if (darkTheme) WebsiteIconKind.Sun else WebsiteIconKind.Moon,
                        size = 20.dp,
                    )
                }
                GameOutlinedButton("Home", viewModel::dismiss)
            }
            Box(Modifier.weight(1f)) { content() }
            Surface(
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    DashboardNavButton(
                        "Overview",
                        selected == AccountDestination.DASHBOARD,
                        viewModel::showDashboard,
                        Modifier.weight(1f),
                    )
                    DashboardNavButton(
                        "History",
                        selected == AccountDestination.HISTORY ||
                            selected == AccountDestination.GAME_DETAIL,
                        viewModel::showHistory,
                        Modifier.weight(1f),
                    )
                    DashboardNavButton(
                        "Settings",
                        selected == AccountDestination.SETTINGS,
                        viewModel::showSettings,
                        Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun DashboardNavButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier,
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        color =
            if (selected) MaterialTheme.colorScheme.primary.copy(alpha = .16f)
            else MaterialTheme.colorScheme.surface,
        shape = GameShapes.small,
    ) {
        Text(
            label,
            Modifier.padding(12.dp),
            fontWeight = if (selected) FontWeight.Black else FontWeight.SemiBold,
        )
    }
}

@Composable
private fun DashboardScreen(
    state: AccountUiState,
    viewModel: AccountViewModel,
    darkTheme: Boolean,
    onToggleTheme: () -> Unit,
    onStartOrJoin: () -> Unit,
) {
    DashboardFrame(AccountDestination.DASHBOARD, viewModel, darkTheme, onToggleTheme) {
        if (state.loading && state.dashboard == null) {
            WebsiteLoadingPanel("Loading your case files")
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(horizontal = 18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item {
                    AccountHeading(
                        "Your command center",
                        "Welcome back.",
                        "Resume a live room or review your latest cases.",
                    )
                }
                state.message?.let { message -> item { AccountMessage(message) } }
                if (state.message != null && state.dashboard == null) {
                    item {
                        GameOutlinedButton(
                            "Retry dashboard",
                            viewModel::showDashboard,
                            Modifier.fillMaxWidth(),
                        )
                    }
                }
                state.dashboard?.let { data ->
                    item {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            StatCard("Games", data.stats.games.toString(), Modifier.weight(1f))
                            StatCard("Win rate", "${data.stats.winRate}%", Modifier.weight(1f))
                            StatCard(
                                "Tasks",
                                "${data.stats.taskCompletionRate}%",
                                Modifier.weight(1f),
                            )
                            StatCard("Survival", "${data.stats.survivalRate}%", Modifier.weight(1f))
                        }
                    }
                    item { SectionTitle("Rooms", "Rejoin a room") }
                    if (data.rooms.isEmpty()) {
                        item {
                            EmptyCard(
                                "No linked rooms yet. Live and previously played rooms will appear here."
                            )
                        }
                    } else {
                        items(data.rooms, key = DashboardRoom::participantId) { room ->
                            RoomCard(room, state.loading) { viewModel.rejoin(room.participantId) }
                        }
                    }
                    item { SectionTitle("Recent results", "Case history") }
                    if (data.recentGames.isEmpty())
                        item { EmptyCard("Completed games will appear here.") }
                    else
                        items(data.recentGames.take(3), key = UserGameSummary::id) { game ->
                            HistoryCard(game) { viewModel.showGame(game.id) }
                        }
                    item {
                        GameButton(
                            "Start or join",
                            onStartOrJoin,
                            Modifier.fillMaxWidth(),
                        )
                    }
                    item { Spacer(Modifier.height(12.dp)) }
                }
            }
        }
    }
}

@Composable
private fun HistoryScreen(
    state: AccountUiState,
    viewModel: AccountViewModel,
    darkTheme: Boolean,
    onToggleTheme: () -> Unit,
) {
    DashboardFrame(AccountDestination.HISTORY, viewModel, darkTheme, onToggleTheme) {
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                AccountHeading(
                    "Archive",
                    "Game history",
                    "Roles and results are saved here. Evidence photos are never included.",
                )
            }
            state.message?.let { item { AccountMessage(it) } }
            if (state.message != null && state.history.isEmpty()) {
                item {
                    GameOutlinedButton(
                        "Retry history",
                        viewModel::showHistory,
                        Modifier.fillMaxWidth(),
                    )
                }
            }
            if (state.loading && state.history.isEmpty())
                item { WebsiteLoadingPanel("Loading game history") }
            if (!state.loading && state.history.isEmpty())
                item { EmptyCard("Completed games will appear here.") }
            items(state.history, key = UserGameSummary::id) { game ->
                HistoryCard(game) { viewModel.showGame(game.id) }
            }
            if (state.historyCursor != null) {
                item {
                    GameOutlinedButton(
                        "Load older games",
                        viewModel::loadMoreHistory,
                        Modifier.fillMaxWidth(),
                        enabled = !state.loading,
                    )
                }
            }
        }
    }
}

@Composable
private fun GameDetailScreen(
    state: AccountUiState,
    viewModel: AccountViewModel,
    darkTheme: Boolean,
    onToggleTheme: () -> Unit,
) {
    DashboardFrame(AccountDestination.GAME_DETAIL, viewModel, darkTheme, onToggleTheme) {
        val game = state.game
        if (state.loading) {
            WebsiteLoadingPanel("Loading game result")
        } else if (game == null) {
            Column(
                Modifier.fillMaxSize().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                AccountMessage(state.message ?: "This game result could not be loaded.")
                GameOutlinedButton(
                    "Back to history",
                    viewModel::showHistory,
                    Modifier.fillMaxWidth(),
                )
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(horizontal = 18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    AccountHeading(
                        "Room ${game.code}",
                        game.winner?.let { if (it == "crew") "Crew won" else "Imposters won" }
                            ?: "Game abandoned",
                        "${game.taskPackName} · You played ${game.role}",
                    )
                }
                item { SectionTitle("Players", "Final roster") }
                items(game.players, key = { it.id }) { player ->
                    AccountCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            PlayerAvatar(player.avatarId, 46.dp, player.nickname)
                            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                                Text(player.nickname, fontWeight = FontWeight.Black)
                                Text(
                                    "${player.role} · ${player.lifeStatus}",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            Text(
                                "${player.completedTasks}/${player.totalTasks}",
                                fontWeight = FontWeight.Black,
                            )
                        }
                    }
                }
                item { SectionTitle("Case record", "Eliminations") }
                if (game.eliminations.isEmpty())
                    item { EmptyCard("No eliminations were recorded.") }
                else
                    items(game.eliminations) { event ->
                        EmptyCard(
                            if (event.type == "ejected") "${event.target} · Ejected by vote"
                            else "${event.target} · Killed${event.actor?.let { " by $it" } ?: ""}"
                        )
                    }
                item { SectionTitle("Meeting record", "Vote record") }
                if (game.voteVisibility != "public") {
                    item {
                        EmptyCard("Individual ballots were private and are not present in history.")
                    }
                } else if (game.ballots.isEmpty()) {
                    item { EmptyCard("No ballots were cast.") }
                } else {
                    items(game.ballots) { ballot ->
                        EmptyCard(
                            "Meeting ${ballot.meeting} · ${ballot.voter} voted for ${ballot.target ?: "Skip"}"
                        )
                    }
                }
            }
        }
    }
}

private enum class SettingsTab {
    PROFILE,
    DEVICES,
    ACCOUNT,
}

@Composable
private fun AccountSettingsScreen(
    state: AccountUiState,
    viewModel: AccountViewModel,
    darkTheme: Boolean,
    onToggleTheme: () -> Unit,
) {
    var tab by remember { mutableStateOf(SettingsTab.PROFILE) }
    var deleteConfirm by remember { mutableStateOf(false) }
    DashboardFrame(AccountDestination.SETTINGS, viewModel, darkTheme, onToggleTheme) {
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                AccountHeading(
                    "Account",
                    "Settings",
                    state.profile?.let { "Signed in as ${it.email}" } ?: "",
                )
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SettingsTab.entries.forEach { item ->
                        DashboardNavButton(
                            item.name.lowercase().replaceFirstChar(Char::uppercase),
                            tab == item,
                            { tab = item },
                            Modifier.weight(1f),
                        )
                    }
                }
            }
            state.message?.let { item { AccountMessage(it) } }
            if (state.message != null && state.profile == null) {
                item {
                    GameOutlinedButton(
                        "Retry settings",
                        viewModel::showSettings,
                        Modifier.fillMaxWidth(),
                    )
                }
            }
            if (state.loading && state.profile == null)
                item { WebsiteLoadingPanel("Loading account settings") }
            when (tab) {
                SettingsTab.PROFILE ->
                    state.profile?.let { profile ->
                        item {
                            ProfileEditor(
                                profile.displayName,
                                profile.avatarId,
                                state.loading,
                                viewModel,
                            )
                        }
                    }
                SettingsTab.DEVICES -> {
                    item {
                        GameOutlinedButton(
                            "Sign out other devices",
                            viewModel::revokeOthers,
                            Modifier.fillMaxWidth(),
                            enabled = state.sessions.any { !it.current } && !state.loading,
                        )
                    }
                    items(state.sessions, key = { it.id }) { session ->
                        AccountCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        if (session.current) "This device" else session.deviceLabel,
                                        fontWeight = FontWeight.Black,
                                    )
                                    Text(
                                        "Expires ${session.expiresAt.take(10)}",
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                }
                                if (!session.current) {
                                    GameOutlinedButton(
                                        "Revoke",
                                        { viewModel.revokeSession(session.id) },
                                    )
                                }
                            }
                        }
                    }
                }
                SettingsTab.ACCOUNT -> {
                    item {
                        AccountCard {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(
                                    "Sign out",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Black,
                                )
                                Text(
                                    "End the player account session on this device. Your active room seat is unchanged."
                                )
                                GameOutlinedButton(
                                    "Sign out",
                                    viewModel::signOut,
                                    Modifier.fillMaxWidth(),
                                )
                            }
                        }
                    }
                    item {
                        AccountCard {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(
                                    "Delete account",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Black,
                                )
                                Text(
                                    "This removes your login and unlinks your history. Google will ask you to confirm your identity first."
                                )
                                GameButton(
                                    "Verify with Google to delete",
                                    { deleteConfirm = true },
                                    Modifier.fillMaxWidth(),
                                    style = GameButtonStyle.Destructive,
                                    loading = state.signingIn,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
    if (deleteConfirm) {
        WebsiteDialog(
            title = "Delete your account?",
            onDismissRequest = { deleteConfirm = false },
            content = {
                Text(
                    "This cannot be undone. Your login will be removed and your game history will be unlinked."
                )
            },
            actions = {
                GameOutlinedButton("Cancel", { deleteConfirm = false }, Modifier.weight(1f))
                GameButton(
                    "Delete account",
                    {
                        deleteConfirm = false
                        viewModel.deleteAccount()
                    },
                    Modifier.weight(1f),
                    style = GameButtonStyle.Destructive,
                )
            },
        )
    }
}

@Composable
private fun ProfileEditor(
    initialName: String,
    initialAvatar: String,
    loading: Boolean,
    viewModel: AccountViewModel,
) {
    var name by remember(initialName) { mutableStateOf(initialName) }
    var avatar by remember(initialAvatar) { mutableStateOf(initialAvatar) }
    AccountCard {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                "Player profile",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Black,
            )
            OutlinedTextField(
                value = name,
                onValueChange = { if (it.length <= 24) name = it },
                label = { Text("Display name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Text("Default operative", fontWeight = FontWeight.Bold)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(PlayerColors.all, key = { it.transportId }) { choice ->
                    Surface(
                        modifier = Modifier.size(58.dp).clickable { avatar = choice.transportId },
                        shape = GameShapes.small,
                        border =
                            BorderStroke(
                                if (avatar == choice.transportId) 3.dp else 1.dp,
                                if (avatar == choice.transportId) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.outlineVariant,
                            ),
                    ) {
                        PlayerAvatar(
                            choice.transportId,
                            46.dp,
                            "Operative",
                            Modifier.padding(6.dp),
                            selected = avatar == choice.transportId,
                        )
                    }
                }
            }
            GameButton(
                "Save profile",
                { viewModel.saveProfile(name, avatar) },
                Modifier.fillMaxWidth(),
                enabled = name.trim().isNotEmpty() && !loading,
                loading = loading,
            )
        }
    }
}

@Composable
private fun AccountHeading(eyebrow: String, title: String, description: String) {
    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(
            eyebrow.uppercase(),
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Black,
        )
        Text(
            title,
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Black,
        )
        Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SectionTitle(eyebrow: String, title: String) {
    Column {
        Text(
            eyebrow.uppercase(),
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelSmall,
        )
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier) {
    Surface(modifier, shape = GameShapes.small, color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(10.dp)) {
            Text(value, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge)
            Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
    }
}

@Composable
private fun RoomCard(room: DashboardRoom, loading: Boolean, onRejoin: () -> Unit) {
    AccountCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PlayerAvatar(room.avatarId, 48.dp, room.nickname)
            Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                Text("Room ${room.code}", fontWeight = FontWeight.Black)
                Text(
                    "${room.nickname} · ${if (room.isHost) "Host" else "Player"} · ${room.status}",
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (room.rejoinable) {
                GameButton(
                    when (room.status) {
                        "expired" -> "Reopen"
                        "completed",
                        "abandoned" -> "Rematch"
                        else -> "Rejoin"
                    },
                    onRejoin,
                    enabled = !loading,
                )
            } else Text("History only", style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun HistoryCard(game: UserGameSummary, onClick: () -> Unit) {
    AccountCard(Modifier.clickable(onClick = onClick)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (game.phase == "abandoned") "Abandoned" else if (game.won) "Won" else "Lost",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Black,
            )
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(game.taskPackName, fontWeight = FontWeight.Black)
                Text(
                    "Room ${game.code} · ${game.startedAt.take(10)}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(game.role, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun AccountCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = GameShapes.medium,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Box(Modifier.padding(14.dp)) { content() }
    }
}

@Composable private fun EmptyCard(text: String) = AccountCard { Text(text) }

@Composable
private fun AccountMessage(message: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = GameShapes.small,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(message, Modifier.padding(12.dp))
    }
}
