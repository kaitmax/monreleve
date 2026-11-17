// web/scripts/lighthouse-plan.d.mts
//
// Types for scripts/lighthouse-plan.mjs, the pure half of `pnpm lighthouse`
// (FW-LIGHTHOUSE-CALC, R951-R953). Hand-written, so asserted rather than
// argued: tests/unit/meta/declaration-parity.test.ts discovers every .d.mts
// beside a .mjs and requires the two export lists to match (R185).

export declare const DESKTOP_ROUTES: readonly string[];
export declare const LCP_ROUTE: string;
export declare const LCP_LIMIT_MS: number;
export declare const NUMBER_OF_RUNS: number;

export interface MobileSettings {
  readonly formFactor: 'mobile';
  readonly throttlingMethod: 'simulate';
  readonly throttling: {
    readonly rttMs: number;
    readonly throughputKbps: number;
    readonly requestLatencyMs: number;
    readonly downloadThroughputKbps: number;
    readonly uploadThroughputKbps: number;
    readonly cpuSlowdownMultiplier: number;
  };
  readonly screenEmulation: {
    readonly mobile: boolean;
    readonly width: number;
    readonly height: number;
    readonly deviceScaleFactor: number;
    readonly disabled: boolean;
  };
  readonly onlyCategories: readonly string[];
}

export declare const MOBILE_SETTINGS: MobileSettings;

export declare function mobileRc(): {
  readonly ci: { readonly collect: { readonly numberOfRuns: number; readonly settings: MobileSettings } };
};

export declare function median(values: readonly number[]): number;

export type LcpVerdict =
  | {
      readonly status: 'pass' | 'fail';
      readonly samples: number[];
      readonly median: number;
      readonly limitMs: number;
      readonly why: string;
    }
  | { readonly status: 'refused'; readonly why: string };

export declare function lcpVerdict(lhrs: readonly unknown[], url: string): LcpVerdict;

export interface DesktopVerdict {
  readonly status: 'pass' | 'fail' | 'refused';
  readonly passed: number;
  readonly failures: string[];
  readonly why: string;
}

export declare function desktopVerdict(results: readonly unknown[], urls: readonly string[]): DesktopVerdict;

export interface Samples {
  readonly samples: number[];
  readonly median: number;
}

export interface RouteSummary {
  readonly url: string;
  readonly runs: number;
  readonly categories: Readonly<Record<string, Samples>>;
  readonly lcp: Samples | null;
}

export declare function summarizeRuns(lhrs: readonly unknown[]): RouteSummary[];

export declare function countLine(checks: number): string;
