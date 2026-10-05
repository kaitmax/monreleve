package ch.monreleve.app.fr

import ch.monreleve.app.calc.Canton

// AN-PARAMS. The French name of each Swiss canton, fully accented (R155). The settings screen showed the
// enum CODE (« GE »); it now shows the name (« Genève »). The engine keeps the code (Canton enum / the stored
// Settings.canton); this is presentation only (R181 - the name is DERIVED from the canton, never a second
// source of the value). Reachable from ui/ (R238): ParametresScreen's canton row and canton edit sheet.
//
// TOTAL by construction: a `when` over the enum, so a new canton is a compile error here rather than a bare
// code leaking to the screen (CantonCopyTest asserts every member maps to a distinct, non-blank name).

object CantonCopy {
    fun name(canton: Canton): String =
        when (canton) {
            Canton.AG -> "Argovie"
            Canton.AI -> "Appenzell Rhodes-Intérieures"
            Canton.AR -> "Appenzell Rhodes-Extérieures"
            Canton.BE -> "Berne"
            Canton.BL -> "Bâle-Campagne"
            Canton.BS -> "Bâle-Ville"
            Canton.FR -> "Fribourg"
            Canton.GE -> "Genève"
            Canton.GL -> "Glaris"
            Canton.GR -> "Grisons"
            Canton.JU -> "Jura"
            Canton.LU -> "Lucerne"
            Canton.NE -> "Neuchâtel"
            Canton.NW -> "Nidwald"
            Canton.OW -> "Obwald"
            Canton.SG -> "Saint-Gall"
            Canton.SH -> "Schaffhouse"
            Canton.SO -> "Soleure"
            Canton.SZ -> "Schwytz"
            Canton.TG -> "Thurgovie"
            Canton.TI -> "Tessin"
            Canton.UR -> "Uri"
            Canton.VD -> "Vaud"
            Canton.VS -> "Valais"
            Canton.ZG -> "Zoug"
            Canton.ZH -> "Zurich"
        }
}
