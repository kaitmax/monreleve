// web/app/page.tsx
import { APP_NAME } from '@/lib/fr';
import { formatDays } from '@/lib/ui/core/format/number';

// The figure exists to prove tabular numerals are active (FW1 AC1). It goes
// through formatDays rather than being quoted: lib/fr used to carry the
// rendered string '1 234,5' with a hand-typed U+202F in it, which is a second
// producer of the one codepoint SPEC 6.4 mandates, sitting next to the
// formatter that is supposed to be the only one. Its own comment nominated
// FW6 to remove it.
const TABULAR_PROOF_DAYS = 1234.5;

export default function HomePage() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      {/* Carries the tabular-numeral proof for FW1 AC1; replaced by the real
          home page at FW20. */}
      <figure className="u-tnum" data-testid="tabular-proof">
        {formatDays(TABULAR_PROOF_DAYS)}
      </figure>
    </main>
  );
}
