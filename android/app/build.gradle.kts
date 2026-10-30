import java.util.Properties

plugins {
    id("com.android.application")
    id("com.chaquo.python")
}

// Boom 본체(저장소 루트의 .py 와 static/)를 그대로 쓴다. 버전도 version.py 하나만 고치면 된다
val boomRoot: File = rootDir.parentFile
val boomVersion: String = Regex("__version__\\s*=\\s*\"([^\"]+)\"")
    .find(boomRoot.resolve("version.py").readText())!!.groupValues[1]
val local = Properties().apply {
    rootDir.resolve("local.properties").takeIf { it.exists() }?.reader(Charsets.UTF_8)?.use { load(it) }
}

android {
    namespace = "com.boom.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.boom.app"
        minSdk = 29
        targetSdk = 36
        versionName = boomVersion
        versionCode = boomVersion.split(".").map { it.toInt() }.let { (a, b, c) -> a * 10000 + b * 100 + c }
        ndk { abiFilters += listOf("arm64-v8a", "x86_64") }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets.getByName("main").assets.srcDir(file("build/boom-assets"))
}

chaquopy {
    defaultConfig {
        version = "3.12"
        local.getProperty("boom.buildPython")?.let { buildPython(it) }
        pip {
            install("boto3")
            install("flask")
        }
    }
    sourceSets.getByName("main") { srcDir(file("build/boom-py")) }
}

val syncBoomPy by tasks.registering(Sync::class) {
    from(boomRoot) {
        include("app.py", "aws_resources.py", "creds_store.py", "fx.py", "updater.py", "window_mode.py", "version.py")
    }
    into(file("build/boom-py"))
}
// 화면 파일은 assets 로 넣고, 앱이 처음 켜질 때 내부 저장소로 풀어 Flask 가 읽게 한다 (MainActivity.unpackAssets)
val syncBoomAssets by tasks.registering(Sync::class) {
    from(boomRoot) { include("static/**", "app.ico") }
    into(file("build/boom-assets/boom"))
}
tasks.named("preBuild") { dependsOn(syncBoomPy, syncBoomAssets) }
tasks.matching { it.name.endsWith("PythonSources") }.configureEach { dependsOn(syncBoomPy) }
