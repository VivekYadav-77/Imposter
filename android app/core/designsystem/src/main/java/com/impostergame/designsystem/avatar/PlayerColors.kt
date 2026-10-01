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
            PlayerColor("fox", R.string.player_color_coral, Color(0xFF9A4616), Color(0xFFF29A5B)),
            PlayerColor("owl", R.string.player_color_gold, Color(0xFF755600), Color(0xFFE5BE5A)),
            PlayerColor("wolf", R.string.player_color_blue, Color(0xFF365F8C), Color(0xFF8FB2D9)),
            PlayerColor(
                "raven",
                R.string.player_color_violet,
                Color(0xFF62439A),
                Color(0xFFB59BE6),
            ),
            PlayerColor("moth", R.string.player_color_teal, Color(0xFF196C69), Color(0xFF78C8C4)),
            PlayerColor("cobra", R.string.player_color_green, Color(0xFF236B38), Color(0xFF78C98D)),
            PlayerColor("stag", R.string.player_color_bronze, Color(0xFF7C4820), Color(0xFFD6A06D)),
            PlayerColor("hare", R.string.player_color_rose, Color(0xFF93485F), Color(0xFFE3A0B2)),
            PlayerColor(
                "panther",
                R.string.player_color_indigo,
                Color(0xFF4E589C),
                Color(0xFF9EA8E8),
            ),
            PlayerColor("shark", R.string.player_color_cyan, Color(0xFF17677C), Color(0xFF72BED3)),
            PlayerColor("bull", R.string.player_color_red, Color(0xFF9B382B), Color(0xFFE98878)),
            PlayerColor("gecko", R.string.player_color_lime, Color(0xFF526F16), Color(0xFFA3C965)),
            PlayerColor(
                "beetle",
                R.string.player_color_amber,
                Color(0xFF7C451D),
                Color(0xFFD49764),
            ),
            PlayerColor(
                "spider",
                R.string.player_color_magenta,
                Color(0xFF843E74),
                Color(0xFFD58AC4),
            ),
            PlayerColor("bat", R.string.player_color_purple, Color(0xFF71417F), Color(0xFFC090CE)),
            PlayerColor(
                "raccoon",
                R.string.player_color_slate,
                Color(0xFF4F5A64),
                Color(0xFFADB6BF),
            ),
            PlayerColor("lynx", R.string.player_color_orange, Color(0xFF7A4D24), Color(0xFFE0A46F)),
            PlayerColor(
                "falcon",
                R.string.player_color_sea_green,
                Color(0xFF386762),
                Color(0xFF88B0AA),
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
