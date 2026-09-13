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
 * NEITHER ENTRY IS AN EXEMPTION FROM MEASUREMENT. Each is a statement about
 * where the cost actually lands, and they are two different statements:
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
];

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

    // THE CAP IS A RATCHET, AND RAISING IT IS THE DELIBERATE EDIT IT IS
    // MEANT TO BE. Two became three in FW15 for Faq, and the number is worth
    // watching rather than following: every exclusion is a component GATE I
    // stops measuring, and a list that grows one reasonable entry at a time
    // ends as a harness that measures nothing.
    //
    // What keeps this honest is that all three entries say the same kind of
    // thing - the cost lands somewhere else, or including it would invent a
    // cost - rather than "this one is awkward to render". The day an entry
    // cannot be written in those terms is the day the harness is wrong, not
    // the cap.
    expect(
      MEASURED_ELSEWHERE.length,
      'the exclusion list has grown - is the harness still measuring the library?',
    ).toBeLessThanOrEqual(3);

    // AND THE MAJORITY MUST STILL BE MEASURED, which is the assertion the cap
    // was standing in for: a fixed ceiling says nothing as the library grows,
    // while this keeps meaning the same thing at any size.
    expect(MEASURED_ELSEWHERE.length * 2).toBeLessThan(COMPONENTS.length);
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
