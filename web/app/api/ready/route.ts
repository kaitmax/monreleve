// web/app/api/ready/route.ts
//
// RULING R83: readiness. 503 while degraded, and FW28 points Coolify's deploy
// health check here rather than at /api/health.
//
// THE DIFFERENCE FROM /api/health IS THE WHOLE POINT. Liveness answers "is
// this process alive" and an orchestrator RESTARTS what fails it - which
// cannot fix a missing environment variable, so a liveness check that failed
// on configuration would crash-loop while the previous version stayed down.
// Readiness answers "should this version be sent live", and failing it stops
// the deploy and leaves the running version serving.
//
// So this endpoint is allowed to fail on configuration and /api/health is not.

import { readiness } from '@/lib/content/readiness';

/** Per-request: it reads the runtime marker, which a prerendered response cannot. */
export const dynamic = 'force-dynamic';

// ASYNC SINCE R353: the database check has to ask the database.
export async function GET(): Promise<Response> {
  const result = await readiness();

  return Response.json(result, {
    // 503 rather than 500: the service is temporarily unable to handle the
    // request, which is exactly true and is what a load balancer and a
    // deploy gate both understand.
    status: result.ready ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
