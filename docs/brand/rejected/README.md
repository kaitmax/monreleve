# Rejected brand assets

Nothing in this directory may be used. It exists so that a rejected asset has
somewhere to live other than a place someone will reach for it — and so the
reason is recorded next to the file rather than in a commit message nobody
reads.

## `frontier-logo-symbol.svg` — rejected under ruling R82

It sat in the repository root, named like the product's logo, while the header
needed a mark. That is the shape of trap this directory exists to defuse: a
plausible filename in an obvious location is reached for before anyone checks
whether it is allowed.

Three independent reasons, any one of which is disqualifying:

1. **It is built from gradients.** Three `linearGradient` definitions —
   `leftBlue`, `rightGray`, and an `frBlue`/`frRed` pair. "Never draw … a
   gradient" is on the *never draw* list in every FD brief (FD1 §Visual
   language, and the same list in FD2 and FD11).

2. **It is a literal flag.** The `frBlue`/`frRed` pair reads as the French
   tricolour. "Never a flag" is explicit in the briefs, and contrary to
   Frontier §79: country identity is carried by **dots and chips**, never by
   flag imagery — a product about two countries cannot lean on one country's
   flag.

3. **Its colours are outside the token set.** `#0B63E8`, `#F62D3F` and the rest
   appear nowhere in `lib/ui/core/styles/tokens.scss`, so using it would put
   raw hex on a public page — the one thing `stylelint` and SPEC §20 forbid
   without exception.

### What the header uses instead

`web/lib/ui/react/PublicShell/Wordmark.tsx` draws a **placeholder geometric
mark** inline: two short horizontal strokes meeting a vertical one — a frontier
and the two sides of it — at `--size-icon`, in `currentColor`, `aria-hidden`
because `APP_NAME` renders beside it.

It is deliberately a placeholder. FW9's prompt is explicit that there is *no
logo design* and that the product name itself is an open question in SPEC §22,
so the mark claims nothing it would be embarrassing to have wrong. Replacing it
is a design task, not a code task.

### What stops this recurring

`web/tests/unit/meta/no-gradients.test.ts` fails on any `linearGradient` or
`radialGradient` in an SVG — file or inline markup — anywhere under `app/`,
`lib/` or `public/`. This directory is outside that scan on purpose: the asset
is kept as a record, and a record that failed the build would just be deleted.
