// web/lib/web-account/code-shape.ts
//
// What the code field accepts: exactly CODE_DIGITS digits. DERIVED from the
// constant the code is generated with (R181), so the form's pattern, its
// maxlength and the handler's check cannot drift from what the e-mail carries.

import { CODE_DIGITS } from '@/lib/auth/magic-link';

export const CODE_LENGTH = CODE_DIGITS;

/** The handler's check, after spaces are removed. */
export const CODE_SHAPE = new RegExp(`^[0-9]{${String(CODE_DIGITS)}}$`, 'u');

/** The input's `pattern` attribute (the browser anchors it itself). */
export const CODE_PATTERN = `[0-9]{${String(CODE_DIGITS)}}`;
