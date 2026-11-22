package ch.monreleve.app.ui.shell

// AN10. The bottom-nav destinations that EXIST. AN11 added RELEVE and AN12 adds PARAMETRES, each the moment
// its screen exists (R282: a tab is advertised when its screen is built, not before). A tab pointing at an
// unbuilt screen is the dead route R85 forbids. With PARAMETRES the four SPEC 11 destinations are all live.
// In its own file so it names the file (detekt MatchingDeclarationName), beside AppBottomBar.

enum class AppTab { AUJOURDHUI, CALENDRIER, RELEVE, PARAMETRES }
