// web/instrumentation.ts
//
// The one place the scheduler starts. FW27 increment 1, extended by 3.
//
// SPEC §3 names this file specifically: pg-boss "started once in
// `instrumentation.ts` behind a `globalThis` guard so hot-reload and multiple
// workers don't duplicate the scheduler".
//
// ============================================================================
// IT NEVER THROWS
// ============================================================================
//
// `register()` runs before the server accepts requests, so an exception here
// takes the whole application down. A scheduler that will not start is a
// product with no reminders; a web server that will not start is a product
// with nothing at all - and the second is strictly worse for a person trying
// to read their dossier.
//
// The refusal is therefore LOUD IN THE LOG and fatal to nothing (R198: it
// names which rule fired). Under R243 the ordinary development case is that
// it starts; the ordinary production case, until FW28 lifts it deliberately,
// is that it refuses and says so.

export async function register(): Promise<void> {
  // ==========================================================================
  // THE IMPORT IS INSIDE THE `if`, AND AN EARLY RETURN WILL NOT DO
  // ==========================================================================
  //
  // This file is compiled for EVERY runtime, and the Edge bundle cannot
  // resolve `fs`, `path` or `stream` - which pg-boss reaches through `pg`.
  //
  // The first version guarded with `if (NEXT_RUNTIME !== 'nodejs') return;`
  // and put the import after it. That defers EXECUTION correctly and changes
  // nothing about BUNDLING: webpack eliminates a dead `if` BLOCK when the
  // condition is a build-time constant, but an early return leaves the import
  // at function top level where it is always analysed. The build failed on
  // four Node built-ins, and `serverExternalPackages` did not help because it
  // does not reach the Edge compilation of this file.
  //
  // Deferring WHEN something runs says nothing about WHETHER it is bundled.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { SchedulerRefused, isSchedulerRunning, startScheduler } = await import(
      '@/lib/scheduler/boss',
    );
    const { describeRegistration, registerJobs } = await import('@/lib/scheduler/jobs');
    const { describePushSender, resolvePushSender } = await import('@/lib/push/resolve');

    // SAID AT STARTUP, BEFORE ANYTHING DEPENDS ON IT. Whether this process can
    // deliver a push is decided by three environment variables, and the
    // consequence of getting it wrong is silence - reminders that simply never
    // arrive, on an opt-in feature nobody is told has stopped. A line in the
    // log at boot is where somebody actually looks.
    console.log(describePushSender(resolvePushSender()));

    // ASKED BEFORE STARTING, because startScheduler() returns the EXISTING
    // scheduler when there is one and nothing in its answer says which case
    // happened. Registering again would add a SECOND worker to each queue in
    // the same process - harmless for the purge, which is idempotent, and
    // pointless for the reminder, whose unique row already makes a double
    // pass a no-op. Pointless work in a hot-reload loop is still work.
    const alreadyRunning = isSchedulerRunning();

    try {
      const boss = await startScheduler();

      console.log('[scheduler] started');

      // WHAT WILL RUN, AND WHAT WILL NOT, said at boot. Whether this process
      // can deliver a push is decided by three environment variables, and the
      // consequence of getting it wrong is SILENCE - reminders that never
      // arrive, on an opt-in feature nobody is told has stopped.
      if (!alreadyRunning) console.log(describeRegistration(await registerJobs(boss)));
    } catch (cause) {
      if (cause instanceof SchedulerRefused) {
        console.warn(`[scheduler] not started (${cause.code}): ${cause.message}`);

        return;
      }

      console.error('[scheduler] failed to start:', cause);
    }
  }
}
