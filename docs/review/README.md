# Artifacts for human review

Files here answer questions no test can. Each names the question and the task
that produced it.

## `rail-200px.png` — Checkpoint A

**The question:** at a Facebook-thumbnail width, can the two regulatory ticks
be told apart? They mark 40 % and 49,9 % — 9,9 percentage points, which is
19,8 px of a 200 px track.

Produced by FW7, increment 6. It is a byte-for-byte copy of
`web/tests/visual/baselines/rail-inline-200px.png`, captured inside the
Playwright Linux container (ruling R37) so the font stack is the same one CI
compares against.

**Status: awaiting a human.** My own reading, which is not the answer: the
ticks and their labels `40 %` and `49,9 %` are legible and clearly separated,
because ruling R39 anchors the two labels outward from their ticks rather than
left-aligning both. That part appears to work.

**But look at the band names before you answer.** At 200 px the three —
`Imposition Suisse`, `Imposition France`, `Sécurité sociale France` — overlap
into an illegible run, and at the 376 px default the first two still touch.
That is a separate defect from the tick question, it is recorded as an open
question in `REPORT-FW7.txt`, and it needs a product decision (truncate, drop
them below some width as `compact` already does, or stack) that FW7 did not
have a ruling for. It does not prevent answering the tick question, but it
does dominate the image.
