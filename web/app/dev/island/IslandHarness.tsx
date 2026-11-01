// web/app/dev/island/IslandHarness.tsx
//
// RULING R122: the client-cost harness. Every component, inside 'use client'.
//
// WHAT IT IS FOR, and it is a measurement rather than a picture. FW12 found
// `import * as icons` in ZoneBadge shipping the entire Lucide library - 207
// KiB - into the calculator's client bundle. R117 then gave the workbench a
// ceiling of its own, and the measurement showed that ceiling would NOT have
// caught it: /dev/composants is a SERVER component, so it renders ZoneBadge on
// the server and the icon library never enters a client bundle at all. The
// defect was only visible because the calculator happens to put a badge inside
// CalculatorForm, which is 'use client'.
//
// The operator's statement of the hole: "nothing measures that until some task
// puts it in one" is an unacceptable place to leave a 207 KiB class.
//
// SO THIS ROUTE EXISTS TO PUT EVERY COMPONENT IN ONE. It renders the whole
// library beneath a 'use client' boundary, so whatever each component drags
// into a client bundle is dragged into THIS route's bundle, where GATE I
// measures it. Two dev routes, two purposes: /dev/composants is the visual
// workbench, /dev/island is the client-cost harness.
//
// IT IS DELIBERATELY NOT A VISUAL RECORD. No data-testid, no baseline, no axe
// sweep - /dev/composants owns all three and duplicating them would mean two
// files to update for one component change, which is how the mobile nav came
// to drift from the desktop one. What this file owes is IMPORTS, and a test
// asserts it imports every component in the library.
//
// THE STATE IT RENDERS BARELY MATTERS, which is the one way this file is
// unlike every other in the project: bundle weight is decided by what is
// imported and reachable, not by which props are passed. One instance of each
// component is enough, and where a component takes a union - ZoneBadge's
// Status - every member is rendered anyway, because a component that switched
// on the union with a dynamic index is exactly the shape that defeated
// tree-shaking the first time.

'use client';

import { useState } from 'react';
import { type Status, formatSignedDays } from '@/lib/ui/core';
import { errorMessage } from '@/lib/fr/errors';
import { ISLAND_HARNESS } from '@/lib/fr/workbench';
import { Container } from '@/lib/ui/react/Container/Container';
import { DataGrid } from '@/lib/ui/react/DataGrid/DataGrid';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { LegalNote } from '@/lib/ui/react/LegalNote/LegalNote';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { MetricTile } from '@/lib/ui/react/MetricTile/MetricTile';
import { RateDisplay } from '@/lib/ui/react/RateDisplay/RateDisplay';
import { ReleveExcerpt } from '@/lib/ui/react/ReleveExcerpt/ReleveExcerpt';
import { HomeCounter } from '@/lib/ui/react/HomeCounter/HomeCounter';
import { HeroPhone } from '@/lib/ui/react/HeroPhone/HeroPhone';
import { calculateTelework } from '@/lib/calc-engine';
import { heroExampleInput } from '@/lib/content/home';
import { HOME_COPY } from '@/lib/fr/home';
import { ThresholdRail } from '@/lib/ui/react/ThresholdRail/ThresholdRail';
import { ZoneBadge } from '@/lib/ui/react/ZoneBadge/ZoneBadge';
// FW-CALCS-A2 (R733): the calculators' shared pieces, measured like the rest.
import { Chip } from '@/lib/ui/react/Chip/Chip';
import { Notice } from '@/lib/ui/react/Notice/Notice';
import { ResultCard } from '@/lib/ui/react/ResultCard/ResultCard';
import { SegmentedChoice } from '@/lib/ui/react/SegmentedChoice/SegmentedChoice';
import { Stepper } from '@/lib/ui/react/Stepper/Stepper';

/**
 * PublicShell IS NOT RENDERED HERE, and it is the one exception.
 *
 * It is already a client component of its own, so it enters a client bundle
 * on every public page and is measured by GATE A there - the calculator's 118,8
 * KiB includes it. Rendering it inside this island would measure it twice and
 * make GATE I's number harder to read, and the completeness test below names
 * the exception rather than leaving the absence to be noticed.
 */

const THRESHOLDS = { fiscalCeiling: 0.4, socialCeiling: 0.499 };
const RAIL_WIDTH = 376;

/** Every Status, so a dynamic switch on the union cannot be shaken out. */
const STATUSES: readonly Status[] = [
  'compliant',
  'mission-exposure',
  'regime-lost',
  'social-switch',
];

/** The worked example the home page's phones show, for HeroPhone below. */
const EXAMPLE = calculateTelework(heroExampleInput(2026));

export function IslandHarness() {
  // STATE, SO THE BOUNDARY IS REAL. A 'use client' component that never uses a
  // hook can still be server-rendered by React with no interactive bundle in
  // some configurations; a useState makes this unambiguously an island, which
  // is the whole point of the route.
  const [shown, setShown] = useState(0);

  return (
    <Container width="public">
      <h1>{ISLAND_HARNESS.title}</h1>
      <p>{ISLAND_HARNESS.purpose}</p>

      <button onClick={() => setShown((n) => n + 1)} type="button">
        {ISLAND_HARNESS.rerender}
      </button>
      <p>{ISLAND_HARNESS.renders(shown)}</p>

      {/* Every status: four icons, four fills, four labels. */}
      {STATUSES.map((status) => (
        <ZoneBadge key={status} status={status} />
      ))}

      <RateDisplay declarableRate={39.16} rawRate={45} zone="fiscal-exposure" />

      <ThresholdRail
        percentage={39.16}
        thresholds={THRESHOLDS}
        variant="inline"
        width={RAIL_WIDTH}
        zone="fiscal-exposure"
      />

      <MetricTile
        days={formatSignedDays(-6)}
        label={ISLAND_HARNESS.tileLabel}
        overLabel={ISLAND_HARNESS.tileOverLabel}
      />

      <DataGrid
        caption={ISLAND_HARNESS.gridCaption}
        columns={[{ key: 'a', header: ISLAND_HARNESS.gridColumn }]}
        rows={[{ key: 'one', cells: { a: ISLAND_HARNESS.gridCell } }]}
      />

      <FieldGroup
        error={errorMessage({ code: 'RATE_OUT_OF_RANGE' })}
        helper={ISLAND_HARNESS.fieldHelper}
        id="harness-field"
        label={ISLAND_HARNESS.fieldLabel}
      >
        {(control) => <input {...control} inputMode="decimal" type="text" />}
      </FieldGroup>
      <Stepper
        decreaseLabel={ISLAND_HARNESS.tileLabel}
        increaseLabel={ISLAND_HARNESS.tileOverLabel}
        onDecrease={() => setShown((n) => n - 1)}
        onIncrease={() => setShown((n) => n + 1)}
      >
        <input aria-label={ISLAND_HARNESS.fieldLabel} readOnly type="text" value={String(shown)} />
      </Stepper>
      <SegmentedChoice
        legend={ISLAND_HARNESS.fieldLabel}
        name="harness-choice"
        onChange={() => setShown((n) => n + 1)}
        options={[
          { value: 'a', label: ISLAND_HARNESS.gridColumn },
          { value: 'b', label: ISLAND_HARNESS.gridCell },
        ]}
        value={shown % 2 === 0 ? 'a' : 'b'}
      />
      <Chip
        checked={shown % 2 === 0}
        label={ISLAND_HARNESS.gridCell}
        name="harness-chip"
        onChange={() => setShown((n) => n + 1)}
        value="a"
      />
      <Notice heading={ISLAND_HARNESS.title}>
        <p>{ISLAND_HARNESS.purpose}</p>
      </Notice>
      <ResultCard>
        <p>{ISLAND_HARNESS.purpose}</p>
      </ResultCard>

      <LegalNote />

      {/* FW-HOME-A2: a server component, imported here rather than excused -
          the exclusion list has reached half the library, which is the point
          island-harness.test.ts says to stop adding to it. */}
      <ReleveExcerpt state={PRODUCT_STATE} />

      {/* The home page's counter island, with the engine it carries. */}
      <HomeCounter
        taxYear={2026}
        copy={{
          rateLabel: HOME_COPY.counter.rateLabel,
          status: HOME_COPY.counter.status,
          fiscalTile: ISLAND_HARNESS.tileLabel,
          fiscalOver: ISLAND_HARNESS.tileOverLabel,
          socialTile: ISLAND_HARNESS.tileLabel,
          socialOver: ISLAND_HARNESS.tileOverLabel,
          teleworkLabel: HOME_COPY.counter.teleworkLabel,
          basisLabel: HOME_COPY.counter.basisLabel,
        }}
        form={{ action: '/', teleworkName: 'tt', basisName: 'total', hidden: [] }}
      />

      {/* The home page's phone pictures, both platforms. */}
      {EXAMPLE.ok ? (
        <>
          <HeroPhone platform="android" result={EXAMPLE.value} taxYear={2026} fiscal={ISLAND_HARNESS.tileLabel} />
          <HeroPhone platform="iphone" result={EXAMPLE.value} taxYear={2026} fiscal={ISLAND_HARNESS.tileLabel} />
        </>
      ) : null}
    </Container>
  );
}
