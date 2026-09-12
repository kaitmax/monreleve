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
 * ONE ENTRY, and it is not an exemption from measurement - it is a statement
 * that something else measures it. PublicShell is already a client component
 * of its own, so it enters a client bundle on every public page and GATE A
 * counts it there; the calculator's 119,8 KiB includes it. Rendering it inside
 * this island would measure it twice and make GATE I's number harder to read.
 */
const MEASURED_ELSEWHERE: ReadonlyArray<readonly [string, string]> = [
  [
    'PublicShell',
    "Already a 'use client' component, so it is in every public route's " +
      'bundle and GATE A measures it there. Rendering it here would double-count.',
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

    expect(
      MEASURED_ELSEWHERE.length,
      'the exclusion list has grown - is the harness still measuring the library?',
    ).toBeLessThanOrEqual(2);
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
