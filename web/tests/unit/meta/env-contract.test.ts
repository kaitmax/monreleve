// web/tests/unit/meta/env-contract.test.ts
//
// RULING R250: THE IMAGE REFUSES TO START ON A PLACEHOLDER, AND ABSENT IS A
// DIFFERENT VERDICT FROM PLACEHOLDER.
//
// The classification is pure so that every branch can be reached without a
// container (R233); increment 2's container run then proves the entrypoint
// actually acts on it, which is the half no unit test can assert (R204).
//
// WHY THE TWO VERDICTS ARE NAMED SEPARATELY (R198). They send whoever is
// reading the log to different places. `absent` means nobody supplied a
// value - the fix is to supply one. `placeholder` means somebody supplied THE
// EXAMPLE, which is a different mistake, with a different urgency, and with
// the nasty property that every naive "is this configured?" check says yes.

import { describe, expect, it } from 'vitest';
import {
  DEPLOYMENT_VARIABLES,
  PLACEHOLDER_PRIVATE_KEY,
  PLACEHOLDER_PROJECT_ID,
  PLACEHOLDER_SECRET,
  classifyEnvironment,
  classifyOrigin,
  classifyVariable,
  describeEnvironment,
} from '../../../lib/deploy/placeholders.mjs';

/** A deployment with everything supplied, as the base for one-field edits. */
function completeEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const variable of DEPLOYMENT_VARIABLES) env[variable.name] = `real-${variable.name}`;

  return env;
}

describe('R250: what a deployment must supply', () => {
  it('found the variables, so nothing below passes vacuously', () => {
    // R63: an empty list would report every environment perfectly valid.
    expect(DEPLOYMENT_VARIABLES.length).toBeGreaterThan(5);

    const names = DEPLOYMENT_VARIABLES.map((variable) => variable.name);

    expect(names, 'the entries table is the product').toContain('DATABASE_URL');
    expect(names, 'signs the print token').toContain('AUTH_SECRET');
    expect(names).toContain('FCM_PROJECT_ID');
  });

  it('a complete environment may serve', () => {
    // THE POSITIVE DIRECTION FIRST (R196). A contract that refuses EVERYTHING
    // passes every negative test below perfectly, and would be indisputably
    // strict while being wrong.
    const report = classifyEnvironment(completeEnv());

    expect(report.mayServe, describeEnvironment(report)).toBe(true);
    expect(report.refusals).toEqual([]);
    expect(report.degraded).toEqual([]);
  });

  it('every variable is classified ok when supplied', () => {
    const report = classifyEnvironment(completeEnv());

    expect(report.results.map((result) => result.verdict)).toEqual(
      DEPLOYMENT_VARIABLES.map(() => 'ok'),
    );
  });
});

describe('R250: a placeholder refuses, at either severity', () => {
  it('refuses the AUTH_SECRET placeholder, which is required', () => {
    const env = { ...completeEnv(), AUTH_SECRET: PLACEHOLDER_SECRET };
    const report = classifyEnvironment(env);

    expect(report.mayServe).toBe(false);
    expect(report.refusals.map((refusal) => refusal.name)).toEqual(['AUTH_SECRET']);
    expect(report.refusals[0]?.verdict).toBe('placeholder');
  });

  it('refuses a DEGRADABLE placeholder too, which is the point of the ruling', () => {
    // FCM_PROJECT_ID absent is a designed state - the reminder job is simply
    // not scheduled, and FW27 made that refusal report itself by name. The
    // PLACEHOLDER is not that state: it is a misconfiguration wearing a
    // configured value, and it must not be allowed to serve merely because
    // the variable it sits in has a graceful absent case.
    const env = { ...completeEnv(), FCM_PROJECT_ID: PLACEHOLDER_PROJECT_ID };
    const report = classifyEnvironment(env);

    expect(report.mayServe, 'a degradable placeholder still refuses').toBe(false);
    expect(report.refusals.map((refusal) => refusal.name)).toEqual(['FCM_PROJECT_ID']);
  });

  it('a placeholder with surrounding whitespace is still a placeholder', () => {
    const env = { ...completeEnv(), FCM_PRIVATE_KEY: `  ${PLACEHOLDER_PRIVATE_KEY}  ` };

    expect(classifyEnvironment(env).mayServe).toBe(false);
  });

  it('names every refusal, not the first', () => {
    const env = {
      ...completeEnv(),
      AUTH_SECRET: PLACEHOLDER_SECRET,
      FCM_PROJECT_ID: PLACEHOLDER_PROJECT_ID,
    };

    expect(classifyEnvironment(env).refusals.map((refusal) => refusal.name)).toEqual([
      'AUTH_SECRET',
      'FCM_PROJECT_ID',
    ]);
  });
});

describe('R250: absent is a different verdict from placeholder', () => {
  it('a required variable absent refuses', () => {
    const env = completeEnv();

    delete env.DATABASE_URL;

    const report = classifyEnvironment(env);

    expect(report.mayServe).toBe(false);
    expect(report.refusals[0]?.name).toBe('DATABASE_URL');
    expect(report.refusals[0]?.verdict, 'absent, NOT placeholder').toBe('absent');
  });

  it('a degradable variable absent STARTS, and is reported', () => {
    // R83's argument, asserted rather than described. Turning this into a
    // refusal would convert "this deploy did not go out" into a crash-loop,
    // and a restart cannot supply a missing environment variable.
    const env = completeEnv();

    delete env.RESEND_API_KEY;

    const report = classifyEnvironment(env);

    expect(report.mayServe, 'an absent degradable variable must not refuse').toBe(true);
    expect(report.degraded.map((entry) => entry.name)).toEqual(['RESEND_API_KEY']);
  });

  it('an empty string is absent, not a value', () => {
    // The permissive default would be to call "" configured. A variable
    // cleared in an orchestrator is the ordinary way a field becomes empty,
    // and this is the guard that exists to catch a permissive default.
    const env = { ...completeEnv(), DATABASE_URL: '   ' };
    const report = classifyEnvironment(env);

    expect(report.mayServe).toBe(false);
    expect(report.refusals[0]?.verdict).toBe('absent');
  });

  it('classifyVariable answers all three verdicts', () => {
    const withPlaceholder = DEPLOYMENT_VARIABLES.find(
      (variable) => variable.placeholder !== null,
    );

    expect(withPlaceholder, 'at least one variable has a published placeholder').toBeDefined();

    if (withPlaceholder === undefined) return;

    expect(classifyVariable(withPlaceholder, 'a real value')).toBe('ok');
    expect(classifyVariable(withPlaceholder, undefined)).toBe('absent');
    expect(classifyVariable(withPlaceholder, withPlaceholder.placeholder)).toBe('placeholder');
  });
});

describe('R249: the image is environment-specific, and the origin proves it', () => {
  // MEASURED BEFORE IT WAS GUARDED. An image built without the origin failed
  // 41 of 284 e2e specs while the same source under `next start` passed all
  // 284: correct CSS, correct scripts, a correct /api/health naming the right
  // runtime origin, and ZERO canonicals - because static routes bake their
  // <head> during `next build` and no runtime value can reach frozen HTML.

  it('agreeing values may serve', () => {
    expect(classifyOrigin('https://monreleve.ch\n', 'https://monreleve.ch')).toBe('ok');
  });

  it('a staging image run with a production origin is a MISMATCH', () => {
    // The failure this exists for: promoting a staging image. Green in every
    // test, invisible in every log, and it serves production traffic with
    // canonicals pointing at staging.
    expect(classifyOrigin('https://staging.monreleve.ch', 'https://monreleve.ch')).toBe(
      'mismatch',
    );
  });

  it('an image built with NO origin, run with one, is UNBUILT', () => {
    // Distinguished from `mismatch` by name (R198): the fix is the same
    // rebuild, but the diagnosis is different - nobody passed the build
    // argument, rather than somebody passed the wrong one.
    expect(classifyOrigin('', 'https://monreleve.ch')).toBe('unbuilt');
  });

  it('built with none and run with none is fine, which is local development', () => {
    expect(classifyOrigin('', undefined)).toBe('ok');
    expect(classifyOrigin('', '')).toBe('ok');
  });

  it('no record at all is UNKNOWN, not ok', () => {
    // R133: "could not look" and "found nothing" must not read alike. An
    // image predating the check has no file, and treating that as agreement
    // would be the permissive default in the guard that exists to catch one.
    expect(classifyOrigin(null, 'https://monreleve.ch')).toBe('unknown');
    expect(classifyOrigin(undefined, 'https://monreleve.ch')).toBe('unknown');
  });
});

describe('R250: what it prints', () => {
  it('names the variable and the verdict, and never the value', () => {
    const env = { ...completeEnv(), AUTH_SECRET: PLACEHOLDER_SECRET };
    const text = describeEnvironment(classifyEnvironment(env));

    expect(text).toContain('AUTH_SECRET');
    expect(text).toContain('PLACEHOLDER');
    expect(text).toContain('WILL NOT START');

    // A container log is a place things get pasted from. An entrypoint that
    // echoed the secret it was complaining about would be a disclosure bug
    // inside the credential guard.
    expect(text, 'the value must never be printed').not.toContain(PLACEHOLDER_SECRET);
  });

  it('distinguishes the two failures in the text a reader sees', () => {
    const absent = completeEnv();

    delete absent.DATABASE_URL;

    const absentText = describeEnvironment(classifyEnvironment(absent));
    const placeholderText = describeEnvironment(
      classifyEnvironment({ ...completeEnv(), AUTH_SECRET: PLACEHOLDER_SECRET }),
    );

    expect(absentText).toContain('ABSENT');
    expect(absentText).not.toContain('PLACEHOLDER');
    expect(placeholderText).toContain('PLACEHOLDER');
    expect(placeholderText).not.toContain('ABSENT');
  });

  it('says so when everything is supplied, rather than printing nothing', () => {
    // R133: silence and success must not read identically.
    expect(describeEnvironment(classifyEnvironment(completeEnv()))).toContain(
      'every deployment variable is supplied',
    );
  });
});
