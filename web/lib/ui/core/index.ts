// web/lib/ui/core/index.ts
// Pure TypeScript + SCSS. React is forbidden here (SPEC section 5).
// The rail: a pure string generator, shared by the browser, the PDF and the
// OG image (SPEC 6.3, D2).

export { statusFor, zoneFor, STATUS_PRESENTATION } from './zones';
export type { Status, StatusPresentation, Zone, ZoneThresholds } from './zones';

export { STATUS_VISUAL, ZONE_BAND_TOKEN } from './zone-tokens';
export type { LucideIconName, StatusVisual } from './zone-tokens';

// Every number and date the product shows goes through these (SPEC 6.4:
// "every number through format/"). normaliseNumber, normaliseDate and
// normaliseDateTime are deliberately NOT re-exported: they are the seams the
// ICU-independence tests drive, not API.
export { formatDays, formatPercent, formatSignedDays } from './format/number';
export type { SignedDays } from './format/number';

// DATE_ZONE is gone with ruling R28: formatDate takes an ISO YYYY-MM-DD
// string, which carries no instant, so there is no zone to name.
export { formatDate, formatDateTime, DATE_TIME_ZONE } from './format/date';

// FW11 increment 3: a start-of-activity date becomes periodFraction. Pure,
// no clock, no zone (R28) - see period.ts for why it is not in the engine.
export { remainingYearFraction } from './period';

export { renderRailSvg } from './rail/renderRailSvg';
export { railGeometry, COMPACT_MIN_WIDTH, SOCIAL_HEIGHT, SOCIAL_WIDTH } from './rail/geometry';
export type { RailData, RailGeometry, RailTick } from './rail/geometry';
