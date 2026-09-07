// web/tests/harness.test.ts
// Smoke test for the unit harness: it proves Vitest runs, that the "@" path
// alias declared in tsconfig.json resolves, and that TypeScript sources under
// lib/ are loadable. It asserts nothing about behaviour - there is none yet.

import { describe, expect, it } from 'vitest';
import * as calcEngine from '@/lib/calc-engine';
import { APP_NAME } from '@/lib/fr';

describe('unit harness', () => {
  it('resolves the tsconfig path alias into lib/calc-engine', () => {
    // Asserts the alias resolves, not what the module contains: the engine's
    // export list grows with every FW3-FW5 increment, and pinning it here
    // would make this harness test fail for reasons that are not about the
    // harness. What the engine exports is asserted in tests/unit/calc-engine.
    expect(calcEngine).toBeTypeOf('object');
    expect(calcEngine).not.toBeNull();
  });

  it('loads lib/fr through the same alias', () => {
    expect(APP_NAME).toBe('frontalier');
  });
});
