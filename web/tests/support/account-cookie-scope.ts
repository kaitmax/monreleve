// web/tests/support/account-cookie-scope.ts
//
// R900's STATIC HALF: which files can read or write the account cookie, and
// whether any public route's module graph reaches them. One implementation,
// used by tests/unit/meta/account-cookie-scope.test.ts and by
// tests/db/privacy-claims.test.ts's CLAIM 1, so the census and the privacy
// claim it backs cannot measure two different things.
//
// THE RUNTIME HALF is e2e/mon-releve.spec.ts: a signed-in browser visits every
// public route and the request carries no Cookie header and the response no
// Set-Cookie. This half is what makes that crawl's result structural rather
// than lucky - no public route CAN read the cookie, because nothing it imports
// knows the cookie exists.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

export const WEB = process.cwd();
const APP = join(WEB, 'app');

/** The one module that names, writes and parses the cookie. */
export const COOKIE_MODULE = join(WEB, 'lib', 'web-account', 'cookie.ts');

/** Where an importer of the cookie module may live. */
export const ACCOUNT_ROOTS = [join(APP, '(account)'), join(WEB, 'lib', 'web-account')];

/**
 * A READ OF A REQUEST COOKIE, in any of the forms Next and the platform offer:
 * next/headers' cookies(), NextRequest.cookies, or the raw Cookie header.
 */
export const COOKIE_READ = /\bcookies\s*\(|\.cookies\b|get\(\s*['"]cookie['"]\s*\)/u;

const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.mjs', '/index.ts', '/index.tsx'];

const posix = (path: string): string => relative(WEB, path).split(sep).join('/');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
}

function specifiersOf(source: string): string[] {
  return [...source.matchAll(/(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/gu)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined);
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;

  if (specifier.startsWith('@/')) base = join(WEB, specifier.slice(2));
  else if (specifier.startsWith('./') || specifier.startsWith('../')) base = join(dirname(fromFile), specifier);
  else return null;

  for (const extension of EXTENSIONS) {
    const candidate = base + extension;

    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
}

/**
 * ONE READ AND ONE RESOLUTION PER FILE (W12). The census walks every routing
 * file's import graph, and those graphs share almost every module: read afresh
 * per entry point, the same files were read and resolved once per entry, and
 * the walk outgrew tests/db's 10 s timeout on a loaded machine (privacy-claims
 * CLAIM 1). Memoised, it asserts exactly what it did - the same closure, the
 * same reads - and reads each file once per process.
 */
const STRIPPED = new Map<string, string>();
const RESOLVED = new Map<string, readonly string[]>();

function strippedSourceOf(file: string): string {
  let source = STRIPPED.get(file);

  if (source === undefined) {
    source = stripComments(readFileSync(file, 'utf8'));
    STRIPPED.set(file, source);
  }

  return source;
}

function dependenciesOf(file: string): readonly string[] {
  let deps = RESOLVED.get(file);

  if (deps === undefined) {
    deps = specifiersOf(strippedSourceOf(file))
      .map((specifier) => resolveSpecifier(file, specifier))
      .filter((resolved): resolved is string => resolved !== null);
    RESOLVED.set(file, deps);
  }

  return deps;
}

/** Every file of ours a file reaches by import, itself included. */
export function importClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];

  while (stack.length > 0) {
    const file = stack.pop();

    if (file === undefined || seen.has(file)) continue;

    seen.add(file);

    if (!/\.(m?ts|tsx|mjs)$/u.test(file)) continue;

    for (const resolved of dependenciesOf(file)) stack.push(resolved);
  }

  return seen;
}

function walk(dir: string, accept: (name: string) => boolean): string[] {
  const out: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) out.push(...walk(full, accept));
    else if (accept(entry.name)) out.push(full);
  }

  return out;
}

/** Every Next routing file outside the account group: pages, layouts, route handlers, middleware. */
export function nonAccountEntryPoints(): string[] {
  const routing = walk(APP, (name) => /^(page|layout|route|not-found|template)(\.dev)?\.tsx?$/u.test(name)).filter(
    (file) => !file.startsWith(join(APP, '(account)')),
  );
  const middleware = join(WEB, 'middleware.ts');

  return existsSync(middleware) ? [...routing, middleware] : routing;
}

/** Non-account entry points whose module graph reaches the cookie module. Should be []. */
export function entryPointsReachingTheCookie(): string[] {
  return nonAccountEntryPoints()
    .filter((entry) => importClosure(entry).has(COOKIE_MODULE))
    .map(posix)
    .sort();
}

/** Files in a non-account entry point's module graph that READ a request cookie. Should be []. */
export function cookieReadsOutsideTheArea(): string[] {
  const readers = new Set<string>();

  for (const entry of nonAccountEntryPoints()) {
    for (const file of importClosure(entry)) {
      if (ACCOUNT_ROOTS.some((root) => file.startsWith(root))) continue;
      if (!/\.(m?ts|tsx)$/u.test(file)) continue;

      if (COOKIE_READ.test(strippedSourceOf(file))) readers.add(posix(file));
    }
  }

  return [...readers].sort();
}

/** Every source file under app/ and lib/ that imports the cookie module. */
export function cookieModuleImporters(): string[] {
  const sources = [...walk(APP, (name) => /\.tsx?$/u.test(name)), ...walk(join(WEB, 'lib'), (name) => /\.tsx?$/u.test(name))];

  return sources
    .filter((file) => file !== COOKIE_MODULE && !/\.test\.tsx?$/u.test(file))
    .filter((file) =>
      specifiersOf(stripComments(readFileSync(file, 'utf8'))).some(
        (specifier) => resolveSpecifier(file, specifier) === COOKIE_MODULE,
      ),
    )
    .map(posix)
    .sort();
}

/** Importers that are not inside the account area. Should be []. */
export function cookieImportersOutsideTheArea(): string[] {
  return cookieModuleImporters().filter(
    (file) => !ACCOUNT_ROOTS.some((root) => join(WEB, file).startsWith(root)),
  );
}
