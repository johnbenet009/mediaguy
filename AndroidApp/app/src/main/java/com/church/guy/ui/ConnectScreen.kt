package com.church.guy.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import com.church.guy.data.DiscoveredServer
import com.church.guy.data.NetworkScanner
import kotlinx.coroutines.launch

private val Night = Color(0xFF07111F)
private val Panel = Color(0xFF101E30)
private val Mint = Color(0xFF57E0C1)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnectScreen(onConnect: (serverUrl: String, cameraToken: String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var scanning by remember { mutableStateOf(false) }
    var discoveredServers by remember { mutableStateOf<List<DiscoveredServer>>(emptyList()) }
    var scanMessage by remember { mutableStateOf("Searching this Wi-Fi network for MediaGuy...") }

    val scan: () -> Unit = {
        scanning = true
        scanMessage = "Searching this Wi-Fi network for MediaGuy..."
        scope.launch {
            val found = NetworkScanner.discoverServers(context)
            discoveredServers = found
            scanMessage = if (found.isEmpty()) {
                "No MediaGuy desktop found. Check that both devices are on the same Wi-Fi and Remote Access is running."
            } else {
                "${found.size} MediaGuy ${if (found.size == 1) "desktop" else "desktops"} found. Select one to connect."
            }
            scanning = false
        }
    }

    LaunchedEffect(Unit) { scan() }

    Scaffold(containerColor = Night) { insets ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(insets)
                .background(Brush.verticalGradient(listOf(Color(0xFF0D2031), Night)))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 24.dp, vertical = 22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(shape = RoundedCornerShape(14.dp), color = Mint.copy(alpha = 0.14f)) {
                        Text("⌁", color = Mint, fontSize = 23.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("MEDIAGUY CAMERA", color = Mint, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
                        Text("Connect to your stage", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(Modifier.height(30.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(22.dp),
                    color = Panel,
                    tonalElevation = 4.dp
                ) {
                    Column(Modifier.padding(20.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Nearby desktops", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(5.dp))
                                Text("Automatic Wi-Fi discovery", color = Color(0xFF9EB0C5), fontSize = 13.sp)
                            }
                            IconButton(onClick = scan, enabled = !scanning) {
                                if (scanning) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Mint, strokeWidth = 2.dp)
                                else Text("↻", color = Mint, fontSize = 22.sp)
                            }
                        }
                        Spacer(Modifier.height(14.dp))
                        Text(scanMessage, color = if (discoveredServers.isEmpty() && !scanning) Color(0xFFFFC078) else Color(0xFFB7C7D9), fontSize = 13.sp, lineHeight = 19.sp)
                        if (discoveredServers.isNotEmpty()) {
                            Spacer(Modifier.height(14.dp))
                            LazyColumn(
                                modifier = Modifier.heightIn(max = 300.dp),
                                verticalArrangement = Arrangement.spacedBy(9.dp)
                            ) {
                                items(discoveredServers) { server ->
                                    Surface(
                                        onClick = { onConnect(server.url, server.cameraToken) },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(14.dp),
                                        color = Color(0xFF172A3E),
                                        border = BorderStroke(1.dp, Color(0xFF29435B))
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 15.dp, vertical = 13.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text("⌁", color = Mint, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                            Spacer(Modifier.width(12.dp))
                                            Column(Modifier.weight(1f)) {
                                                Text("MediaGuy desktop", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                                Text(server.url.removePrefix("http://"), color = Color(0xFF9EB0C5), fontSize = 12.sp)
                                            }
                                            Text("CONNECT", color = Mint, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 0.7.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.weight(1f))
                Text(
                    "Keep this phone on the same Wi-Fi as the MediaGuy computer.",
                    color = Color(0xFF8499AE),
                    fontSize = 12.sp
                )
            }
        }
    }
}
