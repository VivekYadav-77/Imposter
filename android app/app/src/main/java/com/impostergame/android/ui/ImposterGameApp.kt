package com.impostergame.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.impostergame.android.R
import com.impostergame.android.ui.theme.ImposterGameTheme

@Composable
fun ImposterGameApp() {
    ImposterGameTheme {
        Scaffold(modifier = Modifier.fillMaxSize()) { contentPadding ->
            Box(
                modifier = Modifier.fillMaxSize().padding(contentPadding).padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    CircularProgressIndicator()
                    Text(
                        text = stringResource(R.string.bootstrap_title),
                        style = MaterialTheme.typography.titleLarge,
                    )
                    Text(
                        text = stringResource(R.string.bootstrap_message),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        }
    }
}
