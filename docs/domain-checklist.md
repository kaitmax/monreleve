# docs/domain-checklist.md - turning monreleve.ch on

The site is live at **https://monreleve.ch** and the deployed **code is at `main`**
(verified feature by feature - see below). What is *not* yet switched on is
everything that needs a credential, a DNS record, or a deliberate setting the
operator holds and this repository must never carry.

This file is the operator's list. Every item names **which setting**, **the exact
value** (or where to copy it from when only the operator's dashboard has it),
**where it goes**, and **a command that proves it worked**. Ordered **most urgent
first**.

Nothing here was done by the session that wrote this file. It has no access to the
production server, the DNS provider, the Resend dashboard, or any inbox, and it
never claims an operator step was performed.

(This file is kept pure ASCII on purpose: REPORT-DOMAIN.txt embeds it verbatim and
that report must be ASCII. Accented French words are written unaccented here.)

> **How the live site was read (2026-10-06).** `/api/health` ->
> `{"service":"monreleve","status":"ok","origin":"https://monreleve.ch","runtime":true}`;
> `http://` -> `302` -> `https://`; TLS valid (Let's Encrypt). Every page that does
> **not** touch the database serves correctly. Every page that **does** returns
> **HTTP 500** - which is item 1.

---

## 1. The production database - every data-backed request returns 500  (MOST URGENT)

**Symptom, measured.** On the live site:

| Request | Touches the DB? | Result |
|---|---|---|
| `/api/health`, `/api/ready`, static pages, sitemap | no | 200 OK |
| `/verifier/<non-hex>` (rejected before the query) | no | 200 OK (neutral page) |
| `/verifier/<32-hex code>` (`issuanceRecord.findUnique`) | **yes** | **500** (3/3) |
| `POST /api/v1/auth/code` well-formed (`verificationToken.findFirst`) | **yes** | **500** |

Two independent read paths - the latest table (`IssuanceRecord`, FW-VERIFY) **and**
an early one (`VerificationToken`, FW22) - both 500. That rules out "one migration
missing" and points at the database being **unreachable or unmigrated** from the
app container. While this holds, **sign-in (code and link) and the verification
page are broken**, and the alert form falls back to its "service indisponible"
message (it catches the DB error rather than 500-ing).

**What to do** (the operator, on the production host - this session cannot reach the DB):

1. Confirm `DATABASE_URL` is set and the app container can reach PostgreSQL
   (host, port, credentials, network). deploy.md section 2 - the container refuses
   to start without `DATABASE_URL`, and it *is* running, so the string is present;
   the question is whether it points at a reachable, migrated database.
2. Apply migrations as the deliberate pre-serve step in **deploy.md section 4**:

   ```
   docker run --rm -e DATABASE_URL=... monreleve:prod \
     node node_modules/prisma/build/index.js migrate deploy
   ```

**Proof it worked** (both must flip from 500 to the values shown):

```
curl -s -o /dev/null -w "%{http_code}\n" \
  https://monreleve.ch/verifier/0123456789abcdef0123456789abcdef      # expect 200 (neutral page)

curl -s -X POST -H 'content-type: application/json' \
  -d '{"email":"probe@example.invalid","code":"000000"}' \
  https://monreleve.ch/api/v1/auth/code                               # expect 400 invalid_code, never 500
```

---

## 2. The alert form sends email  (do this the moment the DB is up)

The alert form is on the live site. Once item 1 is fixed it will **accept
addresses**; with no Resend key the mailer keeps every message **in memory and
delivers nothing** (deploy.md section 2, FW28). An address accepted and silently
unmailed breaks the promise the form makes, so this is the first email item.

| Setting | Value | Where |
|---|---|---|
| `RESEND_API_KEY` | from the Resend dashboard | production env |

The sender address is **fixed in code** as `alertes@notifications.monreleve.ch`
(`EMAIL_FROM`, derived from `MAIL_SUBDOMAIN`) - it is **not** an environment
variable, so there is nothing to set for it, but the sending **domain**
`notifications.monreleve.ch` must be verified in Resend (item 3).

> deploy.md section 8 N2 lists `EMAIL_FROM` as an operator setting. The code does
> **not** read it from the environment (it imports the constant). Treat the sender
> as fixed; the only email key to set is `RESEND_API_KEY`.

**Proof** (the operator does this with their own address - the session cannot):
subscribe on https://monreleve.ch/alertes and **confirm the confirmation email
arrives**. **Until it does, consider hiding the alert form** so it never accepts an
address it cannot confirm.

---

## 3. Resend sending domain + DNS (SPF, DKIM, DMARC)

**Measured 2026-10-06** (authoritative NS: Cloudflare): **no** SPF, DKIM, DMARC, or
MX records resolve for `monreleve.ch` **or** `notifications.monreleve.ch`. The
sending domain is not set up, so even with a key, double opt-in lands in spam and
the list silently stops growing (deploy.md section 8 N3).

**What to do:**

1. In Resend, add and verify the sending domain **`notifications.monreleve.ch`**.
2. Resend then shows the **exact** SPF (`TXT`), DKIM (`TXT`, e.g.
   `resend._domainkey.notifications...`) and MX records. **Copy them verbatim**
   into Cloudflare DNS. Do **not** invent them - the values are Resend's.
3. Add a DMARC record at `_dmarc.monreleve.ch` (at minimum
   `v=DMARC1; p=none; rua=mailto:<you>`).

**Proof** (each must return a record):

```
nslookup -type=TXT notifications.monreleve.ch 8.8.8.8                       # SPF
nslookup -type=TXT resend._domainkey.notifications.monreleve.ch 8.8.8.8     # DKIM (selector per Resend)
nslookup -type=TXT _dmarc.monreleve.ch 8.8.8.8                             # DMARC
```

and the Resend dashboard shows the domain **Verified**.

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
