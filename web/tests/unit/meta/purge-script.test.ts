// web/tests/unit/meta/purge-script.test.ts
//
// The script and the module state one retention rule. FW27 increment 4.
//
// ============================================================================
// WHY THERE ARE TWO COPIES AT ALL
// ============================================================================
//
// `scripts/purge-unconfirmed.mjs` types `PURGE_AFTER_DAYS = 30` and writes its
// own `deleteMany`, beside `lib/alerts/purge.ts`'s exported constant and
// query. Not from carelessness: a `.mjs` script cannot import a `.ts` module
// in this repository - `node --experimental-strip-types` needs the `.ts`
// extension on the specifier, which `tsc` rejects without
// `allowImportingTsExtensions`. lib/db/local-host.ts records the same blocker
// for the seed.
//
// ============================================================================
// SO THE DUPLICATION IS BOUNDED RATHER THAN ARGUED (R185)
// ============================================================================
//
// A comment explaining why the drift is tolerable is not a mechanism. R181
// names the failure exactly: a transcription is correct on the day it is
// written and silently wrong afterwards, with every suite green, because
// nothing connects the copy to the thing it is about.
//
// WHAT WOULD GO WRONG. Move the retention period in lib/alerts/purge.ts -
// because /confidentialite's sentence changed, which is the only reason it
// would move - and the scheduled job honours the new number while the manual
// command goes on deleting at the old one. Both are "the purge", and which one
// ran decides whether the published promise was kept.
//
// THE SCRIPT IS NOT DELETED, because until FW28 deploys the scheduler it is
// the only way to keep a promise the live site already makes.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PURGE_AFTER_DAYS } from '@/lib/alerts/purge';

const SCRIPT = readFileSync(join(process.cwd(), 'scripts/purge-unconfirmed.mjs'), 'utf8');

describe('the manual purge command agrees with the scheduled one', () => {
  it('was read, so nothing below passes vacuously (R169)', () => {
    expect(SCRIPT).toContain('alertSubscriber.deleteMany');
  });

  it('types the same number of days as lib/alerts/purge.ts exports', () => {
    const match = /const PURGE_AFTER_DAYS = (?<days>\d+);/u.exec(SCRIPT);

    expect(match, 'the script no longer declares PURGE_AFTER_DAYS').not.toBeNull();
    expect(Number(match?.groups?.days)).toBe(PURGE_AFTER_DAYS);
  });

  it('applies the same three conditions, not only the same number', () => {
    // THE NUMBER IS THE EASY HALF. A script that deleted on age alone would
    // pass the assertion above and empty the confirmed list - which is the
    // failure lib/alerts/purge.ts's header spends a paragraph refusing.
    for (const condition of ['confirmedAt: null', 'unsubscribedAt: null', 'createdAt: { lt:']) {
      expect(SCRIPT, `the script must still filter on ${condition}`).toContain(condition);
    }
  });

  it('would catch a drifted script, which is the whole point (R133)', () => {
    const drifted = SCRIPT.replace(
      `const PURGE_AFTER_DAYS = ${PURGE_AFTER_DAYS};`,
      'const PURGE_AFTER_DAYS = 90;',
    );

    const match = /const PURGE_AFTER_DAYS = (?<days>\d+);/u.exec(drifted);

    expect(Number(match?.groups?.days)).not.toBe(PURGE_AFTER_DAYS);
  });
});
