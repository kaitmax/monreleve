// web/instrumentation.ts
//
// The one place the scheduler starts. FW27 increment 1.
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
    const { SchedulerRefused, startScheduler } = await import('@/lib/scheduler/boss');

    try {
      await startScheduler();

      console.log('[scheduler] started');
    } catch (cause) {
      if (cause instanceof SchedulerRefused) {
        console.warn(`[scheduler] not started (${cause.code}): ${cause.message}`);

        return;
      }

      console.error('[scheduler] failed to start:', cause);
    }
  }
}
