// web/lib/content/lead.ts
//
// FW-CALCS-A2, R732: a list item's lead phrase, for comparateur-lamal-a2's
// bold-lead list ("Ce que ce comparatif ne compare pas").
//
// THE TEXT IS SPLIT, NEVER RETYPED (R181, R206). The lead is the item's first
// sentence as it already reads - up to and including its first full stop
// followed by a space - or, for an item that is a single sentence, its first
// clause, up to and including its first comma. The rest is everything after
// the space that follows. Joined with that one space, the two are the item,
// character for character, and tests/unit/content/lead.test.ts asserts it
// for every item the comparator renders.
//
// An item with neither a full stop nor a comma before its end is all lead.

export interface Lead {
  readonly lead: string;
  readonly rest: string;
}

const SENTENCE = '. ';
const CLAUSE = ', ';

export function splitLead(item: string): Lead {
  for (const mark of [SENTENCE, CLAUSE]) {
    const at = item.indexOf(mark);

    if (at >= 0) {
      return { lead: item.slice(0, at + 1), rest: item.slice(at + mark.length) };
    }
  }

  return { lead: item, rest: '' };
}
