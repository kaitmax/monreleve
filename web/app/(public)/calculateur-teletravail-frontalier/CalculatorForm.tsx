// web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx
//
// The client island. One useState, no form library, no schema library: the
// engine's validation IS the validation (standing protocol 5), and its Result
// feeds FieldGroup.
//
// WHY THE STATE IS NOT A TeleworkInput, although the prompt describes it as
// one. Several of its fields cannot hold what a half-typed form contains:
//
//   canton         has no sane default and no empty member. TeleworkInput
//                  requires a Canton, so there is no value to put there
//                  before the user chooses - and inventing one would compute
//                  a regime for a canton nobody selected.
//   the numbers    are TEXT while being typed. An empty field is not 0: if
//                  clearing the day count silently became zero, the form
//                  would answer a question the user was in the middle of
//                  un-asking. Number('') IS 0, which is exactly that bug.
//   periodFraction is not a thing a person knows about themselves. The user
//                  gives a DATE; remainingYearFraction converts it.
//
// So the state holds what the CONTROLS hold, and buildInput turns it into a
// TeleworkInput when it can.
//
// VALIDATION GOES THROUGH calculateTelework. validateInput is internal to the
// engine and exporting it would be a change to the engine's public API, which
// SPEC 20 makes an ask-first item; the report asks. The consequence is that
// nothing is validated until a canton exists, because that is what it takes to
// build an input at all.
//
// EVERY ERROR HAS SOMEWHERE TO GO, including one whose field is hidden. See
// errorFor and `unplaced` at the bottom: a start date in the wrong year is
// reported by the engine, and if the user then collapses the accordion the
// message would simply vanish. That is not a hypothetical - it is the first
// thing that happens if the routing only looks at the code.

'use client';

import { type FormEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  type Canton,
  type DenominatorMethod,
  type Granularity,
  type TeleworkInput,
  type TeleworkResult,
  type ValidationError,
  calculateTelework,
  ruleSetFor,
} from '@/lib/calc-engine';
import { provisionalFor, readingAnchor } from '@/lib/content/provisional';
import { decode, encode, isoDayForFraction } from '@/lib/params/codec';
import type { Rhythm, Weekday } from '@/lib/forecast/imagined';
import { RHYTHM_DAY_CODES } from '@/lib/params/rhythm';
import {
  GRANULARITY_CODES,
  granularityCode,
  type GranularityCode,
  methodCode,
  type ParamName,
  strayParams,
} from '@/lib/params/schema';
// FROM THE LEAF, NOT THE REGISTRY (R976, FW-CALC-BYTES): importing a path from
// lib/content/routes.ts shipped every registered route in this island's bundle.
import { RESULT_PATH } from '@/lib/content/route-paths';
import { writeHandoff } from '@/lib/params/handoff';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { PARAM_NOTICE, SHARE_COPY } from '@/lib/fr/params';
import { PROVISIONAL_COPY } from '@/lib/fr/provisional';
import { CANTONS_BY_NAME } from '@/lib/fr/cantons';
import { errorMessage } from '@/lib/fr/errors';
import { Chip } from '@/lib/ui/react/Chip/Chip';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { SegmentedChoice } from '@/lib/ui/react/SegmentedChoice/SegmentedChoice';
import { Stepper } from '@/lib/ui/react/Stepper/Stepper';
import { formatDays, formatPercent, remainingYearFraction, statusFor } from '@/lib/ui/core';
import {
  accordionOpened,
  calculated,
  missionsDeclared,
  resultStatus,
  shareClicked,
} from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';

/**
 * The advanced panel id, in one place.
 *
 * It was a literal in two - aria-controls and the panel - and FW15 added a
 * third reader when accordion_opened started naming the section. A payload
 * that drifts from the id it names is a category nobody can join back to
 * the page.
 */
const ADVANCED_SECTION_ID = 'options-avancees';
import { type LiveResultLinks, ResultPanel } from './ResultPanel';
import styles from './CalculatorForm.module.scss';

const COPY = CALCULATEUR_COPY.form;
const RESULT = CALCULATEUR_COPY.result;

/** The live region's id. The Calculer button moves focus here. */
const RESULT_ID = 'resultat';
const RESULT_TITLE_ID = 'resultat-titre';

/**
 * The URL debounce. FW13 increment 4.
 *
 * The prompt names 400 ms and asks why: the ENGINE is free and runs on
 * every input event, while replaceState is main-thread work against a
 * string nobody reads between keystrokes.
 */
const URL_DEBOUNCE_MS = 400;

const ICON = 20;
const STROKE = 1.75;

/**
 * The control bounds, matching SPEC 9.3's table.
 *
 * The rate's minimum is 1 rather than 0 because that is the range the engine
 * accepts (RATE_OUT_OF_RANGE below 1): a contract at nothing per cent is not
 * a contract. The day fields have no maximum here on purpose - the real
 * ceiling is the annual basis, which depends on the rate, the method and the
 * period, and the engine reports DAYS_EXCEED_TOTAL when it is passed. A
 * hand-typed max would be one more place the basis lives.
 */
const RATE = { step: 5, min: 1, max: 100 } as const;
const DAYS = { step: 0.5, min: 0 } as const;

/**
 * THE PUBLIC FORM COUNTS IN HALF-DAYS, and this is the increment's one real
 * interpretation.
 *
 * SPEC 9.3 puts step 0.5 on the visible day field. The engine rejects a
 * half-day value declared under granularity 'day' with GRANULARITY_MISMATCH.
 * Both cannot hold, so the default granularity for the public form is
 * 'halfDay' - the prompt reaches the same conclusion and asks for it to be
 * stated. 'day' remains available in the accordion, where choosing it makes
 * 0,5 an error, correctly.
 */
const DEFAULT_GRANULARITY: Granularity = 'halfDay';

/**
 * A decimal comma. RULING R109, which settled FW11's Q11.
 *
 * A French user writes "83,5". type="number" treats a comma as invalid, so
 * the value arrived here as the EMPTY STRING and the digits appeared to
 * vanish as they were typed - the calculator looking broken to exactly the
 * audience it is for. Reproduced in jsdom before the fix: the field read the
 * empty string after typing "83,5".
 *
 * R109: type="text" with inputMode="decimal", both separators accepted,
 * normalised to the period INTERNALLY ONLY. SPEC 9.3 corrected under R9.
 *
 * "Internally only" is the part a naive fix gets wrong. Rewriting the comma
 * to a period in state would move the caret and fight the user mid-number, so
 * the field shows what was typed and the period exists only in the value
 * handed to the engine.
 */
function parseNumeric(raw: string): number {
  const trimmed = raw.trim();

  if (trimmed === '') return Number.NaN;

  return Number(trimmed.replace(',', '.'));
}

/**
 * The start date as a fraction of the year, or the whole year.
 *
 * remainingYearFraction THROWS on anything that is not a real ISO day (R28),
 * and a date input hands over partial values while being edited - both jsdom
 * and every browser sanitise an incomplete date to the empty string, but an
 * exception reaching render would take the island down rather than show a
 * message. An unparseable value therefore means "no date given", which is
 * what an empty field means anyway.
 *
 * A date in a LATER year comes back as 0 from the conversion, which is
 * outside SPEC 7.4's range, so the engine reports PERIOD_OUT_OF_RANGE. The
 * form deliberately holds no second opinion about what a valid period is.
 */
function fractionFor(startDay: string, taxYear: number): number {
  if (startDay === '') return 1;

  try {
    return remainingYearFraction(startDay, taxYear);
  } catch {
    return 1;
  }
}

/** Every field that can carry an error message. */
type FieldKey =
  | 'canton'
  | 'employmentRate'
  | 'teleworkDays'
  | 'missionDaysFrance'
  | 'missionDaysThirdState'
  | 'exactTotal'
  | 'startDay';

interface FormState {
  readonly canton: Canton | '';
  readonly employmentRate: string;
  readonly teleworkDays: string;
  readonly hasMissions: boolean;
  readonly missionDaysFrance: string;
  readonly missionDaysThirdState: string;
  readonly method: DenominatorMethod['kind'];
  readonly exactTotal: string;
  readonly granularity: Granularity;
  readonly startDay: string;
  /**
   * The weekly rhythm (R343), which the island CARRIES but does not draw.
   *
   * It is here so the checkboxes are controlled, so a shared link
   * re-checks them on mount, and so the share row writes them into the
   * URL. The PROJECTION itself is rendered by /resultat on the server -
   * this route has the least headroom in the product and the projection
   * is a block of figures, a rail and four paragraphs.
   */
  readonly rhythm: Rhythm;
}

/**
 * The weekdays in the order the rhythm writes them.
 *
 * READ OFF RHYTHM_DAY_CODES rather than typed again, so the form and the
 * URL cannot disagree about the order - which is part of the contract, since
 * two links to the same rhythm have to be the same string (R181).
 */
const WEEKDAYS_IN_ORDER = Object.keys(RHYTHM_DAY_CODES) as readonly Weekday[];

/** The rhythm helper, named so the group can point at it. */
const RHYTHM_HELPER_ID = 'rythme-helper';

const NO_DAYS = String(DAYS.min);

/** One shared empty array, so "no errors" is referentially stable. */
const NO_ERRORS: readonly ValidationError[] = [];

const INITIAL: FormState = {
  canton: '',
  employmentRate: String(RATE.max),
  teleworkDays: NO_DAYS,
  hasMissions: false,
  missionDaysFrance: NO_DAYS,
  missionDaysThirdState: NO_DAYS,
  method: 'simplified240',
  exactTotal: '',
  granularity: DEFAULT_GRANULARITY,
  startDay: '',
  // NOTHING CHECKED, as the prompt requires: the question is optional and a
  // reader who skips it must get exactly what they got before it existed.
  rhythm: {},
};

/**
 * A decoded scenario as form state. FW13 increment 2.
 *
 * THE STATE IS STRINGS AND THE SCENARIO IS NUMBERS, so this is a conversion
 * rather than a cast - see the header on FormState for why the controls hold
 * text. Every field is a direct rendering except the start date, which the
 * engine holds as a periodFraction: isoDayForFraction recovers the day that
 * produced it, and returns null for a fraction no date can produce, in which
 * case the field stays empty and the fraction still applies. The same
 * function encode uses, so a seeded form re-encodes to the URL it came from.
 *
 * hasMissions IS DERIVED rather than carried: SPEC 9.4 has no param for it,
 * because the answer is visible in the numbers. A link with mission days
 * reveals the fields; one without leaves them collapsed.
 */
function stateFrom(input: TeleworkInput): FormState {
  const startDay = isoDayForFraction(input.periodFraction, input.taxYear);

  return {
    // NOT CARRIED BY TeleworkInput, so it cannot come from here. The mount
    // effect sets it from decoded.rhythm in a second pass, immediately after.
    rhythm: {},
    canton: input.canton,
    employmentRate: String(input.employmentRate),
    teleworkDays: String(input.teleworkDays),
    hasMissions: input.missionDaysFrance > 0 || input.missionDaysThirdState > 0,
    missionDaysFrance: String(input.missionDaysFrance),
    missionDaysThirdState: String(input.missionDaysThirdState),
    method: input.denominator.kind,
    exactTotal:
      input.denominator.kind === 'exact' ? String(input.denominator.totalWorkDays) : '',
    granularity: input.granularity,
    startDay: startDay ?? '',
  };
}

/**
 * WHAT THE READER CHANGED BEFORE THE ISLAND HYDRATED, as an update to apply.
 * FW-PREHYDRATION-SITES, R1057.
 *
 * The canton, the rate, the telework days, the missions answer and the rhythm
 * chips are in the server's HTML, so a reader on a slow phone can use them
 * before the scripts arrive. Hydration never writes a field's value, and the
 * state starts from INITIAL, so without this the screen showed what was typed
 * while the result was computed from the defaults, and the next keystroke put
 * the defaults back.
 *
 * ONLY WHAT WAS CHANGED, judged per control against `rendered` - the state the
 * first render put into the controls. The page is static, so the server renders
 * the DEFAULTS even for a shared link, whose values arrive on mount: a control
 * still holding what was rendered was not touched and takes the link's value,
 * and a control the reader changed keeps the change (Web Ruling 36). With no
 * link the two readings are the same thing.
 *
 * AGAINST THE RENDERED STATE, NOT THE DOM's default attributes: those exist only
 * on the server's HTML. On a client render (an in-site navigation) React sets a
 * select's `selected` property and never `defaultSelected`, so judging by the
 * attributes read every control as changed and put the defaults back over the
 * link (tests/unit/pages/calculateur-link-mount.test.tsx).
 *
 * The mission-day fields and the advanced section are not rendered until the
 * state asks for them, so they cannot have been typed into before hydration.
 */
function typedBefore(form: HTMLFormElement, rendered: FormState): (state: FormState) => FormState {
  const changes: ((state: FormState) => FormState)[] = [];

  for (const control of Array.from(form.elements)) {
    if (control instanceof HTMLSelectElement) {
      const canton = control.value as Canton | '';

      if (control.name === 'canton' && canton !== rendered.canton) {
        changes.push((state) => ({ ...state, canton }));
      }
    } else if (control instanceof HTMLInputElement) {
      const { name, value } = control;

      if (name === 'taux' && value !== rendered.employmentRate) {
        changes.push((state) => ({ ...state, employmentRate: value }));
      }

      if (name === 'tt' && value !== rendered.teleworkDays) {
        changes.push((state) => ({ ...state, teleworkDays: value }));
      }

      // The radio switched ON is the answer. "Non" resets the mission days, as
      // the control's onChange does.
      const yes = value === COPY.missions.yes;

      if (name === 'missions' && control.checked && yes !== rendered.hasMissions) {
        changes.push((state) => ({
          ...state,
          hasMissions: yes,
          missionDaysFrance: yes ? state.missionDaysFrance : NO_DAYS,
          missionDaysThirdState: yes ? state.missionDaysThirdState : NO_DAYS,
        }));
      }

      const weekday = WEEKDAYS_IN_ORDER.find((day) => RHYTHM_DAY_CODES[day] === value);
      const { checked } = control;

      if (name === 'rythme' && weekday !== undefined && checked !== (rendered.rhythm[weekday] === 'HOME')) {
        changes.push((state) => {
          const rhythm = { ...state.rhythm };

          if (checked) rhythm[weekday] = 'HOME';
          else delete rhythm[weekday];

          return { ...state, rhythm };
        });
      }
    }
  }

  // No change gives back the same state, so an untouched form renders nothing.
  return (state) => changes.reduce((next, change) => change(next), state);
}

/**
 * Which field an error belongs to, or null for one that belongs to no control.
 *
 * EXHAUSTIVE OVER THE UNION, ending in a `never` assignment, so a new
 * ValidationError code is a compile error here rather than a message that
 * quietly renders nowhere.
 */
function fieldFor(error: ValidationError): FieldKey | null {
  switch (error.code) {
    case 'RATE_OUT_OF_RANGE':
      return 'employmentRate';

    // The period comes from the start date, so that is the control to point
    // at - not the fraction, which the user never sees.
    case 'PERIOD_OUT_OF_RANGE':
      return 'startDay';

    case 'NEGATIVE_DAYS':
    case 'GRANULARITY_MISMATCH':
      switch (error.field) {
        case 'teleworkDays':
          return 'teleworkDays';
        case 'missionDaysFrance':
          return 'missionDaysFrance';
        case 'missionDaysThirdState':
          return 'missionDaysThirdState';
        // validate.ts reports the exact method's supplied total under the
        // 'denominator' field name.
        case 'denominator':
          return 'exactTotal';
        default:
          return null;
      }

    // Not a single field's fault - the SUM of the day counts passed the annual
    // basis. Shown on the telework field because that is the one the user is
    // editing when it happens and the one they can shrink to fix it.
    case 'DAYS_EXCEED_TOTAL':
      return 'teleworkDays';

    case 'TOTAL_WORK_DAYS_NOT_POSITIVE':
      return 'exactTotal';

    default: {
      const exhaustive: never = error;

      return exhaustive;
    }
  }
}

export interface CalculatorFormProps {
  /** Resolved server-side from the Europe/Paris date (R55). */
  readonly taxYear: number;
  /**
   * A scenario to start from, for tests and for a future caller.
   *
   * THE URL IS NOT READ THROUGH THIS PROP. The page is static (see its
   * header), so nothing on the server knows the query string; the island
   * reads it on mount instead. This stays because a seeded form is worth
   * being able to construct directly in a test without a browser URL.
   */
  readonly initial?: TeleworkInput | null;
  /**
   * FW-CALCS-A2 (R726): what closes the result column - the application card
   * and the link to /sources. RENDERED BY THE SERVER PAGE and handed in as
   * elements, so their words and PRODUCT_STATE never enter this island's
   * bundle: the calculator route has the least first-load headroom in the
   * product (REPORT-FW-HOME-A2, R723).
   */
  readonly aside?: ReactNode;
  /**
   * The result panel's contextual link, per status, RESOLVED BY THE SERVER PAGE
   * (R976, FW-CALC-BYTES) with liveHrefs - for the same reason as `aside`: the
   * decision needs the route registry, and the registry must not enter this
   * island's bundle. Passed straight to ResultPanel, which documents why an
   * absent table renders the link as text.
   */
  readonly liveLinks?: LiveResultLinks;
}

export function CalculatorForm({
  taxYear,
  initial = null,
  aside = null,
  liveLinks,
}: CalculatorFormProps) {
  // SEEDED ONCE, from the server render. useState's initial value is used on
  // the first render and ignored afterwards, which is exactly right here: the
  // URL is where the user STARTED, and from then on the form is the truth and
  // the URL follows it (increment 4).
  const [state, setState] = useState<FormState>(
    initial === null ? INITIAL : stateFrom(initial),
  );

  // The accordion opens for a link that used it, so the reader can see the
  // settings their scenario depends on rather than wondering why the numbers
  // do not match a default calculation.
  /**
   * THE SHARED LINK, READ ON MOUNT. FW13 increment 2.
   *
   * ON THE CLIENT, because the page is static: reading searchParams on the
   * server would move this route's canonical out of <head> (measured - see
   * the page's header), and this is SPEC 14's target-query page.
   *
   * window.location.search RATHER THAN useSearchParams, because that hook
   * forces a Suspense boundary on a static route and returns nothing during
   * prerender anyway. Reading the location once, after mount, is the same
   * information with no boundary and no build-time constraint.
   *
   * ONCE, NOT ON EVERY CHANGE. The URL is where the reader STARTED; from
   * mount onwards the form is the truth and the URL follows it (increment
   * 4). An effect that re-read the location would fight its own writes.
   *
   * AND WHAT WAS TYPED BEFORE HYDRATION GOES ON TOP OF IT (R1057, see
   * typedBefore): the link seeds the state, then every control the reader
   * changed overrides its own field. A LAYOUT effect, so the read and the
   * seed happen in the hydration commit's own task: nothing can be typed
   * between the commit and the read, and nothing typed after it can be
   * overwritten by a seed that runs later.
   */
  const [link, setLink] = useState<{
    readonly ignored: readonly string[];
    readonly invalid: readonly string[];
  }>({ ignored: [], invalid: [] });

  const formRef = useRef<HTMLFormElement>(null);

  useLayoutEffect(() => {
    // `state` is the first render's here: the effect runs once, on mount.
    const typed = formRef.current === null ? (current: FormState) => current : typedBefore(formRef.current, state);
    const query = window.location.search;

    if (query === '' || query === '?') {
      setState(typed);

      return;
    }

    const decoded = decode(new URLSearchParams(query), taxYear);

    if (decoded.input !== null) setState(stateFrom(decoded.input));

    // SEPARATELY FROM THE INPUT, because a rhythm is not part of it: a
    // link may carry a rhythm and no scenario, or a scenario and no
    // rhythm, and stateFrom only knows about the engine fields. The typed
    // controls go last, so a field the reader changed wins (R1057).
    setState((current) => typed({ ...current, rhythm: decoded.rhythm }));

    // THE SAME FILTER THE RESULT PAGE USES (R206, R267). `missions` is a
    // control of this very form, so naming it as a param the calculator
    // does not use would be telling the reader their own answer was
    // discarded. It reaches this URL by the result page’s back link, and
    // by any link a reader has bookmarked since.
    setLink({ ignored: strayParams(decoded.ignored), invalid: decoded.invalid });

    if (
      decoded.input !== null &&
      (decoded.input.denominator.kind === 'exact' || decoded.input.periodFraction < 1)
    ) {
      setAdvancedOpen(true);
    }
    // Mount only, deliberately: see the comment above. The dependency
    // array is empty because re-reading the location would fight the writes
    // increment 4 makes to it.
  }, []);

  /**
   * ANNOUNCE THE CAPTURE CARD'S STATUS, when there is JavaScript to do it.
   *
   * The status is revealed by CSS :target, which needs nothing from here -
   * that is what makes it readable with scripting off. What CSS cannot do
   * is tell a screen reader that something appeared: aria-live announces
   * CHANGES, and on a fresh page load the message is simply present, so no
   * change ever fires.
   *
   * Moving focus is what actually announces it, and it also puts the
   * keyboard where the reader's attention already is. The element carries
   * tabIndex={-1} so it can receive focus without joining the tab order.
   */
  useEffect(() => {
    const fragment = window.location.hash.slice(1);

    if (!fragment.startsWith('alerte-')) return;

    const status = document.getElementById(fragment);

    status?.focus();
  }, []);

  /**
   * navigator.share, DETECTED AFTER MOUNT rather than during render.
   *
   * The island is server-rendered before it hydrates and there is no
   * navigator on the server, so reading it during render would produce
   * markup that disagrees with the client and React would warn. Detecting in
   * an effect means the button appears on the devices that have the API and
   * never exists anywhere else: a button that does nothing when pressed
   * reads as a broken site rather than as a missing browser feature.
   */
  const [canShare, setCanShare] = useState(false);

  /**
   * Whether Calculer has been pressed while the canton was still empty (R380).
   *
   * IT IS STATE AND NOT A DERIVED VALUE, because what it records is not "the
   * canton is empty" - which the form knows at every keystroke - but "the
   * reader has ASKED for an answer and cannot be given one". Those differ by
   * an event, and only the second is an error.
   *
   * The header of this file already names the gap: "nothing is validated
   * until a canton exists, because that is what it takes to build an input at
   * all". The canton field has been wired to errorFor since FW11 and could
   * never receive anything, because the engine that produces errors cannot
   * run without the very field in question.
   */
  const [submittedWithoutCanton, setSubmittedWithoutCanton] = useState(false);

  useEffect(() => {
    setCanShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    );
  }, []);

  /**
   * What the share row has just done, as a sentence.
   *
   * IT STAYS. The prompt: the copy confirmation must be readable by a screen
   * reader, and not a toast that vanishes. A timer clearing this would take
   * the message away from exactly the reader who needs longest to reach it.
   */
  const [shareStatus, setShareStatus] = useState('');

  // SPEC 9.4 requires the link notice to be DISMISSIBLE. Dismissed in state
  // rather than removed from the DOM by the reader's browser, so it comes
  // back on the next shared link rather than staying hidden for the session.
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const rules = ruleSetFor(taxYear);

  /**
   * The engine input, or null while the form cannot make one.
   *
   * Recomputed on every render rather than debounced: SPEC 9.3 and standing
   * protocol 7 both say so, and the reason is that the engine runs in well
   * under a millisecond, so a debounce would add perceived lag and nothing
   * else. useMemo is here for referential stability of the errors array, not
   * as a performance measure.
   */
  const input = useMemo<TeleworkInput | null>(() => {
    if (state.canton === '') return null;

    const denominator: DenominatorMethod =
      state.method === 'exact'
        ? { kind: 'exact', totalWorkDays: parseNumeric(state.exactTotal) }
        : { kind: 'simplified240' };

    return {
      taxYear,
      canton: state.canton,
      employmentRate: parseNumeric(state.employmentRate),
      periodFraction: fractionFor(state.startDay, taxYear),
      denominator,
      granularity: state.granularity,
      teleworkDays: parseNumeric(state.teleworkDays),
      missionDaysFrance: parseNumeric(state.missionDaysFrance),
      missionDaysThirdState: parseNumeric(state.missionDaysThirdState),
    };
  }, [state, taxYear]);

  /**
   * The engine's answer, kept whole.
   *
   * ONE CALL, NOT TWO. The errors and the result are the two branches of the
   * same Result, so computing them separately would run the engine twice per
   * keystroke and - worse - could show a result and an error that came from
   * different inputs if the memo dependencies ever drifted apart.
   */
  const outcome = useMemo(
    () => (input === null ? null : calculateTelework(input)),
    [input],
  );

  const reported: readonly ValidationError[] =
    outcome !== null && !outcome.ok ? outcome.error : NO_ERRORS;

  /**
   * The engine's errors, minus the one that is only ever a restatement.
   *
   * FOUND IN A BASELINE, not by a test. Increment 5's error screenshot showed
   * the rate field correctly marked "Le taux d'activite doit etre compris
   * entre 1 et 100" and, in the form-level list under it, "Le nombre de jours
   * travailles dans la periode doit etre superieur a zero". Two messages for
   * one mistake, and the second one names a quantity the user has never seen.
   *
   * THE ENGINE IS RIGHT TO SEND BOTH. validate.ts resolves the denominator
   * from the rate it was given, so a rate of 0 makes ceil(basis x 0 x period)
   * zero and TOTAL_WORK_DAYS_NOT_POSITIVE is simply true. Choosing which of
   * two true statements a person should read is the form's job, not the
   * engine's - and it is the form that knows the total is not a field here.
   *
   * SUPPRESSED ONLY WHEN IT IS DERIVED, which under the simplified basis is
   * always: with a rate of at least 1 and a period above 0 the total is the
   * ceiling of a positive number, so it is at least 1 and the error cannot
   * arise on its own. Under the EXACT method the user supplies the number,
   * nothing else explains it, and hiding it would leave a form that refuses
   * to calculate and says nothing about why.
   */
  const errors: readonly ValidationError[] =
    state.method === 'exact'
      ? reported
      : reported.filter((error) => error.code !== 'TOTAL_WORK_DAYS_NOT_POSITIVE');

  const result: TeleworkResult | null = outcome !== null && outcome.ok ? outcome.value : null;

  /**
   * SPEC 15: calculated and result_status.
   *
   * WHEN THEY FIRE IS THE WHOLE DESIGN, and the obvious placement is
   * wrong. SPEC 9.3 recomputes on EVERY input event with no debounce, so
   * firing here per computation would report dozens of calculations for
   * one person typing "84" - and SPEC 15 asks calculated for "real usage,
   * not bounces", a question that answer cannot address.
   *
   * So: calculated ONCE per mount, at the first result of any kind, and
   * result_status on each CHANGE of status. The effect depends on the
   * status string, so a reader who moves from compliant to social-switch
   * and back produces three events and a reader who types a rate one digit
   * at a time produces one.
   *
   * NOTHING GOES ANYWHERE TODAY. No collector is installed - see
   * lib/analytics/track.ts for why - so track() returns immediately. The
   * call sites exist because WHERE an event fires is the expensive
   * knowledge, and it is cheaper to encode it beside the code that knows.
   */
  const status = result === null ? null : statusFor(result);
  const everCalculated = useRef(false);

  useEffect(() => {
    if (status === null) return;

    if (!everCalculated.current) {
      everCalculated.current = true;
      track(calculated());
    }

    track(resultStatus(status));
  }, [status]);

  /**
   * THE ADDRESS BAR FOLLOWS THE FORM. FW13 increment 4.
   *
   * replaceState, NEVER pushState. Every input event changes the scenario,
   * so pushing would add one history entry per KEYSTROKE: a reader who typed
   * "84" and pressed Back twice would still be on the calculator, and the
   * third press would take them somewhere they never asked to leave.
   *
   * AND THIS IS THE ONE DEBOUNCE IN THE PRODUCT. The engine is not debounced
   * - SPEC 9.3 says recompute on every input event, and it costs
   * microseconds. The URL is different: replaceState is main-thread work
   * against a string nobody reads mid-word, and 400 ms is far below the
   * pause before anyone reaches for the share button.
   *
   * NOT BEFORE THERE IS SOMETHING TO SHARE. A bare path stays bare: putting
   * a query string in front of a reader who has typed nothing is a URL they
   * did not ask for and cannot un-see.
   */
  //
  // AND THE APP HANDOFF RIDES THE SAME TIMER. FW13 increment 5 persists the
  // scenario for SPEC 10, and localStorage.setItem is SYNCHRONOUS main-thread
  // work - so putting it on its own debounce would mean two timers writing
  // the same scenario to two places 400 ms apart, and putting it on no
  // debounce at all would mean a synchronous write per keystroke. One timer,
  // two destinations, one moment where the scenario is settled.
  //
  // ON A VALID COMPUTATION, WHICH IS NOT THE SAME AS VALID INPUT. `input`
  // being non-null says the form parsed; `hasResult` says the ENGINE answered.
  // The URL follows the form either way - a reader sharing a scenario the
  // engine rejects should still send exactly what they are looking at - but
  // the handoff is a pre-filled onboarding for another app, and handing it a
  // scenario that produced no answer would pre-fill a form with a dead end.
  const hasResult = result !== null;

  useEffect(() => {
    if (input === null) return undefined;

    const timer = setTimeout(() => {
      const query = encode(input, state.rhythm).toString();
      const next =
        query === '' ? window.location.pathname : `?${query}`;

      window.history.replaceState(window.history.state, '', next);

      if (hasResult) writeHandoff(input);

    }, URL_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
    // state.rhythm IS A DEPENDENCY, AND THE WALKTHROUGH IS WHY.
    //
    // Checking a day changes neither `input` (the rhythm is not part of
    // TeleworkInput) nor `hasResult` (a rhythm cannot make the engine
    // answer differently today), so with those two alone the effect never
    // re-ran: the address bar kept a query with no rythme in it, the share
    // button copied it, and a reader who had checked two days sent a link
    // that projected nothing.
    //
    // Its identity is stable across other edits - set() spreads `current`
    // and keeps the same rhythm object - so this does not re-arm the timer
    // on every keystroke.
  }, [input, hasResult, state.rhythm]);

  /**
   * AC2: THE CAPTURE CARD POSTS THE SCENARIO WITH IT, so subscribing does
   * not cost the reader their result.
   *
   * NOT DEBOUNCED, AND THE FIRST VERSION WAS - which was a race the e2e
   * suite caught. Writing the field inside the 400 ms timer meant a reader
   * who landed on a shared link and submitted quickly posted an EMPTY
   * scenario, and the redirect returned them to an empty calculator: they
   * paid for subscribing with the numbers they had just been shown.
   *
   * The debounce exists because replaceState is main-thread work against a
   * URL nobody reads mid-word. Setting a hidden input's value is neither of
   * those things, so it happens as soon as there is something to write.
   *
   * The card is a server-rendered SIBLING of this island - a plain form
   * with no client JavaScript of its own (R136) - so the field is reached
   * through the document rather than through a prop. With scripting off it
   * stays empty, and that is correct: there is no scenario on this page to
   * lose, because the calculator does not compute without JavaScript.
   */
  useEffect(() => {
    const field = document.querySelector<HTMLInputElement>('[data-alert-scenario]');

    if (field === null) return;

    field.value = input === null ? '' : encode(input, state.rhythm).toString();
  }, [input]);



  /**
   * Which fields are on screen right now.
   *
   * Errors are routed by this and not by the code alone, because a field
   * behind a collapsed disclosure cannot show anything. Without it, entering
   * a start date in the wrong year and then closing the accordion would make
   * the engine's message disappear while the form stayed un-calculable.
   */
  const visible = new Set<FieldKey>(['canton', 'employmentRate', 'teleworkDays']);

  if (state.hasMissions) {
    visible.add('missionDaysFrance');
    visible.add('missionDaysThirdState');
  }

  if (advancedOpen) {
    visible.add('startDay');

    if (state.method === 'exact') visible.add('exactTotal');
  }

  const errorFor = (field: FieldKey): string | undefined => {
    // R380: the one error the engine cannot report, because it cannot run
    // without the field it would report on. Routed through errorFor rather
    // than passed separately at the call site so the canton field keeps ONE
    // source of error text (R206) and FieldGroup keeps doing the aria work.
    if (field === 'canton' && submittedWithoutCanton && state.canton === '') {
      return COPY.canton.missing;
    }

    const hit = errors.find((error) => fieldFor(error) === field);

    return hit === undefined ? undefined : errorMessage(hit);
  };

  /** Errors with no field, or whose field the user cannot currently see. */
  const unplaced = errors.filter((error) => {
    const field = fieldFor(error);

    return field === null || !visible.has(field);
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const stepNumeric = (
    key: 'employmentRate' | 'teleworkDays' | 'missionDaysFrance' | 'missionDaysThirdState',
    delta: number,
    min: number,
    max: number | null,
  ) => {
    setState((current) => {
      const parsed = parseNumeric(current[key]);
      const from = Number.isFinite(parsed) ? parsed : min;
      const raised = Math.max(min, from + delta);
      const next = max === null ? raised : Math.min(max, raised);

      return { ...current, [key]: String(next) };
    });
  };

  /** A number field with its two stepper buttons. Four of these exist. */
  const numericField = (config: {
    readonly id: string;
    /**
     * SPEC 9.4's name for this field, and the reason it is required rather
     * than optional: with no scripting the browser builds the query from
     * these attributes alone, and a field with no name is a field the
     * reader filled in and nobody received.
     */
    readonly name: ParamName;
    readonly stateKey:
      | 'employmentRate'
      | 'teleworkDays'
      | 'missionDaysFrance'
      | 'missionDaysThirdState';
    readonly field: FieldKey;
    readonly label: string;
    readonly helper: string;
    readonly decrease: string;
    readonly increase: string;
    readonly step: number;
    readonly min: number;
    readonly max: number | null;
  }) => (
    <FieldGroup
      id={config.id}
      label={config.label}
      helper={config.helper}
      error={errorFor(config.field)}
    >
      {(control) => (
        // R725: THE A2 STEPPER, restyled rather than re-implemented. Stepper
        // draws the frame and the two buttons; the field, its name, its
        // arithmetic (stepNumeric's clamp) and its labels are unchanged.
        <Stepper
          decreaseLabel={config.decrease}
          increaseLabel={config.increase}
          onDecrease={() => {
            stepNumeric(config.stateKey, -config.step, config.min, config.max);
          }}
          onIncrease={() => {
            stepNumeric(config.stateKey, config.step, config.min, config.max);
          }}
        >
          {/*
            NO step, min OR max ATTRIBUTE. All three are inert on a text
            input, so rendering them would read as a bound the browser was
            enforcing while nothing was. The real bounds are the stepper's
            clamp and the engine's own validation, both tested.
          */}
          <input
            {...control}
            name={config.name}
            type="text"
            inputMode="decimal"
            className={styles.number}
            value={state[config.stateKey]}
            onChange={(event) => {
              set(config.stateKey, event.target.value);
            }}
          />
        </Stepper>
      )}
    </FieldGroup>
  );

  /**
   * RULING R110: which pending readings THIS input depends on.
   *
   * Derived from the input rather than from the result, so it is right while
   * the numbers are still invalid: the reading the user's configuration
   * depends on does not become relevant only once the form validates. It is
   * also why this reads the input and not result.warnings - the engine has no
   * opinion about which of its rules are settled.
   */
  const provisional = input === null ? [] : provisionalFor(input);

  /**
   * Copy, with a fallback for browsers without the async clipboard.
   *
   * execCommand IS DEPRECATED AND IT IS STILL THE FALLBACK: the modern API
   * is unavailable in a non-secure context and behind some permissions
   * policies, which is exactly the in-app browser a Facebook link opens in.
   * Both paths end in the same announcement.
   */
  const copyLink = () => {
    track(shareClicked('copy'));

    const url = window.location.href;

    const announce = (ok: boolean) => {
      setShareStatus(ok ? SHARE_COPY.copied : SHARE_COPY.copyFailed);
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
      void navigator.clipboard.writeText(url).then(
        () => {
          announce(true);
        },
        () => {
          announce(false);
        },
      );

      return;
    }

    const carrier = document.createElement('textarea');

    carrier.value = url;
    document.body.append(carrier);
    carrier.select();

    try {
      announce(document.execCommand('copy'));
    } catch {
      announce(false);
    } finally {
      carrier.remove();
    }
  };

  /** The native sheet. Cancelling it is a choice, not a failure. */
  const shareLink = () => {
    void navigator
      .share({ title: SHARE_COPY.shareTitle, url: window.location.href })
      .catch((error: unknown) => {
        const aborted =
          error instanceof Error && error.name === 'AbortError';

        if (!aborted) setShareStatus(SHARE_COPY.copyFailed);
      });
  };

  /**
   * WHAT A SCRIPTED READER GETS INSTEAD OF A NAVIGATION.
   *
   * The form is real and its action answers, so a reader with no JavaScript
   * submits and lands on /resultat. With JavaScript the answer is already on
   * screen and recomputed on every keystroke, so leaving for a server
   * rendering of the same figures would be a downgrade: preventDefault, then
   * do what the Calculer button has always done.
   *
   * BY ID, NOT BY REF, since increment 1. The live region is rendered by the
   * island while there is nothing to show and by ResultPanel once there is,
   * so a ref attached in one branch is null in the other - and the button
   * would silently stop moving focus exactly when there was finally a result
   * to move it to.
   */
  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    // R380: NO CANTON, NO ANSWER - and now the form says which field.
    //
    // It returns before moving focus to the result region, because the
    // region has nothing to say: with no canton there is no input, so no
    // calculation. Sending focus there would announce the neutral "choose a
    // canton" line while leaving the field that needs attention unmarked and
    // off-screen, which is the behaviour this ruling exists to replace.
    if (state.canton === '') {
      setSubmittedWithoutCanton(true);
      document.getElementById('canton')?.focus();

      return;
    }

    const region = document.getElementById(RESULT_ID);

    if (region === null) return;

    // Guarded rather than called: jsdom implements no layout and has no
    // scrollIntoView, so an unguarded call turns every test that presses this
    // button into a TypeError.
    if (typeof region.scrollIntoView === 'function') {
      region.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    region.focus();
  };

  return (
    <>
      {/*
        R351: A REAL FORM, SUBMITTING BY GET TO THE PAGE THAT ANSWERS.

        This fieldset held nine controls and no form element, so with
        scripting off a reader could fill every one of them and had no way
        to send them anywhere. Measured on a production build of main: the
        Calculer button was type="button", and clicking it left the URL on
        the calculator.

        THE ISLAND STILL WINS WHEN IT IS THERE. onSubmit preventDefaults, so
        a scripted visitor never leaves the page - the result is already
        below, recomputed on every keystroke, and navigating away from a
        live answer to a server-rendered copy of it would be a downgrade.
        The form is the FALLBACK, and it is the browser rather than this
        component that uses it.

        action is RESULT_PATH, never this route. FW13 measured what reading
        searchParams here costs - <title> and canonical leave <head> on SPEC
        14's target-query page - and R351 moved the answer instead.
      */}
      {/*
        FW-CALCS-A2, R724: TWO COLUMNS, opened here because only the island
        knows where its form ends and its result begins. The page's grid sets
        them side by side from the md breakpoint; below it they stack, the
        result after the form. DOM order is unchanged - link notice, share
        row, provisional notice, result (R137, page-section-order.test.tsx).
      */}
      <div className={styles.formColumn}>
      <form method="get" action={RESULT_PATH} onSubmit={onSubmit} ref={formRef}>
        <fieldset className={styles.card}>
          <legend className={styles.legend}>{COPY.legend}</legend>

          <FieldGroup
            id="canton"
            label={COPY.canton.label}
            helper={COPY.canton.helper}
            error={errorFor('canton')}
          >
            {(control) => (
              <select
                {...control}
                name="canton"
                className={styles.select}
                value={state.canton}
                onChange={(event) => {
                  set('canton', event.target.value as Canton | '');
                }}
              >
                <option value="">{COPY.canton.placeholder}</option>
                {CANTONS_BY_NAME.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </FieldGroup>

          {/* R725: the two steppers side by side on a wide screen. */}
          <div className={styles.pair}>
          {numericField({
            id: 'taux-activite',
            name: 'taux',
            stateKey: 'employmentRate',
            field: 'employmentRate',
            label: COPY.rate.label,
            helper: COPY.rate.helper,
            decrease: COPY.rate.decrease,
            increase: COPY.rate.increase,
            step: RATE.step,
            min: RATE.min,
            max: RATE.max,
          })}

          {numericField({
            id: 'jours-teletravail',
            name: 'tt',
            stateKey: 'teleworkDays',
            field: 'teleworkDays',
            label: COPY.days.label,
            helper: COPY.days.helper,
            decrease: COPY.days.decrease,
            increase: COPY.days.increase,
            step: DAYS.step,
            min: DAYS.min,
            max: null,
          })}
          </div>

          {/*
            THE MISSION QUESTION, above the accordion and never inside it. SPEC
            9.3's one exception to progressive disclosure, because a user with
            missions who never opens the accordion gets a silently wrong answer.
          */}
          <SegmentedChoice
            name="missions"
            legend={COPY.missions.question}
            helper={COPY.missions.helper(fiscalCeiling(taxYear))}
            value={state.hasMissions ? COPY.missions.yes : COPY.missions.no}
            options={[
              { value: COPY.missions.no, label: COPY.missions.no },
              { value: COPY.missions.yes, label: COPY.missions.yes },
            ]}
            onChange={(value) => {
              const yes = value === COPY.missions.yes;

              // SPEC 15: how common missions actually are. A BOOLEAN, never a
              // count - how many mission days somebody declared is their
              // fiscal position, and the question SPEC asks is answered by
              // the yes.
              track(missionsDeclared(yes));

              // RESET ON "Non", not merely hide. A hidden field keeps its value
              // and keeps feeding the calculation, so answering Oui, typing 12
              // and thinking better of it would compute from 12 mission days the
              // user can no longer see - the exact "silently wrong answer" this
              // question exists to prevent, reintroduced by the reveal.
              setState((current) => ({
                ...current,
                hasMissions: yes,
                missionDaysFrance: yes ? current.missionDaysFrance : NO_DAYS,
                missionDaysThirdState: yes ? current.missionDaysThirdState : NO_DAYS,
              }));
            }}
          />

          {!state.hasMissions ? null : (
            <div className={styles.revealed}>
              {numericField({
                id: 'missions-france',
                name: 'mfr',
                stateKey: 'missionDaysFrance',
                field: 'missionDaysFrance',
                label: COPY.missions.france.label,
                helper: COPY.missions.fieldHelper,
                decrease: COPY.days.decrease,
                increase: COPY.days.increase,
                step: DAYS.step,
                min: DAYS.min,
                max: null,
              })}
              {numericField({
                id: 'missions-pays-tiers',
                name: 'mtiers',
                stateKey: 'missionDaysThirdState',
                field: 'missionDaysThirdState',
                label: COPY.missions.thirdState.label,
                helper: COPY.missions.fieldHelper,
                decrease: COPY.days.decrease,
                increase: COPY.days.increase,
                step: DAYS.step,
                min: DAYS.min,
                max: null,
              })}
            </div>
          )}

          {/*
            R343: THE WEEKLY RHYTHM, AND IT IS FIVE PLAIN CHECKBOXES.

            OUTSIDE THE ACCORDION, like the mission question above it and
            for the same reason: the accordion is not rendered when closed,
            so anything inside it cannot be answered without scripting at
            all. A question whose whole purpose is to work with JavaScript
            off cannot live behind a disclosure that needs JavaScript.

            ONE NAME, FIVE BOXES. A browser submits `?rythme=ma&rythme=je`
            by itself, which is why the parameter repeats rather than
            packing five states into one string - see lib/params/rhythm.ts
            for the version that did and why it could not survive.

            NO PROJECTION IS DRAWN HERE. The answer appears on /resultat,
            rendered by the server; the line under the result says so.
          */}
          <fieldset className={styles.group}>
            <legend className={styles.groupLegend}>{CALCULATEUR_COPY.projection.question}</legend>
            {/* R725: the A2 chips - each still a checkbox named rythme. */}
            <div className={styles.chips} aria-describedby={RHYTHM_HELPER_ID}>
              {WEEKDAYS_IN_ORDER.map((weekday) => (
                <Chip
                  key={weekday}
                  name="rythme"
                  value={RHYTHM_DAY_CODES[weekday]}
                  label={CALCULATEUR_COPY.projection.days[weekday]}
                  checked={state.rhythm[weekday] === 'HOME'}
                  onChange={(event) => {
                    const { checked } = event.target;

                    setState((current) => {
                      const rhythm = { ...current.rhythm };

                      if (checked) rhythm[weekday] = 'HOME';
                      else delete rhythm[weekday];

                      return { ...current, rhythm };
                    });
                  }}
                />
              ))}
            </div>
            <p className={styles.groupHelper} id={RHYTHM_HELPER_ID}>
              {CALCULATEUR_COPY.projection.helper}
            </p>
          </fieldset>

          <button
            type="button"
            className={styles.disclosure}
            aria-expanded={advancedOpen}
            aria-controls={ADVANCED_SECTION_ID}
            onClick={() => {
              setAdvancedOpen((open) => {
                // SPEC 15 asks whether progressive disclosure WORKS, so the
                // event is the opening. Firing on close as well would count
                // one reader twice and make the ratio meaningless.
                if (!open) track(accordionOpened(ADVANCED_SECTION_ID));

                return !open;
              });
            }}
          >
            <ChevronDown
              size={ICON}
              strokeWidth={STROKE}
              aria-hidden="true"
              className={advancedOpen ? styles.chevronOpen : styles.chevron}
            />
            <span>{COPY.advanced.summary}</span>
          </button>

          {/*
            NOT RENDERED WHEN CLOSED, and the first version of this comment
            overclaimed why. It said a display:none control "is still focusable",
            which a probe disproved: hiding this panel with the hidden attribute
            instead kept the keyboard test green, because hidden implies
            display:none and display:none really does take descendants out of the
            tab order.

            So the honest reason is narrower. Not rendering cannot be got wrong,
            where hiding can: visibility, opacity, height 0 and aria-hidden alone
            all leave a focusable control behind, and each is one careless edit
            away from the correct version. There is also no state to keep in sync
            - no aria-hidden to toggle, nothing to remember to untoggle.

            Increment 5's keyboard path asserts that a closed accordion
            contributes no tab stops, which is the property that matters. It does
            NOT distinguish this implementation from a correct display:none one,
            and the probe is why that is stated rather than assumed.
          */}
          <div id={ADVANCED_SECTION_ID}>
            {!advancedOpen ? null : (
              <div className={styles.advanced}>
                <SegmentedChoice
                  name="methode"
                  legend={COPY.method.label}
                  helper={COPY.method.helper(formatDays(rules.simplifiedBasisDays))}
                  /*
                    THE VALUES ARE SPEC 9.4 CODES, NOT THE ENGINE’S NAMES.
                    Until R351 these read `simplified240` and `exact`, which
                    was invisible while the group was a UI control; now the
                    fieldset is inside a GET form, so each `value` is what
                    the browser puts in the URL. Measured: `methode=
                    simplified240` reaches decode() as unreadable, falls back
                    to the default and reports itself in `invalid`.

                    methodCode() rather than a literal, so the form and the
                    codec cannot disagree about the vocabulary (R206).
                  */
                  value={methodCode(state.method)}
                  options={[
                    { value: methodCode('simplified240'), label: COPY.method.simplified },
                    { value: methodCode('exact'), label: COPY.method.exact },
                  ]}
                  onChange={(value) => {
                    const exact = value === methodCode('exact');

                    // PREFILLED FROM THE RULE SET when the exact method is
                    // chosen, and this is an interpretation the report records.
                    // SPEC 9.3 says the user supplies the total; an empty field
                    // reaches the engine as NaN, which it reports as "cannot be
                    // negative" - a wrong message about a field nobody has typed
                    // in yet. The simplified basis is the number the calculation
                    // was already using, so starting there states the default
                    // rather than inventing one.
                    setState((current) => ({
                      ...current,
                      method: exact ? 'exact' : 'simplified240',
                      exactTotal:
                        exact && current.exactTotal === ''
                          ? String(rules.simplifiedBasisDays)
                          : current.exactTotal,
                    }));
                  }}
                />

                {state.method !== 'exact' ? null : (
                  <FieldGroup
                    id="total-jours"
                    label={COPY.method.totalLabel}
                    helper={COPY.method.totalHelper}
                    error={errorFor('exactTotal')}
                  >
                    {(control) => (
                      <input
                        {...control}
                        name="total"
                        type="text"
                        inputMode="decimal"
                        className={styles.number}
                        value={state.exactTotal}
                        onChange={(event) => {
                          set('exactTotal', event.target.value);
                        }}
                      />
                    )}
                  </FieldGroup>
                )}

                <SegmentedChoice
                  name="decompte"
                  legend={COPY.decompte.label}
                  helper={COPY.decompte.helper}
                  /* SPEC 9.4 codes, for the reason above: `decompte=halfDay`
                     falls back to whole days and answers a different
                     question without saying so. */
                  value={granularityCode(state.granularity)}
                  options={[
                    { value: granularityCode('day'), label: COPY.decompte.day },
                    { value: granularityCode('halfDay'), label: COPY.decompte.halfDay },
                    { value: granularityCode('hours'), label: COPY.decompte.hours },
                  ]}
                  onChange={(value) => {
                    set('granularity', GRANULARITY_CODES[value as GranularityCode]);
                  }}
                />

                <FieldGroup
                  id="debut-activite"
                  label={COPY.start.label}
                  helper={COPY.start.helper}
                  error={errorFor('startDay')}
                >
                  {(control) => (
                    <input
                      {...control}
                      name="debut"
                      type="date"
                      className={styles.date}
                      value={state.startDay}
                      onChange={(event) => {
                        set('startDay', event.target.value);
                      }}
                    />
                  )}
                </FieldGroup>
              </div>
            )}
          </div>

          {unplaced.length === 0 ? null : (
            <div className={styles.otherErrors}>
              <p className={styles.otherErrorsLabel}>{COPY.otherErrorsLabel}</p>
              <ul className={styles.otherErrorsList}>
                {unplaced.map((error) => (
                  <li key={error.code}>{errorMessage(error)}</li>
                ))}
              </ul>
            </div>
          )}

          {/*
            FD1 PUTS A PRIMARY BUTTON HERE and, for a scripted reader, the
            result is already live - so this one navigates rather than
            computes: it scrolls the result into view and takes focus there. A
            form full of numbers with no button at all reads as unfinished.

            type="submit" SINCE R351, AND THE OLD COMMENT ARGUED THE OPPOSITE.
            It read: "a submit would reload the page on Enter and lose
            everything typed, which on a form with no persistence is the worst
            available outcome". That was true of a submit with nowhere to go.
            It is not true of this one: the destination now ANSWERS, so the
            reload a reader gets on Enter is their result rather than a blank
            form - and onSubmit preventDefaults before any of that happens
            when there is scripting to do it. The argument is recorded rather
            than deleted because it was right about the arrangement it was
            written for.
          */}
          <button type="submit" className={styles.calculate}>
            {RESULT.calculate}
          </button>
        </fieldset>
      </form>

      {/*
        THE RESULT AREA, and it is rendered by TWO components depending on
        state.

        ResultPanel needs a TeleworkResult - it computes nothing and has
        nothing to render without one - so while the input is incomplete or
        invalid the island keeps a region of its own with the same id, live
        politeness and focus target. The alternative was a panel that accepts
        a null result and branches internally, which would put the empty
        state inside a component whose whole contract is "receives a result".

        R110's NOTICE SITS ABOVE BOTH, AND STAYED HERE IN INCREMENT 5.

        The plan was to move it inside the panel. It is not there, and the
        reason is the sentence two paragraphs up: the notice is derived from
        the INPUT, the panel renders only when there is a RESULT, and those
        two are not the same states. A reader who has just typed a rate of 0
        has no result and is being shown an error - and is exactly the reader
        who should still be told that their mission-day configuration depends
        on a reading awaiting review, because they are about to correct the
        number and act on the answer.

        Moving it in would have silenced it for every invalid input, which is
        a regression dressed as tidiness. Rendering it in BOTH branches would
        have meant two call sites for one banner - the failure increment 4
        just removed for RULE_SET_FALLBACK. One call site, above a region
        whose contents change underneath it, is both.

        What increment 5 actually adds is the DESTINATION: a link per named
        reading to that reading on /sources. provisional-notice.test.tsx
        asserts the survives-invalid-input property directly, so this
        decision is a failing test if anyone moves it later.
      */}

      {/*
        FW13 increment 2: THE LINK NOTICE. SPEC 9.4: "invalid values fall
        back to default and surface a dismissible notice, never a blank page
        (Facebook mangles URLs; degrading beats 404)."

        ABOVE THE RESULT AND ABOVE THE PROVISIONAL NOTICE, because it is
        about the LINK rather than about the calculation: a reader who does
        not know a value was dropped has no reason to check the fields, and
        the numbers below are a correct answer to the wrong scenario.

        IT RENDERS FROM SERVER-DECODED PROPS, so it is in the first paint
        with the result it qualifies - not announced a moment later by an
        effect, which would be the one arrangement worse than silence.
      */}
      {noticeDismissed || (link.ignored.length === 0 && link.invalid.length === 0) ? null : (
        <div className={styles.linkNotice} data-notice="params">
          <p className={styles.linkNoticeLead}>{PARAM_NOTICE.lead}</p>
          {link.invalid.length === 0 ? null : (
            <p className={styles.linkNoticeBody}>{PARAM_NOTICE.invalid(link.invalid)}</p>
          )}
          {link.ignored.length === 0 ? null : (
            <p className={styles.linkNoticeBody}>{PARAM_NOTICE.ignored(link.ignored)}</p>
          )}
          <p className={styles.linkNoticeBody}>{PARAM_NOTICE.advice}</p>
          <button
            className={styles.linkNoticeDismiss}
            onClick={() => {
              setNoticeDismissed(true);
            }}
            type="button"
          >
            {PARAM_NOTICE.dismiss}
          </button>
        </div>
      )}
      {/*
        FW13 increment 4: THE SHARE ROW. SPEC 9.4's growth mechanic.

        AFTER THE FORM AND ITS NOTICES, BEFORE THE RESULT. It shares the
        SCENARIO rather than the answer - a reader who has just typed their
        numbers is the one who wants to send them, and putting it below the
        result would mean scrolling past four tiles and three banners.

        IT WAS ABOVE THE LINK NOTICE UNTIL A BASELINE WAS LOOKED AT. The
        order read: form, two share buttons, then "your link was
        incomplete - you can correct the fields above; the link you share
        will be up to date". The notice explains why the form in front of
        the reader looks the way it does, so it belongs against the form;
        and its last line is advice about sharing, which was arriving
        AFTER the buttons it is advice about. Nothing failed - every test
        in this increment passed in both orders, because not one of them
        asserts what is next to what.

        Two SECONDARY buttons per FD1 - 48 h, radius 12, surface fill, 1 px
        border - because neither is this page’s primary action. That is
        Calculer, and it is above.
      */}
      <div className={styles.share} data-share>
        <h2 className={styles.shareHeading}>{SHARE_COPY.heading}</h2>

        <div className={styles.shareRow}>
          <button className={styles.shareButton} onClick={copyLink} type="button">
            {SHARE_COPY.copy}
          </button>

          {canShare ? (
            <button className={styles.shareButton} onClick={shareLink} type="button">
              {SHARE_COPY.share}
            </button>
          ) : null}
        </div>

        {/*
          THE CONFIRMATION, AND IT STAYS. Polite, so it does not interrupt a
          reader mid-sentence, and ordinary text rather than a toast so it is
          still there when somebody tabs back to it.
        */}
        <p aria-live="polite" className={styles.shareStatus} data-share-status>
          {shareStatus}
        </p>
      </div>
      </div>

      {/*
        THE RESULT COLUMN (R726). Sticky on a wide screen, so the answer
        stays in view while the form scrolls; after the form on a phone.
      */}
      <div className={styles.resultColumn}>

      {provisional.length === 0 ? null : (
        <div className={styles.provisional} data-notice="provisional">
          <p className={styles.provisionalLead}>{PROVISIONAL_COPY.lead}</p>
          <ul className={styles.provisionalList}>
            {provisional.map((id) => (
              <li key={id}>
                <span className={styles.provisionalName}>
                  {PROVISIONAL_COPY.items[id].interpretation}
                </span>{' '}
                {PROVISIONAL_COPY.items[id].body}{' '}
                {/*
                  ONE LINK PER READING, to that reading. The notice knows
                  which of the three the input touches, so sending the reader
                  to a page listing three would throw that away. A plain
                  anchor per R87, and no target - it is our own page.

                  /sources IS LIVE (increment 0), which is why this is an
                  anchor and not ctaHrefIfLive's pending text. It is also the
                  route whose absence was the hole R113 was written about.
                */}
                <a className={styles.provisionalLink} href={`/sources#${readingAnchor(id)}`}>
                  {PROVISIONAL_COPY.readMore}
                </a>
              </li>
            ))}
          </ul>
          <p className={styles.provisionalPending}>{PROVISIONAL_COPY.pending}</p>
        </div>
      )}

      {input === null || result === null ? (
        // ResultCard's frame by its mixin (.resultCard; R736's budget).
        <section className={styles.resultCard} aria-labelledby={RESULT_TITLE_ID}>
          <h2 className={styles.resultHeading} id={RESULT_TITLE_ID}>
            {RESULT.heading}
          </h2>

          <div
            className={styles.resultLive}
            id={RESULT_ID}
            aria-live="polite"
            tabIndex={-1}
          >
            {/*
              result === null IS EXACTLY "the input is invalid". A mutation
              probe in FW11 removed an `errors.length > 0 ||` clause from this
              condition and NOT ONE TEST CHANGED - calculateTelework returns a
              Result, so a result and an error can never coexist. The "never
              show a stale number" guarantee comes from the engine's return
              type, not from a check here.
            */}
            <p className={styles.resultNote}>
              {input === null ? RESULT.empty : RESULT.stale}
            </p>
          </div>
        </section>
      ) : (
        // A FRAGMENT, because this branch now renders two things. The
        // panel was the whole branch until R343 put a line underneath it.
        <>
          <ResultPanel result={result} thresholds={rules} liveLinks={liveLinks} />

          {/*
            WHERE THE PROJECTION IS (R343). A reader who has checked some days
            and sees nothing change has been given a control with no visible
            effect, which reads as a broken form rather than as a deliberate
            split. The projection is drawn by the server on /resultat - this
            route is static by FW13 ruling and has the least headroom in the
            product - so the form says so rather than leaving them to guess.

            CONDITIONAL ON THE CONDITION (R225): only once a day is checked.
            A line that always appeared would be noise on the result of
            somebody who never answered the question.
          */}
          {Object.keys(state.rhythm).length === 0 ? null : (
            <p className={styles.projectionNote} data-projection-note>
              {CALCULATEUR_COPY.projection.onTheResult}
            </p>
          )}
        </>
      )}

      {aside}
      </div>
    </>
  );
}

/**
 * The fiscal ceiling, formatted the way the page's prose formats it.
 *
 * Duplicated from page.tsx rather than shared, because sharing it would mean
 * exporting a formatting helper from a server component into a client one -
 * and the two are the same three lines for the same reason: no decimal on a
 * whole percentage. If a third caller appears it moves to lib/ui/core.
 */
function fiscalCeiling(taxYear: number): string {
  const percent = ruleSetFor(taxYear).fiscalCeiling * 100;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
}
