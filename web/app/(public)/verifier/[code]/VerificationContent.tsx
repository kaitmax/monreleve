// web/app/(public)/verifier/[code]/VerificationContent.tsx
//
// What the verification page draws. FW-VERIFY (R330).
//
// ============================================================================
// A PURE COMPONENT, SO THE CLAIMS ARE TESTABLE WITHOUT A SERVER OR A DATABASE
// ============================================================================
//
// page.tsx does the request-time work - the rate limit and the lookup - and
// hands the RESULT here. This component only draws, so tests/unit/pages can
// render it with a fixed view and assert the three things R330 asks for: the
// printed fields present, the email absent, a former name absent. The email
// never reaches this component because lookupVerification never selects it; this
// renders a VerificationView and nothing else.
//
// THE LABELS ARE THE DOCUMENT'S OWN (R206). name, the declarable-rate label, the
// telework and mission labels and the period sentence come from DOSSIER_COPY, so
// the page and the releve cannot name the same figure two different ways. Only
// the version label and the confirming sentences are this page's own.
//
// NO CLIENT JS. It is a server component; nothing here is interactive, and the
// page deliberately ships none.

import { DOSSIER_COPY } from '@/lib/fr/dossier';
import { VERIFICATION_COPY } from '@/lib/fr/verification';
import { formatDate, formatDays, formatPercent } from '@/lib/ui/core';
import type { VerificationView } from '@/lib/verification/lookup';
import styles from './verification.module.scss';

/** What page.tsx resolved the request to. */
export type VerificationState =
  | { readonly kind: 'found'; readonly view: VerificationView }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'rate-limited' };

/** The date part of an ISO instant, Swiss dots - never the time (R330 subset). */
function dateOf(iso: string): string {
  return formatDate(iso.slice(0, 10));
}

/**
 * The period sentence, built the way the document builds it (R181). Same copy,
 * same branches - so "la periode, exactly as issued" is the identical string.
 */
function periodLabel(view: VerificationView): string {
  if (view.periodFraction >= 1) return DOSSIER_COPY.header.fullYear(view.taxYear);
  if (view.periodStartDate === null) return DOSSIER_COPY.header.partialPeriod(view.taxYear);

  return DOSSIER_COPY.header.fromDate(formatDate(view.periodStartDate), view.taxYear);
}

function Found({ view }: { readonly view: VerificationView }): React.ReactElement {
  return (
    <>
      {/* The vouch: this releve CORRESPONDS to the one issued on a date. Never
          that its figures are right (R330). */}
      <p className={styles.vouch}>{VERIFICATION_COPY.vouch(dateOf(view.generatedAt))}</p>

      {/* R330: a newer version was issued and WHEN - never its figures. */}
      {view.supersededAt === null ? null : (
        <p className={styles.superseded}>{VERIFICATION_COPY.superseded(dateOf(view.supersededAt))}</p>
      )}

      <dl className={styles.fields}>
        <dt>{DOSSIER_COPY.header.name}</dt>
        <dd>{view.name}</dd>

        <dt>{DOSSIER_COPY.zone.declarableLabel}</dt>
        {/* 2 dp: SPEC 7.3's filed figure, exactly as the document prints it. */}
        <dd>{formatPercent(view.declarableRate, 2)}</dd>

        <dt>{DOSSIER_COPY.tiles.teleworkDays}</dt>
        <dd>{formatDays(view.teleworkDays)}</dd>

        <dt>{DOSSIER_COPY.annex.kindMissionFrance}</dt>
        <dd>{formatDays(view.missionDaysFrance)}</dd>

        <dt>{DOSSIER_COPY.annex.kindMissionThird}</dt>
        <dd>{formatDays(view.missionDaysThirdState)}</dd>

        <dt>{DOSSIER_COPY.header.period}</dt>
        <dd>{periodLabel(view)}</dd>

        <dt>{DOSSIER_COPY.header.generatedAt}</dt>
        <dd>{dateOf(view.generatedAt)}</dd>

        <dt>{VERIFICATION_COPY.version}</dt>
        <dd>{view.version}</dd>
      </dl>
    </>
  );
}

export function VerificationContent({ state }: { readonly state: VerificationState }): React.ReactElement {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{VERIFICATION_COPY.title}</h1>
      <p className={styles.intro}>{VERIFICATION_COPY.intro}</p>

      {state.kind === 'found' ? (
        <Found view={state.view} />
      ) : (
        // R330: unknown and withdrawn are the SAME neutral answer; the rate
        // limit is its own, and reveals nothing about whether a code exists.
        <p className={styles.neutral}>
          {state.kind === 'rate-limited' ? VERIFICATION_COPY.rateLimited : VERIFICATION_COPY.unknown}
        </p>
      )}
    </main>
  );
}
