// web/tests/unit/content/health-instance.test.ts
//
// RULING R301: /api/health ECHOES THE INSTANCE THE HARNESS SET.
//
// R169 proves the route NAMES this product (tests/unit/content/identity.test.ts
// pins the `service` field). This proves the SECOND half of FW33's lesson: a
// sibling of the same product passes R169, so the route also echoes a per-run
// marker a harness sets, and a live suite refuses any server that does not echo
// the value it set. Both directions, because a field that is always null and a
// field that is always echoed each satisfy exactly one of these.
//
// THE ROUTE READS process.env AT CALL TIME (dynamic = 'force-dynamic'), so the
// env is set around the call and restored after, never mutated for the suite.

import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/api/health/route';
import { INSTANCE_ID_ENV } from '@/lib/content/identity';

const original = process.env[INSTANCE_ID_ENV];

afterEach(() => {
  if (original === undefined) delete process.env[INSTANCE_ID_ENV];
  else process.env[INSTANCE_ID_ENV] = original;
});

async function health(): Promise<Record<string, unknown>> {
  return (await GET().json()) as Record<string, unknown>;
}

describe('R301: /api/health echoes the per-run instance', () => {
  it('echoes the value the harness set', async () => {
    process.env[INSTANCE_ID_ENV] = 'run-fixture-123';

    const body = await health();

    expect(body.instance).toBe('run-fixture-123');
    // R169 still holds in the same payload: the product is named too.
    expect(body.service).toBe('monreleve');
  });

  it('answers null when no marker is set, which is every ordinary run', async () => {
    delete process.env[INSTANCE_ID_ENV];

    const body = await health();

    // null, not undefined and not absent: a build that CARRIES the field and
    // says "no instance" is a different claim from one too old to carry it, and
    // instanceRefusal treats null as "a server this run did not start".
    expect(body.instance).toBeNull();
    expect('instance' in body, 'the field must be present even when null').toBe(true);
  });
});
