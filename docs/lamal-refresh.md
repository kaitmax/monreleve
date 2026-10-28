# The LAMal / CMU comparator — the yearly refresh

The OFSP publishes next year's premiums each autumn (late September), URSSAF
announces next year's PASS in October and publishes the arrêté in December.
The comparator holds one entry per premium year in
`web/lib/lamal/years.ts`, and **a year is its premiums, its PASS and its rate
together — never mixed** (R671). This is how a year is added, and how 2027's
announced PASS becomes final.

Rulings: R656 (generated, never hand-typed), R657 (a missing year is
refused), R664–R673 (the operator's ruling on the sources; CLAUDE.md).
Rows: `docs/regulatory-sources.md`, section *THE LAMAL / CMU COMPARATOR*,
L1–L14.

## 1. Download the premium file, by name

From https://opendata.swiss/fr/dataset/health-insurance-premiums (dataset
*« Primes de l'assurance-maladie »*, OFSP), download **`Prämien_EU.csv`** for
the new premium year. Read the resource's terms on the page: the comparator
relies on *« Utilisation libre. Obligation d'indiquer la source. »* — if they
have changed, stop; the reuse question is open again (R146, R157).

Commit it as `docs/sources/primes-lamal/<year>_Praemien_EU.csv` and add its
name, size, SHA-256 and URL to `docs/sources/primes-lamal/CHECKSUMS.txt`.
Download `Erläuterungen zu den Prämiendaten.xlsx` too and check the column
descriptions against the generator's header (step 2).

## 2. Configure and generate

In `web/scripts/lamal-generate.mjs`, add the year to `YEARS`: its file name,
URL, date read, how the file spells France (`FR` in 2027, `EU FR` in 2026),
the territory and region codes, the class, accident, subgroup and franchise
codes, and the expected counts (France rows, insurers, excluded K3 rows).
**Copy nothing from the previous year without checking it in the file** —
2027 changed every code.

```
cd web
node scripts/lamal-generate.mjs <year>
```

The script refuses, naming the reason, on any surprise: another header, a
row count, a code it does not know, an insurer missing a cell, a cell twice
(R211). Fix the configuration from the file, never the other way round.

## 3. Add the year

In `web/lib/lamal/years.ts`, add the `ComparatorYear`: the generated
premiums, the PASS for that year from URSSAF's page
(https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds-securite-sociale.html),
`passStatus: 'announced'` until the arrêté is published, the page date, and
the rate and allowance from CSS art. D380-2 I — **re-read the article on
Légifrance**; if it has changed, the formula changes with it and that is an
Ask-first item. The default year is the newest one automatically (R171).

Update the ECB rate in `EXCHANGE_RATE` (the day's euro reference rate for
CHF, https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)
and its date. The rate is stored unmodified; if the site ever changes it,
the ECB's terms require the page to say so.

Add the rows to `docs/regulatory-sources.md` (the new PASS, the new rate,
the new file's checks: France rows, insurers, the codes) with the date read.

## 4. When an announced PASS becomes final

When the arrêté fixing the PASS is published (for 2027: announced by URSSAF
on 20.10.2026, *« Un arrêté sera publié d'ici la fin de l'année »*):

1. Read the arrêté on Légifrance and URSSAF's PASS page.
2. If the figure is the one announced, set `passStatus: 'final'`,
   `passFinalBy: null` and update `passPageDate` in
   `web/lib/lamal/years.ts`. The page drops the *annoncé* label by itself.

   **The gate enforces this (R677).** An announced year carries
   `passFinalBy` - for 2027, `'2027-01-15'` - and from that day
   `tests/unit/lamal/pass-deadline.test.ts` FAILS, with a message pointing
   here, until the year is marked final. When you add a year whose PASS is
   only announced (step 3), give it a `passFinalBy` of 15 January of that
   year.
3. If the figure differs, change `passEur` too, and re-run the tests: the
   2027 expectations in `tests/unit/lamal/compare.test.ts` name the announced
   figure and will fail, which is the point.
4. Record the arrêté (title, date, URL) under row L13.

## 5. Verify

```
pnpm exec vitest run tests/unit/lamal
pnpm gate:changed
```

`tests/unit/lamal/premium-data.test.ts` re-derives the module from the CSV
with its own parser and checks the SHA-256. Add the new year to its `YEARS`
list and pick three rows to check **by hand** against the published file;
name them in the session report (R656).

## 6. Retire a year

Remove its entry from `COMPARATOR_YEARS` and its generated module. The
comparator then refuses it (R657) — it never answers with another year's
figures.
