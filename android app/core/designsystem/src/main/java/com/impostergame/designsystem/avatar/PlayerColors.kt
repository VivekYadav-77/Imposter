package com.impostergame.designsystem.avatar

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import com.impostergame.designsystem.R

@Immutable
data class PlayerColor(
    val transportId: String,
    val nameResource: Int,
    val light: Color,
    val dark: Color,
)

object PlayerColors {
    val all: List<PlayerColor> =
        listOf(
            PlayerColor("fox", R.string.player_color_coral, Color(0xFF9F2D30), Color(0xFFFF8C86)),
            PlayerColor("owl", R.string.player_color_gold, Color(0xFF765800), Color(0xFFFFD166)),
            PlayerColor("wolf", R.string.player_color_blue, Color(0xFF2057A6), Color(0xFF80B5FF)),
            PlayerColor(
                "raven",
                R.string.player_color_violet,
                Color(0xFF6542A6),
                Color(0xFFC2A7FF),
            ),
            PlayerColor("moth", R.string.player_color_teal, Color(0xFF006B66), Color(0xFF62D5CE)),
            PlayerColor("cobra", R.string.player_color_green, Color(0xFF2A6A37), Color(0xFF75D68C)),
            PlayerColor("stag", R.string.player_color_bronze, Color(0xFF7B4D20), Color(0xFFE0A66D)),
            PlayerColor("hare", R.string.player_color_rose, Color(0xFF91405D), Color(0xFFFFA8C0)),
            PlayerColor(
                "panther",
                R.string.player_color_indigo,
                Color(0xFF414F9B),
                Color(0xFFAAB5FF),
            ),
            PlayerColor("shark", R.string.player_color_cyan, Color(0xFF00647A), Color(0xFF62CBE5)),
            PlayerColor("bull", R.string.player_color_red, Color(0xFF9C2D22), Color(0xFFFF9384)),
            PlayerColor("gecko", R.string.player_color_lime, Color(0xFF506A0D), Color(0xFFB6D968)),
            PlayerColor(
                "beetle",
                R.string.player_color_amber,
                Color(0xFF7A4700),
                Color(0xFFFFB95C),
            ),
            PlayerColor(
                "spider",
                R.string.player_color_magenta,
                Color(0xFF843A78),
                Color(0xFFF3A0DF),
            ),
            PlayerColor("bat", R.string.player_color_purple, Color(0xFF713B83), Color(0xFFD9A4E9)),
            PlayerColor(
                "raccoon",
                R.string.player_color_slate,
                Color(0xFF4F5A68),
                Color(0xFFB5C0CF),
            ),
            PlayerColor("lynx", R.string.player_color_orange, Color(0xFF874314), Color(0xFFFFA36B)),
            PlayerColor(
                "falcon",
                R.string.player_color_sea_green,
                Color(0xFF35645C),
                Color(0xFF8BC9BE),
            ),
        )

    private val byTransportId = all.associateBy(PlayerColor::transportId)

    val unknown =
        PlayerColor(
            transportId = "unknown",
            nameResource = R.string.player_color_unknown,
            light = Color(0xFF52525B),
            dark = Color(0xFFA1A1AA),
        )

    fun fromTransportId(transportId: String): PlayerColor = byTransportId[transportId] ?: unknown
}
