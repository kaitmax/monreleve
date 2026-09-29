package ch.monreleve.app.ui.shell

// AN10. The bottom-nav destinations that EXIST. Releve and Parametres join when AN11/AN12 build them -
// a tab pointing at an unbuilt screen is the dead route R85 forbids (R282: never advertise what is not
// there). In its own file so it names the file (detekt MatchingDeclarationName), beside AppBottomBar.

enum class AppTab { AUJOURDHUI, CALENDRIER }
