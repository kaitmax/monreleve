// web/tests/unit/meta/dockerfile-args.test.ts
//
// ============================================================================
// R859: THE ARG SET IS A STATED VALUE
// ============================================================================
//
// web/Dockerfile declares exactly three build arguments - NODE_IMAGE,
// CHROMIUM_VERSION, NEXT_PUBLIC_SITE_URL - no more, no fewer. This test
// states that set and asserts it (R345: state the value, assert the value).
//
// WHY A BUILD ARGUMENT IS WORTH A TEST. Every ARG in scope of a RUN is
// recorded in the image's history WITH ITS VALUE: `docker history --no-trunc`
// of the current image reads `RUN |2 CHROMIUM_VERSION=... NEXT_PUBLIC_SITE_URL=...
// /bin/sh -c ...`, and the ARG instruction itself is recorded as
// `ARG NAME=value`. An image is copied to every server and registry it
// reaches, so a fourth ARG that carried a credential would publish that
// credential with the image. REPORT-FW-CHROMIUM.txt section 4 found two
// secrets marked build-time in Coolify; R858 checks the built image's history
// for every secret name, and this test keeps the Dockerfile itself from
// growing a door for one.
//
// A NEW ARG IS NOT FORBIDDEN, IT IS DELIBERATE. Adding one means editing the
// set below, in the same commit, with a reason - which is the point: the set
// changes by a decision somebody wrote down, never by a line nobody noticed.
//
// THE PARSER IS TESTED FIRST (R154). A parser that found no ARG at all would
// make the second assertion fail loudly, but one that found only some - say,
// not a lower-case `arg`, or not the second name in `ARG A B` - could agree
// with a stated set while a real fourth declaration went unseen. So it is
// driven against every form the Dockerfile language allows before it is
// trusted with the real file.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DOCKERFILE = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8');

/** The stated value (R345). Sorted, so the comparison is order-free. */
const STATED_ARGS = ['CHROMIUM_VERSION', 'NEXT_PUBLIC_SITE_URL', 'NODE_IMAGE'];

/**
 * The Dockerfile's logical instructions, one string each.
 *
 * A trailing backslash continues an instruction onto the next line, and a
 * comment line inside a continuation is dropped without ending it - Docker's
 * own rules. So a line reading `ARG X` inside a RUN's continuation is shell
 * text, not an instruction, and a `# ARG X` is a comment either way.
 */
function instructions(source: string): string[] {
  const result: string[] = [];
  let current: string[] = [];

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();

    if (line.startsWith('#')) continue;
    if (line === '' && current.length === 0) continue;

    if (line.endsWith('\\')) {
      current.push(line.slice(0, -1));
      continue;
    }

    current.push(line);
    result.push(current.join(' ').trim());
    current = [];
  }

  if (current.length > 0) result.push(current.join(' ').trim());

  return result;
}

/** Every name an ARG instruction declares, unique and sorted. */
function declaredArgs(source: string): string[] {
  const names = new Set<string>();

  for (const instruction of instructions(source)) {
    const match = /^ARG\s+(.+)$/i.exec(instruction);

    if (match === null) continue;

    // `ARG A`, `ARG A=1`, `ARG A=1 B` - each token names one argument.
    for (const token of (match[1] ?? '').split(/\s+/)) {
      const name = /^([A-Za-z_][A-Za-z0-9_]*)(?:=|$)/.exec(token)?.[1];

      if (name !== undefined) names.add(name);
    }
  }

  return [...names].sort();
}

describe('R859: the parser sees every ARG form before it is trusted', () => {
  it('finds plain, lower-case, assigned, multi-name and continued declarations', () => {
    const sample = [
      'ARG GLOBAL_ONE=1',
      'FROM scratch AS one',
      'arg lower_case',
      'ARG FIRST=1 SECOND',
      'ARG CONTINUED_A \\',
      '    CONTINUED_B="two"',
      'RUN echo start \\',
      '    # a comment inside a continuation does not end it',
      '    && echo ARG NOT_AN_INSTRUCTION',
      '# ARG COMMENTED_OUT',
    ].join('\n');

    expect(declaredArgs(sample)).toEqual([
      'CONTINUED_A',
      'CONTINUED_B',
      'FIRST',
      'GLOBAL_ONE',
      'SECOND',
      'lower_case',
    ]);
  });
});

describe('R859: web/Dockerfile declares exactly the stated build arguments', () => {
  it('declares NODE_IMAGE, CHROMIUM_VERSION and NEXT_PUBLIC_SITE_URL - no more, no fewer', () => {
    expect(
      declaredArgs(DOCKERFILE),
      'a change to the ARG set is a decision: edit STATED_ARGS in this file, with the reason, ' +
        'in the same commit - and never declare a secret as a build argument (R858)',
    ).toEqual(STATED_ARGS);
  });
});
