// web/lib/ui/core/index.ts
// Pure TypeScript + SCSS. React is forbidden here (SPEC section 5).
// renderRailSvg arrives in FW7.

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

export { formatDate, formatDateTime, DATE_TIME_ZONE, DATE_ZONE } from './format/date';
