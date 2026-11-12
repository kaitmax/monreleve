// web/tests/unit/meta/scratch-database-census.test.ts
//
// ============================================================================
// R877: EVERY SCRIPT THAT CREATES A DATABASE NAMES IT BY THE ONE PATTERN
// ============================================================================
//
// test:db refuses any DATABASE_URL whose database does not match
// SCRATCH_DATABASE_PATTERN (lib/db/scratch-database.mjs). That refusal is only
// safe to live with if every script that MAKES a throwaway database makes one
// the guard admits - otherwise the next harness invents a name, test:db
// refuses it, and the tempting fix is to widen the pattern until it admits
// `frontalier` again.
//
// So this file finds every CREATE DATABASE site in the package and resolves
// the name each one creates. A site is accepted in exactly two shapes:
//
//   FROM THE HOME. The name is assigned from scratchDatabaseName(), imported
//   from lib/db/scratch-database.mjs, which throws on a name outside the
//   pattern (test-db-guard.test.ts proves it throws). gate-clone.mjs and the
//   fw14 migration test take their names this way.
//
//   A LITERAL, ASSERTED HERE. The name is a string literal in the same file,
//   and this test asserts it against the pattern. The four container/restore
//   harnesses and the FW30 dataset script are asserted this way rather than
//   edited: each of them selects its own container suite in gate:changed
//   (R247), and test:container:e2e is red on a parked task, so editing them to
//   import a name they already spell correctly would buy a gate nobody can
//   pass for no change in behaviour.
//
// Anything else - a name built at run time, read from somewhere else, or a
// shape this resolver does not know - FAILS, naming the file and line, so a
// sixth script cannot invent a name the guard refuses without this saying so.
//
// DERIVED, NOT LISTED (R181). The sites are found by walking the package, so
// a new script is covered on the day it is written. The walk OVER-matches
// (case-insensitive, anywhere outside a comment line): the safe direction,
// because an over-match fails loudly and an under-match is silent.
//
// WHAT IT DOES NOT WALK, AND WHY. tests/unit/: `pnpm test` runs with no
// database by construction (vitest.config.ts excludes tests/db/** for exactly
// that reason, and gate:clone scrubs DATABASE_URL from it), so a CREATE
// DATABASE there is text ABOUT creation - this file's own fixtures, and the
// refusal message test-db-guard.test.ts asserts - never a creation.
//
// STATED LIMIT: it reads the web package, where test:db and every harness that
// hands test:db a database live. android/scripts/ also creates databases on
// the same server for walkthroughs (monreleve_an5c, monreleve_anaudit); they
// match the pattern today, never run test:db, and are outside this walk.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SCRATCH_DATABASE_PATTERN, judgeTestDatabase } from '../../../lib/db/scratch-database.mjs';

const WEB = join(import.meta.dirname, '..', '..', '..');
const UNIT_TESTS = join(WEB, 'tests', 'unit');

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.cjs'];

/** Generated or vendored trees: nothing in them is ours to name. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'public',
  'test-results',
  'playwright-report',
  'dist-parity',
  'coverage',
]);

function codeFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // .next, .next-dev-routes, .lighthouseci and every other dot-directory
      // are build output or tool state.
      if (entry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(entry.name)) continue;
      if (join(dir, entry.name) === UNIT_TESTS) continue;
      codeFiles(join(dir, entry.name), found);
      continue;
    }

    if (CODE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      found.push(join(dir, entry.name));
    }
  }

  return found;
}

/** One CREATE DATABASE site and what it creates. */
interface Site {
  readonly file: string;
  readonly line: number;
  /** The database names the site was resolved to, or none when it was not. */
  readonly names: readonly string[];
  /** 'literal' | 'home' | the reason it could not be resolved. */
  readonly how: string;
}

const CREATE = /\bcreate\s+database\b/iu;
const HOME_SPECIFIER = /from\s+['"][^'"]*lib\/db\/scratch-database\.mjs['"]/u;
const IMPORTS_NAME_FROM_HOME = (source: string): boolean =>
  HOME_SPECIFIER.test(source) && /\bscratchDatabaseName\b/u.test(source);

const isCommentLine = (text: string): boolean => /^\s*(?:\/\/|\/\*|\*)/u.test(text);

/**
 * Every value assigned to `identifier` in `source`, resolved.
 *
 * Each assignment must be a string literal (asserted against the pattern by
 * the caller), a call to scratchDatabaseName(), or null/undefined (a variable
 * declared before it is named, as gate-clone.mjs does). Anything else is
 * unresolved - including a template literal with a substitution, whose value
 * this cannot know.
 */
function resolveIdentifier(source: string, identifier: string): Omit<Site, 'file' | 'line'> {
  const assignment = new RegExp(`\\b${identifier}\\s*=(?!=)\\s*([^;\\n]+)`, 'gu');
  const names: string[] = [];
  let fromHome = false;
  let assignments = 0;

  for (const match of source.matchAll(assignment)) {
    const value = (match[1] ?? '').trim();

    assignments += 1;

    const literal = /^(['"`])([^'"`$\\]*)\1$/u.exec(value);

    if (literal !== null) {
      names.push(literal[2] ?? '');
      continue;
    }

    if (/^(?:null|undefined)$/u.test(value)) continue;

    if (/^scratchDatabaseName\(/u.test(value) && IMPORTS_NAME_FROM_HOME(source)) {
      fromHome = true;
      continue;
    }

    return { names: [], how: `${identifier} is assigned a value this cannot resolve: ${value}` };
  }

  if (assignments === 0) {
    return { names: [], how: `${identifier} is never assigned in this file` };
  }

  if (fromHome && names.length === 0) return { names: [], how: 'home' };
  if (!fromHome && names.length > 0) return { names, how: 'literal' };
  if (fromHome) return { names, how: 'home+literal' };

  return { names: [], how: `${identifier} is only ever null` };
}

function sitesIn(file: string): Site[] {
  const source = readFileSync(file, 'utf8');
  const path = relative(WEB, file).split('\\').join('/');
  const sites: Site[] = [];

  source.split('\n').forEach((text, index) => {
    if (!CREATE.test(text) || isCommentLine(text)) return;

    const site = { file: path, line: index + 1 };
    const fromIdentifier = /create\s+database\s+"?\$\{\s*([A-Za-z_$][\w$]*)\s*\}"?/iu.exec(text);

    if (fromIdentifier !== null) {
      sites.push({ ...site, ...resolveIdentifier(source, fromIdentifier[1] ?? '') });
      return;
    }

    const fromLiteral = /create\s+database\s+"?([A-Za-z0-9_]+)"?/iu.exec(text);

    if (fromLiteral !== null) {
      sites.push({ ...site, names: [fromLiteral[1] ?? ''], how: 'literal' });
      return;
    }

    sites.push({ ...site, names: [], how: `cannot read the name in: ${text.trim()}` });
  });

  return sites;
}

const SITES = codeFiles(WEB).flatMap(sitesIn);

describe('R877: every CREATE DATABASE site in the package names a scratch database', () => {
  it('found the sites, so nothing below passes vacuously (R169\'s presence corollary)', () => {
    expect(SITES.length).toBeGreaterThan(0);
    // gate:clone is the creator that runs test:db on what it creates; if the
    // walk cannot see it, the walk is broken.
    expect(SITES.some((site) => site.file === 'scripts/gate-clone.mjs')).toBe(true);
  });

  it.each(SITES.map((site) => [`${site.file}:${site.line}`, site] as const))(
    '%s',
    (_where, site) => {
      expect(['literal', 'home', 'home+literal'], site.how).toContain(site.how);

      for (const name of site.names) {
        expect(SCRATCH_DATABASE_PATTERN.test(name), `${name} is outside ${SCRATCH_DATABASE_PATTERN.source}`).toBe(true);
      }
    },
  );

  it('gate:clone takes its name from the home, because it is the one that runs test:db on it', () => {
    const gateClone = SITES.filter((site) => site.file === 'scripts/gate-clone.mjs');

    expect(gateClone.length).toBeGreaterThan(0);
    for (const site of gateClone) expect(site.how).toBe('home');
  });
});

describe('the resolver itself refuses what it cannot read (R180: a check proven to fire)', () => {
  it('a template literal with a substitution is unresolved', () => {
    const verdict = resolveIdentifier('const DB = `monreleve_${suffix}`;\n', 'DB');

    expect(verdict.how).toMatch(/cannot resolve/u);
  });

  it('a literal outside the pattern resolves, and fails the pattern', () => {
    const verdict = resolveIdentifier("const DB = 'frontalier_test';\n", 'DB');

    expect(verdict).toEqual({ names: ['frontalier_test'], how: 'literal' });
    expect(SCRATCH_DATABASE_PATTERN.test('frontalier_test')).toBe(false);
  });

  it('a reassignment to something unreadable makes the whole identifier unresolved', () => {
    const verdict = resolveIdentifier("let DB = 'monreleve_x';\nDB = process.env.X;\n", 'DB');

    expect(verdict.how).toMatch(/cannot resolve/u);
  });

  it('scratchDatabaseName() without the import from the home is unresolved', () => {
    const verdict = resolveIdentifier("const DB = scratchDatabaseName('x');\n", 'DB');

    expect(verdict.how).toMatch(/cannot resolve/u);
  });

  it('scratchDatabaseName() imported from the home resolves as the home', () => {
    const source =
      "import { scratchDatabaseName } from '../lib/db/scratch-database.mjs';\n" +
      "let DB = null;\nDB = scratchDatabaseName(`gate_clone_${head}`);\n";

    expect(resolveIdentifier(source, 'DB').how).toBe('home');
  });
});

// ============================================================================
// R879: CI NAMES ITS THROWAWAY DATABASE BY THE SAME PATTERN
// ============================================================================
//
// CI's `services: postgres` database is scratch by construction - the runner
// is thrown away - but it used to be called `frontalier`, the same name as the
// shared development database. With R877's guard, `pnpm test:db` and
// container-e2e's direct vitest run would refuse it, and the tempting fix is
// an opt-out variable: an exemption list of one, which grows. So CI's database
// is named by the pattern instead, and this asserts it, everywhere a workflow
// names a database: the service's POSTGRES_DB, a health check's `-d`, and the
// database path of every connection string.
//
// CI IS OFF (R248), so no workflow run can show this. What can be shown here
// is that every name the workflows give passes the very predicate test:db
// applies, and that each connection string names a database a service in the
// same workflow actually creates - so a half-applied rename (R267's shape)
// fails here rather than at the first CI run after it returns.

const WORKFLOWS = join(WEB, '..', '.github', 'workflows');

interface CiName {
  readonly where: string;
  readonly kind: 'POSTGRES_DB' | 'pg_isready -d' | 'connection string';
  readonly database: string | null;
  readonly admitted: boolean;
}

function ciNames(): { names: CiName[]; created: Map<string, Set<string>> } {
  const names: CiName[] = [];
  const created = new Map<string, Set<string>>();

  for (const file of readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/u.test(name))) {
    const lines = readFileSync(join(WORKFLOWS, file), 'utf8').split('\n');
    const databases = new Set<string>();

    created.set(file, databases);

    lines.forEach((text, index) => {
      if (/^\s*#/u.test(text)) return;

      const where = `${file}:${index + 1}`;
      const service = /\bPOSTGRES_DB:\s*['"]?([^'"\s]+)/u.exec(text);

      if (service?.[1] !== undefined) {
        databases.add(service[1]);
        names.push({ where, kind: 'POSTGRES_DB', database: service[1], admitted: SCRATCH_DATABASE_PATTERN.test(service[1]) });
      }

      const health = /\bpg_isready\b[^\n]*?\s-d\s+['"]?([^'"\s]+)/u.exec(text);

      if (health?.[1] !== undefined) {
        names.push({ where, kind: 'pg_isready -d', database: health[1], admitted: SCRATCH_DATABASE_PATTERN.test(health[1]) });
      }

      for (const match of text.matchAll(/postgres(?:ql)?:\/\/[^\s'"]+/gu)) {
        const verdict = judgeTestDatabase(match[0]);

        names.push({ where, kind: 'connection string', database: verdict.database, admitted: verdict.admitted });
      }
    });
  }

  return { names, created };
}

const CI = ciNames();

describe('R879: every database a CI workflow names is a scratch database', () => {
  it('found the service database and the connection strings, so nothing below passes vacuously', () => {
    expect(CI.names.some((name) => name.kind === 'POSTGRES_DB')).toBe(true);
    expect(CI.names.some((name) => name.kind === 'connection string')).toBe(true);
  });

  it.each(CI.names.map((name) => [`${name.where} ${name.kind}`, name] as const))('%s', (_where, name) => {
    expect(name.admitted, `${String(name.database)} is outside ${SCRATCH_DATABASE_PATTERN.source}`).toBe(true);
  });

  it('every connection string names a database a service in the same workflow creates', () => {
    for (const name of CI.names.filter((each) => each.kind === 'connection string')) {
      const file = name.where.split(':')[0] ?? '';

      expect(CI.created.get(file)?.has(name.database ?? ''), `${name.where} names ${String(name.database)}`).toBe(true);
    }
  });
});
