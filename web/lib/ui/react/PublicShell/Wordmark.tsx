// web/lib/ui/react/PublicShell/Wordmark.tsx
//
// A PLACEHOLDER geometric mark, drawn here rather than imported.
//
// THERE IS A FILE THAT LOOKS LIKE THE ANSWER AND IS NOT.
// frontier-logo-symbol.svg sits at the repository root: a full-colour mark
// built from three linearGradients, including a red/blue pair that reads as a
// French flag, in hexes outside the token set. Every one of those properties
// is on the design briefs' "never draw" list - never a gradient, never a flag -
// and the FW9 prompt is explicit that the mark is "a placeholder geometric
// mark as a tiny inline SVG (no logo design, the name is an open question in
// SPEC 22)". A file named like a logo sitting in the repository root is the
// obvious thing for a future session to reach for, so the reason not to is
// recorded here, at the place someone would reach from.
//
// currentColor, so it takes the header's text colour and needs no token of its
// own; aria-hidden, because APP_NAME renders beside it and announcing the
// glyph would say the name twice.
//
// The shape is FD1's description: two short horizontal strokes meeting a
// vertical one - a border and the two sides of it. It carries no meaning it
// would be embarrassing to have wrong, which is the most a placeholder should.

/** Sized by the stylesheet, via --size-icon. */
export function Wordmark() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">
      {/* The frontier: one vertical stroke. */}
      <path d="M10 2v16" strokeWidth="2" strokeLinecap="round" />
      {/* One side, then the other. */}
      <path d="M3 7h5" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 13h5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
