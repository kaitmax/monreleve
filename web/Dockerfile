# web/Dockerfile
#
# ============================================================================
# RULING R249: A DEPLOYMENT IS A CLAIM ABOUT A MACHINE, NOT A FILE
# ============================================================================
#
# "The Dockerfile builds" is not the claim. "This image, on this host, serves
# this product correctly" is. So nothing in FW28 is asserted against a build's
# exit code: every check runs against a RUNNING CONTAINER - the health
# endpoints, a rendered page, a produced PDF. That is R154's shape at the
# infrastructure layer, one level below where it was first written.
#
# A build that exits 0 proves that a sequence of commands succeeded. It cannot
# tell you the server binds an address the proxy can reach, that Chromium
# starts, that the fonts arrived, or that the document a fiduciaire receives
# has glyphs in it. Each of those has its own assertion, against a container.
#
# ============================================================================
# THE FOUR ENVIRONMENT FACTS, AND WHY EACH IS HERE RATHER THAN IN COOLIFY
# ============================================================================
#
#   HOSTNAME=0.0.0.0        Next's standalone server binds 127.0.0.1 by
#                           default, which a reverse proxy in another
#                           container cannot reach: the symptom is a 502 with
#                           a server that is running perfectly and logging
#                           nothing. It belongs in the IMAGE because it is a
#                           property of being containerised, not a property of
#                           one deployment.
#   TZ=Europe/Paris         SPEC's day boundaries are Paris days. A container
#                           defaulting to UTC puts every entry made between
#                           midnight and 02:00 CEST on the wrong DAY, in the
#                           document whose whole value is which day a thing
#                           happened on.
#   FRONTALIER_RUNTIME=1    The marker that distinguishes SERVING from
#                           BUILDING, which NODE_ENV cannot: `next build` sets
#                           NODE_ENV=production too, and an earlier guard
#                           keyed on it broke every local build (R81).
#   FRONTALIER_CHROMIUM_PATH
#                           lib/export/pdf.ts takes the system Chromium
#                           through playwright-core rather than downloading
#                           one. Empty is treated as unset there, deliberately.
#
# A deployment-specific value - DATABASE_URL, NEXT_PUBLIC_SITE_URL, the
# secrets - is NOT here. Those are supplied by the host and the entrypoint
# refuses to start without them (R250).

# ============================================================================
# THE BROWSER IS PINNED, AND THE PIN IS VERIFIED (R249)
# ============================================================================
#
# AN UNPINNED BROWSER IS A RENDERER THAT CHANGES WITHOUT A COMMIT. The PDF is
# the product's output of record; `apt-get install -y chromium` would let the
# thing that draws it move between two builds of the same source, and the
# first anybody would know is a document that looks different.
#
# WHY A VERIFIED PIN RATHER THAN A BARE `=version`. Debian removes superseded
# point releases from the mirror, so a hard pin turns every security update
# upstream into a BUILD FAILURE WITH NO DIAGNOSIS - "package has no
# installation candidate" - months later, on an unrelated commit. The pin is
# stated, the install is attempted, and the INSTALLED version is compared
# against it. Drift stops the build with a message naming both versions, and
# the fix is a one-line commit to this ARG. That is exactly the property the
# ruling asks for: the browser cannot move without a commit.
ARG NODE_IMAGE=node:22-bookworm-slim
ARG CHROMIUM_VERSION=155.0.8059.79-1~deb12u1

# ---------------------------------------------------------------------------
# deps - node_modules from the lockfile, and nothing else
# ---------------------------------------------------------------------------
# SEPARATE FROM THE BUILDER so that a source edit does not reinstall. The
# lockfile is the input; `--frozen-lockfile` makes a lockfile that disagrees
# with package.json a failure rather than a silent resolution, which is the
# same claim gate:clone makes about a fresh install.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

RUN corepack enable

# prisma/ and prisma.config.ts come first because `postinstall` runs
# `prisma generate`, and a missing schema there fails with "no exported member
# 'PrismaClient'" several steps later, in the typecheck of unrelated code.
# That is the FW14 defect, and the fix is to let postinstall do its job here.
# pnpm-workspace.yaml IS NOT OPTIONAL, AND LEAVING IT OUT FAILED LOUDLY.
#
# This repository is a single package (SPEC D1) and the file exists for one
# reason: pnpm 11 refuses to run a dependency's build scripts until they are
# ANSWERED, and this is where they are answered - Prisma's allowed,
# @parcel/watcher's declined. Without it the install ends in
# ERR_PNPM_IGNORED_BUILDS with prisma unbuilt.
#
# It is the FW14 defect one layer out: a file that exists on the development
# machine, is never thought of as an input, and is absent from a fresh build.
# gate:clone catches that class for a CLONE; a build context needs the same
# care, and this line is it.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma

# THE FIRST BUILD TIMED OUT HERE, AND THE NUMBERS ARE WHY THESE THREE LINES
# EXIST. Individual registry requests took 17-19 s and pnpm 11's supply-chain
# policy check spent 7 m 33 s verifying 1042 lockfile entries before the
# default fetch timeout aborted the install.
#
# THE CHECK STAYS. It is a security pass over the lockfile of the image that
# faces the internet, and "it made the build slow" is not a reason to stop
# verifying the dependencies of a deployment artefact. What changes is the
# budget it is given and whether a retry has to pay for it twice.
#
# The cache mount is a BUILD cache, not an image layer: node_modules is
# materialised into /app either way, so nothing about what ships depends on
# whether this machine had a warm store.
# CONFIGURED BY ENVIRONMENT, NOT BY `pnpm config set --global`. That command
# writes to PNPM_HOME and then refuses unless PNPM_HOME/bin is on PATH -
# an error about a global BIN directory raised by a command that was only
# setting a STORE directory. The env form has no such coupling.
ENV npm_config_store_dir=/pnpm/store

# --network-concurrency IS THE ONE THAT FIXED IT, and the reason is worth a
# line because the obvious knob was the wrong one. Raising the timeout alone
# failed twice: the default 16 parallel fetches SATURATE a slow link, so each
# individual request took 40-50 s and tripped its own deadline. Fewer requests
# in flight means each one completes; the timeout is raised as well, but it
# was the concurrency that was causing the timeouts it was being asked to
# tolerate.
RUN --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile \
      --network-concurrency=4 \
      --fetch-timeout=600000

# ---------------------------------------------------------------------------
# builder - next build, standalone
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NO DATABASE, ON PURPOSE. `pnpm build` must succeed with no DATABASE_URL and
# no .env - the same condition gate:clone builds under. A build that needs a
# live database is a build that cannot run in CI, and an import-time Prisma
# client fails here with "Failed to collect page data" rather than at runtime.
#
# `pnpm build` is `copy-fonts && next build`: the fonts are GENERATED here,
# never copied from the host (.dockerignore excludes them).
# FRONTALIER_STANDALONE=1 IS WHAT MAKES THIS A DEPLOYABLE BUILD. next.config.ts
# emits `output: 'standalone'` only when it is set, because setting it
# unconditionally broke `pnpm build` on the Windows development machine - the
# tracer reproduces pnpm's store with symlinks, which Windows refuses without
# elevated privilege. This is the machine that has to produce the bundle, so
# this is where the flag belongs.
# ============================================================================
# THE SITE ORIGIN IS A BUILD INPUT, AND FINDING THAT OUT COST 41 FAILURES
# ============================================================================
#
# NEXT_PUBLIC_SITE_URL is read at RUNTIME by the server bundle - /api/health
# reports the value passed to `docker run`, so the obvious conclusion is that
# supplying it at runtime is enough. IT IS NOT, and the difference is
# prerendering: every static route's <head> is rendered DURING `next build`.
# A canonical computed then, with the variable unset, is frozen into the HTML
# that ships, and no runtime value can reach it.
#
# MEASURED, NOT REASONED. The e2e suite run against this image failed 41 of
# 284 while `next start` on the same source passes all 284. The container
# served correct CSS, correct scripts, a correct /api/health naming the right
# origin - and zero <link rel="canonical"> on a static page.
#
# THE CONSEQUENCE IS THAT THE IMAGE IS ENVIRONMENT-SPECIFIC, which is a real
# deployment fact rather than a wart to hide: the production image is built
# with https://monreleve.ch and a staging image is a different build. docs/
# deploy.md states it, because somebody will otherwise promote a staging image
# to production and get canonicals pointing at staging - a failure that is
# invisible in every test and expensive in search.
#
# The default is DELIBERATELY the stand-in rather than the production origin.
# A build that forgets the argument must produce a visibly wrong artefact, not
# a silently-production-looking one.
ARG NEXT_PUBLIC_SITE_URL=""

ENV NEXT_TELEMETRY_DISABLED=1 \
    FRONTALIER_STANDALONE=1 \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN pnpm build

# ---------------------------------------------------------------------------
# runner - the image that actually serves
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
ARG CHROMIUM_VERSION
WORKDIR /app

# Chromium, the fonts under it, and the zoneinfo TZ needs to mean anything.
#
# fonts-liberation IS A FALLBACK, NOT THE DOCUMENT'S FONT. Inter reaches the
# renderer as woff2 over HTTP from this same server, because the print route
# is a page and its @font-face rule points at /fonts. What this package buys
# is that a FAILED webfont degrades to readable glyphs instead of to tofu -
# and increment 6 asserts the webfont actually loaded, because a fallback that
# renders cleanly is precisely the failure nobody notices.
RUN set -eux; \
    apt-get update; \
    # THE PIN IS TRIED FIRST, so apt never installs a version this image did
    # not ask for. If that fails, the failure is DIAGNOSED rather than left as
    # apt's bare "Version ... was not found" - which is what an operator saw on
    # 2026-10-14 when Debian dropped the pinned build and the deploy stopped.
    if ! apt-get install -y --no-install-recommends \
           "chromium=${CHROMIUM_VERSION}" \
           fonts-liberation \
           tzdata \
           ca-certificates; then \
      echo "" >&2; \
      echo "R249: chromium ${CHROMIUM_VERSION} is not installable from this archive." >&2; \
      echo "" >&2; \
      echo "      WHY THIS HAPPENS ON A COMMIT THAT TOUCHED NOTHING. Debian keeps" >&2; \
      echo "      only the NEWEST point release in bookworm-security, so the day a" >&2; \
      echo "      new Chromium ships the pinned one leaves the mirror and every" >&2; \
      echo "      build begins failing - including deploys of commits that built" >&2; \
      echo "      yesterday. Nothing in this repository changed." >&2; \
      echo "" >&2; \
      echo "      Versions the archive offers right now:" >&2; \
      apt-cache madison chromium >&2 || echo "      (apt-cache madison returned nothing)" >&2; \
      echo "" >&2; \
      echo "      TO FIX, set BOTH of these to one of the versions above - they" >&2; \
      echo "      are two sources of truth and the second one wins:" >&2; \
      echo "        1. ARG CHROMIUM_VERSION in web/Dockerfile" >&2; \
      echo "        2. the CHROMIUM_VERSION env var in Coolify (build-time)," >&2; \
      echo "           which is passed as a build arg and OVERRIDES the file" >&2; \
      echo "" >&2; \
      exit 1; \
    fi; \
    installed="$(dpkg-query -W -f='${Version}' chromium)"; \
    if [ "$installed" != "${CHROMIUM_VERSION}" ]; then \
      echo "R249: chromium resolved to ${installed}, this image pins ${CHROMIUM_VERSION}." >&2; \
      echo "      An unpinned browser is a renderer that changes without a commit." >&2; \
      echo "      Bump CHROMIUM_VERSION in web/Dockerfile and commit the change." >&2; \
      exit 1; \
    fi; \
    printf '%s\n' "$installed" > /etc/frontalier-chromium-version; \
    rm -rf /var/lib/apt/lists/*

# THE ORIGIN THIS IMAGE WAS BUILT FOR, recorded so the entrypoint can refuse a
# mismatch. Static routes bake their canonicals at build time, so an image
# built for staging and run with a production NEXT_PUBLIC_SITE_URL serves
# production traffic with canonicals pointing at staging - correct in every
# test, invisible in every log, and expensive in search.
#
# The same move as the chromium version file: an artefact records what went
# into it, so the claim can be checked rather than assumed.
ARG NEXT_PUBLIC_SITE_URL
RUN printf '%s\n' "${NEXT_PUBLIC_SITE_URL}" > /etc/frontalier-site-origin

# UNPRIVILEGED, and --no-sandbox in lib/export/pdf.ts is the consequence: the
# container has no user-namespace support, so Chromium's own sandbox cannot
# start. Running the SERVER as root to get it back would trade a sandbox
# inside a container for root inside that container, which is the worse half.
# ============================================================================
# A WRITABLE HOME, BECAUSE CHROMIUM NEEDS ONE AND /app IS ROOT'S
# ============================================================================
#
# MEASURED, NOT ANTICIPATED. With --home /app the user's HOME was a directory
# created by WORKDIR and owned by ROOT, so the unprivileged user could not
# write into it. Chromium refused to start with
#
#   Failed to create headless user data directory container
#
# and the PDF route answered 503 `renderer_unavailable` - the product's
# OUTPUT OF RECORD could not be produced in the image at all. Nothing before
# increment 6 could have seen it: the build succeeds, the server serves, 270
# e2e specs pass, and the one thing that needs a browser is the one thing
# none of them exercise.
#
# --chown on the COPY lines below chowns what is COPIED. It does not chown
# /app itself, which is the distinction that hid this.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --home-dir /home/nextjs --create-home --shell /usr/sbin/nologin nextjs

ENV HOME=/home/nextjs

# Next's standalone output: server.js plus exactly the traced node_modules.
# static/ and public/ are NOT traced - they are served from disk and have to
# be copied beside it, which is the step whose omission produces a site with
# no CSS and a perfect Lighthouse performance score (R177).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The migrations travel with the image so that the version being deployed and
# the migrations applied for it are the same artefact. Running them is a
# separate, deliberate step - see docs/deploy.md - because a server that
# migrates on boot migrates once per replica, concurrently.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# R250'S TWO FILES, COPIED EXPLICITLY BECAUSE NOTHING TRACES THEM.
#
# Next's standalone tracer follows what server.js imports. The entrypoint runs
# BEFORE server.js and is imported by nothing, so it is invisible to the
# tracer - the same reason R246 says an entry point is reachable from no
# import. Its one dependency comes with it, at the path it imports:
# scripts/entrypoint.mjs resolves ../lib/deploy/placeholders.mjs, which is
# /app/lib/deploy/placeholders.mjs here and in the repository alike.
COPY --from=builder --chown=nextjs:nodejs /app/lib/deploy/placeholders.mjs ./lib/deploy/placeholders.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/entrypoint.mjs ./scripts/entrypoint.mjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    TZ=Europe/Paris \
    FRONTALIER_RUNTIME=1 \
    FRONTALIER_CHROMIUM_PATH=/usr/bin/chromium

USER nextjs
EXPOSE 3000

# ============================================================================
# R375: A RUNTIME HEALTH SIGNAL IS LIVENESS
# ============================================================================
#
# THIS USED TO PROBE /api/ready, under this comment:
#
#     # The readiness endpoint, NOT liveness (R83). Coolify's DEPLOY health
#     # check points here: /api/ready returns 503 while degraded, which stops
#     # a bad deploy and leaves the running version serving. /api/health
#     # returns 200 whenever the process answers, because an orchestrator
#     # RESTARTS what fails liveness and a restart cannot supply a missing
#     # environment variable.
#
# Every sentence in it is true, and it is describing the WRONG PROBE.
# Coolify's deploy health check is configured in Coolify and runs ONCE, when a
# version is released; this instruction runs every 10 seconds for the entire
# life of the container. They are two different checks and only the first is
# about readiness.
#
# R83 SAID SO ALREADY, in the sentence after the one quoted above: "Wire the
# restart policy, if any, at /api/health." So this was never a ruling being
# followed - it was one being half-applied to the probe it does not govern.
# R375 records the correction, because a citation left standing reads as
# agreement.
#
# IT WAS HARMLESS UNTIL FW-READY, which is why it survived. While /api/ready
# could not fail at runtime the two endpoints answered alike in a healthy
# container. R353-R357 made /api/ready check the DATABASE, so from that commit
# a database outage marks the SERVING container unhealthy every 10 seconds -
# and anything routing or restarting on Docker health may then take the whole
# site down, including the pages R357 exists to keep serving without a
# database.
#
# THE ARGUMENT DOES NOT DEPEND ON WHAT COOLIFY DOES with an unhealthy
# container, which is why this is a ruling and not an investigation. Whatever
# consumes the signal, a probe that runs continuously is a liveness probe, and
# a liveness probe that fails on a degraded dependency asks for a restart that
# cannot fix it.
#
# tests/unit/meta/healthcheck-target.test.ts asserts both directions, and
# docs/deploy.md states the split: container -> /api/health, Coolify's deploy
# check -> /api/ready.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# R250: THE PREFLIGHT IS THE ENTRYPOINT, so a misconfigured container never
# becomes a serving one. It refuses on a PLACEHOLDER at any severity and on an
# absent REQUIRED variable, exits non-zero with the variable named, and
# otherwise spawns server.js and forwards SIGTERM to it.
#
# It deliberately does NOT refuse an absent degradable variable: that is a
# designed state the product reports through /api/ready, and converting it
# into a crash would turn "this deploy did not go out" into a crash-loop -
# which is what R83 argues against, since a restart cannot supply a missing
# environment variable.
ENTRYPOINT ["node", "scripts/entrypoint.mjs"]
