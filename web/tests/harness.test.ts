// web/tests/harness.test.ts
// Smoke test for the unit harness: it proves Vitest runs, that the "@" path
// alias declared in tsconfig.json resolves, and that TypeScript sources under
// lib/ are loadable. It asserts nothing about behaviour - there is none yet.

import { describe, expect, it } from 'vitest';
import * as calcEngine from '@/lib/calc-engine';
import { APP_NAME } from '@/lib/fr';

describe('unit harness', () => {
  it('resolves the tsconfig path alias into lib/calc-engine', () => {
    expect(Object.keys(calcEngine)).toEqual([]);
  });

  it('loads lib/fr through the same alias', () => {
    expect(APP_NAME).toBe('frontalier');
  });
});
