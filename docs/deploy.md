# docs/deploy.md — deploying Mon Relevé

Written for whoever puts this on a VPS, including the person who wrote it,
six months from now, at an hour when nothing is obvious.

Everything below was **measured against a running container** during FW28, not
inferred from the Dockerfile (R249). Where a claim has not been executed, it
says so under **NEEDS** rather than being written as if it had.

---

## 1. What is being deployed

One image, built from `web/Dockerfile`, serving Next.js standalone output on
port 3000 inside the container.

| | |
|---|---|
| Base | `node:22-bookworm-slim` |
| Runs as | `nextjs`, uid 1001, unprivileged |
| Browser | Debian `chromium`, **pinned** and verified at build time |
| Timezone | `Europe/Paris`, with `tzdata` installed so `Intl` resolves it |
| Entrypoint | `scripts/entrypoint.mjs` — refuses to start on a misconfiguration |

### The image is environment-specific, and that is not negotiable

`NEXT_PUBLIC_SITE_URL` is a **build argument**, not only a runtime variable.
Every static route renders its `<head>` — canonical included — during
`next build`, so an origin supplied only at runtime arrives too late and the
canonicals are already frozen.

```
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://monreleve.ch -t monreleve:prod web/
```

**Measured:** an image built without it failed **41 of 284** e2e specs while
the same source under `next start` passed all of them — correct CSS, correct
scripts, a correct `/api/health` naming the right runtime origin, and **zero**
`<link rel="canonical">`.

The build records the origin in `/etc/frontalier-site-origin`, and the
entrypoint **refuses to start** when the runtime value disagrees. Promoting a
staging image to production is therefore impossible rather than discouraged —
that failure would otherwise be green in every test and invisible in every log.

---

## 2. Environment

### Refused at startup — the container will not run

| Variable | Why |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. The entries table is the product. |
| `AUTH_SECRET` | Signs the short-lived print token. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

**Any variable set to the placeholder `.env.example` ships is also refused**,
at any severity. A placeholder presents as configured — it is a value, it has
the right shape, every naive check passes — so the failure would otherwise be
discovered by a reader, in production, quietly.

### Starts, and reports itself degraded

These are **designed** states. `/api/ready` answers 503 and the entrypoint
names each one at boot. They are deliberately not fatal: a restart cannot
supply a missing variable, so turning them into crashes converts *this deploy
did not go out* into a crash-loop (R83).

| Variable | Absent means |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | localhost stand-in; `/sitemap.xml` and `/api/ready` answer 503; canonicals omitted |
| `RESEND_API_KEY` | confirmation mail is collected in memory and delivered to nobody |
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` | the daily reminder job is **not scheduled at all**, reported by name |
| `ANDROID_PACKAGE_NAME` / `ANDROID_SHA256_CERT_FINGERPRINTS` | `/.well-known/assetlinks.json` is withheld entirely (R205) |

### Set by the image — do not set these in the host

`HOSTNAME=0.0.0.0` · `PORT=3000` · `TZ=Europe/Paris` ·
`FRONTALIER_RUNTIME=1` · `FRONTALIER_CHROMIUM_PATH=/usr/bin/chromium` ·
`NODE_ENV=production`

`HOSTNAME` is the one that bites: Next binds `127.0.0.1` by default, which a
proxy in another container cannot reach. The symptom is a 502 from a server
that is running perfectly and logging nothing.

### Set by the deployment, deliberately

| Variable | Why it is not in the image |
|---|---|
| `FRONTALIER_SCHEDULER=1` | Enables the scheduler against a non-local database. **The image does not set it**, so `docker run monreleve` by hand cannot start notifying people. This process sends reminders without being asked, and a run against a real database is a notification in somebody's hand with no undo (R243). |

---

## 3. Ports and the health checks

| Path | Answers | Point it at |
|---|---|---|
| `/api/ready` | 200 ready, **503 while degraded** | Coolify's **deploy** health check |
| `/api/health` | 200 whenever the process answers | a restart policy, if any |

**They are not interchangeable, and R83 is why.** Readiness returning 503 stops
a deploy and leaves the running version serving — the outcome wanted. Liveness
returns 200 whenever the process answers, because an orchestrator **restarts**
what fails liveness, and a restart cannot supply a missing environment
variable. Wiring the deploy check to `/api/health` would ship a degraded
version; wiring the restart policy to `/api/ready` would crash-loop a container
that is merely missing a credential.

`/api/health` names the product in a `service` field. Every harness in this
repository refuses to run until it sees that name (R169) — a health check that
proves something is listening proves nothing about **what**.

---

## 4. Migrations

The migrations travel **inside the image**, so the version being deployed and
the migrations applied for it are one artefact.

```
docker run --rm -e DATABASE_URL=... monreleve:prod \
  node node_modules/prisma/build/index.js migrate deploy
```

Run it as a **separate, deliberate step** before the new version serves. It is
not run on boot, because a server that migrates on boot migrates once per
replica, concurrently.

---

## 5. Backups, and a restore that has actually been performed

**A backup nobody has restored is a hope.** `pg_dump` running nightly proves a
file is being written; it says nothing about whether that file can be turned
back into a database.

Nightly, from the host:

```
docker exec -e PGPASSWORD=... <postgres> pg_dump --clean --if-exists \
  -d postgresql://<user>@127.0.0.1:5432/<db> -f /tmp/monreleve-$(date +%F).sql
```

### The restore is tested by `pnpm test:container:restore`

It does the destructive half, which is the whole point:

1. a scratch database, migrated from `prisma/migrations`
2. rows seeded into every table the dossier depends on
3. `pg_dump` to a file, and the file asserted non-trivial in size
4. **`DROP DATABASE`** — confirmed gone by querying `pg_database`, not assumed
5. `CREATE` + restore from the file
6. every row count compared, table by table, with what was there before

A restore into a database that still holds its data proves nothing: every
count matches because nothing was lost. The drop is what makes the comparison
mean something.

**Executed during FW28 — see REPORT-FW28.txt for the counts.**

---

## 6. Reminder punctuality, measured (R236)

`REMINDER_CRON` is `*/5 * * * *` and the question parked since FW27 was
whether five minutes is the right number, to be answered on the real image.

**The arithmetic.** A person choosing 17:30 receives their reminder at the
first pass **at or after** 17:30, so worst-case lateness is:

```
  one cron interval            300 000 ms   (*/5)
+ one pass over the due set        273 ms   measured, 500 due users
= worst case                    300 273 ms   = 5 min 0,3 s
```

**Measured**, not estimated: 500 users with reminders enabled, the indexed
query the pass actually runs, timed against a scratch database. The pass is
**0,09 %** of the interval, so the cadence is what decides punctuality and the
query is not going to become the reason a reminder is late.

Correctness does not depend on the interval. *Exactly one per day* is the
unique `(userId, sentOn)` row in `ReminderSent`, and that holds at any cadence
— which is also why two containers produce one notification rather than two.

**If a reminder must arrive at 17:30 rather than by 17:35**, the answer is a
per-minute cron and a heavier query, and that is a product decision about
punctuality rather than a defect. Left at five minutes.

### Concurrency

Every replica runs its own scheduler — `globalThis` is per-process and cannot
see another container. **Measured with two containers against one database: 6
jobs enqueued, 3 executed by each, 6 total.** Work is distributed, not
duplicated, and each log line names the instance that produced it.

There is deliberately **no advisory lock**. A session-held lock survives a
container that dies until its connection is reaped, so the survivor silently
never schedules — a failure indistinguishable from working, because the dead
container had been doing the job. Every claim here is a unique row instead: a
dead container releases nothing because it holds nothing.

---

## 7. Co-hosted sites — do not touch

This VPS hosts other projects. The following are **not** ours:

- any container not named `monreleve-*`
- any database other than the one `DATABASE_URL` names
- ports already bound by another project

**Rules that have already been needed.** When another project holds a port,
move ours rather than stopping theirs. A harness may kill only a process tree
it spawned itself (R179) — a neighbour's container is not one.

Recorded because it happened: during FW28 a Docker engine failure required
`wsl --shutdown`, which stopped every container on the machine. Ours returned
by restart policy; a neighbour's did not, and it was **left alone** rather than
restarted by us.

---

## 8. NEEDS — what the operator must supply

Nothing below was created during FW28. R250 forbids this task from obtaining a
real credential, and every one of these touches a real account or a real
person.

| # | What | Where it goes | Until then |
|---|---|---|---|
| N1 | A Firebase project, a service account, and its private key | `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` | the reminder job is not scheduled, and says so by name |
| N2 | A Resend API key, and a verified sending domain | `RESEND_API_KEY`, `EMAIL_FROM` | confirmation mail is collected in memory and delivered to nobody |
| N3 | **SPF and DKIM** for the sending subdomain | DNS | double opt-in lands in spam and the list silently stops growing — a failure that looks like nobody being interested |
| N4 | The production domain and its TLS certificate | `NEXT_PUBLIC_SITE_URL`, **as a build argument** | the image serves the localhost stand-in and omits canonicals |
| N5 | The Android package name and signing certificate fingerprints | `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_CERT_FINGERPRINTS` | `/.well-known/assetlinks.json` is withheld (R205) |
| N6 | A generated `AUTH_SECRET` | the host's environment | **the container refuses to start** |
| N7 | The VPS, Coolify, and a managed PostgreSQL with nightly dumps | — | nothing is deployed |

**N4 is the one most easily got wrong**, because it is a *build* argument. An
image built for staging and run with a production origin is refused at startup
by design — but an image built with **no** origin starts and serves without
canonicals, which no test catches and search notices slowly.

---

## 9. Not deployed by FW28

`Umami` (SPEC 15 / R143) and `GlitchTip` (D32) are named in `tasks/todo.md` for
this task and are **not** in this image. `/confidentialite` still says the site
does not measure its audience, and `e2e/analytics.spec.ts` holds that sentence
on every public route: no analytics script, no cookie, no third-party request.

Shipping either without changing that sentence fails there, which is the point.
See REPORT-FW28.txt under **PARKED**.
