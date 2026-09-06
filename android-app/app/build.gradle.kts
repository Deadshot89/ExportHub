plugins {
    id("com.android.application")
}

android {
    namespace = "de.exporthub.test"
    compileSdk = 36

    defaultConfig {
        applicationId = "de.exporthub.test"
        minSdk = 29
        targetSdk = 36
        versionCode = 998
        versionName = "1.0-rc997.1"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
