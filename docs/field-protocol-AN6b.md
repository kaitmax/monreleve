# AN6b — the detection field protocol

**For the operator.** This is the half of Checkpoint G that no Claude Code session can do: a real person carrying a phone across the Franco-Swiss border for several weeks. AN6a builds and proves the instrument on synthetic tracks. This document says who should test, what counts as a pass, and how to run it.

**The pass criteria in §3 are proposed, not final.** They must be ratified — changed if needed — **before the first field day**. Once data exists they are frozen (R276). Picking a threshold after seeing results means tuning the test to pass.

---

## 1. What this test can and cannot prove

This is a **kill test, not a certification.**

A month of one tester is about 20 working days. If the app gets all 20 right, the most you can say is that its true error rate is probably below **15 %** — that's the "rule of three": with zero errors in *n* trials, the 95 % upper bound on the error rate is about 3/*n*.

To show an error rate below 2 % with the same confidence, you'd need about **150 error-free days**.

| Testers × weeks | Working days | Best case you can claim (0 errors) |
|---|---|---|
| 1 × 4 | ~20 | error rate < ~15 % |
| 3 × 4 | ~60 | error rate < ~5 % |
| 5 × 6 | ~150 | error rate < ~2 % |

So a **fail** here is decisive: detection is broken and should not ship. A **pass** means only *"not visibly broken"*. Automatic mode can proceed to AN7, but measurement continues during beta, and the product must not claim a detection accuracy it hasn't measured.

The scoring harness prints these bounds next to every rate, so a good month can't be misread as proof.

---

## 2. Who the tester must be

The hard case is the whole point. A tester living 30 km from the border tests the easy case and proves almost nothing.

**Required:**
- **Lives within about 2 km of the border.** Annemasse, Saint-Julien-en-Genevois, Ferney-Voltaire, Saint-Genis-Pouilly or similar around Geneva; the equivalent near Basel. This is where GPS fixes land in the 150 m buffer, and where detection is most likely to fail.
- **Works in Switzerland and commutes most days.**
- **Teleworks at least 5 days during the test.** This matters more than it looks: the dangerous error — proposing *En Suisse* on a day spent at home — can only happen on a home day. A tester who never teleworks can't produce it, and that criterion would pass without testing anything.
- **An Android phone running Android 8 or later.**
- **Willing to write one line a day for four weeks.**

**Strongly preferred:**
- **Testers on different phone brands.** Some manufacturers, notably Xiaomi, Huawei, OnePlus and some Samsung models, aggressively kill background apps to save battery. That breaks detection in ways no emulator reproduces. [dontkillmyapp.com](https://dontkillmyapp.com) ranks them. One Pixel tester tells you nothing about a Xiaomi.
- **Mixed commutes** — car, Léman Express, bike. The train in particular crosses the border and passes through tunnels.

**Lead time:** finding testers is the slowest step in the Android series. Start recruiting now, in parallel with the Play Console verification. Frontalier Facebook groups are the obvious source, and the same audience the product is for.

---

## 3. The pass criteria — proposed, to ratify before day one

### The vote — four checks a day (R320)

Detection checks the position **four times a working day**, in windows around **09:30, 11:00, 14:30 and 16:30** Europe/Paris (each ±30 minutes, chosen to avoid lunch). Each check is *En Suisse*, *Domicile*, or *in the 150 m strip*, or **missed** if no fix was obtained inside its window — a check that cannot run inside its window is missed, **never taken late**. A day is then decided by a vote over its checks:

| Tier | Checks taken | Agreement |
|---|---|---|
| **HIGH** | ≥ 3 | ALL on the same side, none in the strip |
| **MEDIUM** | ≥ 3 | exactly one on the other side or in the strip |
| **LOW** | anything else | — |

One bad reading can never decide a day alone: a lone dissenter drops HIGH to MEDIUM, two drop it to LOW.

**Half-day granularity:** each half is decided from its own two checks (morning = 09:30 + 11:00, afternoon = 14:30 + 16:30): both taken, both the same side, neither in the strip, or that half is not sure.

**LOW withholds.** No proposal is made and the day stays *Non renseigné*. The person records it by hand.

Missions and absences are never detected.

These thresholds — the window times and width, the three-check minimum, the one-dissenter MEDIUM tolerance — are **proposed**; ratify or change them before day one, then they freeze (R276).

### Kill criteria

**Any one of these failing means Checkpoint G does not pass.**

| | Criterion | Threshold | Why |
|---|---|---|---|
| **K1** | **False-CH on a HIGH day**: proposed *En Suisse*, but the person was at home | **zero** | The dangerous error (R278). It understates telework, so the person thinks they have room they don't. HIGH is the tier people confirm without looking. |
| **K2** | Wrong HIGH proposals, of any kind | **at most 1** in the period | HIGH has to mean something. |
| **K3** | Wrong MEDIUM proposals | **at most 15 %** of MEDIUM days | MEDIUM is shown as less certain, but it still has to be usually right. |
| **K4** | Coverage: days with a HIGH or MEDIUM proposal | **at least 60 %** of working days | Below this, detection doesn't earn its battery cost. |
| **K5** | Battery | median **≤ 3 %** per working day | SPEC §13's budget, measured the same way every day (AN6a documents the method). |
| **K6** | A day written without the person's tap | **never** | D16. Should be impossible by design. If it happens once, that's a defect and everything stops. |

---

## 4. What happens after — the Checkpoint G decision

| Result | Decision |
|---|---|
| **All six pass** | Proceed to **AN7** (automatic mode). Keep measuring in beta. Claim no accuracy figure. |
| **Failures concentrated on buffer-heavy days**, for a tester who lives near the border | A border problem. Build **AN7b**, the device-only home and workplace geofences (D31), then re-test. |
| **Failures across the board**, including on clean days far from the border | A broad failure. **Launch in manual mode only.** Automatic mode doesn't ship. |
| **Only K5 fails** | A sampling-rate problem. Adjust and re-run. |
| **K6 fails** | Stop. It's a defect, not a measurement result. |

The tally records how many of each day's fixes landed in the buffer. That's what tells a border failure apart from a broad one — and it does so **without ever recording a coordinate**.

---

## 5. Privacy — what the test collects

**The measurement build is identical to production on privacy (R277).** It stores, per day: the result of each of the four checks (*En Suisse*, *Domicile*, *in the strip*, or missed). **No coordinate is ever stored, logged or sent**, not even for debugging.

The tester's daily log is their own note of where they worked. It's still personal data — it says where someone was on each working day — so:

- the tester **agrees in writing** before starting, using the consent in §8;
- they can **stop at any time** and have everything deleted;
- the log and the export are **kept only until the analysis is finished**, then deleted, and the report says when;
- they are shared only with the operator, never published, and the report quotes counts, never someone's days.

The measurement build **runs without an account or a server**. Detection happens entirely on the phone, so nothing is sent anywhere during the test. The tester hands over one exported file at the end.

---

## 6. Running it

**Setup, day 0:**
1. Install the measurement APK. It's sideloaded, not from the Play Store.
2. Grant location **"Allow all the time"**. On Android 10 and later this has to be set in the app's settings; the in-app prompt only offers "while using".
3. Exempt the app from battery optimisation: Settings → Battery → the app → *Unrestricted*.
4. Apply the phone brand's own "don't kill this app" setting, if it has one — dontkillmyapp.com has the steps per brand.
5. Record the phone model and Android version.

**Every working day, in the evening:**
- Write one line: the date, where you worked (*Suisse*, *Domicile*, *Mission*, *Absent*), and anything unusual.
- **The app does not show its guesses during the test.** That's deliberate: seeing "*En Suisse*" before writing your own line would make you anchor on it, and the log would stop being the truth.

**At the end:**
- Export from the app and send the file with the log.
- The operator runs the scoring command (AN6a increment 6). It prints each criterion, its count, its rate, and the confidence bound.

---

## 7. Before day one — the operator's checklist

- [ ] Ratify or change the tier thresholds and kill criteria in §3. **After this box is ticked, they're frozen.**
- [ ] Recruit testers meeting §2 — at least one within 2 km of the border who teleworks at least 5 days.
- [ ] Get signed consent (§8) from each.
- [ ] AN6a is merged, and its report confirms the measurement mode runs without a server and hides its proposals.
- [ ] Record the start date and the planned end date.

---

## 8. Fiche testeur

*À remettre à chaque personne qui participe au test.*

**Ce que nous testons.** Mon Relevé peut proposer automatiquement, chaque soir, si vous avez travaillé en Suisse ou à domicile. Avant de proposer cette fonction à qui que ce soit, nous devons savoir si elle se trompe — surtout près de la frontière, là où le GPS hésite. Vous nous aidez à le mesurer.

**Ce que l'application enregistre.** Pour chaque journée : le nombre de minutes passées de chaque côté de la frontière, le nombre de relevés de position, et un niveau de confiance. **Aucune coordonnée n'est enregistrée, conservée ni transmise.** L'application détermine sur votre téléphone si vous êtes en Suisse ou non, puis oublie immédiatement la position.

**Pendant le test, l'application ne vous montre pas ses propositions.** C'est voulu : si vous voyiez « En Suisse » avant de noter votre journée, votre note serait influencée.

**Ce que nous vous demandons.** Chaque soir de travail, une ligne, trente secondes :

| Date | Où avez-vous travaillé ? | Remarque (facultatif) |
|---|---|---|
| 12.10.2026 | Domicile | |
| 13.10.2026 | Suisse | train, tunnel à Genève |

Réponses possibles : **Suisse**, **Domicile**, **Mission** (déplacement professionnel hors de Suisse), **Absent** (congé, maladie, férié).

**Durée.** Quatre semaines de travail, dont **au moins cinq jours de télétravail**.

**Réglages à faire une fois.**
1. Autoriser la localisation **« Toujours »** (sur Android 10 et plus : dans les réglages de l'application).
2. Désactiver l'optimisation de batterie pour l'application : Réglages → Batterie → l'application → *Sans restriction*.
3. Si votre téléphone est un Xiaomi, un Huawei, un OnePlus ou un Samsung récent : suivre la page de votre marque sur dontkillmyapp.com, sinon le téléphone risque de couper l'application.

**À la fin.** Exportez le fichier depuis l'application et envoyez-le avec votre tableau.

**Vos droits.** Vous pouvez arrêter à tout moment, sans justification, et demander la suppression de tout ce qui a été transmis. Vos données ne servent qu'à cette mesure. Elles sont supprimées dès l'analyse terminée et ne sont jamais publiées. Le rapport ne cite que des totaux, jamais vos journées.

**Consentement.**

J'accepte de participer au test décrit ci-dessus, et de transmettre à l'issue du test mon tableau journalier et le fichier exporté par l'application. J'ai compris qu'aucune coordonnée n'est enregistrée, que je peux arrêter à tout moment et demander la suppression de mes données.

Nom : ______________________  Date : ____________  Signature : ______________________

Modèle de téléphone et version d'Android : ______________________
