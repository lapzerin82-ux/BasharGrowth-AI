package com.bashar.growthchart

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.bashar.growthchart.ui.AppRoot
import com.bashar.growthchart.ui.theme.GrowthTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as GrowthApp).container
        lifecycleScope.launch {
            container.settings.values.collect {
                if (it.secureScreen) window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }
        setContent { GrowthTheme { AppRoot(container) } }
    }

    override fun onResume() {
        super.onResume()
        (application as GrowthApp).container.scheduleSync(500)
    }
}
