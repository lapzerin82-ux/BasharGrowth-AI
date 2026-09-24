package com.bashar.growthchart.sync

import android.content.Context
import com.bashar.growthchart.BuildConfig
import com.bashar.growthchart.data.AppSettings
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

@Serializable
data class CloudConfig(val apiKey: String, val appId: String, val projectId: String)

/**
 * Optional Firebase back-end (free "Spark" plan is sufficient): Firebase Authentication
 * (email + password) and Cloud Firestore for synchronisation. The Firebase project is
 * supplied either at build time (CI secrets) or at runtime by pasting google-services.json
 * in Settings. Without it the app runs in local-only mode.
 */
class CloudService(private val context: Context, private val settings: AppSettings) {

    private var app: FirebaseApp? = null

    fun config(): CloudConfig? {
        settings.cloudConfigJson?.let { txt ->
            runCatching { Json.decodeFromString(CloudConfig.serializer(), txt) }.getOrNull()?.let { return it }
        }
        if (BuildConfig.FIREBASE_API_KEY.isNotBlank() && BuildConfig.FIREBASE_APP_ID.isNotBlank() && BuildConfig.FIREBASE_PROJECT_ID.isNotBlank()) {
            return CloudConfig(BuildConfig.FIREBASE_API_KEY, BuildConfig.FIREBASE_APP_ID, BuildConfig.FIREBASE_PROJECT_ID)
        }
        return null
    }

    val isConfigured: Boolean get() = config() != null

    val isBuiltIn: Boolean get() = settings.cloudConfigJson == null && isConfigured

    @Synchronized
    private fun firebaseApp(): FirebaseApp? {
        app?.let { return it }
        val c = config() ?: return null
        val options = FirebaseOptions.Builder()
            .setApiKey(c.apiKey)
            .setApplicationId(c.appId)
            .setProjectId(c.projectId)
            .build()
        val existing = FirebaseApp.getApps(context).firstOrNull { it.name == APP_NAME }
        app = existing ?: FirebaseApp.initializeApp(context, options, APP_NAME)
        return app
    }

    fun auth(): FirebaseAuth? = firebaseApp()?.let { FirebaseAuth.getInstance(it) }

    fun firestore(): FirebaseFirestore? = firebaseApp()?.let { FirebaseFirestore.getInstance(it) }

    @Synchronized
    fun setConfig(config: CloudConfig?) {
        runCatching { auth()?.signOut() }
        runCatching { app?.delete() }
        app = null
        settings.cloudConfigJson = config?.let { Json.encodeToString(CloudConfig.serializer(), it) }
    }

    companion object {
        private const val APP_NAME = "growthchart"

        /** Extracts the three values the app needs from a google-services.json file. */
        fun parseGoogleServicesJson(text: String, packageName: String): CloudConfig {
            val root = Json.parseToJsonElement(text).jsonObject
            val projectId = root["project_info"]!!.jsonObject["project_id"]!!.jsonPrimitive.content
            val clients = root["client"] as JsonArray
            val client = clients.map { it.jsonObject }.firstOrNull {
                it["client_info"]?.jsonObject?.get("android_client_info")?.jsonObject?.get("package_name")?.jsonPrimitive?.content == packageName
            } ?: clients.first().jsonObject
            val appId = client["client_info"]!!.jsonObject["mobilesdk_app_id"]!!.jsonPrimitive.content
            val apiKey = (client["api_key"]!!.jsonArray.first() as JsonObject)["current_key"]!!.jsonPrimitive.content
            return CloudConfig(apiKey, appId, projectId)
        }
    }
}
