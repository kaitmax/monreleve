package ch.monreleve.app.data.remote

// AN4 increment 6. The authenticated route the AC1 walkthrough probes to prove
// the access token is accepted (and, after sign-out, refused). GET /api/v1/me is
// read-only and side-effect-free (docs/api-v1.md 9), unlike sign-out/revoke-all
// which would end the session. Lives here, not in dev/, because dev/ carries no
// string literal (fence 4) - the probe references this constant.
const val ME_PATH = "/api/v1/me"
