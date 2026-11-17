// web/tests/unit/meta/gate-clone-admin.test.ts
//
// R957: THE ADMIN CONNECTION IS postgres.
//
// gate:clone created and dropped its scratch database through a connection to
// whatever DATABASE_URL named. From a checkout whose web/.env names
// `frontalier` - the shared development database, and what .env.example
// gives every developer - it opened a session ON `frontalier` to run CREATE
// DATABASE and DROP DATABASE for monreleve_gate_clone_<sha8>. No table was
// touched, but nothing about the design said none would be (C6's Q1).
//
// Now every administration statement goes through one runner, which opens
// the server's `postgres` database with DATABASE_URL's host, port and
// credentials, and nothing else of it. These tests read the URL the runner
// opens through an injected client, so "no admin statement is sent to the
// named database" is observed rather than argued; and gate-clone.mjs is held
// to having no other way to reach the server.
//
// THE QUERY STRING IS DROPPED, and not because `pg` needs it gone: measured
// on 2026-11-16 against the local server, `pg` connects to `postgres` with
// `?schema=public`, without it, and with `?database=frontalier` (the path
// wins). It is dropped because nothing in it belongs to an administration
// connection, and it can carry a SECOND name for a database, which
// scratch-database.mjs refuses for test:db for the same reason.
//
// THE SCRATCH URL KEEPS DERIVING FROM DATABASE_URL, query string and all
// (R959): db:deploy, test:db and the production write receive exactly what
// they received before.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_DATABASE,
  administer,
  adminDatabaseUrl,
  adminTarget,
  scratchDatabaseUrl,
  type AdminClient,
} from '../../../scripts/gate-clone-parts.mjs';
import { judgeTestDatabase, scratchDatabaseName } from '../../../lib/db/scratch-database.mjs';
import { withoutComments } from '@/tests/support/quoted-spans';

const WEB = join(import.meta.dirname, '..', '..', '..');
const GATE_CLONE = withoutComments(readFileSync(join(WEB, 'scripts', 'gate-clone.mjs'), 'utf8'));
const PARTS = withoutComments(readFileSync(join(WEB, 'scripts', 'gate-clone-parts.mjs'), 'utf8'));

/** A DATABASE_URL naming `frontalier`, in the shape .env.example publishes it. */
const FRONTALIER_URL = 'postgresql://frontalier:frontalier@localhost:5436/frontalier?schema=public';

/** What every developer's web/.env starts from. */
const ENV_EXAMPLE_URL = /^DATABASE_URL="([^"]+)"/mu.exec(readFileSync(join(WEB, '.env.example'), 'utf8'))?.[1];

/** The database a connection string opens, read by the one home that reads it the driver's way. */
const databaseOf = (url: string): string | null => judgeTestDatabase(url).database;

describe('R957: the admin URL is DATABASE_URL\'s server, on its postgres database', () => {
  it('derives the admin URL for a DATABASE_URL naming frontalier', () => {
    expect(adminDatabaseUrl(FRONTALIER_URL)).toBe('postgresql://frontalier:frontalier@localhost:5436/postgres');
  });

  it('ADMIN_DATABASE is the server\'s maintenance database', () => {
    expect(ADMIN_DATABASE).toBe('postgres');
  });

  it('.env.example\'s URL names frontalier, and its admin URL keeps only the host, port and credentials', () => {
    expect(ENV_EXAMPLE_URL, '.env.example declares DATABASE_URL').toBeDefined();

    const named = new URL(ENV_EXAMPLE_URL ?? '');
    const admin = new URL(adminDatabaseUrl(ENV_EXAMPLE_URL ?? ''));

    expect(databaseOf(ENV_EXAMPLE_URL ?? '')).toBe('frontalier');
    expect(databaseOf(admin.toString())).toBe('postgres');
    expect([admin.protocol, admin.hostname, admin.port, admin.username, admin.password]).toEqual([
      named.protocol,
      named.hostname,
      named.port,
      named.username,
      named.password,
    ]);
    expect(admin.search).toBe('');
    expect(admin.hash).toBe('');
  });

  it.each([
    ['?database=', 'postgresql://u:p@localhost:5436/frontalier?database=frontalier'],
    ['?dbname=', 'postgresql://u:p@localhost:5436/frontalier?dbname=frontalier'],
    ['?db=', 'postgresql://u:p@localhost:5436/frontalier?db=frontalier'],
    ['a fragment', 'postgresql://u:p@localhost:5436/frontalier#frontalier'],
  ])('carries no %s: a second name for a database cannot ride along', (_what, url) => {
    expect(adminDatabaseUrl(url)).toBe('postgresql://u:p@localhost:5436/postgres');
  });

  it.each([
    ['an encoded password', 'postgres://u:p%40ss%2Fw0rd@127.0.0.1:5432/frontalier', 'postgres://u:p%40ss%2Fw0rd@127.0.0.1:5432/postgres'],
    ['an IPv6 host', 'postgresql://u:pw@[::1]:5433/frontalier', 'postgresql://u:pw@[::1]:5433/postgres'],
    ['no port', 'postgresql://u@localhost/frontalier', 'postgresql://u@localhost/postgres'],
    ['no credentials', 'postgresql://localhost:5436/frontalier', 'postgresql://localhost:5436/postgres'],
  ])('keeps %s as it was', (_what, url, admin) => {
    expect(adminDatabaseUrl(url)).toBe(admin);
  });

  it('accepts the parsed URL gate-clone.mjs holds, not only a string', () => {
    expect(adminDatabaseUrl(new URL(FRONTALIER_URL))).toBe(adminDatabaseUrl(FRONTALIER_URL));
  });

  it('names the admin connection for the log with its credentials masked', () => {
    const target = adminTarget(FRONTALIER_URL);

    expect(target).toBe('postgresql://<credentials>@localhost:5436/postgres');
    expect(target).not.toContain('frontalier');
    expect(adminTarget('postgresql://localhost:5436/frontalier')).toBe('postgresql://localhost:5436/postgres');
  });

  it('prints the URL the runner opens, masked: derived from adminDatabaseUrl, so the log cannot name one database while another is opened', () => {
    // Found by the R958 plant: with the derivation reverted, the real server
    // refused a connection to the NAMED database while a target built on its
    // own still printed `postgres`.
    const body = /export function adminTarget\(databaseUrl\) \{([\s\S]*?)\n\}/u.exec(PARTS)?.[1] ?? '';

    expect(body, 'adminTarget derives from adminDatabaseUrl').toContain('adminDatabaseUrl(databaseUrl)');

    for (const url of [
      FRONTALIER_URL,
      'postgresql://localhost:5436/frontalier',
      'postgres://u:p%40ss@[::1]:5433/frontalier?db=frontalier',
    ]) {
      expect(adminTarget(url)).toBe(adminDatabaseUrl(url).replace(/\/\/[^@/]*@/u, '//<credentials>@'));
    }
  });

  it('the scratch URL still derives from DATABASE_URL, query string and all, and test:db admits it (R959)', () => {
    const scratch = scratchDatabaseUrl(FRONTALIER_URL, scratchDatabaseName('gate_clone_0d2339fd'));

    expect(scratch).toBe(
      'postgresql://frontalier:frontalier@localhost:5436/monreleve_gate_clone_0d2339fd?schema=public',
    );
    expect(judgeTestDatabase(scratch).admitted).toBe(true);
    expect(scratchDatabaseUrl(new URL(FRONTALIER_URL), 'monreleve_x')).toBe(
      scratchDatabaseUrl(FRONTALIER_URL, 'monreleve_x'),
    );
  });
});

/** A client factory that records every URL it is asked to open and every statement sent on it. */
function recorder(failOn?: string) {
  const opened: string[] = [];
  const sent: { database: string | null; statement: string }[] = [];
  let ended = 0;

  const connect = async (connectionString: string): Promise<AdminClient> => {
    opened.push(connectionString);

    return {
      async query(statement: string) {
        if (statement === failOn) throw new Error(`refused: ${statement}`);
        sent.push({ database: databaseOf(connectionString), statement });
      },
      async end() {
        ended += 1;
      },
    };
  };

  return { connect, opened, sent, ended: () => ended };
}

const DROP = 'DROP DATABASE IF EXISTS "monreleve_gate_clone_0d2339fd" WITH (FORCE)';
const CREATE = 'CREATE DATABASE "monreleve_gate_clone_0d2339fd"';

describe('R957: no admin statement is sent to the named database (an injected client)', () => {
  it('opens one connection, on postgres, and sends every statement there in order', async () => {
    const client = recorder();

    await administer(FRONTALIER_URL, [DROP, CREATE], client.connect);

    expect(client.opened).toEqual(['postgresql://frontalier:frontalier@localhost:5436/postgres']);
    expect(client.opened.map(databaseOf)).not.toContain('frontalier');
    expect(client.sent).toEqual([
      { database: 'postgres', statement: DROP },
      { database: 'postgres', statement: CREATE },
    ]);
    expect(client.ended()).toBe(1);
  });

  it('takes the parsed URL gate-clone.mjs holds the same way', async () => {
    const client = recorder();

    await administer(new URL(FRONTALIER_URL), [DROP], client.connect);

    expect(client.opened.map(databaseOf)).toEqual(['postgres']);
  });

  it('a refused statement still closes the connection, sends nothing after it, and is not swallowed', async () => {
    const client = recorder(DROP);

    await expect(administer(FRONTALIER_URL, [DROP, CREATE], client.connect)).rejects.toThrow(/refused/u);
    expect(client.sent).toEqual([]);
    expect(client.ended()).toBe(1);
  });

  it('a connection that cannot open is not swallowed', async () => {
    const opened: string[] = [];
    const connect = async (connectionString: string): Promise<AdminClient> => {
      opened.push(connectionString);
      throw new Error('no server');
    };

    await expect(administer(FRONTALIER_URL, [DROP], connect)).rejects.toThrow(/no server/u);
    expect(opened.map(databaseOf)).toEqual(['postgres']);
  });
});

describe('R957 in gate-clone.mjs: it has no way to reach the server except the runner', () => {
  it('opens no database client of its own and loads no driver', () => {
    expect(GATE_CLONE).not.toMatch(/new\s+Client\b/u);
    expect(GATE_CLONE).not.toMatch(/import\(\s*['"]pg['"]\s*\)/u);
    expect(GATE_CLONE).not.toMatch(/from\s+['"]pg['"]/u);
  });

  it('imports the runner and the derivations from gate-clone-parts.mjs', () => {
    expect(GATE_CLONE).toMatch(/import \{[^}]*\badminister\b[^}]*\} from '\.\/gate-clone-parts\.mjs';/u);
    expect(GATE_CLONE).toMatch(/import \{[^}]*\bscratchDatabaseUrl\b[^}]*\} from '\.\/gate-clone-parts\.mjs';/u);
  });

  it('sends its three administration statements through administer, and has no fourth', () => {
    expect(GATE_CLONE.match(/\b(?:CREATE|DROP) DATABASE\b/gu)).toHaveLength(3);
    expect(GATE_CLONE).toMatch(
      /await administer\(server, \[\s*`DROP DATABASE IF EXISTS "\$\{scratchDatabase\}" WITH \(FORCE\)`,\s*`CREATE DATABASE "\$\{scratchDatabase\}"`,?\s*\]\);/u,
    );
    expect(GATE_CLONE).toMatch(
      /await administer\(server, \[`DROP DATABASE IF EXISTS "\$\{scratchDatabase\}" WITH \(FORCE\)`\]\);/u,
    );
  });

  it('prints the admin connection it opens, credentials masked, so the real run shows it', () => {
    expect(GATE_CLONE).toContain('adminTarget(server)');
  });

  it('hands the suites a scratch URL derived from DATABASE_URL itself, not from the admin URL', () => {
    expect(GATE_CLONE).toContain('const scratchUrl = scratchDatabaseUrl(local, scratchDatabase);');
  });
});
