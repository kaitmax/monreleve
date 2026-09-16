// web/e2e/support/base-url.ts
//
// RULING R170: THE PORT COMES FROM THE ENVIRONMENT.
//
// It was the literal 'http://localhost:3000' in playwright.config.ts, and
// that is half of how FW20 found the suite testing a different product. The
// other half is reuseExistingServer, which is only safe once R169's identity
// check establishes whose server is being reused.
//
// WHY A PORT RATHER THAN "FREE THE PORT". Stopping whatever holds 3000 fixes
// today and leaves the collision to recur every time two projects are open on
// one machine. A port that can be moved fixes it for good, and costs one
// environment variable.
//
// ONE MODULE, TWO CONSUMERS: playwright.config.ts builds its webServer and
// its baseURL from this, and e2e/global-setup.ts checks the same address. A
// guard that checked a different URL from the one the tests use would be the
// same class of defect it exists to catch.

/**
 * FRONTALIER_PORT first, then PORT, then 3000.
 *
 * FRONTALIER_PORT is named so that a machine running several products can set
 * a port for THIS one without a bare PORT leaking into every tool that reads
 * it. PORT is honoured second because it is the convention CI images use.
 */
export const PORT = process.env.FRONTALIER_PORT ?? process.env.PORT ?? '3000';

export const BASE_URL = `http://localhost:${PORT}`;
