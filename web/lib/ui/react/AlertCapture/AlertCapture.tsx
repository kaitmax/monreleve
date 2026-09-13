// web/lib/ui/react/AlertCapture/AlertCapture.tsx
//
// The capture card. FW14 increment 5, SPEC 9.3 item 8, FD1.
//
// A SERVER COMPONENT AND A PLAIN FORM (R136). No island, no fetch, no state:
// <form method="post" action="/api/alertes">, which browsers have handled
// since before JavaScript existed. It costs the calculator ZERO bytes of
// client JavaScript, which matters because that route has 4,4 KiB of GATE A
// headroom left and this is the growth mechanic, not the product.
//
// EVERY STATUS IS RENDERED, HIDDEN, AND CSS PICKS ONE. The handler redirects
// back with a fragment - #alerte-ok, #alerte-adresse-invalide - and
// `:target` reveals the matching paragraph. That is what lets the server
// render the outcome without reading searchParams, which on the calculator
// would move <title> and the canonical into the body (FW13, measured five
// ways). It also means a reader with JavaScript off sees their error: the
// alternative considered was an island-rendered status, which would have
// left a mistyped address producing no message at all.
//
// THE COST, STATED: all six messages are in the DOM on every render. They are
// `display: none`, which removes them from the accessibility tree as well as
// from view, so a screen reader encounters exactly the one that is revealed.
//
// THE RESULT IS NEVER GATED BEHIND THIS (SPEC 9.3). The card sits BELOW the
// result panel, it is not a dialog, it does not overlay, and nothing about
// the calculation depends on it.

import { ALERT_STATUS, statusFragment, statusMessage } from '@/lib/alerts/status';
import { ALERTES_COPY } from '@/lib/fr/alertes';
import type { Source } from '@/lib/alerts/subscribe';
import styles from './AlertCapture.module.scss';

export interface AlertCaptureProps {
  /**
   * Where this card is. Recorded on the row, and it decides which page the
   * handler returns the reader to.
   */
  readonly source: Source;
}

/** The field ids, unique per source so two cards could never collide. */
const fieldId = (source: Source): string => `alerte-email-${source}`;

export function AlertCapture({ source }: AlertCaptureProps): React.ReactElement {
  return (
    <section aria-labelledby={`${fieldId(source)}-titre`} className={styles.card}>
      <h2 className={styles.heading} id={`${fieldId(source)}-titre`}>
        {ALERTES_COPY.heading}
      </h2>

      <p className={styles.intro}>{ALERTES_COPY.intro}</p>

      {/*
        THE STATUS MESSAGES, ALL OF THEM, HIDDEN. `:target` reveals the one the
        handler named in the fragment. role="status" so that a scripted reader
        moving focus here has it announced; the CSS does the showing either
        way.
      */}
      <div className={styles.statuses}>
        {Object.values(ALERT_STATUS).map((status) => (
          <p
            className={status === ALERT_STATUS.ok ? styles.ok : styles.error}
            id={statusFragment(status)}
            key={status}
            role="status"
            tabIndex={-1}
          >
            {statusMessage(status)}
          </p>
        ))}
      </div>

      <form action="/api/alertes" className={styles.form} method="post">
        {/*
          The source is fixed by the page, not chosen by the reader. It decides
          which page they come back to, through a closed map in the handler -
          never a URL in a form field.
        */}
        <input name="source" type="hidden" value={source} />

        {/*
          THE SCENARIO, so submitting does not cost the reader their result
          (AC2). Empty here and filled by the island when there is one: with
          no JavaScript there is no scenario on this page to lose, because the
          calculator does not compute without it.
        */}
        <input data-alert-scenario name="scenario" type="hidden" value="" />

        <label className={styles.label} htmlFor={fieldId(source)}>
          {ALERTES_COPY.emailLabel}
        </label>

        <div className={styles.row}>
          <input
            autoComplete="email"
            className={styles.input}
            id={fieldId(source)}
            inputMode="email"
            name="email"
            // NOT type="email". The browser's own validation is a convenience
            // for some readers and absent for others, and its message is in
            // the browser's language, not the page's. The server validates
            // every submission either way, so this keeps one behaviour and
            // one French sentence rather than two of each.
            type="text"
          />

          <button className={styles.submit} type="submit">
            {ALERTES_COPY.submit}
          </button>
        </div>

        <p className={styles.helper}>{ALERTES_COPY.helper}</p>
      </form>
    </section>
  );
}
