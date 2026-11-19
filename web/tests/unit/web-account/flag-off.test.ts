// web/tests/unit/web-account/flag-off.test.ts
//
// QUEUE RULING 13 ITEM 5: WITH THE AREA SWITCHED OFF, IT IS NOT THERE.
//
// PRODUCT_STATE.webAccountExists is the one fact the header link, the privacy
// notice's cookie sentence and the area itself follow (R172). Hiding the link
// and the sentence while the pages kept answering would leave a reachable
// area setting a cookie the notice no longer mentions - the dangerous
// direction. So with the fact false, every account path answers 404 and sets
// no cookie, and this file flips the fact to prove it.
//
// The flag is a module constant, so it is flipped by mocking the module: the
// route registry derives ACCOUNT_ROUTE from it at load, exactly as in
// production.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/content/product-state', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/content/product-state')>();

  return { ...real, PRODUCT_STATE: { ...real.PRODUCT_STATE, webAccountExists: false } };
});

const SITE = 'https://monreleve.ch';

function post(path: string, fields: Record<string, string>): Request {
  return new Request(`${SITE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      host: 'monreleve.ch',
      origin: SITE,
      cookie: 'monreleve_session=Abc_def-0123456789ABCDEFGHIJKLMNOPQRSTUVWXY',
    },
    body: new URLSearchParams(fields).toString(),
  });
}

/** What Next's notFound() throws: an error whose digest names the 404 fallback. */
async function notFoundOf(render: () => Promise<unknown>): Promise<string> {
  try {
    await render();
  } catch (error) {
    return String((error as { digest?: unknown }).digest ?? error);
  }

  return 'RENDERED';
}

beforeEach(async () => {
  // A KEY IS SET so that, were the area open, step one WOULD seal and mail -
  // without one it refuses on its own (R205) and 'no mail' would pass vacuously.
  process.env.AUTH_SECRET = 'flag-off-test-secret';

  const { clearOutbox } = await import('@/lib/alerts/mailer');

  clearOutbox();
});

describe('the flag is really off in this file (presence of the flip)', () => {
  it('reads webAccountExists false, and the registry follows', async () => {
    const { PRODUCT_STATE } = await import('@/lib/content/product-state');
    const { ACCOUNT_ROUTE, accountHrefIfLive } = await import('@/lib/content/routes');

    expect(PRODUCT_STATE.webAccountExists).toBe(false);
    expect(ACCOUNT_ROUTE.status).toBe('planned');
    expect(accountHrefIfLive()).toBeNull();
  });
});

describe('every account route handler answers 404 and sets no cookie', () => {
  it.each([
    ['step one', '@/app/(account)/mon-releve/connexion/envoi/route', '/mon-releve/connexion/envoi', { adresse: 'x@monreleve.test' }],
    ['step two', '@/app/(account)/mon-releve/connexion/verification/route', '/mon-releve/connexion/verification', { etape: 'x', code: '123456' }],
    ['sign-out', '@/app/(account)/mon-releve/deconnexion/route', '/mon-releve/deconnexion', {}],
    ['the PDF', '@/app/(account)/mon-releve/export/pdf/route', '/mon-releve/export/pdf', { annee: '2026' }],
    ['the CSV', '@/app/(account)/mon-releve/export/csv/route', '/mon-releve/export/csv', { annee: '2026' }],
  ] as const)('%s', async (_label, module, path, fields) => {
    const { POST } = (await import(module)) as { POST: (request: Request) => Promise<Response> };
    const response = await POST(post(path, fields));

    expect(response.status).toBe(404);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
  });

  it('sends no mail when step one is closed', async () => {
    const { POST } = await import('@/app/(account)/mon-releve/connexion/envoi/route');
    const { readOutbox } = await import('@/lib/alerts/mailer');

    await POST(post('/mon-releve/connexion/envoi', { adresse: 'closed@monreleve.test' }));

    expect(readOutbox()).toHaveLength(0);
  });
});

describe('every account page answers 404', () => {
  const params = { searchParams: Promise.resolve({}) };

  it('the signed-in page', async () => {
    const { default: Page } = await import('@/app/(account)/mon-releve/page');

    expect(await notFoundOf(() => Page(params))).toContain('404');
  });

  it('step one', async () => {
    const { default: Page } = await import('@/app/(account)/mon-releve/connexion/page');

    expect(await notFoundOf(() => Page(params))).toContain('404');
  });

  it('step two', async () => {
    const { default: Page } = await import('@/app/(account)/mon-releve/connexion/code/page');

    expect(await notFoundOf(() => Page(params))).toContain('404');
  });
});
