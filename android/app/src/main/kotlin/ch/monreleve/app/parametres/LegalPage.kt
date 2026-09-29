package ch.monreleve.app.parametres

// AN12 increment 4. The legal pages the « À propos » section opens in the browser. Each is a LIVE web route
// (lib/content/routes.ts: mentions-legales / confidentialite / cgu are FW10, sources is FW12), so the slug is
// a verified fact, not a guess (R156 forbids parking a slug). The composition root builds the full URL from
// BuildConfig.API_BASE_URL - the emulator's host in debug, monreleve.ch in release - and opens it; the path
// stays here (R206).
enum class LegalPage(val path: String) {
    PRIVACY("/confidentialite"),
    TERMS("/cgu"),
    LEGAL("/mentions-legales"),
    SOURCES("/sources"),
}
