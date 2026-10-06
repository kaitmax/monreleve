// web/tests/db/verification-qr.test.ts
//
// The QR and the printed address on the produced PDF, both gated on the
// permanent-domain setting. FW-VERIFY (R332, R232).
//
// ============================================================================
// TWO STATES, TWO SERVERS, NEVER BOTH AT ONCE
// ============================================================================
//
// R332: the QR and the printed verification address appear ONLY when a permanent
// origin is set; by default the document carries neither. Which state a render
// produces depends on the SERVER's MONRELEVE_VERIFICATION_ORIGIN, so this file
// reads the TEST process's own setting to know which to assert, and skips the
// other - naming the skip, never hiding it (R133):
//
//   origin UNSET  -> the default PDF carries no verification block (the e2e/gate
//                    server runs this way, so it is the state CI exercises)
//   origin SET    -> the PDF carries the QR, the address and the code, and the
//                    QR DECODES to the right URL (the walkthrough runs this way:
//                    MONRELEVE_VERIFICATION_ORIGIN=https://... pnpm dev)
//
// R232: the assertions are on the PRODUCED FILE. The QR is read out of the PDF
// bytes (support/pdf-image.ts + jsqr), not off the page the template emitted.

import jsQR from 'jsqr';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { GET } from '@/app/api/v1/export/pdf/route';
import { verificationOrigin, verificationUrlFor } from '@/lib/verification/origin';
import { DOSSIER_COPY as COPY } from '@/lib/fr/dossier';
import { liveOrigin } from './support/live-server';
import { extractPdfText } from './support/pdf-text';
import { extractFirstImage } from './support/pdf-image';

const LIVE = await liveOrigin();
const ORIGIN = verificationOrigin();
const YEAR = 2026;

const base = 'skip' in LIVE ? `no live server - ${LIVE.skip}` : null;

if (base !== null) {
  process.stderr.write(`\n[verification-qr] R133: the render tests did not run - ${base}\n\n`);
}

let userId = '';
let token = '';
let counter = 0;

function get(origin: string): Request {
  return new Request(`${origin}/api/v1/export/pdf?year=${YEAR}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(async () => {
  process.env.AUTH_SECRET ??= 'verification-qr-test-secret';
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'qr@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;
  token = (await issueTokenPair(userId)).accessToken;

  counter += 1;
  await prisma.entry.create({
    data: {
      userId,
      dayDate: new Date(`${YEAR}-03-02T00:00:00.000Z`),
      portion: 'FULL',
      kind: 'HOME',
      clientMutationId: `00000000-0000-4000-c000-${String(counter).padStart(12, '0')}`,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.skipIf(base !== null || ORIGIN !== null)(
  'R332: with NO permanent origin, the document carries no verification block',
  () => {
    const origin = 'origin' in LIVE ? LIVE.origin : '';

    it('prints neither the QR, the address, nor the code', async () => {
      const response = await GET(get(origin));
      expect(response.status).toBe(200);

      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = extractPdfText(bytes);

      // PRESENCE FIRST (R169): the document rendered - it has its title.
      expect(text).toContain(COPY.title);
      // And it does NOT carry the verification block (R332 default).
      expect(text).not.toContain(COPY.verification.heading);
      expect(extractFirstImage(bytes)).toBeNull();
    }, 60_000);
  },
);

describe.skipIf(base !== null || ORIGIN === null)(
  'R332/R232: with a permanent origin set, the QR decodes to the right URL',
  () => {
    const origin = 'origin' in LIVE ? LIVE.origin : '';
    const verifyOrigin = ORIGIN ?? '';

    it('prints the verification block and the QR decodes to the issued URL', async () => {
      const response = await GET(get(origin));
      expect(response.status).toBe(200);

      const bytes = new Uint8Array(await response.arrayBuffer());

      // The code the server issued and stored for this render.
      const record = await prisma.issuanceRecord.findFirst({
        where: { userId, taxYear: YEAR, supersededAt: null },
      });
      expect(record).not.toBeNull();
      const expectedUrl = verificationUrlFor(verifyOrigin, record!.code);

      // THE PRINTED TEXT carries the address and the code (for anyone who cannot
      // scan) - asserted on the produced file.
      const text = extractPdfText(bytes);
      expect(text).toContain(COPY.verification.heading);
      expect(text).toContain(record!.code);

      // THE QR, DECODED FROM THE PRODUCED PDF (R232). Extract the embedded image
      // and read it with jsqr; it must carry exactly the verification URL.
      const image = extractFirstImage(bytes);
      expect(image, 'no raster image found in the PDF to decode').not.toBeNull();

      const decoded = jsQR(image!.rgba, image!.width, image!.height);
      expect(decoded, 'the QR did not decode').not.toBeNull();
      expect(decoded!.data).toBe(expectedUrl);
    }, 60_000);
  },
);
