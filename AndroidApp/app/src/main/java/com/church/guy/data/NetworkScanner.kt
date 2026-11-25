package com.church.guy.data

import android.content.Context
import android.net.wifi.WifiManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.InetAddress
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit

data class DiscoveredServer(
    val url: String,
    val cameraToken: String
)

object NetworkScanner {
    private val client = OkHttpClient.Builder()
        .connectTimeout(800, TimeUnit.MILLISECONDS)
        .readTimeout(800, TimeUnit.MILLISECONDS)
        .build()

    suspend fun discoverServers(context: Context): List<DiscoveredServer> = withContext(Dispatchers.IO) {
        val subnet = getSubnetPrefix(context) ?: return@withContext emptyList()
        val deferreds = (1..254).map { i ->
            async(Dispatchers.IO) {
                val ip = "$subnet$i"
                val url = "http://$ip:9174"
                try {
                    val request = Request.Builder().url("$url/camera-invite.json").build()
                    client.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            val token = JSONObject(response.body?.string().orEmpty()).optString("cameraToken")
                            if (token.isNotBlank()) DiscoveredServer(url, token) else null
                        } else null
                    }
                } catch (_: Exception) {
                    null
                }
            }
        }
        deferreds.awaitAll().filterNotNull()
    }

    private fun getSubnetPrefix(context: Context): String? {
        try {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val wifiInfo = wifiManager?.connectionInfo
            val ipInt = wifiInfo?.ipAddress ?: return null
            if (ipInt == 0) return null
            val ipBytes = ByteArray(4) {
                (ipInt shr (it * 8) and 0xFF).toByte()
            }
            val addr = InetAddress.getByAddress(ipBytes)
            val ipStr = addr.hostAddress ?: return null
            val lastDot = ipStr.lastIndexOf('.')
            if (lastDot != -1) {
                return ipStr.substring(0, lastDot + 1)
            }
        } catch (_: Exception) {}
        return null
    }
}
