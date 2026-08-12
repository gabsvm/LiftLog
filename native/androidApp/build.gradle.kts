import org.jetbrains.kotlin.gradle.dsl.JvmTarget

fun buildConfigString(value: String): String =
    "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

val nativeSupabaseUrl = project.findProperty("nativeSupabaseUrl")?.toString()
    ?: System.getenv("LIFTLOG_SUPABASE_URL")
    ?: ""
val nativeSupabaseAnonKey = project.findProperty("nativeSupabaseAnonKey")?.toString()
    ?: System.getenv("LIFTLOG_SUPABASE_ANON_KEY")
    ?: ""

plugins {
    id("com.android.application")
    kotlin("android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.gabsvm.liftlog.nativeapp"
    compileSdk = 36

    defaultConfig {
        applicationId = project.findProperty("nativeApplicationId")?.toString()
            ?: "com.gabsvm.liftlog.nativeapp"
        minSdk = 29
        targetSdk = 36
        versionCode = project.findProperty("nativeVersionCode")?.toString()?.toIntOrNull() ?: 1
        versionName = project.findProperty("nativeVersionName")?.toString() ?: "0.1.0-native"
    }

    signingConfigs {
        create("release") {
            storeFile = rootProject.file("../app/android/app/debug.keystore")
            storePassword = project.findProperty("nativeStorePassword")?.toString() ?: "android"
            keyAlias = project.findProperty("nativeKeyAlias")?.toString() ?: "androiddebugkey"
            keyPassword = project.findProperty("nativeKeyPassword")?.toString() ?: "android"
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
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

    buildTypes.configureEach {
        buildConfigField("String", "NATIVE_SUPABASE_URL", buildConfigString(nativeSupabaseUrl))
        buildConfigField("String", "NATIVE_SUPABASE_ANON_KEY", buildConfigString(nativeSupabaseAnonKey))
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":shared"))
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.9.4")
    implementation("androidx.health.connect:connect-client:1.1.0-alpha11")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
