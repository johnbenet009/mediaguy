package com.church.guy.data

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class StageMessage(
    val id: String,
    val text: String
)

class ServerConnectionManager {
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val _isAuthed = MutableStateFlow(false)
    val isAuthed: StateFlow<Boolean> = _isAuthed

    private val _authError = MutableStateFlow("")
    val authError: StateFlow<String> = _authError

    private val _clientId = MutableStateFlow("")
    val clientId: StateFlow<String> = _clientId

    private val _incomingMessage = MutableStateFlow<StageMessage?>(null)
    val incomingMessage: StateFlow<StageMessage?> = _incomingMessage

    var onSignalReceived: ((String, JSONObject) -> Unit)? = null

    fun connect(serverUrl: String, cameraToken: String) {
        disconnect()
        // Convert http://host:port to ws://host:port/ws
        val wsUrl = serverUrl
            .trimEnd('/')
            .replace("https://", "wss://")
            .replace("http://", "ws://") + "/ws"

        val request = Request.Builder().url(wsUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _isConnected.value = true
                Log.d("ServerConn", "WebSocket connected, sending hello")
                // Send hello message
                val hello = JSONObject().apply {
                    put("type", "hello")
                    put("role", "camera")
                    put("cameraToken", cameraToken)
                }
                webSocket.send(hello.toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type")
                    if (type == "auth") {
                        _isAuthed.value = json.optBoolean("ok", false)
                        _authError.value = when (json.optString("reason")) {
                            "invalid-camera-token" -> "Camera invitation is invalid or expired. Scan a new QR code from the desktop camera mixer."
                            else -> ""
                        }
                        _clientId.value = json.optString("clientId", "")
                        Log.d("ServerConn", "Auth received: authed=${_isAuthed.value}, clientId=${_clientId.value}")
                    } else if (type == "signal") {
                        val from = json.optString("from")
                        val payload = json.optJSONObject("payload")
                        if (from.isNotEmpty() && payload != null) {
                            if (payload.optString("type") == "camera-message") {
                                val msgId = payload.optString("id")
                                val msgText = payload.optString("text")
                                if (msgId.isNotEmpty()) {
                                    _incomingMessage.value = StageMessage(msgId, msgText)
                                }
                            }
                            onSignalReceived?.invoke(from, payload)
                        }
                    }
                } catch (e: Exception) {
                    Log.e("ServerConn", "Error parsing message", e)
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false
                _isAuthed.value = false
                Log.d("ServerConn", "WebSocket closed: $reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _isConnected.value = false
                _isAuthed.value = false
                Log.e("ServerConn", "WebSocket failure", t)
            }
        })
    }

    fun sendSignal(to: String, payload: JSONObject) {
        val msg = JSONObject().apply {
            put("type", "signal")
            put("to", to)
            put("payload", payload)
        }
        webSocket?.send(msg.toString())
    }

    fun registerCamera(label: String) {
        val payload = JSONObject().apply {
            put("type", "register")
            put("label", label)
        }
        sendSignal("host", payload)
    }

    fun sendOperatorMessage(text: String) {
        sendSignal("host", JSONObject().apply {
            put("type", "camera-operator-message")
            put("id", "phone-${System.currentTimeMillis()}")
            put("text", text)
        })
    }

    fun replyToOperator(id: String, text: String) {
        sendSignal("host", JSONObject().apply {
            put("type", "camera-message-reply")
            put("id", id)
            put("text", text)
        })
    }

    fun acknowledgeMessage(id: String) {
        sendSignal("host", JSONObject().apply {
            put("type", "camera-message-ack")
            put("id", id)
        })
    }

    fun unregisterCamera() {
        val payload = JSONObject().apply {
            put("type", "unregister")
        }
        sendSignal("host", payload)
    }

    fun clearMessage() {
        _incomingMessage.value = null
    }

    fun disconnect() {
        try {
            unregisterCamera()
            webSocket?.close(1000, "App closing")
        } catch (_: Exception) {}
        webSocket = null
        _isConnected.value = false
        _isAuthed.value = false
    }
}
