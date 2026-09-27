// Lets the pure-Kotlin core be built and tested on its own: `cd core && gradle test`.
// Inside the full project this file is ignored and :core is configured by the root build.
pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
    plugins {
        id("org.jetbrains.kotlin.jvm") version "2.1.0"
        id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0"
    }
}
dependencyResolutionManagement {
    repositories { mavenCentral() }
}
rootProject.name = "core"
