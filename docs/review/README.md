# Artifacts for human review

Files here answer questions no test can. Each names the question and the task
that produced it.

## `rail-200px.png` — Checkpoint A

**The question, and it is now the only one:** at a Facebook-thumbnail width,
can the two regulatory ticks be told apart? They mark 40 % and 49,9 % — 9,9
percentage points, which is 19,8 px of a 200 px track.

Produced by FW7 and regenerated in FW8 after rulings R44–R46. It is a
byte-for-byte copy of `web/tests/visual/baselines/rail-inline-200px.png`,
captured inside the Playwright Linux container (ruling R37) so the font stack
is the one CI compares against.

**Status: awaiting a human.**

### What changed since the first version

The first artifact had a second problem that dominated it: the three band
names — `Imposition Suisse`, `Imposition France`, `Sécurité sociale France` —
were centred over their bands and overlapped into an illegible run at 200 px,
and still touched at the 376 px default.

That is **resolved by removal**, not by tuning. Ruling R45 established that
centring words over bands cannot work at any realistic width: `Imposition
France` measures 93,7 px at Micro 11/500 and sits over a band that is 9,9 % of
the track, so it would need roughly 950 px of rail before it stopped
colliding. The band names left the SVG entirely. In `inline` and `compact` the
React wrapper renders them as an HTML legend beneath the rail, where a layout
engine can measure and wrap them; only the `social` card keeps them inside the
SVG, stacked one per line at a fixed left edge.

Ruling R46 also took the tick width from 1,5 px to 2 px, because 1,5 cannot
sit on the device pixel grid and the two ticks were rendering asymmetrically
from each other — one a symmetric grey pair, the other lopsided. That is
exactly the kind of thing this review is for, so it is worth confirming the
two ticks now look like each other.

### So when you look

Only the ticks are in question. The image should show the rate, the filled
rail, two evenly-drawn tick marks and their labels `40 %` and `49,9 %`. My own
reading, which is not the answer: the labels are legible and clearly
separated, because ruling R39 anchors them outward from their ticks rather
than left-aligning both.

If the ticks are not distinguishable at this size, the thing to change is the
tick treatment — width, colour, or a different mark — not the labels.
