import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

/** Reads a value from the environment (CI secrets) or ~/.gradle/gradle.properties. */
fun config(name: String, default: String = ""): String =
    System.getenv(name)?.takeIf { it.isNotBlank() } ?: (project.findProperty(name) as String?) ?: default

val buildNumber = config("GITHUB_RUN_NUMBER", "1").toIntOrNull() ?: 1

android {
    namespace = "com.bashar.growthchart"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bashar.growthchart"
        minSdk = 26
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"

        // Optional Firebase project for cloud sync (can also be entered in Settings at runtime).
        buildConfigField("String", "FIREBASE_API_KEY", "\"${config("FIREBASE_API_KEY")}\"")
        buildConfigField("String", "FIREBASE_APP_ID", "\"${config("FIREBASE_APP_ID")}\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"${config("FIREBASE_PROJECT_ID")}\"")
    }

    signingConfigs {
        create("release") {
            // A fixed signing key is required so that new APK versions install as updates
            // (keeping the patient database). Override with your own key via CI secrets.
            storeFile = file(config("SIGNING_KEYSTORE_PATH", "${rootDir}/keystore/growthchart-release.jks"))
            storePassword = config("SIGNING_STORE_PASSWORD", "growthchart")
            keyAlias = config("SIGNING_KEY_ALIAS", "growthchart")
            keyPassword = config("SIGNING_KEY_PASSWORD", "growthchart")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation(project(":core"))

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")

    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")

    // Local encrypted database: Room on top of SQLCipher
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("net.zetetic:sqlcipher-android:4.6.1@aar")
    implementation("androidx.sqlite:sqlite-ktx:2.4.0")

    // Optional cloud account + sync
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")
}
