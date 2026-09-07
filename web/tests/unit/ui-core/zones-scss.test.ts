// web/tests/unit/ui-core/zones-scss.test.ts
//
// The stale check for the generated lib/ui/core/styles/_zones.scss, plus the
// guards that stylelint structurally cannot provide.
//
// SPEC section 20 Never: "keep zones.ts the single source." The SCSS carries
// the same Zone -> colour and Status -> colour mapping as
// lib/ui/core/zone-tokens.ts, and two copies of a mapping drift silently
// because nothing renders both at once.
//
// This is the check's primary home, because `pnpm test` runs it and CI runs
// the test suite BEFORE `pnpm build`. `pnpm zones:check` runs the same
// comparison as a command on prebuild, so drift also fails the build.
// Ordering matters and is not incidental: the build must never REGENERATE,
// or a hand edit is overwritten before anything can see it.
//
// WHY STYLELINT IS NOT ENOUGH. scale-unlimited/declaration-strict-value does
// not inspect custom-property declarations at all - verified by linting a
// candidate file, where `--zone-compliant-colour: #15803d` passes clean. The
// generated file is entirely custom properties, so it sits in the one blind
// spot of the rule that exists to forbid raw values. The hex check and the
// token-existence check below are therefore load-bearing rather than belt
// and braces.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';
import { ZONE_BAND_TOKEN } from '@/lib/ui/core/zone-tokens';
import { renderZonesScss } from '../../../scripts/generate-zones-scss.mjs';

const STYLES = join(process.cwd(), 'lib', 'ui', 'core', 'styles');
const TARGET = join(STYLES, '_zones.scss');

/** Repo-relative and POSIX-style, which is what git wants on every OS. */
const TARGET_FOR_GIT = 'lib/ui/core/styles/_zones.scss';

const onDisk = () => readFileSync(TARGET);
const expected = () => Buffer.from(renderZonesScss(ZONE_BAND_TOKEN), 'utf8');

/**
 * The file with its `//` comments removed.
 *
 * Needed because the generated header explains the design in prose and names
 * the custom properties the file DEFINES - "the rail fills with
 * var(--zone-colour)". Scanning the raw text for var() references therefore
 * reports --zone-colour and --status-colour as undefined tokens, which is the
 * test being wrong rather than the file. Only declarations are inspected, the
 * same way tests/unit/calc-engine/no-magic-thresholds.test.ts strips comments
 * and string literals before looking for threshold literals.
 */
const declarations = () => onDisk().toString('utf8').replace(/\/\/[^\n]*/g, '');

describe('_zones.scss is generated, and has not drifted', () => {
  it('is byte-for-byte what the generator produces', () => {
    // BYTES, not text, and not normalised. A comparison that normalises line
    // endings or trims trailing whitespace cannot see an EOL-only or
    // trailing-newline-only hand edit, which is the class of edit a
    // "GENERATED - DO NOT EDIT" file most often suffers. .gitattributes pins
    // LF repo-wide so that this exactness is stable across clones rather
    // than a Windows-versus-CI coin flip.
    expect(onDisk().equals(expected())).toBe(true);
  });

  it('says it is generated, and where from', () => {
    const header = onDisk().toString('utf8').split('\n').slice(0, 6).join('\n');

    expect(header).toContain('GENERATED FROM lib/ui/core/zone-tokens.ts');
    expect(header).toContain('DO NOT EDIT');
  });

  it('is LF-only with exactly one trailing newline', () => {
    // Both properties the byte comparison depends on, asserted directly so a
    // failure names the cause instead of just reporting a length mismatch.
    const text = onDisk().toString('utf8');

    expect(text).not.toContain('\r');
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('is tracked by git', () => {
    // public/fonts/ is this repo's precedent for git-ignoring generated
    // output. If _zones.scss followed it, `stylelint "{app,lib}/**/*.scss"`
    // would match nothing on a fresh clone, the generated classes would never
    // be linted, and the stale check would pass trivially by regenerating
    // what was never committed.
    expect(() =>
      execFileSync('git', ['ls-files', '--error-unmatch', TARGET_FOR_GIT], { stdio: 'pipe' }),
    ).not.toThrow();
  });
});

describe('_zones.scss carries token references and never a colour', () => {
  it('contains no hex literal', () => {
    // The check stylelint cannot do. Custom properties are wholly exempt from
    // declaration-strict-value, so a generated `:root { --zone-compliant:
    // #15803d }` would lint clean - and that shape is tempting, because FW7's
    // PDF and OG-image rail have no cascade to resolve var() against.
    expect(onDisk().toString('utf8')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('references only custom properties the token layer actually defines', () => {
    // A var() naming a token that does not exist renders as nothing in CSS -
    // no error, no colour. Looked up in the COMPILED token layer, so the
    // check follows whatever tokens.scss actually emits.
    const { css } = compileString(readFileSync(join(STYLES, 'tokens.scss'), 'utf8'));
    const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));

    const referenced = [...declarations().matchAll(/var\((--[a-z0-9-]+)\)/g)].map(
      (match) => match[1],
    );

    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((token) => !defined.has(token))).toEqual([]);
  });

  it('passes the repo stylelint config', async () => {
    // Proves the GENERATOR's output shape is lint-legal, rather than proving
    // the repo is clean after the fact. Several natural shapes are not: a
    // `//GENERATED` comment with no space trips
    // scss/double-slash-comment-whitespace-inside, consecutive rules with no
    // blank line trip rule-empty-line-before, and an empty file trips
    // no-empty-source. Without this, a change to the generator could emit an
    // unlintable file and only `pnpm lint` would notice, one step later.
    const result = await stylelint.lint({
      files: [TARGET],
      configFile: join(process.cwd(), '.stylelintrc.mjs'),
    });

    expect(result.results.flatMap((r) => r.warnings)).toEqual([]);
    expect(result.errored).toBe(false);
  });
});

describe('_zones.scss covers the mapping completely and reaches the browser', () => {
  it('emits one class per Zone and nothing at all for Status (R31)', () => {
    const text = onDisk().toString('utf8');

    for (const zone of Object.keys(ZONE_BAND_TOKEN)) {
      expect(text).toContain(`.zone-${zone} {`);
    }

    // R31. Status styling belongs to FW8, whose badge is a .tsx with a
    // COLOCATED CSS MODULE - and a module addresses its classes as styles.x,
    // so its selectors are camelCase while this global partial is kebab-case
    // (.stylelintrc.mjs enforces both). A global .status-mission-exposure is
    // therefore not consumable there: it would be dead CSS that still had to
    // be kept in step with the mapping. The badge reads the token NAMES from
    // zones.ts in TypeScript instead, which is the single source either way.
    //
    // Scanned with comments stripped: the generated header explains this very
    // ruling and names ".status-mission-exposure" in prose, so checking the
    // raw text finds the explanation and fails. Second time this file has hit
    // that - the var() check above strips comments for the same reason.
    expect(declarations()).not.toMatch(/\.status-/);

    // ...and no more than the three, so a stale class left behind by a
    // renamed Zone cannot linger.
    const classes = [...text.matchAll(/^\.([a-z-]+) \{/gm)].map((match) => match[1]);
    expect(classes.length).toBe(Object.keys(ZONE_BAND_TOKEN).length);
  });

  it('is reachable from global.scss, so the classes actually ship', () => {
    // A generated partial nobody @uses is dead weight that every check above
    // would still pass. Asserted through the COMPILER rather than by grepping
    // for the @use line, because that is what proves the rules survive to
    // CSS. Note the load is `@use "zones"` and not `"_zones"` - the leading
    // underscore is rejected by scss/load-no-partial-leading-underscore.
    const { css } = compileString(readFileSync(join(STYLES, 'global.scss'), 'utf8'), {
      loadPaths: [STYLES],
    });

    for (const zone of Object.keys(ZONE_BAND_TOKEN)) {
      expect(css).toContain(`.zone-${zone}`);
    }
  });
});
