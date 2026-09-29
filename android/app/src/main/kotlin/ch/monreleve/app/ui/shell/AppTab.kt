package ch.monreleve.app.ui.shell

// AN10. The bottom-nav destinations that EXIST. AN11 adds RELEVE, whose screen it also builds (R282: a tab
// is advertised the moment its screen exists, not before - Parametres joins in AN12). A tab pointing at an
// unbuilt screen is the dead route R85 forbids. In its own file so it names the file (detekt
// MatchingDeclarationName), beside AppBottomBar.

enum class AppTab { AUJOURDHUI, CALENDRIER, RELEVE }
