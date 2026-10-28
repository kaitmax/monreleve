# Primary sources – LAMal / CMU comparator (monreleve.ch)

Date read for every source below: **27 October 2026** (unless stated otherwise).
Passages are copied word for word. `[…]` marks a cut, and the note next to it says what was left out.

---

## A. Downloaded files

The files were saved by the browser into your usual **Downloads** folder. I added a year prefix to the file names. The server's own names are given in brackets.

| Saved as | Original name / source URL | Premium year | Format | Actual size (bytes) |
|---|---|---|---|---|
| `2027_Prämien_EU.csv` | Prämien_EU.csv – https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0VVLmNzdg%3D%3D | 2027 | CSV | 234 836 |
| `2027_Prämien_EU.xlsx` | Prämien_EU.xlsx – https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0VVLnhsc3g%3D | 2027 | XLSX | 128 929 |
| `2027_Prämien_CH.csv` | Prämien_CH.csv – https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0NILmNzdg%3D%3D | 2027 | CSV | 25 832 930 |
| `2027_Erläuterungen zu den Prämiendaten.xlsx` | Erläuterungen zu den Prämiendaten.xlsx (opendata.bagnet.ch, same `?r=/download&path=` pattern) | 2027 | XLSX | 21 815 |
| `2027_to whom it may concern.pdf` | to whom it may concern.pdf – https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL3RvIHdob20gaXQgbWF5IGNvbmNlcm4ucGRm | 2027 | PDF | 165 110 |
| `Archiv_Praemien_2026.zip` | Archiv_Praemien_2026.zip (opendata.bagnet.ch, same pattern) | 2026 | ZIP | 31 923 906 |

All the files are listed as resources of https://opendata.swiss/fr/dataset/health-insurance-premiums.

**Contents of `Archiv_Praemien_2026.zip`** (premium year 2026, file dates 16–25 Sept 2025): Eingeschr.-Tät.gebiete.csv/.xlsx, Einzugsgebiete.csv/.xlsx, Erläuterungen zu den Prämiendaten.xlsx, Prämien_CH.csv (22 545 492 B), Prämien_CH.xlsx, Prämien_CHEU.xlsx, **Prämien_EU.csv (204 515 B)**, Prämien_EU.xlsx, Tarife.csv/.xlsx, to whom it may concern.pdf, Versichertenbestand_CH.csv/.xlsx.

**Not downloaded** (2027 versions, available from the same page): Prämien_CH.xlsx, Prämien_CHEU.xlsx, Tarife.csv/.xlsx, Einzugsgebiete.csv/.xlsx, Eingeschr.-Tät.gebiete.csv/.xlsx, Versichertenbestand_CH.csv/.xlsx, and the archives for 2011–2025.

**Size note (fact only):** some sizes in the opendata.swiss catalogue do not match the files actually served. For example, the catalogue gives Prämien_CH.csv as "199.7 KB" but the file is 25 832 930 bytes, and it gives Archiv_Praemien_2026.zip as "30.4 KB" but the file is 31 923 906 bytes. The table above gives the sizes actually received.

---

## B. Report

### 1. opendata.swiss terms of use (verbatim)

**Dataset page:** https://opendata.swiss/fr/dataset/health-insurance-premiums
Title: "Primes de l’assurance-maladie". Organisation: Office fédéral de la santé publique OFSP. "Dernière mise à jour 29 septembre 2026". "Date de publication 26 septembre 2013". "Date de modification 29 septembre 2026". "Couverture temporelle 1 janvier 2027 - 31 décembre 2027". "Editeur Bundesamt für Gesundheit, Sektion Prämien und finanzielle Risiken". "Landing page https://www.priminfo.admin.ch/de/praemien".

**Terms of use icon on the dataset page** (alt/title text of the icon, linked to `/fr/terms-of-use#terms_by`):
> Utilisation libre. Obligation d’indiquer la source.

**Terms per resource** (from the portal's metadata API, `/api/3/action/package_show?id=health-insurance-premiums`, field `license`):
- `https://opendata.swiss/terms-of-use#terms_open`: Prämien_CH.csv, Prämien_CH.xlsx, Prämien_CHEU.xlsx, and all the Archiv_Praemien_20xx.zip files.
- `https://opendata.swiss/terms-of-use#terms_by`: Prämien_EU.csv, Prämien_EU.xlsx, Tarife.*, Versichertenbestand_CH.*, Einzugsgebiete.*, Eingeschr.-Tät.gebiete.*, Erläuterungen zu den Prämiendaten.xlsx, to whom it may concern.pdf.

**Full terms page:** https://opendata.swiss/fr/terms-of-use (no date shown on the page). Verbatim:

> Les conditions d’utilisation des données mises à disposition par les organisations sur opendata.swiss sont régies par la législation en vigueur. Lorsque la loi prévoit que la source doit être indiquée, le jeu de données en question est assorti du symbole correspondant. Dans tous les autres cas, l’indication de la source est recommandée.
>
> Les symboles accompagnant chaque jeu de données indiquent le type d’utilisation autorisé. Tous les services proposant des données emploient les mêmes symboles.

> **Utilisation libre**
> Vous pouvez utiliser ce jeu de données à des fins non commerciales.
> Vous pouvez utiliser ce jeu de données à des fins commerciales.
> Nous vous recommandons d’indiquer la source (auteur, titre et lien vers le jeu de données).

> **Utilisation libre. Obligation d’indiquer la source.**
> Vous pouvez utiliser ce jeu de données à des fins non commerciales.
> Vous pouvez utiliser ce jeu de données à des fins commerciales.
> L’indication de la source (auteur, titre et lien vers le jeu de données) est obligatoire.

> **Utilisation libre. Utilisation à des fins commerciales uniquement avec l’autorisation du fournisseur des données.**
> Vous pouvez utiliser ce jeu de données à des fins non commerciales.
> Vous pouvez utiliser ce jeu de données à des fins commerciales, sous réserve de l’autorisation du fournisseur des données.
> Nous vous recommandons d’indiquer la source (auteur, titre et lien vers le jeu de données).

> **Utilisation libre. Obligation d’indiquer la source. Utilisation commerciale uniquement avec l’autorisation du fournisseur des données.**
> Vous pouvez utiliser ce jeu de données à des fins non commerciales.
> Vous pouvez utiliser ce jeu de données à des fins commerciales, sous réserve que vous ayez reçu l’autorisation du fournisseur des données.
> L’indication de la source (auteur, titre et lien vers le jeu de données) est obligatoire.

> À propos : Licences vs. Conditions d’utilisation
> Les licences Creative Commons (CC) sont des contrats juridiques qui permettent aux titulaires de droits d’auteur de définir les conditions de réutilisation de leurs œuvres, tout en conservant leurs droits. En revanche, les conditions d’utilisation peuvent inclure des règles techniques ou organisationnelles, même en l’absence de protection par le droit d’auteur. En Suisse, les données brutes ou les jeux de données (ex. : relevés de température, statistiques démographiques) ne sont généralement pas protégées par le droit d’auteur (source : Licences d’utilisation – UNIL). C’est pourquoi les jeux de données sur opendata.swiss sont généralement accompagnés de conditions d’utilisation, plutôt que de licences. […]

(Left out: the last sentence of that section, the "Modèle d'utilisation" paragraph, and the newsletter footer.)

Legal basis linked from the dataset page ("Base légale"): https://www.fedlex.admin.ch/eli/cc/2015/840/fr#art_71. I did not open this link.

---

### 2. Are France residents covered? Where?

**Yes, for 2026 and 2027, in the files named `Prämien_EU`. They are not in `Prämien_CH`.**

**2027 – `Prämien_EU.csv` (and .xlsx), from opendata.swiss / opendata.bagnet.ch**
- Header row (verbatim): `Versicherer,Land,Hoheitsgebiet,Geschäftsjahr,Erhebungsjahr,Region,Altersklasse,Unfalleinschluss,Tarif,Tariftyp,Altersuntergruppe,Franchisestufe,Franchise,Prämie,isBaseP,isBaseF,Tarifbezeichnung`
- Column **`Land`**: France is coded **`FR`**. Values found in the file: AT, BE, BG, CY, CZ, DE, DK, EE, ES, FI, FR, GB, GR, HR, HU, IE, IS, IT, LT, LU, LV, MT, NL, NO, PL, PT, RO, SE, SI, SK.
- Column `Hoheitsgebiet`: only value `P_OKPEU`.
- `Land = FR`: 80 rows, 13 insurers (BAG numbers 8, 32, 290, 376, 455, 509, 1384, 1479, 1509, 1542, 1555, 1560, 1562).
- Example rows (verbatim):
  `8,FR,P_OKPEU,2027,2026,PR_REG_0,AKA_03_ERW,MIT_UNF,BASE,BASE,E1,FRASTU_01,FRA_01_E_0300,750.0,1,1,BASE`
  `8,FR,P_OKPEU,2027,2026,PR_REG_0,AKA_01_KIN,MIT_UNF,BASE,BASE,K1,FRASTU_01,FRA_01_K_0000,165.0,1,1,BASE`

**2026 – `Prämien_EU.csv` inside `Archiv_Praemien_2026.zip`**
- Same column headers as 2027. France is coded **`EU FR`** in column `Land`. `Hoheitsgebiet` = `EU`. `Region` = `PR-REG EU0`.
- `Land = EU FR`: 80 rows, the same 13 insurers.
- Example row (verbatim): `8,EU FR,EU,2026,2025,PR-REG EU0,AKL-ERW,MIT-UNF,BASE,BASE,,FRAST1,FRA-300,750,1,1,BASE`

**How the documentation describes it** (`Erläuterungen zu den Prämiendaten.xlsx` 2027, sheet "Description", verbatim):
> Prämien EU 2027 (= primes UE 2027), format csv, séparées par des virgules et .xlsx
> Land | Etat UE ou AELE | AT
> Hoheitsgebiet | Territoire national | P_OKPEU
> Region | Région de prime UE/AELE ("PR_REG_0" = pas de subdivision par des régions) | PR_REG_0
> Prämie | Prime en CHF | 108.95

In the 2026 version (sheet "Description"):
> Land | Etat UE ou AELE | "EU AT"

The documentation also describes `Prämien_CHEU.xlsx` (2027) as:
> Exploitation Excel avec table pivot concernant les primes AOS CH et AOS UE.

(Its 2026 version has sheets `Info`, `OKP_CH`, `OKP_EU_EFTA`, `Versicherte`, `Data`.)

**Keyword search in the 2026 and 2027 explanation files** (both sheets): "frontal", "Grenzg", "Ausland", "étranger/etranger", "France", "Frankreich" → **0 matches each**. "AELE"/"EFTA" → 2 matches each. "UE"/"EU" → several matches. The documentation does not state whether "Prime en CHF" is a monthly or yearly amount: **NOT FOUND**.

**Change notice for 2027** (`to whom it may concern.pdf`, French part, verbatim extract):
> Dans le cadre de la publication des primes 2027, la structure des fichiers de primes est adaptée. En conséquence, le document « Explications relatives aux données de primes » a été révisé et mis à jour en fonction de la nouvelle structure des fichiers.
> Par ailleurs, les nouveaux documents ont déjà été mis en ligne. Ils contiennent actuellement uniquement la structure des fichiers, respectivement la première ligne avec les intitulés des colonnes.
> […]
> Territoire national | Nouvelles valeurs P_OKPCH et P_OKPEU

(Left out: the rest of the change table and the German version.) When read on 27 Oct 2026, the 2027 files did contain data rows (Prämien_EU.csv: 2 231 lines; Prämien_CH.csv: 219 917 lines), so they were no longer header-only.

---

### 3. Dimensions the premiums vary by (as named in the 2027 documentation)

From `Erläuterungen zu den Prämiendaten.xlsx` (2027), "Prämien CH 2027" section, verbatim (column | description):
> Versicherer | N° OFSP de l'assureur
> Kanton | Canton
> Hoheitsgebiet | Territoire national
> Geschäftsjahr | Année de primes
> Erhebungsjahr | Année de l'enquête
> Region | Région de prime CH ("PR_REG_0" = pas de subdivision par des régions, "PR_REG_1", "PR_REG_2", "PR_REG_3")
> Altersklasse | Classe d'âge ("AKA_01_KIN" = enfants, AKA_02_JUG" = jeunes adultes, "AKA_03_ERW" = adultes)
> Unfalleinschluss | avec ou sans couverture d'accident: "MIT_UNF" = avec couverture d'accident ou "OHN_UNF" = sans couverture d'accident
> Tarif | ID spécifique du tarif d'assurance
> Tariftyp | Type de tarif (BASE, PRAXIS, FLEX, TEL_DIG, PHARM)
> Altersuntergruppe | Sous-groupe d'âge ("K1", "K2", "K3", "K4", "K5", "J1", "E1")
> Franchisestufe | Niveau de franchise (FRASTU_01, …, FRASTU_07)
> Franchise | Montant de la franchise en CHF (adultes: FRA_01_E_0300 à FRA_06_E_2500, jeunes adultes et enfants analogue)
> Prämie | Prime en CHF
> isBaseP | Tarif Base? 1 = Oui, 0 = Non
> isBaseF | Franchise ordinaire? 1 = Oui, 0 = Non
> Tarifbezeichnung | Nom du tarif

The "Prämien EU 2027" section has the same columns, with `Land` ("Etat UE ou AELE") in place of `Kanton`.

**Values actually present in the 2027 files:**
- **Prämien_CH.csv**:
  - Kanton: 28 codes, including ZE and ZR.
  - Region: PR_REG_0 to 3.
  - Altersklasse: KIN, JUG, ERW.
  - Unfalleinschluss: MIT_UNF, OHN_UNF.
  - Tariftyp: BASE, FLEX, PRAXIS, TEL_DIG.
  - Altersuntergruppe: E1, J1, K1, K3, K4, K5.
  - Franchisestufe: FRASTU_01–07.
  - Franchise: adults 300/500/1000/1500/2000/2500; children 0–600.
  - Tarif: 88 different values.
  - Insurers: 32.
- **Prämien_EU.csv**:
  - Land: 30 countries.
  - Region: PR_REG_0 only.
  - Altersklasse: KIN, JUG, ERW.
  - Unfalleinschluss: MIT_UNF, OHN_UNF.
  - Tarif / Tariftyp: BASE only.
  - Franchisestufe: FRASTU_01 only.
  - Franchise: FRA_01_E_0300, FRA_01_J_0300, FRA_01_K_0000.
  - Altersuntergruppe: E1, J1, K1, K3.
  - Insurers: 14.

---

### 4. ge.ch reuse terms

**Not used.** Part 1 found premiums for France residents, so Part 2 was skipped as you instructed.

---

### 5. Legifrance – Code de la sécurité sociale

**Superseded:** the articles were read in the third round. See §16 at the end of this report.

**NOT FOUND (access blocked).** Every request to legifrance.gouv.fr landed on a bot-protection page: "Vérification de sécurité en cours – Ce site utilise un service de sécurité pour se protéger contre les bots malveillants." This is the URL tried in the browser: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006742817. The page stayed on the check for more than 15 seconds and on later re-checks. The web fetch tool also failed (client error). I did not try to get past the check.

So **I have not verified article L380-3-1 or any article it refers to**, and none of their text is in this report. None of the URSSAF, ameli or cleiss pages I read cites an article number of the Code de la sécurité sociale.

---

### 6. URSSAF – cotisation maladie du frontalier en Suisse (verbatim)

**Page 6a:** https://www.urssaf.fr/accueil/particulier/travailleur-frontalier-suisse/travail-suisse-declarer-revenus.html
Title: "Travailleur frontalier en Suisse : déclarer vos revenus". Page date: "Mis à jour le 24 septembre 2026".

**Page 6b:** https://www.urssaf.fr/accueil/services/services-particuliers/travailleur-frontalier-suisse/declarer-revenus-frontalier.html
Title: "Travailleurs frontaliers en Suisse, comment déclarer vos revenus annuels sur urssaf.fr ?". Page date: "Mis à jour le 24 septembre 2026".

**Page 6c:** https://www.urssaf.fr/accueil/particulier/travailleur-frontalier-suisse/payer-cotisation-maladie.html
Title: "Travailleur frontalier en Suisse : payer votre cotisation maladie". Page date: "Publié le 02 juillet 2026".

**Page 6d:** https://www.urssaf.fr/accueil/particulier/travailleur-frontalier-suisse/assurance-maladie-france-suisse.html
Title: "Choisir entre l’assurance maladie française ou suisse". Page date: "Publié le 19 avril 2024".

**Official CNTFS site:** NOT FOUND as a separate site. A domain-restricted search on cntfs.fr returned nothing. The ameli page (§7b) refers to "le centre national des travailleurs frontaliers suisses (CNFTS) de l'Urssaf".

**a) Income it is based on, and of which year**
6a:
> Si vous avez choisi l’assurance maladie française, vous devez payer votre cotisation maladie auprès de l’Urssaf durant toute la durée de votre affiliation. Elle est basée sur vos revenus perçus au cours de l’avant dernière année (deux ans en arrière).

> Ainsi, pour déterminer votre cotisation 2027, vous devez déclarer vos revenus de l’année 2025 (salaires, pensions, revenus locatifs, etc.) figurant sur votre avis d’impôts 2026.

> Vous devez déclarer :
> les salaires, pensions et rentes nets perçus en 2025 ;
> les autres revenus perçus en 2025, à savoir : revenus de capitaux mobiliers déclarés, frais de capitaux mobiliers déclarés, revenus de capitaux mobiliers imposables, rente viagère à titre onéreux nette, revenus fonciers nets, plus-values de cession de valeurs mobilières ou immobilières, déficit de capitaux mobiliers antérieurs déclarés... ;
> votre revenu fiscal de référence en 2025.

6b:
> La somme des deux premières rubriques sert au calcul de votre cotisation.
> Le revenu fiscal de référence n’est pas pris en compte dans le calcul de votre cotisation, il sert uniquement de base de vérification.

> Déclarez vos revenus en ligne avant le 14 octobre 2026.

**b) Rate**
6a:
> En 2026, le taux de cotisation d’assurance maladie est de 8 %.

The page gives no separate rate for 2027.

**c) Allowance and how it is computed**
6a:
> Chaque année civile, l'Urssaf détermine votre cotisation annuelle en se basant sur l'ensemble des revenus que vous avez perçus l’avant-dernière année. De ce montant est déduit un montant forfaitaire annuel, qui est systématiquement revalorisé chaque année. Enfin, le taux de cotisation est appliqué à cette base.

> Pour l’année 2027, la cotisation d’assurance maladie est calculée à partir de la déclaration de vos revenus de 2025 et après un abattement de 25 % du plafond de la Sécurité sociale.

> Si vous débutez en tant que travailleur frontalier en Suisse ou que vous mettez fin à votre contrat de travail au cours de l'année, la cotisation maladie sera ajustée.
> Elle sera proratisée en fonction du nombre de jours travaillés en Suisse.
> Si vous êtes affilié en cours d'année, la formule suivante est utilisée : Cotisation = (assiette retenue - abattement de 25 % du plafond de la Sécurité sociale) × 8 % × nombre de jours ÷ 365.
> Le montant de la base de calcul et la cotisation sont arrondis à l’euro le plus proche.

**d) Minimum / maximum**
No minimum and no maximum (ceiling) are stated on these pages: **NOT FOUND**. The only fixed amount given is the flat-rate base used when no income is declared.

6a:
> Si vous ne déclarez pas vos revenus, votre cotisation maladie sera calculée sur une base forfaitaire (taxation d'office). Son montant est égal à 240 300 € en 2026, soit cinq fois le plafond annuel de la Sécurité sociale.
> Si vous déclarez ultérieurement vos revenus, un nouveau calcul de votre cotisation sera effectué sur la base de vos revenus déclarés mais une majoration de 10 % sera appliquée à cette base pour retard de déclaration de revenus.

**e) Who in the household it covers**
6a:
> Cette déclaration est individuelle. Si votre conjoint(e) est également travailleur frontalier en Suisse et assuré(e) à l’assurance maladie française, vous devez faire les deux déclarations distinctes.

6d:
> Opter pour l'assurance maladie française signifie que vous avez les mêmes droits que n'importe quel assuré, avec le remboursement des frais de soins pour vous et vos ayants-droits (dans le parcours de soins coordonnés).

> Vous pouvez demander le rattachement de vos proches (conjoint, concubin, pacsé, enfant) comme bénéficiaires, ce qui leur permettra de bénéficier des prestations de l’assurance maladie française.

6b, about a joint tax return:
> Si vous avez une déclaration d’impôt commune : indiquez le montant des revenus vous concernant personnellement. Si vous avez perçus des revenus en commun au sein du foyer fiscal, veuillez en mentionner la moitié.

**f) How it is paid**
6c:
> Vous devez payer votre cotisation chaque trimestre. Cependant, pour faciliter votre gestion, l'Urssaf vous permet de payer mensuellement si vous adhérez au prélèvement automatique. Vos dates de paiement figurent sur votre échéancier de paiement.
> Le paiement de votre cotisation est dû le dernier jour ouvré du trimestre ou du mois concerné. Si vous vous affiliez à l'Urssaf au cours du dernier mois d'un trimestre, votre paiement pour ce trimestre sera groupé avec celui du trimestre suivant.

> Si vous ne souhaitez pas opter pour le prélèvement automatique, vous pouvez payer votre cotisation maladie trimestrielle par télépaiement ou par virement bancaire. […]
> Le chèque bancaire est également accepté accompagné de votre coupon réponse.

> En tant que travailleur frontalier en Suisse, vous bénéficiez peut-être d'une prise en charge par votre employeur du paiement, partiel ou total, de votre cotisation maladie. En cas de prise en charge partielle, vous devez payer le solde.

(Left out: the list of the two user guides, the details of what to give the employer, and the late-payment penalties.)

---

### 7. Droit d'option – official wording (verbatim)

**7a. cleiss.fr – FAQ**
URL: https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html
Title: "FAQ - Droit d'option des frontaliers France-Suisse". Page date: none shown.

> L'option entre les systèmes d'assurance maladie suisse et français est-elle définitive ?
> Oui, le droit d'option ne peut s'exercer qu'une seule fois et il est irrévocable.
> Seul l'un des changements suivants dans votre situation vous permettra de revenir sur votre décision : reprise d'activité en Suisse (par ex. après une période de chômage), transfert de résidence en France ou prise de domicile en France, ou passage à la retraite du seul régime suisse.
> Les modifications d'état civil (mariage, divorce), les changements de composition de la cellule familiale (naissance ou décès d'un membre de famille) ou le changement d'activité professionnelle (sans période de chômage entre les deux activités) ne sont pas considérés comme des changements de situations.

> Dans quel délai puis-je exercer le droit d'option ?
> Si vous êtes travailleur frontalier ou travailleuse frontalière : vous disposez de 3 mois à compter de la prise d'activité professionnelle en Suisse ou du transfert de résidence en France pour exercer l'option entre les systèmes d'assurance maladie suisse et français.
> […]
> A défaut de s'être manifesté en faveur du système d'assurance maladie français au terme du délai de 3 mois, le frontalier ou le titulaire de rente suisse est affilié d'office en Suisse.

(Left out: the paragraph about people with Swiss pensions.)

> Les membres de ma famille qui n'exercent pas d'activité professionnelle ou ne perçoivent pas de pension ou rente du seul régime suisse pourront-ils exercer un droit d'option ?
> Non, s'ils résident en France leur couverture maladie sera conditionnée par l'option que vous aurez exercée.

**7b. ameli.fr**
URL: https://www.ameli.fr/assure/droits-demarches/europe-international/travailleur-frontalier-suisse
Title: "Travailleur frontalier suisse : droits et prise en charge". Page date: "30 avril 2026".

> Vous pouvez exercer votre droit d'option entre l'assurance maladie suisse et l'assurance maladie française dans un délai de 3 mois à compter de votre prise d'emploi en Suisse ou de votre domiciliation en France.Passé ce délai, vous êtes obligatoirement affilié auprès de l'assurance maladie suisse.

> À noter : l'option, une fois exercée, a un caractère irrévocable. Elle ne s'exerce que dans les cas suivants :
> vous prenez un premier emploi en Suisse ;
> vous reprenez une activité en Suisse après une période de chômage ;
> vous changez de statut (passage du statut de travailleur à celui de pensionné) ;
> vous changez de pays de résidence (installation en France).

Same page, on the contribution:
> Le montant de la cotisation est calculé par le centre national des travailleurs frontaliers suisses (CNFTS) de l'Urssaf, sur la base du revenu fiscal de référence figurant sur avis d'imposition après déduction d'un abattement forfaitaire annuel.

**7c. cleiss.fr – page for workers**
URL: https://www.cleiss.fr/particuliers/je_reside_en_france_et_travaille_en_suisse.html
Title: "Vous travaillez en Suisse et vous résidez en France (travailleur frontalier)". Page date: none found.

> Le droit d'option est définitif. Il ne peut être exercé à nouveau que dans certaines situations : prise d'un premier emploi en Suisse, reprise d'activité en Suisse après une période d'activité dans un autre État membre ou de chômage en France, changement de pays de résidence (installation en France) ou changement de statut (passage du statut de travailleur à celui de pensionné).

> L'option ne vaut que pour la couverture maladie. Toutes les autres prestations (au titre des accidents du travail ou des maladies professionnelles, de l'invalidité ainsi que la perte de gains liée à la maladie ou à la maternité) relèvent de la législation applicable en Suisse. […]

**7d. urssaf.fr** (page 6d above, "Publié le 19 avril 2024")
> Vous devez faire un choix dans les trois mois suivant le début de votre activité en Suisse. Sans choix de votre part, vous serez automatiquement affilié à l’assurance maladie suisse.

> Si vous optez pour l'assurance maladie française et que vous êtes salarié, vous ne pourrez pas changer pour l'assurance maladie suisse pendant toute la durée de votre contrat de travail.

---

### 8. NOT FOUND

| Item | Where I looked |
|---|---|
| Legifrance article L380-3-1 and the articles it refers to (verbatim text and "version en vigueur" date) | legifrance.gouv.fr in the browser (blocked by the security check); web fetch tool (failed); web search (returned only an old article L380-1 link, dated 2007, which I could not open) |
| A separate official CNTFS website | Domain-restricted web search on cntfs.fr; urssaf.fr and ameli.fr pages (these only mention the centre) |
| Minimum / maximum of the French contribution | URSSAF pages 6a, 6b, 6c, 6d; ameli 7b |
| Whether "Prime en CHF" is monthly or yearly | Explanation files 2026 and 2027 (both sheets); 2027 change notice PDF |
| Page dates on the cleiss.fr pages | Visible text and meta tags of both cleiss pages |
| Rate for 2027 stated explicitly | URSSAF page 6a (it gives "En 2026 … 8 %" only) |
| Reuse notice on priminfo.admin.ch | Not visited (the opendata.swiss terms were found, as asked) |

---

# Addendum – second round (read 27 October 2026)

## 9. priminfo.admin.ch – monthly or yearly?

Neither priminfo page shows a page date.

**Page 9a:** https://www.priminfo.admin.ch/fr/praemien
Title: "Calculateur des primes 2027 – Priminfo". The page carries a "Communiqué 29.09.2026" and labels its text "Ce texte est écrit en langue facile à lire."
> La prime est le montant que vous devez payer chaque mois à votre caisse-maladie.

**Page 9b:** https://www.priminfo.admin.ch/fr/anleitung
Title: user guide ("Mode d'emploi").
> La prime d’assurance, c’est le montant que vous devez payer chaque mois à votre caisse-maladie.

**Page 9c:** https://www.priminfo.admin.ch/fr/versicherungen/eu_efta
Title: "UE/AELE/UK – Priminfo". This page does not say whether premiums are monthly or yearly. It does say:
> Près d’un tiers des caisses-maladie suisses proposent une assurance-maladie pour les personnes qui vivent dans un pays de l’UE, en Islande, en Norvège ou en Grande-Bretagne. Certaines caisses-maladie proposent une assurance seulement pour certains pays de l’UE. Les caisses-maladie calculent des primes différentes pour chaque pays.

> Vous êtes frontalière ou frontalier ? Alors, c’est le canton de votre lieu de travail qui est compétent.

The OFSP data files themselves (`Erläuterungen`, column `Prämie`) still say only "Prime en CHF", with no period. For the data files: **NOT FOUND**.

## 10. LAMal (RS 832.10) – age limits for premiums

**Page 10a:** https://www.fedlex.admin.ch/eli/cc/1995/1328_1328_1328/fr
Title: "RS 832.10 - Loi fédérale du 18 mars 1994 sur l'assurance-maladie (LAMal)". The page shows "du 18 mars 1994 (État le 1er juillet 2026)" and "Ce texte est en vigueur".

**Art. 61, al. 3 and 3bis** (no ages are given in art. 61):
> 3 Pour les enfants et les jeunes adultes, l’assureur fixe une prime plus basse que celle des autres assurés; la prime des enfants doit être inférieure à celle des jeunes adultes.²³⁸
> 3bis Le Conseil fédéral peut fixer les réductions de primes visées à l’al. 3.²³⁹
> ²³⁸ Nouvelle teneur selon le ch. I de la LF du 17 mars 2017, en vigueur depuis le 1er janv. 2019 (RO 2018 1843; FF 2016 6989 7729).
> ²³⁹ Introduit par le ch. I de la LF du 24 mars 2000, en vigueur depuis le 1er janv. 2001 (RO 2000 2305; FF 1999 727).

**Art. 61, al. 4** (residents of the EU, Iceland, Norway or the UK):
> 4 Pour les assurés résidant dans un État membre de l’Union européenne, en Islande, en Norvège ou au Royaume-Uni, les primes sont calculées en fonction de l’État de résidence. Le Conseil fédéral édicte les dispositions sur la fixation et l’encaissement des primes de ces assurés.

**The only age bounds found in the LAMal: art. 16a.** This article is about risk compensation, not about setting premiums.
> Art. 16a Allégement
> 1 Les assureurs bénéficient d’un allégement de la compensation des risques pour les assurés âgés de 19 à 25 ans le 31 décembre de l’année concernée (jeunes adultes).
> […]
> 4 Sont réputés adultes les jeunes adultes et les assurés qui ont plus de 26 ans le 31 décembre de l’année concernée.
> ⁴⁰ Introduit par le ch. I de la LF du 17 mars 2017, en vigueur depuis le 1er janv. 2019 (RO 2018 1843; FF 2016 6989 7729).

(Left out: al. 2–3.)

**Also checked: OAMal (RS 832.102).**
**Page 10b:** https://www.fedlex.admin.ch/eli/cc/1995/3867_3867_3867/fr. The page shows "(État le 22 octobre 2026)".
> Art. 91 Échelonnement des primes […]
> 3 L’échelonnement des primes selon le groupe d’âge pour les assurés visés à l’art. 61, al. 3, LAMal s’effectue d’après l’année de naissance.

**Age limit for "enfants" for premiums: NOT FOUND** in the LAMal or the OAMal. I searched both texts for "18 ans", "25 ans", "classe/catégorie/groupe d'âge" and "0 à 18". The only hits about 18/25 years in the OAMal concern the definition of "membres de la famille" and unpaid premiums of minors.

## 11. Suspending accident cover (LAMal art. 8 + LAA / OLAA)

**LAMal art. 8** – same page as 10a, État le 1er juillet 2026. No amendment footnote is attached to this article.
> Art. 8 Principe
> 1 La couverture des accidents peut être suspendue tant que l’assuré est entièrement couvert pour ce risque, à titre obligatoire, en vertu de la loi fédérale du 20 mars 1981 sur l’assurance-accidents (LAA). L’assureur procède à la suspension lorsque l’assuré lui en fait la demande et apporte la preuve qu’il est entièrement assuré conformément à la LAA. Il réduit la prime en conséquence.
> 2 Les accidents sont couverts en vertu de la présente loi dès que la couverture au sens de la LAA cesse totalement ou en partie.
> 3 L’assurance-maladie sociale prend en charge les coûts des suites d’accidents qu’elle assurait avant la suspension de la couverture.

**LAA (RS 832.20)**
**Page 11a:** https://www.fedlex.admin.ch/eli/cc/1982/1676_1676_1676/fr. The page shows "du 20 mars 1981 (État le 1er janvier 2026)".
> Art. 8 Accidents non professionnels […]
> 2 Les travailleurs occupés à temps partiel au sens de l’art. 7, al. 2, ne sont pas assurés contre les accidents non professionnels.

> Art. 7 […] 2 Les accidents qui se produisent sur le trajet que l’assuré doit emprunter pour se rendre au travail ou pour en revenir sont aussi réputés accidents professionnels pour les travailleurs occupés à temps partiel dont la durée de travail n’atteint pas un minimum qui sera fixé par le Conseil fédéral.

**OLAA (RS 832.202)** – this is where the weekly-hours threshold is set.
**Page 11b:** https://www.fedlex.admin.ch/eli/cc/1983/38_38_38/fr. The page shows "du 20 décembre 1982 (État le 1er janvier 2026)".
> Art. 13 Travailleurs à temps partiel
> 1 Les travailleurs à temps partiel occupés chez un employeur au moins huit heures par semaine sont également assurés contre les accidents non professionnels.³¹
> 2 Pour les travailleurs à temps partiel dont la durée hebdomadaire de travail n’atteint pas le minimum susdit, les accidents subis pendant le trajet entre leur domicile et leur lieu de travail sont réputés accidents professionnels.³²
> ³¹ Nouvelle teneur selon le ch. I de l’O du 20 sept. 1999, en vigueur depuis le 1er janv. 2000 (RO 1999 2879).
> ³² Nouvelle teneur selon le ch. I de l’O du 15 déc. 1997, en vigueur depuis le 1er janv. 1998 (RO 1998 151).

## 12. Plafond annuel de la Sécurité sociale (PASS)

**2026**
**Page 12a:** https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds-securite-sociale.html
Title: "Plafonds de la Sécurité sociale - Urssaf.fr". Page date: "Mis à jour le 01 janvier 2026".
Table "Plafonds de la Sécurité sociale par périodicité de paie en métropole et en Outre-mer (hors Mayotte)", column 2026:
> Année | 48 060 €
> Trimestre | 12 015 €
> Mois | 4 005 €

(Left out: the fortnight, week, day and hour rows, and the Mayotte table.)
The reference text listed on the page: "Arrêté du 22 décembre 2025 portant fixation du plafond de la Sécurité sociale pour 2026". I did not open it on Légifrance (see §14).

**2027 – announced, but the arrêté is not yet published (per URSSAF)**
**Page 12b:** https://www.urssaf.fr/accueil/actualites/plafond-annuel-securite-sociale.html
Title: "Plafond annuel de la Sécurité sociale, une augmentation prévue pour 2027". Page date: "Mis à jour le 20 octobre 2026".
> À compter du 1er janvier 2027 le plafond annuel de la Sécurité sociale sera fixé à 48 900 €.
> Le plafond mensuel s’élèvera à 4 075 €.
> […]
> Un arrêté sera publié d’ici la fin de l’année.

## 13. ECB euro foreign exchange reference rates

**Page 13a:** https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
Title: "Euro foreign exchange reference rates". No page date is shown apart from the date of the rates.
> The reference rates are usually updated at around 16:00 CET every working day, except on TARGET closing days.
> They are based on the daily concertation procedure between central banks across Europe, which normally takes place around 14:10 CET. The reference rates are published for information purposes only. Using the rates for transaction purposes is strongly discouraged.

**Latest value shown:** "27 October 2026" – "All currencies quoted against the euro (base currency)" – **CHF Swiss franc 0.9239**.

The same page links a PDF, "Framework for the euro foreign exchange reference rates" (`/stats/pdf/exchange/Frameworkfortheeuroforeignexchangereferencerates.en.pdf`). I did not open it.

**Terms of reuse**
**Page 13b:** https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html (the footer link /services/disclaimer/… redirects here).
Title: "Disclaimer & copyright". No page date shown.

> While the euro short-term rate (€STR), the euro foreign exchange reference rates and other price information published on this website are based on sources which the ECB considers to be reliable, the ECB accepts no responsibility or liability for any loss, damage, expense or claim incurred in connection with any decision made or action or inaction on the part of any party in reliance upon such publication. In particular, the ECB does not accept any responsibility or liability for any economic loss or any indirect or consequential loss or damage including, without limitation, loss of business and loss of profits, as a direct or indirect consequence of, or in connection with, the ECB publishing the rates or other price information, including the frequency of such publication or the use of the rates and other price information by any person.

> Copyright
> Copyright © for the entire content of this website: European Central Bank, Frankfurt am Main, Germany.
> Subject to the exception below, users of this website may make free use of the information obtained directly from it subject to the following conditions:
> When such information is distributed or reproduced, it must appear accurately and the ECB must be cited as the source.
> Where the information is incorporated in documents that are sold (regardless of the medium), the natural or legal person publishing the information must inform buyers, both before they pay any subscription or fee and each time they access the information taken from this website, that the information may be obtained free of charge through this website.
> If the information is modified by the user (e.g. by seasonal adjustment of statistical data or calculation of growth rates) this must be stated explicitly.
> When linking to this website from business sites or for promotional purposes, this website must load into the browser's entire window (i.e. it must not appear within another website's frame).
> As an exception to the above, any reproduction, publication or reprint, in whole or in part, of documents that bear the name of their authors, such as ECB Working Papers and ECB Occasional Papers, in the form of a different publication (whether printed or produced electronically) is permitted only with the explicit prior written authorisation of the ECB or the authors.

> If you access any part of this website, you will be deemed to have accepted the foregoing.

(Left out: the rest of the Disclaimer section and the "Use of name and logos" section.)

## 14. Légifrance – article L380-3-1 CSS

**Update, third round (read 27 October 2026):** the security check had cleared in your browser, and the articles were read. See §16 below. The paragraph below records the earlier blocked attempt and is superseded by §16.

**NOT FOUND (blocked again).** I tried https://www.legifrance.gouv.fr/search/code?query=L380-3-1, which redirected to `/search?fonds=CODE&query=L380-3-1`. After 10 seconds the page still showed "Vérification de sécurité en cours". I stopped there, as instructed, and made no attempt to get past the check.

## 15. NOT FOUND (second round)

| Item | Where I looked |
|---|---|
| Whether the OFSP data files give monthly or yearly premiums | Erläuterungen 2026/2027 (priminfo states "chaque mois" only in its user-facing calculator and guide texts, §9) |
| Age limit for "enfants" for premium purposes | LAMal art. 61 and the full text; OAMal art. 91 and the full text |
| Article L380-3-1 CSS | Légifrance (blocked) |
| Page dates on the priminfo and ECB pages | Visible page text |

---

# Addendum – third round: Légifrance (read 27 October 2026)

## 16. Code de la sécurité sociale and Code général des impôts (verbatim)

**How the articles were found:** the Légifrance search results page (https://www.legifrance.gouv.fr/search?fonds=CODE&query=L380-3-1) returned three articles of the Code de la sécurité sociale: L380-3-1, D380-2 and R380-3.

### 16a. Article L380-3-1 CSS — this is the article in question

URL: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036390105
Title: "Article L380-3-1 - Code de la sécurité sociale - Légifrance".
Version shown: « EN VIGUEUR DEPUIS LE 01 JANVIER 2018 » – « Modifié par LOI n°2017-1836 du 30 décembre 2017 - art. 8 (V) ».

> I.-Les travailleurs frontaliers résidant en France et soumis obligatoirement à la législation suisse de sécurité sociale au titre des dispositions de l'accord du 21 juin 1999 entre la Communauté européenne et ses Etats membres, d'une part, et la Confédération suisse, d'autre part, sur la libre circulation des personnes, mais qui, sur leur demande, sont exemptés d'affiliation obligatoire au régime suisse d'assurance maladie en application des dispositions dérogatoires de cet accord, sont affiliés obligatoirement au régime général dans les conditions fixées par l'article L. 160-1.
>
> II.-Toutefois, les travailleurs frontaliers occupés en Suisse et exemptés d'affiliation obligatoire au régime suisse d'assurance maladie peuvent demander à ce que les dispositions du I ne leur soient pas appliquées, ainsi qu'à leurs ayants droit, jusqu'à la fin des dispositions transitoires relatives à la libre circulation des personnes entre la Suisse et l'Union européenne, soit douze ans à partir de l'entrée en vigueur de l'accord du 21 juin 1999 précité, à condition d'être en mesure de produire un contrat d'assurance maladie les couvrant, ainsi que leurs ayants droit, pour l'ensemble des soins reçus sur le territoire français. Ces dispositions ne sont pas applicables aux travailleurs frontaliers, ainsi qu'à leurs ayants droit, affiliés au régime général à la date d'entrée en vigueur de la loi n° 2006-1640 du 21 décembre 2006 de financement de la sécurité sociale pour 2007. Les travailleurs ayant formulé une telle demande peuvent ultérieurement y renoncer à tout moment, pour eux-mêmes et pour leurs ayants droit indistinctement, et sont, à partir de la date de cette renonciation, affiliés au régime général en application des dispositions du I.
>
> III.-Les dispositions du I et du II sont également applicables aux titulaires de pensions ou de rentes suisses, ainsi qu'à leurs ayants droit, résidant en France et soumis obligatoirement à la législation suisse de sécurité sociale au titre des dispositions de l'accord du 21 juin 1999 précité, mais qui sur leur demande sont exemptés d'affiliation obligatoire au régime suisse d'assurance maladie en application des dispositions dérogatoires de cet accord.
>
> IV.-Les travailleurs frontaliers et les titulaires de pensions et de rentes affiliés au régime général dans les conditions fixées au I ne sont pas assujettis aux contributions visées à l'article L. 136-1 et à l'article 14 de l'ordonnance n° 96-50 du 24 janvier 1996 relative au remboursement de la dette sociale et ne sont pas redevables des cotisations visées à l'article L. 131-9 et à l'article L. 380-2.
>
> Ils sont redevables d'une cotisation fixée en pourcentage du montant de leurs revenus définis selon les modalités fixées au IV de l'article 1417 du code général des impôts. Un décret détermine le taux et les modalités de calcul de cette cotisation ainsi que les obligations déclaratives incombant aux assujettis.
>
> La cotisation est recouvrée selon les dispositions des sections 2 à 4 du chapitre III et du chapitre IV du titre IV du livre II du présent code, sous réserve des adaptations prévues par décret en Conseil d'Etat.

### 16b. Article D380-2 CSS — rate, allowance, formula

URL: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038405782
Title: "Article D380-2 - Code de la sécurité sociale - Légifrance".
Version shown: « EN VIGUEUR DEPUIS LE 01 JANVIER 2019 » – « Modifié par Décret n°2019-349 du 23 avril 2019 - art. 1 ».

> I.-La cotisation due par les personnes mentionnées à l'article L. 380-3-1 au titre d'une année civile est calculée selon la formule suivante :
>
> Montant de la cotisation = 8 % × (A-0,25 × PASS)
>
> Où :
>
> A correspond à l'assiette des revenus définis au deuxième alinéa du IV de l'article L. 380-3-1 perçus au cours de la dernière année civile pour laquelle ces revenus sont connus.
>
> PASS correspond au plafond annuel de la sécurité sociale.
>
> II.-Cette cotisation est due à compter de la date à laquelle la personne remplit les conditions énoncées au premier alinéa de l'article L. 380-3-1 et cesse d'être due à compter du lendemain de la date à laquelle elles ne sont plus remplies. Lorsque la période entre ces deux dates est inférieure à une année, le montant de la cotisation est calculé au prorata de la durée de cette période.
>
> III.-Les caisses primaires d'assurance maladie communiquent aux organismes chargés du recouvrement la liste des personnes redevables de la cotisation prévue à l'article L. 380-3-1.
>
> Conformément à l'article 3 du décret n° 2019-349 du 23 avril 2019, ces dispositions s'appliquent aux cotisations dues au titre des périodes courant à compter du 1er janvier 2019.

### 16c. Article R380-3 CSS — collection

URL: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000034623630
Title: "Article R380-3 - Code de la sécurité sociale - Légifrance".
Version shown: « EN VIGUEUR DEPUIS LE 06 MAI 2017 » – « Modifié par Décret n°2017-736 du 3 mai 2017 - art. 7 ».

> Les cotisations mentionnées à l'article L. 380-2 et au deuxième alinéa du IV de l'article L. 380-3-1 sont calculées, appelées et recouvrées par les organismes chargés du recouvrement des cotisations du régime général au vu des éléments transmis par l'administration fiscale ou par les personnes redevables de ces cotisations.

### 16d. Article 1417, IV, Code général des impôts — income base referred to by L380-3-1

URL: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373249
Title: "Article 1417 - Code général des impôts".
Version shown: « EN VIGUEUR DEPUIS LE 01 JUILLET 2026 » – « Modifié par Décret n°2026-562 du 29 juin 2026 - art. 2 ».

Only part IV is copied. I to III, which deal with thresholds for local taxes, are left out.

> IV. – 1° Pour l'application du présent article, le montant des revenus s'entend du montant net après application éventuelle des règles de quotient définies à l'article 163-0 A des revenus et plus-values retenus pour l'établissement de l'impôt sur le revenu au titre de l'année précédente.
>
> Ce montant est majoré :
>
> a) du montant des charges déduites en application de l'article 163 duovicies ainsi que du montant des cotisations ou des primes déduites en application de l'article 163 quatervicies ;
>
> a bis) du montant des abattements mentionnés aux 1 ter ou 1 quater de l'article 150-0 D, à l'article 150-0 D ter, au 2° du 3 de l'article 158 et au 3 de l'article 200 A, du montant des plus-values en report d'imposition en application de l'article 150-0 B quater, du montant des plus-values soumises au prélèvement prévu à l'article 244 bis A et du montant des plus-values et distributions soumises au prélèvement prévu à l'article 244 bis B ;
>
> b) du montant des bénéfices exonérés en application des articles 44 sexies, 44 sexies A, 44 octies A, 44 octies B, 44 terdecies à 44 septdecies, ainsi que du 9 de l'article 93 ;
>
> c) du montant des revenus soumis aux prélèvements libératoires prévusau 1 du II et au II bis de l'article 125-0 A, aux II et III de l'article 125 A et au II de l'article 163 bis, du montant des produits et revenus soumis aux retenues à la source prévues à l'article 119 bis, aux articles 182 A, 182 A bis et 182 A ter, à hauteur de la fraction donnant lieu à une retenue libératoire de l'impôt sur le revenu, de ceux soumis aux versements libératoires prévus par l'article 151-0 retenus pour leur montant diminué, selon le cas, de l'abattement prévu au 1 de l'article 50-0 ou au 1 de l'article 102 ter, de ceux visés aux articles 81 quater, 81 A, 81 D et 155 B, de ceux perçus par les fonctionnaires des organisations internationales, de ceux exonérés par application d'une convention internationale relative aux doubles impositions, de ceux exonérés en application de l'article 80 sexdecies ainsi que de ceux exonérés en application des articles 163 quinquies B à 163 quinquies C bis ;
>
> d) Du montant des plus-values exonérées en application des 1,1 bis et 7 du III de l'article 150-0 A ainsi que du montant du gain net exonéré en application du 4 ter du même III ;
>
> e) Des sommes correspondant aux droits visés à l'article L. 3152-4 ou à l'article L. 3334-8 du code du travail ainsi que les sommes issues des droits inscrits au compte-épargne ou correspondant à des jours de repos non pris exonérés en application du 18° de l'article 81.
>
> 2°) Abrogé (à compter des impositions établies au titre de 2000.)
>
> Modification effectuée en conséquence de l'article 4-I B 1° a de la loi n° 2026-103 du 19 février 2026.

("prévusau" is spelled that way on the page.)

### 16e. Not followed

These articles are mentioned in L380-3-1 but do not concern the rate, the allowance or the calculation, so I did not open them:

- L. 160-1 (affiliation)
- L. 136-1 (CSG)
- art. 14 of the 1996 ordonnance (CRDS)
- L. 131-9
- L. 380-2
- the collection provisions in book II, title IV of the CSS
