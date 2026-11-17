# docs/domain-checklist.md - turning monreleve.ch on

The site is live at **https://monreleve.ch** and the deployed **code is at `main`**
(verified feature by feature - see below). What is *not* yet switched on is
everything that needs a credential, a DNS record, or a deliberate setting the
operator holds and this repository must never carry.

This file is the operator's list. Every item names **which setting**, **the exact
value** (or where to copy it from when only the operator's dashboard has it),
**where it goes**, and **a command that proves it worked**. Ordered **most urgent
first**.

Nothing here was done by the session that WROTE this file: it had no access to the
production server, the DNS provider, the Resend dashboard, or any inbox, and it
never claimed an operator step was performed.

**Item 1 was since done, on 2026-10-14, by a session the operator granted server
access to.** Its entry records what was run and what was measured. Every other
item is still outstanding and still needs the operator.

(This file is kept pure ASCII on purpose: REPORT-DOMAIN.txt embeds it verbatim and
that report must be ASCII. Accented French words are written unaccented here.)

> **How the live site was read (2026-10-06).** `/api/health` ->
> `{"service":"monreleve","status":"ok","origin":"https://monreleve.ch","runtime":true}`;
> `http://` -> `302` -> `https://`; TLS valid (Let's Encrypt). Every page that does
> **not** touch the database serves correctly. Every page that **does** returns
> **HTTP 500** - which was item 1.
>
> **Re-read 2026-10-14, after the migrations ran.** The data-backed paths now
> answer: `/verifier/<32 hex>` -> `200`, `POST /api/v1/auth/code` -> `400
> invalid_code`. `/api/health` is unchanged at `200` - and that is the point of
> the note under item 1, because it read `200` throughout the outage too.

---

## 1. The production database - DONE 2026-10-14 (was: every data-backed request returns 500)

**Status: fixed and verified.** The database was reachable all along and simply
**unmigrated** - it held zero tables in any schema. 13 migrations were applied
with `prisma migrate deploy`; sign-in and the verification page work.

**How it was diagnosed, since the original guess here was half right.** This
item said the database was "unreachable or unmigrated" and told the operator to
check `DATABASE_URL` first. The container logs settled it in one read:

```
Invalid `prisma.issuanceRecord.findUnique()` invocation:
The table `public.IssuanceRecord` does not exist in the current database.
  code: 'P2021',
```

`P2021` means Prisma **connected and executed** - so `DATABASE_URL` was correct
and the database was reachable. Only the tables were missing. Reading the logs
first would have skipped the whole connectivity investigation; it is the first
thing to do next time, not the last.

**What was run** - see `deploy.md` section 4, whose command was **corrected at
the same time because the one printed here could never have worked**: the
runtime image is Next standalone and carries no Prisma CLI, and Prisma 7 keeps
the datasource in `prisma.config.ts`, which that image does not carry either.
The working procedure stages the migrations out of the image, the CLI out of a
throwaway `node:22` container, and the config out of the repository.

**Proof it worked** - both flipped, measured against the live site:

| Probe | Before | After |
|---|---|---|
| `/verifier/<32 hex>` | 500 | **200** |
| `POST /api/v1/auth/code` (well-formed) | 500 | **400 `invalid_code`** |
| `/api/health` | 200 | 200 (unchanged) |

```
curl -s -o /dev/null -w "%{http_code}\n" \
  https://monreleve.ch/verifier/0123456789abcdef0123456789abcdef      # 200

curl -s -X POST -H 'content-type: application/json' \
  -d '{"email":"probe@example.invalid","code":"000000"}' \
  https://monreleve.ch/api/v1/auth/code                               # 400 invalid_code
```

In the database: `_prisma_migrations` reports **13 finished, 0 failed or
rolled back**, and `public` now holds 14 tables including `IssuanceRecord` and
`VerificationToken` - the two the 500s named.

**And the log was checked the only way that proves anything.** The app's log
buffer still contains the old `P2021` lines, so "no errors in the log" would
have been false. Instead: count the `P2021` occurrences, send six fresh
requests to both data-backed endpoints, count again. **Unchanged at 5** - the
remaining lines are history, and nothing new is failing.

**Nothing was backed up, and that was a decision rather than an oversight.**
The database held zero relations in any schema (checked with
`information_schema.tables`, not just `\dt` on `public`), so there was nothing
to lose and the migration was purely additive. On a database with rows, take
the dump first.

**Two things this left behind**, neither fixed here:

- **The deploy health check cannot see this class of failure.** The
  application's Coolify health check is disabled (`health_check_enabled:
  false`), and `/api/health` returns `status: ok` without touching the
  database - which is exactly why the site sat with a dead data layer while
  reporting itself healthy. A check that only proves something is listening
  proves nothing about what (R169). Worth its own task.
- **The host key now needs rotating.** The migration was run over SSH with the
  Coolify-stored host key ("localhost's key"), fetched through the Coolify API
  at `http://164.132.85.231:8000` - **plaintext HTTP**. It is root on the whole
  VPS, not MonReleve-scoped.

---


## 2. The alert form sends email  (do this the moment the DB is up)

The alert form is on the live site. Once item 1 is fixed it will **accept
addresses**; with no Resend key the mailer keeps every message **in memory and
delivers nothing** (deploy.md section 2, FW28). An address accepted and silently
unmailed breaks the promise the form makes, so this is the first email item.

| Setting | Value | Where |
|---|---|---|
| `RESEND_API_KEY` | from the Resend dashboard | production env |

The sender address is **fixed in code**: `EMAIL_FROM`, a constant in
`web/lib/fr/emails.ts`. Nothing reads it from the environment, so there is
nothing to set for it (deploy.md section 2's `EMAIL_FROM` row). Its domain is
`MAIL_DOMAIN` in `web/lib/content/identity.ts`, and that domain must be verified
in Resend. Item 3 names `notifications.monreleve.ch`, the subdomain the code used
before `MAIL_DOMAIN`; identity.ts records why it changed. Item 3 was written
on 2026-10-06, before that change, and has not been revised since.

**Proof** (the operator does this with their own address - the session cannot):
subscribe on https://monreleve.ch/alertes and **confirm the confirmation email
arrives**. **Until it does, consider hiding the alert form** so it never accepts an
address it cannot confirm.

---

## 3. Resend sending domain + DNS (SPF, DKIM, DMARC)

**The sending domain is the one `MAIL_DOMAIN` holds** in
`web/lib/content/identity.ts`; the senders in `web/lib/fr/emails.ts` are built
on it. This item names the constant, not its value, so read the domain there.
The code moved off a sending subdomain on 2026-10-14 (dcac1df), and the
constant's comment records why.

**Readings** (dated records: none is this item's proof, and none says it is done):

- **2026-10-06** (authoritative NS: Cloudflare): **no** SPF, DKIM, DMARC, or MX
  records resolved for `monreleve.ch` **or** `notifications.monreleve.ch`, the
  subdomain the code sent from then.
- **2026-10-14**: `MAIL_DOMAIN`'s comment records what was measured in
  production that day.
- **2026-11-17, about 09:10Z, from the session's own machine.** One PC's view
  through its own network path - not proof of what the world sees, and nothing
  about what Resend shows. Queried with `nslookup` addressed to 8.8.8.8, with
  the system resolver (10.2.0.1), and over HTTPS (`https://dns.google/resolve`);
  the three agreed. Queries addressed to 1.1.1.1 all timed out, the control
  included, so that resolver gave no result. Controls: `_dmarc.google.com` TXT
  returned its record; a never-used name under `monreleve.ch` returned NXDOMAIN.

  | Queried | Answer |
  |---|---|
  | `notifications.monreleve.ch` A, TXT | NXDOMAIN |
  | `resend._domainkey.monreleve.ch` TXT | one record, beginning `p=MIGfMA0G` |
  | `monreleve.ch` TXT | one record, a `google-site-verification=` token |
  | `monreleve.ch` MX | `10 inbound-smtp.eu-west-1.amazonaws.com` |
  | `_dmarc.monreleve.ch` TXT | NXDOMAIN |
  | `send.monreleve.ch` TXT, MX | CNAME to `send.forge.rmta.net`, which answers TXT `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all` and MX `10 feedback.forge.rmta.net` |

Without these records, even with a key, double opt-in lands in spam and the list
silently stops growing (deploy.md section 8 N3).

**What to do:**

1. In Resend, add and verify the sending domain: **the domain `MAIL_DOMAIN`
   holds** (above).
2. Resend then shows the **exact** SPF (`TXT`), DKIM (`TXT`, e.g.
   `resend._domainkey.<MAIL_DOMAIN>`) and MX records. **Copy them verbatim**
   into Cloudflare DNS. Do **not** invent them - the names and values are Resend's.
3. Add a DMARC record at `_dmarc.monreleve.ch` (at minimum
   `v=DMARC1; p=none; rua=mailto:<you>`).

**Proof** (each must return a record). `<MAIL_DOMAIN>` stands for the
constant's value; query each record by the exact name Resend lists for it:

```
nslookup -type=TXT <SPF name Resend lists for MAIL_DOMAIN> 8.8.8.8     # SPF
nslookup -type=TXT <DKIM name Resend lists for MAIL_DOMAIN> 8.8.8.8    # DKIM (selector per Resend)
nslookup -type=TXT _dmarc.monreleve.ch 8.8.8.8                         # DMARC
```

and the Resend dashboard shows that domain **Verified**.

---

## 4. App-opening sign-in links - `/.well-known/assetlinks.json`

Live state **2026-10-06**: `404 {"status":"not_configured"}` - correct and
honest (R205): the file is withheld until real fingerprints exist, never served as
an empty list. **Not yet configured.**

| Setting | Value | Where |
|---|---|---|
| `ANDROID_PACKAGE_NAME` | `ch.monreleve.app` | production env |
| `ANDROID_SHA256_CERT_FINGERPRINTS` | comma-separated, uppercase, colon-separated SHA-256 (below) | production env |

**The debug keystore fingerprint on the build machine today** (computed this
session from `~/.android/debug.keystore`, alias `androiddebugkey`):

```
EF:33:6D:B5:97:7C:F5:CB:FD:EF:24:30:50:82:FE:C0:A5:C0:1B:9D:11:8B:5A:56:7E:C0:17:44:45:E3:73:D1
```

This verifies **debug installs only**. **At the Play release (AN14b) you MUST add
two more fingerprints** to the same comma-separated value:

- the **release upload key** (the key you sign the AAB with), and
- **Google Play's app-signing key** (Play re-signs the app it distributes -
  Play Console -> App integrity -> App signing key certificate -> SHA-256).

A statement listing **only** the debug key verifies **nothing** for a Play-store
install (PARK4-2). Omit the debug key from production once the release keys exist,
or keep it only if you still sideload debug builds against this origin.

**Proof:**

```
curl -s https://monreleve.ch/.well-known/assetlinks.json       # expect a 200 JSON array:
#   relation ["delegate_permission/common.handle_all_urls"],
#   target.package_name == ch.monreleve.app,
#   target.sha256_cert_fingerprints == the fingerprint(s) above (uppercase, colon-separated),
#   and NEVER an empty list.
```

Then re-verify on the device (deferred this session - phone disconnected): reinstall
so Android re-checks, open a real `https://monreleve.ch` callback link, and read the
state with `adb shell pm get-app-links ch.monreleve.app`.

---

## 5. QR codes on releves - `MONRELEVE_VERIFICATION_ORIGIN`

The QR and the printed verification address appear on a releve **only** when this
dedicated setting names the permanent origin (R332). Unset today, so releves carry
no QR (the honest default).

| Setting | Value | Where |
|---|---|---|
| `MONRELEVE_VERIFICATION_ORIGIN` | `https://monreleve.ch` | production env |

Separate from `NEXT_PUBLIC_SITE_URL` on purpose: a printed QR must point at a
domain that is permanent, so this is its own deliberate switch (https only, bare
origin, no localhost).

**Proof:**

- Locally, with the setting exported, the produced PDF's QR decodes to
  `https://monreleve.ch/verifier/<code>` - asserted by
  `web/tests/db/verification-qr.test.ts` (reads the QR out of the PDF bytes).
- On the live site, once item 1 is fixed, an **unknown** code shows the neutral
  page: `curl -s -o /dev/null -w "%{http_code}\n"
  https://monreleve.ch/verifier/0123456789abcdef0123456789abcdef` -> 200.

> This only works end to end once item 1 is fixed: generating a releve **writes**
> an `IssuanceRecord`, and scanning any real code **reads** one.

---

## Already correct on the live site - no action

- **Code is at `main`.** Health payload, canonicals, sitemap, TLS, and the
  deployed pages all match `main` by content. The API is live (not just the
  website): `GET /api/v1/auth/magic-link` -> 405, `POST /api/v1/auth/code` with a
  bad body -> `400 malformed_body`.
- **Canonicals use the production origin.** Homepage `<link rel="canonical"
  href="https://monreleve.ch"/>`; sitemap entries are `https://monreleve.ch/...`.
  The image was built with `NEXT_PUBLIC_SITE_URL=https://monreleve.ch` (deploy.md
  section 1).
- **`/confidentialite` names Resend** as a processor ("... prestataires
  interviennent de facon limitee : Resend, pour l'envoi des messages ...") -
  confirmed in code and on the live page. No change needed.
