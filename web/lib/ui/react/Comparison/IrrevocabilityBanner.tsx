// web/lib/ui/react/Comparison/IrrevocabilityBanner.tsx
//
// SPEC 9.6: "a prominent error banner stating the choice is IRREVOCABLE and
// the window is THREE MONTHS". Worded from rows D1-D6 (CLEISS, corroborated
// by ameli), in the error style: the accent on the RULE and the soft error
// background, the text in text-primary (R57 - the status colour fails 4,5:1
// as body text and passes as a border). An icon AND a heading carry it, never
// the colour alone (SPEC 16).
//
// role="note", not role="alert": it is standing content present from the
// first render, not an event; an alert role on load is read out before the
// page's own heading.

import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import { Notice } from '@/lib/ui/react/Notice/Notice';

// FW-CALCS-A2 (R729, R733): the shared error-style banner - a full error
// border on the soft fill, a warning icon, the heading - with this banner's
// own words and link, unchanged. Rendered by the page now, above the form
// and the result (R642).
export function IrrevocabilityBanner() {
  return (
    <Notice
      element="aside"
      heading={COPY.banner.heading}
      headingId="irrevocable-titre"
      aria-labelledby="irrevocable-titre"
      data-banner="irrevocable"
    >
      <p>{COPY.banner.body}</p>
      <p>
        <a href={COPY.banner.link.href}>{COPY.banner.link.text}</a>
      </p>
    </Notice>
  );
}
