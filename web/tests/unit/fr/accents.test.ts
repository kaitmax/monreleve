// web/tests/unit/fr/accents.test.ts
//
// RULING R155: lib/fr IS AUTHORITATIVE AND FULLY ACCENTED.
//
// "ASCII in a relay prompt is ILLUSTRATIVE, never a source. The prompt's
// spelling is a transport constraint, and any copy taken from one is
// re-accented before it lands."
//
// THE DEFECT, AND ITS CAUSE IS IN THE PROCESS RATHER THAN THE CODE. The relay
// prompts this project runs on are pure ASCII because prompts are. FW16 wrote
// lib/fr/guides.ts by transcribing copy out of one, and the accents did not
// survive the trip - so FW17's three articles, written in correct French,
// render against a chip reading "Derniere verification" and a footer reading
// "Chaque regle citee sur cette page".
//
// IN FRENCH THAT IS SPELLING, NOT TYPOGRAPHY. "ou" and "ou" with a grave are
// different words, and so are "des" and "des". On a page whose subject is
// French tax rules, read by somebody deciding whether to trust it, it is the
// most damaging thing on the surface.
//
// THE LIST IS CURATED, NOT DERIVED, and that is the whole design. Deriving it
// - stripping the accents off every accented word in the articles and looking
// for the result - proposes votre, des, sur, compte, entre, note, passe,
// donne, demande, compare, tranche, copie, valide, and the verb forms
// horodate and genevoise. EVERY ONE OF THOSE IS CORRECT FRENCH. A guard that
// reports 117 false positives is a guard somebody deletes, and the failure
// mode of a self-generating scope is noise until it is silenced.
//
// So every entry below is a form that NO correct French word spells that way.
// When a new one appears, it is added here deliberately.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isComment, quotedSpans } from '@/tests/support/quoted-spans';

const FR_DIR = join(process.cwd(), 'lib', 'fr');
const GUIDES_DIR = join(process.cwd(), 'content', 'guides');

/**
 * Unaccented spellings that are never correct French.
 *
 * Grouped by the word they belong to so that a reader can check the claim.
 * The seed is the operator's; the rest were measured in lib/fr and the
 * guides. Anything ambiguous is deliberately ABSENT - see the header.
 */
const FORBIDDEN: readonly string[] = [
  // dernier / derniere
  'derniere',
  'dernieres',
  // verification, verifier
  'verification',
  'verifications',
  'verifie',
  'verifiee',
  'verifiees',
  'verifier',
  // reglementaire, regle
  'reglementaire',
  'reglementaires',
  'regle',
  'regles',
  // teletravail
  'teletravail',
  // apres, etre, etes
  'apres',
  'etre',
  'etes',
  // frontalier's feminine forms. The masculine "frontalier" is correct.
  'frontaliere',
  'frontalieres',
  // declaration and its family
  'declaration',
  'declarations',
  'declarable',
  'declares',
  'declenches',
  // annee
  'annee',
  'annees',
  // nouns whose unaccented form is not a word
  'consequence',
  'consequences',
  'difference',
  'differences',
  'reference',
  'references',
  'decompte',
  'detection',
  'parametres',
  'separement',
  'precise',
  'precises',
  'demonstration',
  'prefixe',
  'repertoire',
  'hierarchie',
  'caracteres',
  'entree',
  'ecran',
  'frequentes',
  'confidentialite',
  'securite',
  'activite',
  'periode',
  'numero',
  'regime',
  'regimes',
  'releve',
  'releves',
  'zero',
  'negative',
  'negatif',
  'citee',
  'citees',
  'journee',
  'journees',
  'interieur',
  'simplifiee',
  'incomplete',
  'completes',
];

const strip = (word: string): string => word.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * PROSE CONTAINS A SPACE. An identifier does not.
 *
 * THE FALSE POSITIVES THIS REMOVES ARE REAL AND THEY ARE NOT EDGE CASES:
 * "/releve-annuel" is a route path, "regime-lost" is a Status id,
 * "NEGATIVE_DAYS" is an error code, "/confidentialite" is a route, and in
 * content/guides every slug and every href is one -
 * "teletravail-frontalier-40-pourcent" appears in all three articles.
 *
 * SPEC 14 MAKES SLUGS PERMANENT, so those are permanently unaccented and a
 * guard that flagged them would be refusing something that cannot change.
 *
 * A DISCRIMINATOR RATHER THAN AN EXEMPTION LIST, deliberately. A list of
 * allowed identifiers has to grow with every new route, enum member and slug,
 * and the day somebody forgets, the guard reports a defect that is not one.
 * This rule survives all three without an entry.
 */
const isProse = (span: string): boolean => span.includes(String.fromCharCode(32));

interface Offence {
  readonly where: string;
  readonly form: string;
  readonly context: string;
}

/** Every forbidden form in one piece of prose. */
function formsIn(text: string, where: string): Offence[] {
  const found: Offence[] = [];

  for (const word of text.match(/[\p{L}]{3,}/gu) ?? []) {
    const low = word.toLowerCase();

    // An accented word is correct by construction and cannot be a hit.
    if (low !== strip(low)) continue;
    if (!FORBIDDEN.includes(low)) continue;

    found.push({ where, form: low, context: text.trim().slice(0, 70) });
  }

  return found;
}

/** lib/fr, scanned the way R91 and R126 scan it: quoted spans, no comments. */
function offencesInCopy(): Offence[] {
  const found: Offence[] = [];

  for (const name of readdirSync(FR_DIR).filter((file) => file.endsWith('.ts'))) {
    const lines = readFileSync(join(FR_DIR, name), 'utf8').split('\n');

    for (const line of lines) {
      if (isComment(line)) continue;

      for (const span of quotedSpans(line)) {
        if (!isProse(span)) continue;

        found.push(...formsIn(span, `lib/fr/${name}`));
      }
    }
  }

  return found;
}

/**
 * content/guides, frontmatter and body.
 *
 * MDX COMMENTS ARE STRIPPED - they are English maintainer commentary, the
 * same treatment R91's and R147's scans give them. The slug and the hrefs are
 * excluded by isProse, not by a rule about MDX.
 */
function offencesInGuides(): Offence[] {
  const found: Offence[] = [];

  for (const name of readdirSync(GUIDES_DIR).filter((file) => file.endsWith('.mdx'))) {
    const source = readFileSync(join(GUIDES_DIR, name), 'utf8').replace(
      /\{\/\*[\s\S]*?\*\/\}/g,
      ' ',
    );

    // LINE BY LINE, AND A LINE IS EITHER CODE OR PROSE.
    //
    // An article is both. Its markdown is prose; its <DataGrid> props are
    // JavaScript, and the OBJECT KEYS in them are identifiers that happen to
    // be French-looking words:
    //
    //   regime: "Cantons de l'accord de 1983",
    //
    // `regime` there is a column id, not a word - it is never rendered. The
    // string beside it IS rendered and must be correct. The first version of
    // this scan read the whole line as prose and reported the key, which is
    // the same false positive as flagging a route path, one syntax along.
    //
    // So a line that introduces a quoted value is scanned the way lib/fr is
    // scanned - by its quoted spans - and every other line is prose. French
    // prose never writes `mot: "`, because its own quotation marks are
    // guillemets and R91 puts a no-break space before the colon.
    const CODE_LINE = /[A-Za-z_$][\w$]*\s*[:=]\s*["'`]/;

    // THE IDENTIFIER TRAP, IN A THIRD SYNTAX. It first appeared as a route
    // path in a TypeScript string and then as an object key in a JSX prop;
    // here it is YAML:
    //
    //   slug: teletravail-frontalier-40-pourcent
    //   related:
    //     - teletravail-frontalier-40-pourcent
    //
    // Both lines contain a space, so the span rule passes them, and neither
    // carries a quote, so the code-line rule misses them.
    //
    // EXCLUDED BY CONTRACT RATHER THAN BY SHAPE. The tempting rule - "a
    // hyphenated lowercase token is a slug" - would swallow mi-temps,
    // au-dela, demi-journee and compte-t-elle, which is most of the French
    // this guard exists to check. lib/guides/frontmatter.ts says which fields
    // hold identifiers; those three are skipped and every other field -
    // title, description, reviewer, faq, claims - is scanned as the prose it
    // is. SPEC 14 makes a slug permanent, so it is permanently unaccented.
    const IDENTIFIER_FIELDS = /^(?:slug|cluster|related)\s*:/;
    let inFrontmatter = false;
    let skippingList = false;
    let seenFence = 0;

    for (const line of source.split('\n')) {
      if (line.trim() === '---' && seenFence < 2) {
        seenFence += 1;
        inFrontmatter = seenFence === 1;
        continue;
      }

      if (inFrontmatter) {
        if (IDENTIFIER_FIELDS.test(line)) {
          // `related:` introduces a list; `slug:` is a one-liner.
          skippingList = line.trim().endsWith(':');
          continue;
        }

        // A list item under an identifier field. Any other key ends the run.
        if (skippingList && /^\s+-\s/.test(line)) continue;
        if (/^\S/.test(line)) skippingList = false;
      }

      if (CODE_LINE.test(line)) {
        for (const span of quotedSpans(line)) {
          if (isProse(span)) found.push(...formsIn(span, `content/guides/${name}`));
        }

        continue;
      }

      for (const piece of line.split(/\s{2,}/)) {
        if (!isProse(piece)) continue;

        // Drop markdown link targets and bare URLs, which carry slugs.
        const withoutTargets = piece.replace(/\]\([^)]*\)/g, ' ').replace(/\S*\/\S*/g, ' ');

        found.push(...formsIn(withoutTargets, `content/guides/${name}`));
      }
    }
  }

  return found;
}

const describeAll = (offences: readonly Offence[]): string =>
  offences.map((o) => `  ${o.where}  ${o.form}  "${o.context}"`).join('\n');

describe('the detector fires on what it is for', () => {
  it('reports each forbidden form planted in a sentence', () => {
    // NON-VACUITY FIRST. An absence assertion over a scanner that reports
    // nothing is the exact shape R154 was written about.
    expect(formsIn('Derniere verification de la regle', 'x').map((o) => o.form)).toEqual([
      'derniere',
      'verification',
      'regle',
    ]);
    expect(formsIn('Le teletravail apres la declaration', 'x')).toHaveLength(3);
  });

  it('ignores the correctly accented forms', () => {
    const correct = [
      'Dernière vérification de la règle',
      'Le télétravail après la déclaration',
    ];

    for (const sentence of correct) expect(formsIn(sentence, 'x'), sentence).toEqual([]);
  });

  it('does not flag the correct French the derived list would have', () => {
    // THE TRAP THIS GUARD IS BUILT AROUND. Every word here is correct
    // unaccented and a derived list proposes all of them. If one ever lands
    // in FORBIDDEN, this is what fails.
    const correct =
      'votre compte entre des notes sur le passe et la demande ' +
      'donne une copie valide que je compare et tranche';

    expect(formsIn(correct, 'x')).toEqual([]);
  });

  it('treats an identifier as an identifier, not as prose', () => {
    // Route paths, status ids and error codes live inside quotes too.
    for (const identifier of [
      '/releve-annuel',
      'regime-lost',
      'NEGATIVE_DAYS',
      '/confidentialite',
      'teletravail-frontalier-40-pourcent',
    ]) {
      expect(isProse(identifier), identifier).toBe(false);
    }

    // And a real sentence is prose even though it contains the same word.
    expect(isProse('Le teletravail du frontalier')).toBe(true);
  });
});

describe('lib/fr is written in accented French (R155)', () => {
  it('reads the copy files, so nothing below passes vacuously', () => {
    const files = readdirSync(FR_DIR).filter((file) => file.endsWith('.ts'));

    expect(files.length).toBeGreaterThan(20);
  });

  it('contains no forbidden form', () => {
    const found = offencesInCopy();

    expect(
      found,
      `R155: unaccented French in lib/fr.\n${describeAll(found)}`,
    ).toEqual([]);
  });
});

describe('the guides are written in accented French (R155)', () => {
  it('contains no forbidden form in any article', () => {
    const found = offencesInGuides();

    expect(
      found,
      `R155: unaccented French in content/guides.\n${describeAll(found)}`,
    ).toEqual([]);
  });
});

describe('the other direction: the accents are actually there', () => {
  it('counts accented characters in lib/fr, so removing them cannot pass', () => {
    // THE HALF THAT MAKES IT A GUARD RATHER THAN A SWEEP, and the same shape
    // as copy-codepoints.test.ts's apostrophe count. Somebody facing a
    // failure above could "fix" it by deleting the word, or by rewording
    // around every accent. The count would collapse and this would fail.
    let accented = 0;

    for (const name of readdirSync(FR_DIR).filter((file) => file.endsWith('.ts'))) {
      for (const line of readFileSync(join(FR_DIR, name), 'utf8').split('\n')) {
        if (isComment(line)) continue;

        for (const span of quotedSpans(line)) {
          for (const character of span) {
            if (character !== strip(character)) accented += 1;
          }
        }
      }
    }

    expect(accented, 'lib/fr has lost its accents').toBeGreaterThan(850);
  });
});
