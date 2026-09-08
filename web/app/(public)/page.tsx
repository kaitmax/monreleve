// web/app/(public)/page.tsx
//
// A PLACEHOLDER home. FW20 builds the real one; this exists so the public
// shell is visible and so "/" is not a blank route while the legal pages are
// built around it.
//
// It owns the h1, which PublicShell deliberately does not emit - one per page,
// and the page is the only thing that knows what its heading is.
//
// THE TABULAR FIGURE STAYS, and it is not decoration. It is FW1 AC1's
// artifact: the proof that Inter is reaching a page with tabular numerals ON,
// which only a real browser can answer and which e2e/home.spec.ts asserts
// three ways - the feature settings, the variant property, and that the woff2
// actually arrived with a 200 rather than the stack merely being declared.
//
// It could have moved to the workbench, and that would have been worse: the
// workbench is a dev route, and the claim worth holding is about a PUBLIC
// page. FW20 should keep an equivalent assertion when it replaces this file.

import type { Metadata } from 'next';
import { HOME_COPY } from '@/lib/fr';
import { formatDays } from '@/lib/ui/core/format/number';

// The title stays the layout's default - the bare product name for "/" -
// while the description is this page's own. A site-wide default description
// would apply to any page that forgot one, which is how every page ends up
// with the same snippet in a search result.
export const metadata: Metadata = {
  description: HOME_COPY.description,
};

// Through formatDays rather than quoted. lib/fr used to carry the rendered
// string with a hand-typed U+202F in it, which made a second producer of the
// one codepoint SPEC 6.4 mandates, sitting beside the formatter that is
// supposed to be the only one.
const TABULAR_PROOF_DAYS = 1234.5;

export default function HomePage() {
  return (
    <main>
      <h1>{HOME_COPY.heading}</h1>
      <p>{HOME_COPY.intro}</p>

      {/* FW1 AC1's tabular-numeral proof. See the module comment. */}
      <figure className="u-tnum" data-testid="tabular-proof">
        {formatDays(TABULAR_PROOF_DAYS)}
      </figure>
    </main>
  );
}
