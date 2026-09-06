// web/app/page.tsx
import { APP_NAME, TABULAR_PROOF_FIGURE } from '@/lib/fr';

export default function HomePage() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      {/* Carries the tabular-numeral proof for FW1 AC1; replaced by the real
          home page at FW20. */}
      <figure className="u-tnum" data-testid="tabular-proof">
        {TABULAR_PROOF_FIGURE}
      </figure>
    </main>
  );
}
