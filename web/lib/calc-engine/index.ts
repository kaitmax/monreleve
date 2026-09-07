// web/lib/calc-engine/index.ts
//
// The engine's public surface (SPEC section 7.4). Pure TypeScript, zero
// runtime dependencies, no I/O, no clock, no React. Invalid input returns a
// Result and never throws.
//
// FW3 delivers the type surface, the RuleSet, regime derivation, granularity,
// the denominator, validation and allowedTeleworkDays. calculateTelework -
// the waterfall, the rates, the headroom and the warnings - is FW4's, and is
// deliberately not exported until it exists.

export { ruleSetFor } from './rules';
export { regimeFor } from './regime';

export type {
  AllowedTeleworkDays,
  Canton,
  DenominatorMethod,
  Granularity,
  Regime,
  Result,
  RuleSet,
  TeleworkInput,
  TeleworkResult,
  ValidationError,
  Warning,
} from './types';
