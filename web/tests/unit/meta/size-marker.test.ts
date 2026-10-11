// web/tests/unit/meta/size-marker.test.ts
//
// RULING R326: pnpm size measures only the build that ships. The refusal
// decision is a PURE function (shippingMarkerRefusal), so it is proven here
// without a build - both directions (R154): every kind of non-shipping build
// is refused by name, and a clean shipping build is let through.
//
// The end-to-end plant - a real dev-routes build refused by `pnpm size` - is in
// REPORT-FW34.txt (R180: the marker written by a real build, seen refused).

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// The .mjs resolves through size-marker.d.mts (R185); the parity test asserts
// the declaration and the module agree.
import {
  SIZE_MARKER_FILE,
  writeSizeMarker,
  readSizeMarker,
  shippingMarkerRefusal,
} from '@/scripts/size-marker.mjs';

const temps: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'size-marker-'));
  temps.push(dir);

  return dir;
}

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('R326: the shipping measurement refuses every build it cannot vouch for', () => {
  it('refuses a missing marker, by name', () => {
    const reason = shippingMarkerRefusal(null, '.next');

    expect(reason).not.toBeNull();
    expect(reason).toContain('no shipping marker');
    expect(reason).toContain('R326');
  });

  it('refuses a `next dev` build, by name', () => {
    const reason = shippingMarkerRefusal({ phase: 'dev', devRoutes: false }, '.next');

    expect(reason).not.toBeNull();
    expect(reason).toContain('next dev');
    expect(reason).toContain('R326');
  });

  it('refuses a production build with the dev routes compiled in, by name', () => {
    const reason = shippingMarkerRefusal({ phase: 'build', devRoutes: true }, '.next');

    expect(reason).not.toBeNull();
    expect(reason).toContain('FRONTALIER_DEV_ROUTES');
    expect(reason).toContain('R326');
  });

  it('lets a clean production build through', () => {
    // The direction that must stay true, or the gate refuses every honest run.
    expect(shippingMarkerRefusal({ phase: 'build', devRoutes: false }, '.next')).toBeNull();
  });
});

describe('R326: the marker round-trips, and a dev-routes flag is recorded', () => {
  it('writes and reads back what the build was', () => {
    const dir = scratch();

    writeSizeMarker(dir, { dev: false, devRoutes: false });

    expect(readSizeMarker(dir)).toEqual({ phase: 'build', devRoutes: false });
  });

  it('records a dev-routes build as such', () => {
    const dir = scratch();

    writeSizeMarker(dir, { dev: false, devRoutes: true });

    expect(readSizeMarker(dir)).toMatchObject({ phase: 'build', devRoutes: true });
  });

  it('records a dev server as such', () => {
    const dir = scratch();

    writeSizeMarker(dir, { dev: true, devRoutes: false });

    expect(readSizeMarker(dir)).toMatchObject({ phase: 'dev' });
  });

  it('returns null for a directory with no marker', () => {
    expect(readSizeMarker(scratch())).toBeNull();
  });

  it('uses a stable, documented filename', () => {
    expect(SIZE_MARKER_FILE).toBe('frontalier-size-marker.json');
  });
});
