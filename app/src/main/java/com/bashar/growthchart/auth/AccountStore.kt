package com.bashar.growthchart.auth

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * A clinician account known on this device. Only a salted PBKDF2 verifier of the
 * password is kept (never the password). Keys are wrapped by the Android Keystore.
 */
@Serializable
data class LocalAccount(
    val email: String,
    val verifierSalt: String,
    val verifierIterations: Int,
    val verifierHash: String,
    val wrappedDbKey: String,
    val dbName: String,
    val firebaseUid: String? = null,
    val wrappedCloudKey: String? = null,
)

class AccountStore(context: Context) {
    private val prefs = context.getSharedPreferences("accounts_v1", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    @Synchronized
    fun all(): List<LocalAccount> = prefs.getString("accounts", null)?.let {
        runCatching { json.decodeFromString(ListSerializer(LocalAccount.serializer()), it) }.getOrNull()
    } ?: emptyList()

    fun get(email: String): LocalAccount? = all().firstOrNull { it.email == email }

    @Synchronized
    fun put(account: LocalAccount) {
        val list = all().filter { it.email != account.email } + account
        prefs.edit().putString("accounts", json.encodeToString(ListSerializer(LocalAccount.serializer()), list)).apply()
    }

    var currentEmail: String?
        get() = prefs.getString("current", null)
        set(v) { prefs.edit().putString("current", v).apply() }
}
