package com.church.guy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.church.guy.ui.CameraStreamScreen
import com.church.guy.ui.ConnectScreen
import com.church.guy.ui.theme.ChurchGuyTheme
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ChurchGuyTheme {
                val navController = rememberNavController()
                NavHost(navController = navController, startDestination = "connect") {
                    composable("connect") {
                        ConnectScreen(
                            onConnect = { serverUrl, cameraToken ->
                                val encodedUrl = URLEncoder.encode(serverUrl, StandardCharsets.UTF_8.toString())
                                navController.navigate("stream/$encodedUrl/$cameraToken")
                            }
                        )
                    }
                    composable("stream/{serverUrl}/{cameraToken}") { backStackEntry ->
                        val encodedUrl = backStackEntry.arguments?.getString("serverUrl") ?: ""
                        val cameraToken = backStackEntry.arguments?.getString("cameraToken") ?: ""
                        val serverUrl = URLDecoder.decode(encodedUrl, StandardCharsets.UTF_8.toString())
                        CameraStreamScreen(
                            serverUrl = serverUrl,
                            cameraToken = cameraToken,
                            onDisconnect = {
                                navController.popBackStack("connect", inclusive = false)
                            }
                        )
                    }
                }
            }
        }
    }
}
