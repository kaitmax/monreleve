// web/tests/unit/meta/api-contract-doc.test.ts
//
// docs/api-v1.md documents exactly the fields the code accepts and returns.
// FW23 increment 5.
//
// ============================================================================
// THE DOCUMENT AND THE CONTRACT CANNOT DRIFT
// ============================================================================
//
// R206: one text, one home. The field NAMES live in the schema and in
// lib/entries/read.ts; the document holds prose ABOUT them. This test is the
// join, and without it the document is a transcription - correct the day it was
// written and silently wrong afterwards, with every suite green (R181).
//
// It matters more here than anywhere else in the repository, because FW23
// FREEZES these names. A field renamed in code and not in the document sends a
// client author to implement the wrong contract, and the cost of that is a
// migration plus an app release plus every version still in the field (R187).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENTRY_ITEM_FIELDS } from '@/lib/entries/schema';
import { ENTRY_READ_FIELDS } from '@/lib/entries/read';

const DOC = join(process.cwd(), '..', 'docs', 'api-v1.md');
const SOURCE = readFileSync(DOC, 'utf8');

/**
 * The field names a marked block documents.
 *
 * DELIMITED BY EXPLICIT MARKERS rather than by "the table after heading X".
 * FW22's increment 6 lost an edit to a parser that read 26 items where there
 * were 10, because it inferred structure from formatting. A marker is a
 * decision written down; a heuristic is a guess that works until somebody adds
 * a paragraph.
 */
function documented(block: string): string[] {
  const open = `<!-- fields:${block} -->`;
  const close = `<!-- /fields:${block} -->`;
  const from = SOURCE.indexOf(open);
  const to = SOURCE.indexOf(close);

  // R133: a POSITIVE signal that the block was found. A missing marker would
  // otherwise yield an empty list, and "the document lists no fields" would
  // compare equal to nothing rather than failing.
  expect(from, `the marker ${open} is missing from docs/api-v1.md`).toBeGreaterThan(-1);
  expect(to, `the marker ${close} is missing from docs/api-v1.md`).toBeGreaterThan(from);

  const rows = SOURCE.slice(from + open.length, to).split('\n');

  return rows
    .filter((row) => row.trimStart().startsWith('|'))
    .map((row) => /^\s*\|\s*`([^`]+)`/u.exec(row)?.[1])
    .filter((name): name is string => name !== undefined)
    .sort();
}

describe('docs/api-v1.md documents exactly what the code accepts', () => {
  it('found the document, so nothing below passes vacuously', () => {
    expect(SOURCE.length).toBeGreaterThan(1000);
    expect(SOURCE).toContain('FROZEN AS OF FW23');
  });

  it('documents every field the write schema accepts, and no others', () => {
    // BOTH DIRECTIONS, and each is a different failure. A field in the code and
    // not the document is a contract a client author cannot discover. A field
    // in the document and not the code is a promise the server will reject with
    // `invalid_payload`, discovered by whoever writes the client.
    expect(documented('write')).toEqual([...ENTRY_ITEM_FIELDS].sort());
  });

  it('documents every field the read path returns, and no others', () => {
    expect(documented('read')).toEqual([...ENTRY_READ_FIELDS].sort());
  });

  it('found a non-trivial number of fields in each block', () => {
    // The equality tests above are satisfied by two empty lists if both the
    // parser and the constants broke together. This is the floor under them.
    expect(documented('write').length).toBeGreaterThan(5);
    expect(documented('read').length).toBeGreaterThan(5);
  });

  it('documents every error code the routes can return', () => {
    // NOT DERIVED FROM A CONSTANT, because the codes are spread across the
    // route handlers, the bearer guard and the write path - and inventing a
    // registry purely to satisfy a test would move the contract into a place no
    // route reads from. So the document is checked to MENTION each code, and
    // the source is what is scanned for candidates.
    const codes = [
      'missing_token',
      'invalid_token',
      'expired_token',
      'revoked_session',
      'payload_too_large',
      'malformed_body',
      'coordinates_refused',
      'invalid_payload',
      'conflict',
      'write_failed',
      'invalid_year',
      'unknown_parameter',
      'read_failed',
    ];

    for (const code of codes) {
      expect(SOURCE, `docs/api-v1.md does not mention the code \`${code}\``).toContain(
        `\`${code}\``,
      );
    }
  });

  it('says what the freeze forbids, not merely that it is frozen (R217)', () => {
    // WITHOUT THIS THE DOCUMENT IS AMBIGUOUS IN THE EXPENSIVE DIRECTION. A
    // session reading "FROZEN" as "nothing changes" leaves improvements unmade
    // that break nobody - which is how the POST answer nearly kept its two
    // round trips. The three forbidden operations are named, and so is the one
    // that stays free.
    expect(SOURCE).toContain('**Renaming**');
    expect(SOURCE).toContain('**Removing**');
    expect(SOURCE).toContain('**Changing what an existing field MEANS**');
    expect(SOURCE).toContain('**Adding a field to a RESPONSE**');

    // AND THE ASYMMETRY, which is the half a reader gets wrong: a response may
    // gain a key freely, a request may not gain a REQUIRED one.
    expect(SOURCE).toContain('**Adding a field to a REQUEST is not free**');
  });

  it('distinguishes a replay from a late write, and says which is open (R219)', () => {
    // TWO FAILURES WITH ONE SYMPTOM, and a document that described only the
    // fixed one would tell a client author the problem is solved. A replay of
    // an old mutation is refused; a genuinely NEW mutation arriving late still
    // wins on server receipt and still reverts a day to older content.
    //
    // The second is a change to a STATED RULE (SPEC 13.2's receipt ordering)
    // rather than to an implementation, so it is parked with its mechanism
    // written down rather than decided quietly - and this assertion is what
    // stops the parking note being tidied away by somebody who reads the
    // replay fix and assumes the section is finished.
    expect(SOURCE).toContain('A replay is recognised by the trail, not by the current row');
    expect(SOURCE).toContain('**What is NOT closed');
    expect(SOURCE).toContain('server receipt');

    // AND THE CLIENT-FACING CONSEQUENCE, which is the only part a client author
    // can act on today.
    expect(SOURCE).toContain('a client should');
    expect(SOURCE).toContain(
      'not assume the last write it sent is the one the server kept',
    );
  });

  it('tells a client it must surface warnings, not only figures', () => {
    // THE ONE CLIENT OBLIGATION ABOUT HONESTY RATHER THAN PARSING, and the
    // easiest to drop because the figures alone look complete.
    //
    // Only 2026 has a rule set. ruleSetFor applies the latest known rules to
    // any other year without refusing, so a 2019 calculation runs under 2026
    // thresholds - honest only because the engine warns which year it applied.
    // A client that renders the rate and discards the warning publishes a
    // figure derived from rules that did not exist in the year it describes.
    //
    // lib/dossier is held to this by three tests. AN11 will read this document
    // rather than any report, so the sentence has to be here - and this test
    // is what stops it being tidied out of a section about parsing.
    expect(SOURCE).toContain('Surface every');
    expect(SOURCE).toContain('ruleSetFor');

    // AND THE REASON, not just the instruction. An obligation with no stated
    // consequence is the kind a client author reads as boilerplate.
    expect(SOURCE).toContain('that did not exist in the year it claims');
  });

  it('carries the freeze and says what a version costs', () => {
    // R160's shape on a contract document: the marker states the status rather
    // than implying a process nobody wrote down.
    expect(SOURCE).toContain('requires a **version**, not an\nedit');
    expect(SOURCE).toContain('/api/v2/entries');
  });
});
