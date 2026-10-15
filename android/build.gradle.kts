// Top-level build file. Configuration common to all modules.
plugins {
    alias(libs.plugins.android.application) apply false
    // KMP-0 increment 1 (R368): the :shared module's plugins, declared here so their versions are pinned
    // once on the build classpath and applied without a version in shared/build.gradle.kts.
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.multiplatform) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ktlint) apply false
    alias(libs.plugins.detekt) apply false
}
