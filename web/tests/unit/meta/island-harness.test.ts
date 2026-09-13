// web/tests/unit/meta/island-harness.test.ts
//
// RULING R122: /dev/island measures nothing it does not import.
//
// THE FAILURE MODE OF A HARNESS IS GOING STALE. GATE I holds the route to 25
// KiB over the framework floor, and the number is only worth reading if the
// route actually contains the library. A component added to lib/ui/react and
// not added here is a component whose CLIENT cost is unmeasured - which is
// precisely the state that let 207 KiB of icons ship, one directory over.
//
// SO THE LIST IS READ FROM DISK, not written out. The same discovery the
// contrast audit uses, and for the same reason: a hardcoded list covers what
// someone remembered on the day, and FW9 added four components in one task.
//
// WHY THIS IS A SOURCE SCAN AND NOT A RENDER. Bundle weight is decided by what
// is IMPORTED and reachable, not by what a render happens to reach - a
// component imported and then rendered inside a false branch still ships. So
// the property is about the import statements, and reading them is the thing
// rather than a proxy for it.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withoutComments } from '@/tests/support/quoted-spans';

const ROOT = process.cwd();
const LIBRARY = join(ROOT, 'lib', 'ui', 'react');
const HARNESS = join(ROOT, 'app', 'dev', 'island', 'IslandHarness.tsx');
const PAGE = join(ROOT, 'app', 'dev', 'island', 'page.dev.tsx');

/** Every directory under lib/ui/react holding a <Name>.tsx component. */
const COMPONENTS = readdirSync(LIBRARY, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(join(LIBRARY, name, `${name}.tsx`)))
  .sort();

/**
 * Components the harness deliberately does not render, with the reason.
 *
 * NO ENTRY HERE IS AN EXEMPTION FROM MEASUREMENT. Each is a statement about
 * where the cost actually lands, and there are two such statements - one
 * component makes the first, three make the second. Both are checked against
 * the source by "excludes nothing that would actually cost a client bundle"
 * below, so neither is a claim a reader has to take on trust:
 *
 * PublicShell is already a client component of its own, so it enters a
 * client bundle on every public page and GATE A counts it there; the
 * calculator's figure includes it. Rendering it inside this island would
 * measure it twice and make GATE I's number harder to read.
 *
 * AlertCapture (FW14) is a SERVER component - a plain form with no
 * 'use client' anywhere - so it contributes nothing to any client bundle at
 * all. Putting it in this harness would not measure its cost; it would
 * CREATE one, by pulling a server component into client code and reporting
 * a number the product does not pay. R136 is the ruling it exists under:
 * prefer zero JS on public routes, and the capture card has none.
 *
 * Faq (FW15) is the same statement as AlertCapture's, and this census is how
 * it got made rather than assumed: the FAQ is built on native <details>
 * precisely so that it needs no JavaScript - the answers have to be in the
 * DOM for a crawler, since increment 3 publishes them as FAQPage structured
 * data and a claim a reader cannot see is cloaking. A component whose whole
 * design is "no client cost" is the last thing to put in a client island.
 *
 * JsonLd (FW15) renders one <script type="application/ld+json"> and nothing
 * else - no client behaviour, and no rendered element at all. It is also the
 * first entry in the contrast audit's STYLE_FREE list, for the same reason
 * seen from the other side: there is nothing on screen to measure a contrast
 * ratio against.
 */
const MEASURED_ELSEWHERE: ReadonlyArray<readonly [string, string]> = [
  [
    'PublicShell',
    "Already a 'use client' component, so it is in every public route's " +
      'bundle and GATE A measures it there. Rendering it here would double-count.',
  ],
  [
    'AlertCapture',
    'A server component: a plain form with no client JavaScript (R136). ' +
      'Rendering it in a client island would not measure its cost, it would ' +
      'create one.',
  ],
  [
    'Faq',
    'A server component built on native <details>: no client JavaScript at ' +
      'all, by design, because the answers must stay in the DOM for a ' +
      'crawler and a scripting-off reader. Rendering it here would create a ' +
      'cost the product does not pay.',
  ],
  [
    'JsonLd',
    'A server component that renders one <script type="application/ld+json"> ' +
      'and nothing else. It has no client behaviour to measure and no ' +
      'rendered element at all.',
  ],
  [
    'TableOfContents',
    'A server component: a list of fragment links and a sticky card. FW16 ' +
      'declined the active-item highlight precisely because knowing the ' +
      'current section needs a scroll listener, which is client JavaScript ' +
      'on a content page (R136).',
  ],
  [
    'GuideCta',
    'A server component: a card, a heading and a link, identical on every ' +
      'guide. It takes no props at all, so there is no interactive surface ' +
      'and nothing for a client bundle to carry.',
  ],
];

/**
 * The one exclusion that is client code, and is excluded for the opposite
 * reason: GATE A already counts it on every public route.
 *
 * Named here so the test below can hold BOTH reasons to account - the others
 * must have no client cost, and this one must genuinely have some.
 */
const COUNTED_BY_GATE_A = 'PublicShell';

/** The harness with its comments stripped - see withoutComments. */
const harnessSource = (): string => withoutComments(readFileSync(HARNESS, 'utf8'));

describe('the island harness imports the whole component library (R122)', () => {
  it('found the library on disk, so nothing below passes vacuously', () => {
    expect(COMPONENTS.length).toBeGreaterThanOrEqual(9);
    expect(COMPONENTS).toContain('ZoneBadge');
    expect(COMPONENTS).toContain('ThresholdRail');
  });

  it('is a client component, which is the entire point of the route', () => {
    // Without the directive this route is a second server-rendered workbench
    // and GATE I measures the same nothing GATE W does.
    expect(harnessSource()).toContain("'use client'");
  });

  it('is reached from a server page, like every public route', () => {
    // The arrangement is the subject: a thin server page over a client island
    // is the shape in which the 207 KiB defect existed.
    const page = withoutComments(readFileSync(PAGE, 'utf8'));

    expect(page).not.toContain("'use client'");
    expect(page).toContain('IslandHarness');
  });

  it.each(
    COMPONENTS.filter(
      (name) => !MEASURED_ELSEWHERE.some(([excluded]) => excluded === name),
    ),
  )('imports %s', (component) => {
    expect(
      harnessSource(),
      `${component} is in lib/ui/react and NOT imported by the island ` +
        'harness, so its client-bundle cost is unmeasured (R122). Add it, or ' +
        'add it to MEASURED_ELSEWHERE with the reason something else covers it.',
    ).toContain(`/${component}/${component}'`);
  });

  it('names every component it leaves out, with a reason', () => {
    for (const [component, reason] of MEASURED_ELSEWHERE) {
      expect(COMPONENTS, `${component} is not in the library at all`).toContain(component);
      expect(reason.length, component).toBeGreaterThan(40);
    }

    // THE FIXED CAP IS GONE, AFTER BEING WRONG THREE TIMES IN TWO TASKS.
    // It was two; FW15 raised it to three for Faq and four for JsonLd; FW16
    // arrived with TableOfContents. Each raise was correct on its own and
    // the sequence is exactly the erosion a ratchet exists to prevent, which
    // is the signal that the NUMBER was measuring the wrong thing: it tracks
    // how fast the library grows, not whether the harness still measures it.
    //
    // WHAT REPLACED IT IS STRICTLY STRONGER, and both halves are below:
    //
    //   the proportional assertion  exclusions must stay under half the
    //                              library, which keeps meaning the same
    //                              thing at any size
    //   the structural assertion   every exclusion's stated reason is
    //                              checked against its source
    //
    // Nothing can slip through the pair. A CLIENT component added to this
    // list to dodge GATE I fails the structural test; a client component
    // left out of the harness fails the per-component test above; a server
    // component added is legitimately free. The count added nothing either
    // of those did not already say.
    //
    // AND THE PROPORTIONAL RULE IS NOT DECORATIVE - IT IS CLOSING IN. FW16
    // takes the list to six of fourteen components, because almost every new
    // component in this product is a server component: the capture card, the
    // FAQ, the JSON-LD script, the outline, the closing card. The day
    // exclusions reach half, GATE I is measuring a minority of the library
    // and the harness needs rethinking rather than another entry - which is
    // exactly what this assertion will say, and why it replaced a number
    // that only tracked how fast the library grew.
    expect(MEASURED_ELSEWHERE.length * 2).toBeLessThan(COMPONENTS.length);
  });

  it('excludes nothing that would actually cost a client bundle', () => {
    // THE ASSERTION THE COUNT WAS STANDING IN FOR, and the one that makes the
    // list safe to grow. Every exclusion claims one of two things, and both
    // are now checked against the source rather than taken on trust:
    //
    //   the server components  must contain no 'use client', so GATE I is
    //                          not being asked to measure a cost that does
    //                          not exist
    //   PublicShell            must contain one, because its reason is the
    //                          opposite - it IS in a client bundle and GATE
    //                          A counts it there. If it ever stopped being
    //                          client code, its exclusion would be wrong in
    //                          the other direction and nothing would say so.
    //
    // A client component slipped into this list to dodge the harness fails
    // here, whatever the cap says.
    for (const [component] of MEASURED_ELSEWHERE) {
      const source = readFileSync(
        join(LIBRARY, component, `${component}.tsx`),
        'utf8',
      );
      const isClient = /^\s*['"]use client['"]/m.test(source);

      if (component === COUNTED_BY_GATE_A) {
        expect(isClient, `${component} is excluded as client code but is not`).toBe(true);
        continue;
      }

      expect(
        isClient,
        `${component} is excluded as having no client cost, but it declares 'use client'`,
      ).toBe(false);
    }
  });

  it('renders every Status, so a dynamic union index cannot be shaken out', () => {
    // THE SHAPE OF THE ORIGINAL DEFECT. ZoneBadge indexed a namespace import
    // with a string built at runtime, which is what defeated tree-shaking; a
    // harness that rendered one status might let a bundler prove the other
    // three unreachable and shake exactly the code under test away.
    const source = harnessSource();

    for (const status of [
      'compliant',
      'mission-exposure',
      'regime-lost',
      'social-switch',
    ]) {
      expect(source, status).toContain(status);
    }
  });

  it('does not duplicate the workbench contract', () => {
    // /dev/composants owns the data-testid specimens, the baselines and the
    // axe sweep. Two files to update for one component change is how the
    // mobile nav drifted from the desktop one.
    expect(harnessSource()).not.toContain('data-testid');
  });
});
