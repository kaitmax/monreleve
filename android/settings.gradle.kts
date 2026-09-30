pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Mon Releve"
include(":app")

// AN-AUDIT increment 4: a minimal second app (a DIFFERENT applicationId, therefore a DIFFERENT Linux UID)
// that tries to read ch.monreleve.app's private data across the sandbox. Committed as TEST TOOLING. It lives
// OUTSIDE :app, so it structurally cannot enter the release APK - no R284 guard extension is needed.
include(":probe")
