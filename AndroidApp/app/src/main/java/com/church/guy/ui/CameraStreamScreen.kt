package com.church.guy.ui

import android.Manifest
import android.content.pm.PackageManager
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.Matrix
import android.util.Base64
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn as AndroidOptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.church.guy.data.ServerConnectionManager
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

private val CameraMint = Color(0xFF63E6C5)
private val CameraInk = Color(0xFF07111D)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CameraStreamScreen(
    serverUrl: String,
    cameraToken: String,
    onDisconnect: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val activity = remember(context) { context as? android.app.Activity }

    DisposableEffect(activity) {
        val previousOrientation = activity?.requestedOrientation
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        onDispose {
            if (previousOrientation != null) activity?.requestedOrientation = previousOrientation
        }
    }

    var hasPermissions by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasPermissions = granted
    }
    LaunchedEffect(Unit) {
        if (!hasPermissions) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    val connectionManager = remember { ServerConnectionManager() }
    val isConnected by connectionManager.isConnected.collectAsState()
    val isAuthed by connectionManager.isAuthed.collectAsState()
    val authError by connectionManager.authError.collectAsState()
    val clientId by connectionManager.clientId.collectAsState()
    val incomingMessage by connectionManager.incomingMessage.collectAsState()

    var useFrontCamera by remember { mutableStateOf(false) }
    var registered by remember { mutableStateOf(false) }
    var showChat by remember { mutableStateOf(false) }
    var chatText by remember { mutableStateOf("") }

    LaunchedEffect(serverUrl, cameraToken) {
        if (serverUrl.isNotBlank()) connectionManager.connect(serverUrl, cameraToken)
    }
    LaunchedEffect(isAuthed, clientId) {
        if (!isAuthed) {
            registered = false
        } else if (clientId.isNotBlank() && !registered) {
            connectionManager.registerCamera("MediaGuy Android Cam ${clientId.takeLast(4)}")
            registered = true
        }
    }
    DisposableEffect(Unit) {
        onDispose { connectionManager.disconnect() }
    }

    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    DisposableEffect(cameraExecutor) {
        onDispose { cameraExecutor.shutdown() }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .background(CameraInk)
    ) {
        if (hasPermissions) {
            Row(Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .background(Color.Black)
                ) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { ctx ->
                            PreviewView(ctx).apply {
                                scaleType = PreviewView.ScaleType.FILL_CENTER
                                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                            }
                        },
                        update = { previewView ->
                            val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
                            cameraProviderFuture.addListener({
                                val cameraProvider = cameraProviderFuture.get()
                                val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
                                val selector = if (useFrontCamera) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
                                val analysis = ImageAnalysis.Builder()
                                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                    .build()
                                analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                                    processAndSendFrame(imageProxy, isAuthed) { frame -> connectionManager.sendSignal("host", frame) }
                                }
                                try {
                                    cameraProvider.unbindAll()
                                    cameraProvider.bindToLifecycle(lifecycleOwner, selector, preview, analysis)
                                } catch (error: Exception) {
                                    Log.e("CameraStream", "Camera binding failed", error)
                                }
                            }, ContextCompat.getMainExecutor(context))
                        }
                    )

                    CompositionGuide(Modifier.fillMaxSize())

                    Row(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(Modifier.size(8.dp).background(if (isAuthed) CameraMint else Color(0xFFFFC46B), CircleShape))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = when {
                                authError.isNotEmpty() -> authError
                                isAuthed -> "LIVE · LANDSCAPE"
                                isConnected -> "AUTHENTICATING"
                                else -> "CONNECTING"
                            },
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            modifier = Modifier
                                .background(Color(0xB807111D), RoundedCornerShape(20.dp))
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        )
                    }

                    if (!isAuthed && authError.isNotEmpty()) {
                        Text(
                            authError,
                            color = Color.White,
                            fontSize = 14.sp,
                            modifier = Modifier.align(Alignment.Center).background(Color(0xDD172537), RoundedCornerShape(12.dp)).padding(18.dp)
                        )
                    }
                    Text(
                        "Turn on Auto-rotate and hold your phone sideways. Keep the subject inside the guide.",
                        color = Color.White.copy(alpha = 0.9f),
                        fontSize = 11.sp,
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 12.dp)
                            .background(Color(0xB807111D), RoundedCornerShape(18.dp))
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    )
                }

                Column(
                    modifier = Modifier
                        .width(104.dp)
                        .fillMaxHeight()
                        .background(Color(0xFF0B1725))
                        .border(width = 1.dp, color = Color(0xFF1D3144)),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("MEDIAGUY", color = Color(0xFF91A9BE), fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.1.sp)
                    Spacer(Modifier.height(20.dp))
                    CameraAction("End", "■", Color(0xFFFF6678), onDisconnect)
                    Spacer(Modifier.height(12.dp))
                    CameraAction("Audio N/A", "×", Color(0xFF8193A7), null, enabled = false)
                    Spacer(Modifier.height(12.dp))
                    CameraAction("Switch", "↻", CameraMint, onClick = { useFrontCamera = !useFrontCamera })
                    Spacer(Modifier.height(12.dp))
                    CameraAction("Chat", "···", CameraMint, onClick = { showChat = true })
                    Spacer(Modifier.height(20.dp))
                    Text(
                        text = if (isAuthed) "VIDEO LIVE" else "NOT LIVE",
                        color = if (isAuthed) CameraMint else Color(0xFFFFC46B),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp
                    )
                }
            }
        } else {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                    Text("Grant camera permission")
                }
            }
        }
    }

    if (showChat) {
        AlertDialog(
            onDismissRequest = { showChat = false },
            containerColor = Color(0xFF102034),
            titleContentColor = Color.White,
            textContentColor = Color(0xFFD8E3EE),
            title = { Text("Message the stage operator") },
            text = {
                OutlinedTextField(
                    value = chatText,
                    onValueChange = { chatText = it },
                    label = { Text("Message") },
                    maxLines = 4
                )
            },
            confirmButton = {
                TextButton(
                    enabled = chatText.isNotBlank() && isAuthed,
                    onClick = {
                        connectionManager.sendOperatorMessage(chatText.trim())
                        chatText = ""
                        showChat = false
                    }
                ) { Text("Send", color = CameraMint) }
            },
            dismissButton = { TextButton(onClick = { showChat = false }) { Text("Cancel", color = Color.LightGray) } }
        )
    }

    incomingMessage?.let { message ->
        AlertDialog(
            onDismissRequest = {},
            containerColor = Color(0xFF102034),
            titleContentColor = Color.White,
            textContentColor = Color(0xFFD8E3EE),
            title = { Text("Message from stage") },
            text = {
                Column {
                    Text(message.text)
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = chatText,
                        onValueChange = { chatText = it },
                        label = { Text("Reply (optional)") },
                        textStyle = TextStyle(color = Color.White),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            cursorColor = CameraMint,
                            focusedBorderColor = CameraMint,
                            unfocusedBorderColor = Color(0xFF53677D),
                            focusedLabelColor = CameraMint,
                            unfocusedLabelColor = Color(0xFFB7C7D9)
                        )
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (chatText.isNotBlank()) connectionManager.replyToOperator(message.id, chatText.trim())
                    connectionManager.acknowledgeMessage(message.id)
                    chatText = ""
                    connectionManager.clearMessage()
                }) { Text("Send & acknowledge", color = CameraMint) }
            },
            dismissButton = {
                TextButton(onClick = {
                    connectionManager.acknowledgeMessage(message.id)
                    connectionManager.clearMessage()
                }) { Text("Okay", color = Color.LightGray) }
            }
        )
    }
}

@Composable
private fun CameraAction(label: String, glyph: String, tint: Color, onClick: (() -> Unit)?, enabled: Boolean = true) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Surface(
            onClick = { onClick?.invoke() },
            enabled = enabled,
            shape = CircleShape,
            color = if (enabled) tint.copy(alpha = 0.13f) else Color(0xFF182432),
            border = androidx.compose.foundation.BorderStroke(1.dp, tint.copy(alpha = if (enabled) 0.6f else 0.22f)),
            modifier = Modifier.size(58.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(glyph, color = tint.copy(alpha = if (enabled) 1f else 0.55f), fontSize = 25.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.height(5.dp))
        Text(label, color = if (enabled) Color(0xFFD5E1EC) else Color(0xFF758599), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun CompositionGuide(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val frameWidth = size.width * 0.72f
        val frameHeight = size.height * 0.72f
        val left = (size.width - frameWidth) / 2f
        val top = (size.height - frameHeight) / 2f
        val guideColor = Color.White.copy(alpha = 0.58f)
        val thin = 1.dp.toPx()
        val corner = 24.dp.toPx()

        drawRoundRect(
            color = Color.White.copy(alpha = 0.08f),
            topLeft = Offset(left, top),
            size = Size(frameWidth, frameHeight),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(18.dp.toPx()),
            style = Stroke(width = thin)
        )
        for (index in 1..2) {
            val x = left + frameWidth * index / 3f
            val y = top + frameHeight * index / 3f
            drawLine(guideColor.copy(alpha = 0.38f), Offset(x, top), Offset(x, top + frameHeight), thin)
            drawLine(guideColor.copy(alpha = 0.38f), Offset(left, y), Offset(left + frameWidth, y), thin)
        }
        val path = Path().apply {
            moveTo(left, top + corner); lineTo(left, top); lineTo(left + corner, top)
            moveTo(left + frameWidth - corner, top); lineTo(left + frameWidth, top); lineTo(left + frameWidth, top + corner)
            moveTo(left, top + frameHeight - corner); lineTo(left, top + frameHeight); lineTo(left + corner, top + frameHeight)
            moveTo(left + frameWidth - corner, top + frameHeight); lineTo(left + frameWidth, top + frameHeight); lineTo(left + frameWidth, top + frameHeight - corner)
        }
        drawPath(path, guideColor, style = Stroke(width = 3.dp.toPx()))
    }
}

private var lastFrameTime = 0L

@AndroidOptIn(ExperimentalGetImage::class)
private fun processAndSendFrame(
    imageProxy: androidx.camera.core.ImageProxy,
    isAuthed: Boolean,
    onSend: (JSONObject) -> Unit
) {
    val now = System.currentTimeMillis()
    if (now - lastFrameTime > 80 && isAuthed) {
        lastFrameTime = now
        try {
            val bitmap = imageProxy.toBitmap()
            if (bitmap != null) {
                val rotation = imageProxy.imageInfo.rotationDegrees
                val rotatedBitmap = if (rotation == 0) bitmap else Bitmap.createBitmap(
                    bitmap,
                    0,
                    0,
                    bitmap.width,
                    bitmap.height,
                    Matrix().apply { postRotate(rotation.toFloat()) },
                    true
                )
                val landscapeBitmap = if (rotatedBitmap.height > rotatedBitmap.width) {
                    Bitmap.createBitmap(
                        rotatedBitmap,
                        0,
                        0,
                        rotatedBitmap.width,
                        rotatedBitmap.height,
                        Matrix().apply { postRotate(90f) },
                        true
                    )
                } else rotatedBitmap
                val outputStream = ByteArrayOutputStream()
                landscapeBitmap.compress(Bitmap.CompressFormat.JPEG, 62, outputStream)
                val encoded = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
                onSend(JSONObject().put("type", "video-frame").put("frame", encoded))
            }
        } catch (error: Exception) {
            Log.e("CameraStream", "Frame conversion error", error)
        }
    }
    imageProxy.close()
}
