# Play store listing - the draft (AN-PLAY-PACK, R1123)

The French texts Play shows, written for the operator's approval. They ship as written unless refused
(relay/AN-PLAY-PACK.txt R1123). Each text sits between its two markers; `StoreListingCopyTest` (android/app) reads them
from this file and fails on: a length over Play's limit (title 30, short description 80, full description 4 000
characters - Play Console Help answer/9859152, read 2026-11-20); the words *certifié*, *atteste*, *conforme* in any
form; a typed threshold value (a digit followed by %, R153 - the texts name *le seuil fiscal* and *le seuil de
sécurité sociale*); a typewriter apostrophe (R126); a privacy-policy URL other than the one the app's Paramètres
opens (`Site.url(LegalPage.PRIVACY)`, R181); a detection paragraph that does not state its requirements (precise
location, the « Toujours autoriser » background grant, beta - Android Ruling 8, N4); and any mention of location or
detection OUTSIDE the detection paragraph, so the manual-only listing is this text with that paragraph removed.

The detection paragraph also carries Play's background-location disclosure, which Play requires "in the app
description" as well as in the app (answer/9799150, read 2026-11-20). Its claims are those the in-app disclosure
(`android/shared/.../fr/DisclosureCopy.kt`) and the privacy page (`web/lib/fr/confidentialite.ts`, R325) already
make - not strengthened, including the Wi-Fi and cellular sentence.

## Nom de l'application (30 caractères au plus)

<!-- listing:title -->
Mon Relevé
<!-- /listing:title -->

## Description courte (80 caractères au plus)

<!-- listing:short -->
Vos jours de télétravail de frontalier, déclarés et horodatés jour après jour.
<!-- /listing:short -->

## Description complète (4 000 caractères au plus)

<!-- listing:full -->
Mon Relevé tient le registre de vos journées de travail de frontalier entre la France et la Suisse, et vous dit combien de jours de télétravail il vous reste avant le seuil fiscal et avant le seuil de sécurité sociale.

Chaque journée se déclare en un geste : en Suisse, à domicile, en mission ou absent. Le serveur horodate chaque enregistrement à sa réception, et chaque modification est conservée dans un historique.

À partir de ces journées, l’application établit le Relevé annuel de télétravail : chaque jour déclaré, son origine et son horodatage, à exporter en PDF ou en CSV.

CE QUE FAIT L’APPLICATION
• Le décompte de votre année, jour par jour, au regard du seuil fiscal et du seuil de sécurité sociale.
• Une prévision à partir de votre rythme habituel, et une alerte si vous approchez d’un seuil (en option).
• Un rappel le soir, un seul par jour, si la journée n’est pas encore renseignée (en option).
• La saisie fonctionne hors connexion : vos journées partent dès que le réseau revient.

<!-- listing:detection -->
DÉTECTION AUTOMATIQUE (BÊTA, EN OPTION)
Si vous l’activez, l’application utilise la localisation de votre téléphone en arrière-plan, pendant vos heures de travail, même lorsque l’application est fermée, pour vous proposer chaque soir « en Suisse » ou « à domicile ». Elle vérifie votre position quatre fois par journée de travail. Votre position est comparée sur le téléphone à la frontière suisse, puis effacée : l’application ne conserve ni n’envoie jamais votre position, seulement la journée que vous confirmez. Pour déterminer la position, Android peut utiliser les réseaux Wi-Fi et cellulaires à proximité, selon les réglages de votre téléphone.
La détection demande l’accès à la position exacte et l’autorisation « Toujours autoriser ». Avec une position approximative, ou sans l’accès en arrière-plan, elle ne fonctionne pas : vos journées restent à saisir à la main. Elle ne fait que proposer : rien n’est enregistré sans votre confirmation. Fonction en bêta, dont la fiabilité est en cours de mesure. La saisie manuelle produit le même relevé, avec les mêmes chiffres : seule l’origine indiquée pour chaque journée diffère.
<!-- /listing:detection -->

VOS DONNÉES
Aucune coordonnée géographique n’est enregistrée ni transmise. Vous pouvez exporter vos données et supprimer votre compte depuis l’application.
Politique de confidentialité : https://monreleve.ch/confidentialite
<!-- /listing:full -->

## Politique de confidentialité (champ de la fiche)

<!-- listing:privacy -->
https://monreleve.ch/confidentialite
<!-- /listing:privacy -->

## Captures d'écran

Taken on the emulator (labelled "emulator API 36", never "device"), from the commit named in REPORT-AN-PLAY-PACK.txt
ASSETS, saved under C:/wt/play-assets/ (not committed). The list, the sizes and the sha256 of each are in that
report. Screenshot 04 (the disclosure) was RETAKEN on the corrected text by AN-COPY-TRUTH-2:
`04-disclosure-before-the-system-prompt-emulator-api36-e0b9198e.png` replaces A5's 04 in the upload
(REPORT-AN-COPY-TRUTH-2.txt). Under the manual-only fallback, any screenshot that shows detection or its disclosure is left out.
