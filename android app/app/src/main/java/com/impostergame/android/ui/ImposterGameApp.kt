package com.impostergame.android.ui

import androidx.compose.runtime.Composable
import com.impostergame.designsystem.catalog.ComponentCatalog
import com.impostergame.designsystem.theme.ImposterGameTheme

@Composable
fun ImposterGameApp() {
    ImposterGameTheme { ComponentCatalog() }
}
