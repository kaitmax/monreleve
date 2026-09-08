// @vitest-environment jsdom
//
// web/lib/ui/react/accessibility.test.tsx
//
// FW8 AC1: zero axe violations across every state of every component. One
// file rather than one per component, because what is being asserted is a
// property of the SET - every state, none excepted - and a per-component
// file makes "every state" a thing each author remembers separately. The
// table below is the list, and adding a component without adding its states
// leaves an obvious hole in one place.
//
// jsdom, declared per file rather than globally: the rest of the suite runs
// in node, where it is faster and where a test cannot accidentally depend on
// a DOM that production does not have. Only this file needs one.
//
// WHAT AXE CAN AND CANNOT SEE HERE, stated so the green is not read as more
// than it is. jsdom has no layout, so the colour-contrast rules return
// INCOMPLETE rather than passing - they are answered instead by
// tests/unit/tokens/contrast.test.ts, which computes ratios from the compiled
// tokens and derives each gate from the font-size declared beside the colour.
// What axe does answer here is structure: roles, names, duplicate ids, list
// and figure nesting, aria that points nowhere, and images without alt.
//
// The two halves are complementary and neither is sufficient. Contrast without
// structure passes a beautifully coloured div soup; structure without contrast
// passes a correctly marked-up page nobody can read.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { ruleSetFor } from '@/lib/calc-engine';
import { formatSignedDays } from '@/lib/ui/core';
import type { Status, Zone } from '@/lib/ui/core';
import { LegalNote } from './LegalNote/LegalNote';
import { MetricTile } from './MetricTile/MetricTile';
import { RateDisplay } from './RateDisplay/RateDisplay';
import { ThresholdRail } from './ThresholdRail/ThresholdRail';
import { ZoneBadge } from './ZoneBadge/ZoneBadge';

expect.extend(matchers);

const RULES = ruleSetFor(2026);
const THRESHOLDS = {
  fiscalCeiling: RULES.fiscalCeiling,
  socialCeiling: RULES.socialCeiling,
};

const ZONES: readonly Zone[] = ['compliant', 'fiscal-exposure', 'social-switch'];
const STATUSES: readonly Status[] = [
  'compliant',
  'mission-exposure',
  'regime-lost',
  'social-switch',
];
const RATE: Record<Zone, number> = {
  compliant: 34.58,
  'fiscal-exposure': 45.2,
  'social-switch': 60,
};

const RAIL_WIDTH = 376;

interface State {
  readonly name: string;
  readonly node: React.ReactElement;
}

const STATES: readonly State[] = [
  ...(['inline', 'compact'] as const).flatMap((variant) =>
    ZONES.map((zone) => ({
      name: `ThresholdRail ${variant} ${zone}`,
      node: (
        <ThresholdRail
          percentage={RATE[zone]}
          zone={zone}
          thresholds={THRESHOLDS}
          variant={variant}
          width={RAIL_WIDTH}
        />
      ),
    })),
  ),
  {
    // R33. The state with the most to get wrong: it carries an aria-live
    // region that the ordinary states must not have, and the rail it replaces
    // would otherwise sit at zero and read as an untouched allowance.
    name: 'ThresholdRail unavailable',
    node: (
      <ThresholdRail
        percentage={Number.NaN}
        zone="compliant"
        thresholds={THRESHOLDS}
        variant="inline"
        width={RAIL_WIDTH}
      />
    ),
  },
  ...STATUSES.map((status) => ({
    name: `ZoneBadge ${status}`,
    node: <ZoneBadge status={status} />,
  })),
  ...ZONES.map((zone) => ({
    name: `RateDisplay ${zone}`,
    node: <RateDisplay declarableRate={RATE[zone]} zone={zone} />,
  })),
  {
    name: 'RateDisplay two rates, Geneva case (c)',
    node: <RateDisplay declarableRate={39.16} zone="compliant" rawRate={45} />,
  },
  {
    name: 'MetricTile positive',
    node: <MetricTile label="Jours restants" days={formatSignedDays(12.5)} />,
  },
  {
    name: 'MetricTile negative',
    node: <MetricTile label="Jours restants" days={formatSignedDays(-6)} />,
  },
  { name: 'LegalNote', node: <LegalNote /> },
];

describe('every state of every component is free of axe violations (AC1)', () => {
  it('covers all five components, so a green run means what it says', () => {
    // Without this the loop below could pass by shrinking. Eighteen states:
    // seven rail, four badge, four rate, two metric, one legal.
    expect(STATES).toHaveLength(18);

    for (const component of ['ThresholdRail', 'ZoneBadge', 'RateDisplay', 'MetricTile', 'LegalNote']) {
      expect(STATES.some((state) => state.name.startsWith(component))).toBe(true);
    }
  });

  for (const state of STATES) {
    it(state.name, async () => {
      const { container } = render(state.node);

      expect(await axe(container)).toHaveNoViolations();
    });
  }
});
