// web/tests/unit/pages/verification-outage.test.ts
//
// FW-VERIFIER-OUTAGE (R1022, R1023; Web Ruling 20): /verifier/[code] WITH A
// DATABASE THAT CANNOT BE REACHED.
//
// THE REAL PAGE, THE REAL LOOKUP, A REAL CLIENT THAT CANNOT CONNECT. Only the
// client's address is chosen here: lib/db/client.ts is replaced by a client on
// 127.0.0.1:1, where nothing listens, so lookupVerification runs its own query
// and gets the error a stopped database gives (P1001). No Docker, so the state
// is asserted on every gate, not only in the container suite (R1023).
//
// THE STATUS NO LONGER DISCRIMINATES. Under Web Ruling 20 the degraded answer
// is a 200, like the unknown-code answer, so a status cannot tell them apart.
// Only the CONTENT can: the page's own heading and ONE sentence, and nothing
// about the code or the document - not the unknown-code text, not the intro,
// not a printed field. Each is asserted by its copy key (R181).

import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.20' }),
}));

// A client that cannot reach a database, built exactly as lib/db/client.ts
// builds the real one (PrismaClient + the PrismaPg adapter).
vi.mock('@/lib/db/client', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');

  return {
    prisma: new PrismaClient({
      adapter: new PrismaPg({ connectionString: 'postgresql://probe:probe@127.0.0.1:1/monreleve_probe?schema=public' }),
    }),
  };
});

import VerifyPage from '@/app/(public)/verifier/[code]/page';
import type { VerificationState } from '@/app/(public)/verifier/[code]/VerificationContent';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { VERIFICATION_COPY } from '@/lib/fr/verification';

/** A well-formed code: it passes lookup.ts's format check and reaches the query. */
const CODE = '0123456789abcdef0123456789abcdef';

let logged: string[] = [];

beforeEach(() => {
  resetRateLimit();
  logged = [];
  vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    logged.push(parts.map(String).join(' '));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Drive the real page, as the framework does, and render what it returned. */
async function visit(code: string): Promise<{ kind: VerificationState['kind']; html: string }> {
  const element = (await VerifyPage({ params: Promise.resolve({ code }) })) as ReactElement<{
    state: VerificationState;
  }>;

  return { kind: element.props.state.kind, html: renderToStaticMarkup(element) };
}

const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&#x27;/gu, "'")
    .replace(/&amp;/gu, '&')
    .replace(/\s+/gu, ' ')
    .trim();

describe('R1022 (Web Ruling 20): the database cannot be reached', () => {
  it('answers the unavailable state: the heading and ONE sentence', async () => {
    const { kind, html } = await visit(CODE);

    expect(kind).toBe('unavailable');
    expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/u)?.[1]).toBe(VERIFICATION_COPY.title);
    expect(textOf(html)).toContain(VERIFICATION_COPY.unavailable);
    // ONE sentence under the heading: the intro is dropped (Web Ruling 20 item 6).
    expect(html.match(/<p\b/gu) ?? []).toHaveLength(1);
  });

  it('says NOTHING about the code or the document (R160)', async () => {
    const text = textOf((await visit(CODE)).html);

    expect(text).not.toContain(VERIFICATION_COPY.unknown);
    expect(text).not.toContain(VERIFICATION_COPY.intro);
    expect(text).not.toContain(VERIFICATION_COPY.rateLimited);
    expect((await visit(CODE)).html).not.toMatch(/<dl\b/u);
  });

  it('logs the error it took the degraded path on: the code and the adapter cause', async () => {
    await visit(CODE);

    const line = logged.find((entry) => entry.startsWith('[verifier]'));

    expect(line, `no [verifier] line among ${JSON.stringify(logged)}`).toBeDefined();
    expect(line).toContain('P1001');
    expect(line).toContain('DatabaseNotReachable');
  });
});

describe('Q4 (Web Ruling 20 item 5): what never asks the database keeps its answer', () => {
  it('a malformed code is still the unknown answer, with the database unreachable', async () => {
    const { kind, html } = await visit('not-a-code');

    expect(kind).toBe('unknown');
    expect(textOf(html)).toContain(VERIFICATION_COPY.unknown);
    expect(logged.filter((entry) => entry.startsWith('[verifier]'))).toEqual([]);
  });
});
