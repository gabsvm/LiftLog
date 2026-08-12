package com.gabsvm.liftlog.nativeapp.data

import android.content.Context
import com.gabsvm.liftlog.nativeapp.BuildConfig
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.Locale
import org.json.JSONArray
import org.json.JSONObject

data class SupabaseCloudState(
    val configured: Boolean,
    val email: String? = null,
)

/** Small Android-only client for the existing private LiftLog backup contract. */
class SupabaseBackupClient(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val baseUrl = BuildConfig.NATIVE_SUPABASE_URL.trimEnd('/')
    private val anonKey = BuildConfig.NATIVE_SUPABASE_ANON_KEY

    val isConfigured: Boolean
        get() = baseUrl.isNotBlank() && anonKey.isNotBlank()

    fun state(): SupabaseCloudState = SupabaseCloudState(
        configured = isConfigured,
        email = preferences.getString(EMAIL_KEY, null),
    )

    fun signOut() {
        preferences.edit().clear().apply()
    }

    fun signIn(email: String, password: String): SupabaseCloudState {
        require(isConfigured) { "Supabase no está configurado en este APK" }
        require(email.isNotBlank() && password.isNotBlank()) { "Correo y contraseña son obligatorios" }
        val response = request(
            method = "POST",
            url = "$baseUrl/auth/v1/token?grant_type=password",
            body = JSONObject().put("email", email.trim()).put("password", password).toString().toByteArray(),
            contentType = "application/json",
        )
        require(response.code in 200..299) { response.errorMessage() }
        val json = JSONObject(response.body)
        val user = json.optJSONObject("user") ?: error("Supabase no devolvió el usuario")
        preferences.edit()
            .putString(ACCESS_TOKEN_KEY, json.getString("access_token"))
            .putString(REFRESH_TOKEN_KEY, json.optString("refresh_token").takeIf(String::isNotBlank))
            .putString(USER_ID_KEY, user.getString("id"))
            .putString(EMAIL_KEY, user.optString("email", email.trim()))
            .apply()
        return state()
    }

    fun signUp(email: String, password: String): SupabaseCloudState {
        require(isConfigured) { "Supabase no está configurado en este APK" }
        require(email.isNotBlank() && password.isNotBlank()) { "Correo y contraseña son obligatorios" }
        val response = request(
            method = "POST",
            url = "$baseUrl/auth/v1/signup",
            body = JSONObject().put("email", email.trim()).put("password", password).toString().toByteArray(),
            contentType = "application/json",
        )
        require(response.code in 200..299) { response.errorMessage() }
        val json = JSONObject(response.body)
        val accessToken = json.optString("access_token").takeIf(String::isNotBlank)
        val user = json.optJSONObject("user")
        if (accessToken != null && user != null) {
            preferences.edit()
                .putString(ACCESS_TOKEN_KEY, accessToken)
                .putString(REFRESH_TOKEN_KEY, json.optString("refresh_token").takeIf(String::isNotBlank))
                .putString(USER_ID_KEY, user.getString("id"))
                .putString(EMAIL_KEY, user.optString("email", email.trim()))
                .apply()
        }
        return state().copy(email = state().email ?: email.trim())
    }

    fun uploadBackup(jsonText: String): String {
        val userId = requireUserId()
        val token = requireToken()
        val bytes = jsonText.toByteArray(Charsets.UTF_8)
        val hash = sha256(bytes)
        val storagePath = "$userId/$hash.native.json"
        val encodedPath = storagePath.split('/').joinToString("/") { URLEncoder.encode(it, Charsets.UTF_8.name()) }
        val upload = request(
            method = "POST",
            url = "$baseUrl/storage/v1/object/liftlog-backups/$encodedPath",
            token = token,
            body = bytes,
            contentType = "application/json",
        )
        require(upload.code in 200..299 || upload.code == 409) { upload.errorMessage() }

        val metadata = JSONObject()
            .put("user_id", userId)
            .put("storage_path", storagePath)
            .put("byte_size", bytes.size)
            .put("content_hash", hash)
            .put("include_feed", false)
        val metadataResponse = request(
            method = "POST",
            url = "$baseUrl/rest/v1/user_backup_metadata",
            token = token,
            body = metadata.toString().toByteArray(),
            contentType = "application/json",
        )
        require(metadataResponse.code in 200..299 || metadataResponse.code == 409) {
            metadataResponse.errorMessage()
        }
        return hash
    }

    fun downloadLatestBackup(): String? {
        val userId = requireUserId()
        val token = requireToken()
        val query = "user_id=eq.${URLEncoder.encode(userId, Charsets.UTF_8.name())}" +
            "&select=storage_path&order=created_at.desc&limit=1"
        val metadataResponse = request(
            method = "GET",
            url = "$baseUrl/rest/v1/user_backup_metadata?$query",
            token = token,
        )
        require(metadataResponse.code in 200..299) { metadataResponse.errorMessage() }
        val metadata = JSONArray(metadataResponse.body)
        if (metadata.length() == 0) return null
        val storagePath = metadata.getJSONObject(0).getString("storage_path")
        val encodedPath = storagePath.split('/').joinToString("/") { URLEncoder.encode(it, Charsets.UTF_8.name()) }
        val fileResponse = request(
            method = "GET",
            url = "$baseUrl/storage/v1/object/liftlog-backups/$encodedPath",
            token = token,
        )
        require(fileResponse.code in 200..299) { fileResponse.errorMessage() }
        return fileResponse.body
    }

    private fun requireUserId(): String = preferences.getString(USER_ID_KEY, null)
        ?: error("Inicia sesión antes de sincronizar")

    private fun requireToken(): String = preferences.getString(ACCESS_TOKEN_KEY, null)
        ?: error("La sesión de Supabase expiró; inicia sesión nuevamente")

    private fun request(
        method: String,
        url: String,
        token: String? = null,
        body: ByteArray? = null,
        contentType: String? = null,
    ): SupabaseResponse {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 30_000
            setRequestProperty("apikey", anonKey)
            token?.let { setRequestProperty("Authorization", "Bearer $it") }
            contentType?.let { setRequestProperty("Content-Type", it) }
            if (body != null) doOutput = true
        }
        return try {
            if (body != null) connection.outputStream.use { it.write(body) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            SupabaseResponse(code, responseBody)
        } catch (error: IOException) {
            throw IOException("No se pudo conectar con Supabase: ${error.message}", error)
        } finally {
            connection.disconnect()
        }
    }

    private data class SupabaseResponse(val code: Int, val body: String) {
        fun errorMessage(): String = runCatching {
            val json = JSONObject(body)
            json.optString("msg").ifBlank { json.optString("message") }
                .ifBlank { json.optString("error_description") }
        }.getOrNull().orEmpty().ifBlank { "Supabase respondió HTTP $code" }
    }

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { byte -> "%02x".format(Locale.ROOT, byte) }

    private companion object {
        const val PREFS = "liftlog_supabase"
        const val ACCESS_TOKEN_KEY = "access_token"
        const val REFRESH_TOKEN_KEY = "refresh_token"
        const val USER_ID_KEY = "user_id"
        const val EMAIL_KEY = "email"
    }
}
