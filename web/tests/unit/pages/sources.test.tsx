// @vitest-environment jsdom
//
// web/tests/unit/pages/sources.test.tsx
//
// /sources - RULING R113, FW12 increment 0.
//
// WHAT THIS PAGE IS ACCOUNTABLE FOR. It is the only disclosure surface for P2,
// which by design has no input trigger, and it is linked from the calculator's
// standing legal note. The operator's account of the hole it closes: "I
// designed P2 with no input trigger and then pointed its only disclosure at a
// planned route, while the calculator went live."
//
// So the assertions here are about DISCLOSURE rather than layout: that all
// three readings appear, that the two unverified constants are marked
// unverified rather than presented beside the six that were checked, and that
// every value shown comes from the RuleSet rather than from a string.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import SourcesPage, { generateMetadata } from '@/app/(public)/sources/page';
import { ruleSetFor } from '@/lib/calc-engine';
import { PUBLISHED_PROVISIONAL_IDS } from '@/lib/content/provisional';
import { LAST_REGULATORY_REVIEW } from '@/lib/content/regulatory';
import { CHECKPOINT_A, SOURCE_ENTRIES, SOURCE_IDS } from '@/lib/content/sources';
import { currentTaxYear } from '@/lib/content/tax-year';
import { SOURCES_COPY } from '@/lib/fr/sources';
import { guideNavLinks } from '@/lib/guides/registry';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';
import { formatDate, formatDays, formatPercent } from '@/lib/ui/core';
import { complianceClaims } from '@/tests/support/vocabulary';

expect.extend(matchers);

afterEach(cleanup);

const YEAR = currentTaxYear();
const RULES = ruleSetFor(YEAR);

const pageText = (): string => {
  const { container } = render(<SourcesPage />);

  return container.textContent ?? '';
};

describe('the constants table', () => {
  it('has a row for every source entry', () => {
    const text = pageText();

    expect(SOURCE_ENTRIES).toHaveLength(SOURCE_IDS.length);
    // SEVENTEEN SINCE FW20b, and every step of the growth is a decision
    // somebody wrote down.
    // R158 split the two facts that shared missionCapDays because they share
    // its ge.ch PAGE - the travel-day rules and the six worked examples - and
    // the CLEISS pass added four for the droit d’option. FW20b added the
    // last three: droitOptionFamily, the fact FW18b transcribed and never
    // turned into a row, plus droitOptionFiling and droitOptionForm - fact 6
    // split in two because where the option is filed and which form files it
    // have different rot profiles (R158).
    //
    // Hardcoded on purpose: deriving it from SOURCE_IDS would agree with
    // whatever SOURCE_IDS says, which is the thing being checked.
    // THIRTY SINCE FW-COMPARATEUR: thirteen rows for the LAMal / CMU
    // comparator (docs/regulatory-sources.md L1-L14), one per fact the page
    // or a guide states (R158).
    expect(SOURCE_ENTRIES.length).toBe(30);

    for (const entry of SOURCE_ENTRIES) {
      expect(text, entry.id).toContain(SOURCES_COPY.rules[entry.id]);
    }
  });

  it('takes every value from the RuleSet, not from copy (R73)', () => {
    // The page's whole subject is where the numbers come from, which makes it
    // the worst place to keep a second copy of them. Computed here the same
    // way the page computes them, so a change to RuleSet moves both.
    const text = pageText();

    expect(text).toContain(formatPercent(RULES.fiscalCeiling * 100, 0));
    expect(text).toContain(formatPercent(RULES.socialCeiling * 100, 1));
    expect(text).toContain(formatDays(RULES.simplifiedBasisDays));
    expect(text).toContain(formatDays(RULES.missionCapDays));
  });

  it('lists the 1983-accord cantons from the RuleSet', () => {
    expect(pageText()).toContain(RULES.residence1983Cantons.join(', '));
  });

  it('says "no value" for the rows that state a rule rather than a number', () => {
    // Better than an empty cell, which reads as missing data on a page whose
    // subject is completeness.
    const withoutValue = SOURCE_ENTRIES.filter((entry) => entry.ruleSetKey === undefined);

    expect(withoutValue.length).toBeGreaterThanOrEqual(2);
    expect(pageText()).toContain(SOURCES_COPY.noValue);
  });

  it('links each row to its primary source', () => {
    const { container } = render(<SourcesPage />);
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));

    for (const entry of SOURCE_ENTRIES) {
      expect(hrefs, entry.id).toContain(entry.url);
    }
  });

  it('opens those links without a referrer', () => {
    // A tax administration has no business knowing which of our pages a
    // reader came from.
    const { container } = render(<SourcesPage />);
    const external = [...container.querySelectorAll('a')].filter((a) =>
      (a.getAttribute('href') ?? '').startsWith('https://'),
    );

    expect(external.length).toBeGreaterThanOrEqual(8);
    for (const link of external) {
      expect(link.getAttribute('rel')).toContain('noreferrer');
    }
  });
});

describe('what is verified and what is not', () => {
  it('marks the two unreached constants as pending, not as checked', () => {
    // THE ASSERTION THAT MATTERS MOST ON THIS PAGE. Six of eight were
    // transcribed against the primary source; two could not be reached by any
    // published example - the day classification, because the cases count
    // days rather than hours, and the 1983 canton list, because Geneve is a
    // source canton. Presenting those two beside the six would be the quiet
    // overclaim this page exists to prevent.
    const pending = SOURCE_ENTRIES.filter((entry) => entry.status === 'pending');

    expect(pending.map((entry) => entry.id)).toEqual([
      'dayClassification',
      'residence1983Cantons',
    ]);
    expect(pageText()).toContain(SOURCES_COPY.status.pending);
  });

  it('says what "transcribed" does and does not mean', () => {
    // Transcribed is not verified, and the page says so in its own sentence
    // rather than leaving a reader to infer it from a word.
    expect(pageText()).toContain(SOURCES_COPY.statusNote);
  });

  it('shows the review date (R51)', () => {
    expect(LAST_REGULATORY_REVIEW).not.toBeNull();
    expect(pageText()).toContain(formatDate(LAST_REGULATORY_REVIEW ?? ''));
  });
});

describe('the three readings, in two groups since the accord (R113, REG-APPLY)', () => {
  it('publishes all three, including the one with no input trigger', () => {
    const text = pageText();

    expect(PUBLISHED_PROVISIONAL_IDS).toHaveLength(3);

    for (const id of PUBLISHED_PROVISIONAL_IDS) {
      expect(text, `${id} heading`).toContain(SOURCES_COPY.provisional[id].heading);
      expect(text, `${id} body`).toContain(SOURCES_COPY.provisional[id].body);
    }
  });

  it('groups them into what the texts now establish and what stays a reading', () => {
    // Since the accord of 29 April 2026: P1 (imputation order, 1b) and P2 (49,9
    // social, OFAS) move under the settled heading, and P3's combined case
    // stays under the reading heading. Both headings and both intros render.
    const text = pageText();

    expect(text).toContain(SOURCES_COPY.settledHeading);
    expect(text).toContain(SOURCES_COPY.settledIntro);
    expect(text).toContain(SOURCES_COPY.readingHeading);
    expect(text).toContain(SOURCES_COPY.readingIntro);
  });

  it('publishes P2, which nothing on the calculator can surface', () => {
    // Named separately from the loop because this is the disclosure that had
    // nowhere to live: the notice is input-triggered and P2 has no trigger.
    expect(pageText()).toContain(SOURCES_COPY.provisional.P2.heading);
  });
});

describe('SPEC section 20 vocabulary, on the page most likely to break it', () => {
  it('claims no certification anywhere in the rendered text', () => {
    // A page about what is and is not established is the single most tempting
    // place to write "conforme" for a checked row.
    const claims = complianceClaims(pageText());

    expect(claims, claims.join(', ')).toEqual([]);
  });

  it('claims none in the metadata either (R95)', () => {
    const meta = generateMetadata();
    const text = `${String(meta.title)} ${String(meta.description)}`;

    expect(complianceClaims(text), text).toEqual([]);
  });
});

describe('the assembled page', () => {
  it('has no axe violations inside the shell', async () => {
    const { container } = render(
      <PublicShell guideLinks={guideNavLinks()}>
        <SourcesPage />
      </PublicShell>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has one h1 and skips no heading level', () => {
    const { container } = render(
      <PublicShell guideLinks={guideNavLinks()}>
        <SourcesPage />
      </PublicShell>,
    );
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((element) =>
      Number.parseInt(element.tagName.slice(1), 10),
    );

    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);

    for (let index = 1; index < levels.length; index += 1) {
      expect(
        (levels[index] ?? 1) - (levels[index - 1] ?? 1),
        `h${levels[index - 1]} followed by h${levels[index]}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('uses a real table, with header cells that name their scope', () => {
    // Eight rows against four columns is tabular data, and a screen reader
    // should be able to say "Source primaire, ge.ch" rather than read a stack
    // of divs.
    const { container } = render(<SourcesPage />);

    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(5);
    expect(container.querySelectorAll('th[scope="row"]')).toHaveLength(30);
  });
});

describe('the verification date column', () => {
  it('dates every transcribed row', () => {
    const text = pageText();
    const transcribed = SOURCE_ENTRIES.filter((entry) => entry.status === 'transcribed');

    // FIFTEEN OF SEVENTEEN. The two still unread are rows 6 and 7 - the day
    // classification and the 1983 canton list - and they are the same two
    // they have always been, which is the number worth watching: every row
    // added since has arrived WITH its source read, and these two have not
    // moved in four tasks. FW20b's three came off the CLEISS fetch of
    // 16.09.2026 that D1-D7 already came from.
    // TWENTY-EIGHT OF THIRTY since FW-COMPARATEUR's thirteen, all read on
    // 27.10.2026 - and the same two still unread.
    expect(transcribed).toHaveLength(28);
    expect(text).toContain(formatDate(CHECKPOINT_A));
  });

  it('leaves the two unreached rows undated, not dated', () => {
    // THE OVERCLAIM THIS PREVENTS, and I shipped it for one commit: every row
    // carried the Checkpoint A date, including the two the pass never
    // reached. A verification date on an unverified row, on the page that
    // exists to stop exactly that.
    //
    // The type now makes it impossible - lib/content/sources.ts models a
    // pending row without a date field at all, and adding one is TS2353 - so
    // this asserts the RENDERED consequence: an em dash where there is no
    // date.
    const pending = SOURCE_ENTRIES.filter((entry) => entry.status === 'pending');

    expect(pending).toHaveLength(2);
    expect(pageText()).toContain(SOURCES_COPY.notRead);
  });

  it('names the publisher rather than showing a bare hostname', () => {
    const text = pageText();

    for (const entry of SOURCE_ENTRIES) {
      expect(text, entry.id).toContain(entry.sourceName);
    }
  });
});
