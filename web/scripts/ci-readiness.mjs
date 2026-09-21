// web/scripts/ci-readiness.mjs
//
// Will the push you are about to make produce red checks that no test caused?
//
// ============================================================================
// THIS CANNOT LIVE IN THE WORKFLOW, AND THAT IS THE WHOLE REASON IT EXISTS
// ============================================================================
//
// The condition it detects is CI_FULL set while the repository is PRIVATE. In
// that state GitHub refuses to start any job at all: on 19 September it
// produced four failed jobs with ZERO STEPS and a forty-second run. A guard job
// inside ci.yml would have been refused along with the rest, so the check has
// to happen where a job can still run - here, before the push.
//
// WHAT WENT WRONG THE FIRST TIME was not the refusal but its message:
//
//   "The job was not started because recent account payments have failed or
//    your spending limit needs to be increased."
//
// That string is emitted for an exhausted allowance AND for a declined card,
// and it was briefly read as a diagnosis of the second. It is a vendor's
// sentence about billing, not a statement about this repository. Naming the
// condition ourselves - CI_FULL on, repository private - is the difference
// between a fact and a transcription (R181, pointed at an error message).
//
// IT REPORTS RATHER THAN REFUSES. The push is sound; gate:clone has just
// proved it. What is wrong is what CI will do with it, and that is a different
// claim - refusing the push would be punishing the work for the setting.
//
// R133: when it cannot check, it says so. An unauthenticated `gh`, no network,
// no `gh` at all - each is reported as UNKNOWN rather than passing quietly,
// because "the guard found nothing" and "the guard could not look" read
// identically in a log and mean opposite things.

import { execFileSync } from 'node:child_process';

/** One `gh` call, or null when gh cannot answer. */
function gh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15_000,
    }).trim();
  } catch {
    return null;
  }
}

export function ciReadiness() {
  const visibility = gh(['repo', 'view', '--json', 'isPrivate', '--jq', '.isPrivate']);

  if (visibility === null) {
    return {
      state: 'unknown',
      why: 'gh could not report the repository visibility (not installed, not authenticated, or offline)',
    };
  }

  const variables = gh(['variable', 'list']);

  if (variables === null) {
    return { state: 'unknown', why: 'gh could not list the repository variables' };
  }

  const isPrivate = visibility === 'true';
  // The list is `NAME\tVALUE\tUPDATED`. A variable set to anything other than
  // `on` does not enable the jobs, so the value is read rather than assumed.
  const full = variables
    .split('\n')
    .map((line) => line.split('\t'))
    .find((cells) => cells[0] === 'CI_FULL');

  const fullOn = full !== undefined && full[1] === 'on';

  if (isPrivate && fullOn) {
    return { state: 'refused', why: 'CI_FULL is on and the repository is PRIVATE' };
  }

  if (isPrivate) {
    return { state: 'quiet', why: 'the repository is private and CI_FULL is unset - jobs will skip' };
  }

  return {
    state: 'ready',
    why: fullOn
      ? 'the repository is public and CI_FULL is on - jobs will run, and the minutes are free'
      : 'the repository is public and CI_FULL is unset - jobs will skip',
  };
}

/** What to print, given a readiness result. Pure, so a test can read it. */
export function describeReadiness(result) {
  if (result.state === 'refused') {
    return [
      '',
      '  CI WILL REFUSE THIS PUSH, AND NOT BECAUSE OF A TEST.',
      `    ${result.why}.`,
      '',
      '    GitHub starts no job in this state - expect failed checks with ZERO',
      '    steps and a billing message. That message is emitted both for an',
      '    exhausted allowance and for a declined card, so it is not a',
      '    diagnosis of either.',
      '',
      '    To make the checks skip cleanly instead:  gh variable delete CI_FULL',
      '    To run them: make the repository public, where the minutes are free.',
      '',
      '    The push itself is sound. This is about what CI does with it.',
    ].join('\n');
  }

  if (result.state === 'unknown') {
    return [
      '',
      `  CI readiness: UNKNOWN - ${result.why}.`,
      '    Not a failure. Said out loud because a guard that could not look and',
      '    a guard that found nothing read identically in a log (R133).',
    ].join('\n');
  }

  return `\n  CI readiness: ${result.state} - ${result.why}.`;
}
