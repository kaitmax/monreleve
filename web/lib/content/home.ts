// web/lib/content/home.ts
//
// The non-copy facts the home page is built from: the hero's worked example and
// the three guides its Guides section links to. Words live in lib/fr/home.ts;
// this file holds the fixture and the identifiers, the same split as
// lib/content/sources.ts against lib/fr/sources.ts.
//
// THE HERO EXAMPLE IS A FIXTURE, NOT A PICTURE (R147, R163). The phone card in
// design/home is a mock whose figures - 15,83 %, 58, 81,5 - are sample data;
// the real card is RENDERED by the engine from THIS input, so they can never
// drift from it. The caption that narrates the example ("38 jours ... sur une
// base de 240 jours") interpolates teleworkDays and the basis from here and
// from the RuleSet rather than typing either, so the prose and the fixture
// move together (R163, R181).
//
// taxYear IS A PARAMETER, not a constant here, for R55's reason: the year comes
// from the server's Europe/Paris clock at render, never from a literal that is
// correct only until the next 1 January. ruleSetFor falls back to the latest
// known set for an unknown year, so the figures stay the 2026 ones until a
// 2027 RuleSet exists.

import type { TeleworkInput } from '@/lib/calc-engine';

/**
 * The hero's worked example: 38 telework days on the simplified 240-day basis,
 * full time, a whole year, no missions. Canton GE because the example must name
 * one and Geneva is the published reference canton; the regime is source either
 * way below the ceiling, so the choice changes none of the three figures.
 *
 * A FUNCTION OF THE YEAR, so the RuleSet it is computed against is the same one
 * every other surface resolves (R55). The example days live here as the single
 * source the caption narrates (R163).
 */
export const HERO_EXAMPLE_TELEWORK_DAYS = 38;

export function heroExampleInput(taxYear: number): TeleworkInput {
  return {
    taxYear,
    canton: 'GE',
    employmentRate: 100,
    periodFraction: 1,
    denominator: { kind: 'simplified240' },
    granularity: 'day',
    teleworkDays: HERO_EXAMPLE_TELEWORK_DAYS,
    missionDaysFrance: 0,
    missionDaysThirdState: 0,
  };
}

/**
 * The three guides the home page's Guides section links to, by slug.
 *
 * SLUGS, NOT LABELS, and the labels are DERIVED from each guide's own
 * breadcrumbLabel at render (R181) - the same mechanism guideNavLinks() uses
 * for the footer. The design mock labels them "Le plafond fiscal de 40 %", "Le
 * seuil de securite sociale de 49,9 %" and "Les missions temporaires et le
 * quota de 10 jours"; transcribing those would type three regulatory figures
 * (R147), so the home shows each guide's figure-free breadcrumbLabel instead -
 * "Le plafond fiscal", "Le seuil social", "Les jours de mission".
 *
 * These three are the two thresholds plus missions - the rules the page's own
 * "two rules" section explains. The slugs are SPEC 14 permanent identifiers,
 * not copy, so naming them here is not a typed figure even where one carries a
 * digit (teletravail-frontalier-40-pourcent).
 */
export const HOME_GUIDE_SLUGS: readonly string[] = [
  'teletravail-frontalier-40-pourcent',
  'seuil-social-49-9-pourcent',
  'jours-de-mission-hors-suisse',
];
