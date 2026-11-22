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
}
