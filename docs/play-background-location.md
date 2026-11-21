# Play and background location - the verdict, checked first (AN-AUTO increment 0)

The relay (AN-AUTO, "PLAY, CHECKED FIRST") asks, before any code is built, what
Google Play requires for background location and whether an OPT-IN BETA inside an
app built around manual entry is likely to meet it. This file records the answer,
its sources and their dates (R273 applies to claims about policy), and the
disclosure/in-app wording designed to meet the requirements as closely as the
feature allows.

---

## THE VERDICT: LIKELY REFUSED (as an opt-in alternative to manual entry)

An opt-in, labelled-beta automatic detection mode inside Mon Releve is **likely
to be refused** the `ACCESS_BACKGROUND_LOCATION` permission by Google Play review,
for one reason that sits above all the mechanics: **background location is only
permitted when it is CORE functionality, and this product's own design makes it
NOT core.**

- SPEC and the field protocol state repeatedly that **manual mode produces exactly
  the same annual statement** (SPEC 11.1 "Copy states plainly that both modes
  produce the same annual statement"; D19 manual is the safe default; the
  Checkpoint-G fallback is "launch in manual mode only"). The product's core
  purpose - the Releve annuel de teletravail - is fully delivered without any
  location access.
- Google's policy: *"Your app should only request access to the location in the
  background if it's required for the core functionality of the app"*, where core
  functionality is *"the main purpose of your app ... a set of important features
  without which your app is broken or rendered unusable."* And decisively: *"If
  your app requests access to the location in the background but it's not important
  to the app's core functionality, you must remove it."*
- An **opt-in alternative to a fully-working manual mode is exactly the "not
  important to core functionality" case** the policy names. The app is neither
  broken nor unusable without it.

This is NOT a stop (the upload is AN14b's), but per the relay it is the first line
of the report so the operator decides with it in view.

### The two things that are NOT the problem

1. **Data Safety / collection.** Not an issue. Play's "collection" means
   off-device transmission. Mon Releve determines country on-device against a
   bundled polygon and discards the fix (D18), transmitting no coordinate - Case 1,
   *"Not Transferred (Local only) -> EXEMPT"* (docs/android-skills.md 7.2,
   play-policy-insights Data Safety Case Matrix). That is true of the COORDINATE
   (Precise location: NOT collected), and it holds ONLY while D18 holds.
   **CORRECTED (Android Ruling 18 Q-DS1, 2026-11-20; recorded by AN15-AUDIT,
   R1135).** This item used to say "The Data Safety form declares location NOT
   collected / NOT shared, and prominent-disclosure-for-collection is exempt". That
   is SUPERSEDED: a day the person confirms or corrects from a detection proposal
   (`CH` / `HOME` sent with `DETECTED_*` provenance) is a country-level location
   that leaves the phone, so the form declares **Approximate location: collected,
   optional (detection only), not shared, App functionality**. The table and its
   trace to code are `docs/play-release.md` section 2 (2.3 names what this
   supersedes). The in-app prominent disclosure is shown regardless
   (`docs/play-release.md` section 3).
2. **The restricted-permission MECHANICS.** Surmountable, but costly. Regardless
   of transmission, `ACCESS_BACKGROUND_LOCATION` triggers Play's
   restricted-permission review: a Permissions Declaration Form in Play Console and
   typically a <=30s demo video showing the location feature in use. These can be
   produced. They do not make the feature core - they only document it.

### The strengthened 2026 policy makes the verdict firmer, not softer

Google's Location Permissions policy update **effective 2026-10-28** requires
"strong justification", "explicit user consent", and device location "limited to
essential functions that directly benefit the user and are **central to the app's
core purpose**." An opt-in beta that the product itself presents as an equal to
manual entry does not read as "central to the core purpose."

---

## WHAT THIS MEANS FOR THE BUILD (and why it still ships now)

The operator has decided to ship automatic detection now, opt-in, labelled beta,
BEFORE the field test (Checkpoint G) - see REPORT-AN-AUTO.txt R273. This task
builds the feature and designs every surface to meet Play's requirements as
closely as the feature allows; the upload, the Declaration Form and the demo video
are AN14b's, and the operator takes the refusal risk knowingly.

**The honest framing for the eventual Declaration Form** (recorded here so AN14b
does not re-derive it): the core functionality background location serves is *the
automatic, coordinate-free determination of whether each working day was spent in
Switzerland or at home, which is the fact the Releve is built from.* That is the
strongest truthful justification. It may not clear review while manual mode exists
as an equal; if review refuses, the Checkpoint-G "manual mode only" path is already
the product's designed fallback and nothing is lost.

---

## THE DISCLOSURE, DESIGNED TO MEET THE REQUIREMENTS AS CLOSELY AS THE FEATURE ALLOWS

Play requires a **prominent disclosure dialog shown BEFORE the runtime permission
prompt** (D5 / SPEC 11.1 "Avant l'autorisation"). Google's template language is
*"This app collects location data to enable [feature] even when the app is closed
or not in use."* Mon Releve does **not** collect (transmit) location - so copying
that template verbatim would claim more than the record supports, which this
product never does (SPEC 12 vocabulary; "never claim more than the record
supports"). The disclosure therefore:

- States plainly that the app **uses the phone's location in the background, during
  working hours, even when the app is closed**, so Play's background-use
  expectation is met explicitly.
- States, equally plainly, that it determines **on this phone** whether the day was
  in Switzerland or at home and then **discards the position** - no coordinate,
  route, address or history is recorded, kept, or sent (D18).
- Names what is kept: **one conclusion per day** (ni trajet, ni adresse, ni
  historique - SPEC 11.1).
- Warns in advance that Android will ask **twice** on Android 10+ (in-use, then
  background), because an unexplained second dialog is the main reason background
  grants get revoked (SPEC 11.1).
- Is shown BEFORE the system prompt and offers, equally weighted, "Rester en saisie
  manuelle" (D19 - manual is never the lesser option).

The in-app wording lives in `lib/fr` (Android: `fr/`), accented and reachable
(R238), and never suggests manual mode is lesser (R315).

---

## SOURCES AND DATES (R273)

- **docs/android-skills.md** sections 6.7, 7.2 (play-policy-insights, vetted at
  AN0): Data Safety Case 1 local-only EXEMPT; `ACCESS_BACKGROUND_LOCATION` is a
  restricted permission requiring a declaration and typically a demo video
  regardless of transmission.
- **Google Play - "Location permissions" / background location requirements**,
  support.google.com/googleplay/android-developer/answer/9799150 - fetched
  2026-10-02. Quoted: core-functionality requirement; *"If your app requests access
  to the location in the background but it's not important to the app's core
  functionality, you must remove it"*; Permissions Declaration Form; demo video
  <=30s; prominent disclosure before the runtime prompt.
- **Google Play Location Permissions policy update, effective 2026-10-28** (via
  Play Console Help "Permissions and APIs that Access Sensitive Information",
  support.google.com/googleplay/android-developer/answer/16585319 and the Preview
  answer/16909972 - searched 2026-10-02): strong justification, explicit consent,
  location central to the app's core purpose.
- **developer.android.com/develop/sensors-and-location/location/background**
  (foreground vs background definition; the separate Android 10+ background grant),
  referenced 2026-10-02.
