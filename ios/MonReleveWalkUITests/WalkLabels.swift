// ios/MonReleveWalkUITests/WalkLabels.swift
//
// IOS-WALK (I2). THE LABELS THE WALK MATCHES, EACH THE COMMON COPY'S OWN TEXT. The app has no test tags, so the walk
// finds Compose elements by the accessibility label the shared copy gives them. Every literal below is followed by the
// copy file and constant it comes from, and the workflow REFUSES TO RUN unless each literal appears, quoted and byte for
// byte, in android/shared/src/commonMain/kotlin/ch/monreleve/app/fr/<File>.kt (.github/scripts/ios-walk-labels.py) -
// so a copy change fails the walk before it starts rather than reading as a missing screen (R181: derived, checked;
// never a loose transcription). Typographic apostrophes (U+2019) and accents are the copy's own.

enum L {
    static let welcomeStart = "Commencer" // WelcomeCopy.START
    static let signInSubmit = "Recevoir mon lien de connexion" // SignInCopy.SUBMIT
    static let emailLabel = "Adresse e-mail" // SignInCopy.EMAIL_LABEL
    static let codeLabel = "Code à 6 chiffres" // CodeCopy.CODE_LABEL
    static let onbNameLabel = "Prénom et nom" // OnboardingCopy.NAME_LABEL
    // The first of the six code boxes: CodeCopy.digitLabel(1) - a template ("Chiffre $position sur 6"), so not
    // checked as a literal; run 45073103807 showed the boxes labelled this way.
    static let codeDigit1 = "Chiffre 1 sur 6"
    static let codeTitle = "Vérifiez votre messagerie" // CodeCopy.TITLE
    static let codeSubmit = "Valider le code" // CodeCopy.SUBMIT
    static let onbContinue = "Continuer" // OnboardingCopy.CONTINUE
    static let onbNameTitle = "Votre nom" // OnboardingCopy.NAME_TITLE
    static let onbCantonTitle = "Canton de votre employeur" // OnboardingCopy.CANTON_TITLE
    static let cantonGeneve = "Genève" // CantonCopy.GE
    static let onbRateTitle = "Votre taux d’activité" // OnboardingCopy.RATE_TITLE
    static let onbRate100 = "100 %" // OnboardingCopy.RATE_100
    static let onbMethodTitle = "Méthode de décompte" // OnboardingCopy.METHOD_LABEL
    static let onbMethodSimplified = "Méthode simplifiée" // OnboardingCopy.METHOD_SIMPLIFIED_TITLE
    static let onbGranularityTitle = "Comment comptez-vous vos journées ?" // OnboardingCopy.GRANULARITY_TITLE
    static let onbGranularityDay = "Journées entières" // OnboardingCopy.GRANULARITY_DAY
    static let onbPeriodTitle = "Avez-vous travaillé toute l’année chez cet employeur ?" // OnboardingCopy.PERIOD_TITLE
    static let onbPeriodPart = "Non, j’ai commencé en cours d’année" // OnboardingCopy.PERIOD_PART_TITLE
    static let onbPeriodAll = "Oui, depuis le 1ᵉʳ janvier" // OnboardingCopy.PERIOD_ALL_TITLE
    static let onbModeTitle = "Comment enregistrer vos journées ?" // OnboardingCopy.MODE_TITLE
    static let onbModeManual = "Manuellement" // OnboardingCopy.MODE_MANUAL_TITLE
    static let onbReminderTitle = "Un rappel le soir ?" // OnboardingCopy.REMINDER_TITLE
    static let onbReminderYes = "Oui, me le rappeler" // OnboardingCopy.REMINDER_YES
    static let onbReadyTitle = "Tout est prêt" // OnboardingCopy.READY_TITLE
    static let tabAujourdhui = "Aujourd’hui" // NavCopy.AUJOURDHUI
    static let tabCalendrier = "Calendrier" // NavCopy.CALENDRIER
    static let tabReleve = "Relevé" // NavCopy.RELEVE
    static let tabParametres = "Paramètres" // ParametresCopy.TITLE
    static let todayQuestion = "Où travaillez-vous aujourd’hui ?" // AujourdhuiCopy.QUESTION
    static let todaySuisse = "En Suisse" // AujourdhuiCopy.SUISSE
    static let todayDomicile = "Domicile" // AujourdhuiCopy.DOMICILE
    static let todayPending = "Enregistré sur le téléphone, en attente d’envoi" // AujourdhuiCopy.PENDING
    static let todaySynced = "Enregistré" // AujourdhuiCopy.SYNCED
    static let sheetQuestion = "Où avez-vous travaillé ?" // CalendarCopy.SHEET_QUESTION
    static let sheetSave = "Enregistrer" // CalendarCopy.SHEET_SAVE
    static let exportPdf = "Exporter en PDF" // ReleveCopy.EXPORT_PDF
    static let compareEmployer = "Comparer avec mon employeur" // ReleveCopy.COMPARE_EMPLOYER
    static let comparisonTitle = "Votre employeur a-t-il le même chiffre ?" // ComparisonCopy.TITLE
    static let eveningLabel = "Me prévenir le soir" // ParametresCopy.EVENING_LABEL
    static let alertLabel = "M’avertir si j’approche d’un seuil" // ParametresCopy.ALERT_LABEL
    static let licencesTitle = "Licences" // LicencesCopy.TITLE
    static let licencesBack = "Retour" // LicencesCopy.BACK
    static let signOut = "Se déconnecter" // ParametresCopy.SIGN_OUT
    static let deleteRow = "Supprimer mon compte" // ParametresCopy.DELETE_ROW
    static let deleteConfirm = "Supprimer définitivement" // ParametresCopy.DELETE_CONFIRM
    static let deleteDoneTitle = "Compte supprimé" // ParametresCopy.DELETE_DONE_TITLE
    static let deleteDoneAck = "Terminer" // ParametresCopy.DELETE_DONE_ACK
    static let reminderTitle = "Où avez-vous travaillé aujourd’hui ?" // NotificationCopy.MANUAL_TITLE
    static let deleteWord = "SUPPRIMER" // DELETE_CONFIRMATION (parametres/ParametresController.kt; not a copy file)
}
