plugins {
  alias(libs.plugins.android.application)
}

android {
  namespace = "com.kash.cleancooking"
  compileSdk = 36
  defaultConfig {
    applicationId = "com.kash.cleancooking"
    minSdk = 24
    targetSdk = 36
    versionCode = 12
    versionName = "3.1"
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  buildFeatures {
    compose = false
    aidl = false
    buildConfig = false
    shaders = false
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

kotlin {
  jvmToolchain(21)
}

dependencies {
  implementation(libs.androidx.core.ktx)
  implementation("androidx.activity:activity-ktx:1.10.1")
  implementation("androidx.webkit:webkit:1.12.1")
}
