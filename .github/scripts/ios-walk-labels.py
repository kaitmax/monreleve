#!/usr/bin/env python3
"""IOS-WALK (I2). Every label the walk matches is the common copy's own text, checked before the walk runs.

Reads ios/MonReleveWalkUITests/WalkLabels.swift; for each line `static let x = "<text>" // <File>.<CONST>`, requires
"<text>" - quoted, byte for byte - in android/shared/src/commonMain/kotlin/ch/monreleve/app/fr/<File>.kt. Exits 1
naming every label that is not found (the walk would otherwise read a renamed button as a missing screen), and 1 when
no label at all was read (a check that read nothing passes vacuously - R169's corollary).
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
LABELS = ROOT / "ios" / "MonReleveWalkUITests" / "WalkLabels.swift"
COPY = ROOT / "android" / "shared" / "src" / "commonMain" / "kotlin" / "ch" / "monreleve" / "app" / "fr"
LINE = re.compile(r'static let (\w+) = "((?:[^"\\]|\\.)*)" // (\w+)\.(\w+)\s*$')

checked = 0
missing = []
for raw in LABELS.read_text(encoding="utf-8").splitlines():
    match = LINE.search(raw)
    if not match:
        continue
    name, text, copy_file, constant = match.groups()
    source = COPY / (copy_file + ".kt")
    checked += 1
    if not source.exists() or ('"%s"' % text) not in source.read_text(encoding="utf-8"):
        missing.append("%s (%s.%s)" % (name, copy_file, constant))

print("WALK LABELS: %d checked against the common copy, %d missing" % (checked, len(missing)))
for item in missing:
    print("  MISSING: " + item)
sys.exit(1 if missing or checked == 0 else 0)
