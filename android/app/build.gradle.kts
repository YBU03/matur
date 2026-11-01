import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val kunci = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun nilaiKunci(nama: String, env: String): String? = kunci.getProperty(nama) ?: System.getenv(env)?.takeIf { it.isNotBlank() }

android {
    namespace = "id.matoer.pos"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.matoer.pos"
        minSdk = 24 // Android 7.0 ke atas
        targetSdk = 35
        // Naikkan versionCode setiap membuat APK baru, agar bisa dipasang menimpa versi lama.
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "BASE_URL", "\"https://matoer.id\"")
        buildConfigField("String", "START_PATH", "\"/pos\"")
    }

    // Kunci tanda tangan TIDAK disimpan di repo. Sumbernya (lihat docs/android-pos-panduan.md):
    // 1) file android/keystore.properties (dibuat sendiri di laptop, tidak ikut di-commit), atau
    // 2) variabel lingkungan dari GitHub Secrets saat build otomatis.
    // Bila keduanya tidak ada, APK ditandatangani kunci debug (cukup untuk uji coba).
    signingConfigs {
        if (nilaiKunci("storeFile", "MATOER_KEYSTORE_FILE") != null) {
            create("rilis") {
                storeFile = file(nilaiKunci("storeFile", "MATOER_KEYSTORE_FILE")!!)
                storePassword = nilaiKunci("storePassword", "MATOER_KEYSTORE_PASSWORD")
                keyAlias = nilaiKunci("keyAlias", "MATOER_KEY_ALIAS")
                keyPassword = nilaiKunci("keyPassword", "MATOER_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("rilis") ?: signingConfigs.getByName("debug")
        }
    }

    buildFeatures { buildConfig = true }

    // Peringatan lint tidak menghentikan pembuatan APK internal.
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

// Nama file APK: MatoerPOS-1.0.0.apk
base.archivesName.set("MatoerPOS-${android.defaultConfig.versionName}")

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.core:core-splashscreen:1.0.1")
}
