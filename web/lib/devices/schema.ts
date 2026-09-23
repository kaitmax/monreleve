// web/lib/devices/schema.ts
//
// What POST /api/v1/devices accepts. FW27 increment 3.
//
// ============================================================================
// A REGISTRATION IS A TOKEN AND NOTHING ELSE THAT IDENTIFIES A PHONE
// ============================================================================
//
// SPEC §8's `Device` holds an FCM token, a platform and an application
// version. It does not hold a model, an IMEI, an advertising id, a locale or a
// timezone, and nothing here accepts one - not stripped, REFUSED, so a client
// sending a device model learns it was refused rather than believing it was
// stored.
//
// `.strict()` for the reason the entries route refuses unknown parameters: a
// client that misspells a field and receives 200 has been told its change was
// saved.
//
// ============================================================================
// THE PLATFORM IS A LITERAL, NOT A FREE STRING
// ============================================================================
//
// There is one client (SPEC D1, Android). A free-form platform field would
// accept "Android", "android 14" and "ANDROID" as three platforms, and the
// column would be useless for the one thing it exists for - knowing which
// clients are still registered when a push shape changes. When iOS arrives it
// is one entry in this union and a migration nobody has to guess at.

import { z } from 'zod';

/**
 * The upper bound on a registration token.
 *
 * FCM tokens were around 160 characters and are now several hundred; Google
 * publishes no maximum. 4096 is generous enough that no real token is refused
 * and small enough that this cannot be used to write a megabyte into a row.
 */
export const MAX_FCM_TOKEN_LENGTH = 4096;

export const PLATFORMS = ['android'] as const;

export const deviceRegistrationSchema = z
  .object({
    fcmToken: z.string().min(1).max(MAX_FCM_TOKEN_LENGTH),
    platform: z.enum(PLATFORMS).default('android'),
    /**
     * Optional, because a token is worth registering from a build that does
     * not know its own version. Bounded because it is a free string.
     */
    appVersion: z.string().min(1).max(40).optional(),
  })
  .strict();

export type DeviceRegistration = z.infer<typeof deviceRegistrationSchema>;
