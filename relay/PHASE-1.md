PHASE 1 RUNBOOK - FOUNDATION (FW1 to FW9)
==========================================

Purpose: build the engine, the design tokens, and the shared components
before any feature page exists. Nothing in Phase 1 is user-visible.
Everything in Phase 1 is load-bearing.

THE GATE RULE (applies to every step, every increment)
------------------------------------------------------
A step is one FW task. A step is done when:
  1. every acceptance criterion in tasks/todo.md is proven in the report,
  2. pnpm typecheck && pnpm lint && pnpm test && pnpm build are green on
     the final commit in ONE run,
  3. every increment inside the step was committed only while green,
  4. REPORT-FW<N>.txt is committed and pushed.
The next step does not start until the operator has read the report and
issued a verdict (accept / bounce). A bounce fix begins with a failing
reproduction test.

SEQUENCE
--------
Serial order for a single operator. Parallel branches are marked; use them
only if two Claude Code sessions run at once.

  FW1  Scaffold, guardrails, CI                      M   no deps
       -> proves: tokens compile, Inter/tnum served, every lint fence
          fails on a planted violation, size budget wired, CI green

  FW2  Bundle budget spike (fail fast)               S   FW1
       -> proves: measured first-load gzip and font payload recorded in
          docs/perf-spike.md; go / escalate decision written down

  FW3  calc-engine: types, validation, regime,       M   FW1
       denominator, granularity, RuleSet(2026)
       -> proves: type surface exact; RuleSet is the only home of any
          threshold; docs/regulatory-sources.md started

  FW4  calc-engine: waterfall, rates, headroom,      M   FW3
       warnings + Geneva fixtures (TEST-FIRST)
       -> proves: fixtures written and shown FAILING before waterfall
          exists; then all six exact (39,16 / 4,16); two rounding rules
          in separate files

  FW5  calc-engine: property tests + 100% coverage    S   FW4
       -> proves: 8 invariants x 10k cases; coverage gate blocks CI;
          no snapshot test in the package

    [parallel branch after FW1: FW6 -> FW7 may run alongside FW3 -> FW5]

  FW6  ui/core: zones, generated SCSS, formatters    M   FW1
       -> proves: codepoint-exact separators (U+00A0, U+202F); zones.ts
          -> _zones.scss generation with a stale-file check

  FW7  ui/core: renderRailSvg (8 px pill, two ticks) S   FW6
       -> proves: byte-identical Node/browser; baselines per variant x
          zone; 200 px thumbnail kept for human review

  FW8  ui/react: Rail, Badge, Rate, Tile, LegalNote  M   FW6, FW7
       -> proves: all states in /dev/composants; jest-axe zero; contrast
          audit over every token pair; tnum asserted

  FW9  ui/react: FieldGroup, DataGrid, Container,    M   FW6, FW8
       PublicShell
       -> proves: every ValidationError has French copy (exhaustiveness
          test); shell keyboard path incl. mobile menu

CHECKPOINT A - FOUNDATION
-------------------------
Machine checks:
  [ ] all six Geneva fixtures exact; 100% engine coverage; 8 invariants
  [ ] spike numbers recorded; budgets reachable or escalation decided
  [ ] visual baselines + a11y green for all nine components
  [ ] 200 px rail thumbnail reviewed by a human and approved
Human gate:
  [ ] FIXTURES FROZEN - every constant verified against admin.ch, the
      AFC, and impots.gouv.fr; docs/regulatory-sources.md dated and
      signed; fixtures/geneva-cases.json published for the Kotlin port
No Phase 2 task starts before this gate is recorded.

WHAT TO ROUTE BACK TO THE OPERATOR DURING PHASE 1
-------------------------------------------------
  - any runtime dependency proposed for lib/calc-engine (answer is no)
  - any change to a constant, a rounding rule, or the engine API
  - the FW2 escalation if the 100 KB budget is unreachable
  - the question of truncation vs rounding of the declarable rate if
    anything in the sources contradicts truncation
  - a proposed token outside DESIGN-SYSTEM.md

FILES THIS PHASE PRODUCES
-------------------------
  web/                          scaffold, tokens, lint, CI
  web/lib/calc-engine/**        the engine
  web/lib/ui/core/**            zones, rail, formatters
  web/lib/ui/react/**           nine components
  web/lib/fr/**                 first French strings (errors, statuses)
  fixtures/geneva-cases.json    (FW4; frozen at the gate)
  docs/regulatory-sources.md    (FW3 onward)
  docs/perf-spike.md            (FW2)
  REPORT-FW1.txt ... REPORT-FW9.txt

Session prompts: relay/FW1.txt is written. FW2 onward are written after
the preceding report is accepted, so each carries the rulings verbatim.
