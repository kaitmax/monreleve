// web/lib/fr/guides-sante.ts
//
// FW-SEO-ARTICLES. The few French words the health-insurance half of the
// guide scope needs: the labels of table cells that lib/guides/scope.ts
// builds from lib/lamal. They are here because French lives in lib/fr and
// nowhere else (R126); the figures beside them come from the comparator's
// year table and the OFSP dataset, never from this file.
//
// NO FIGURE, NO INSURER, NO VERDICT (R673). These are names of things.

import type { AgeClass, PassStatus } from '@/lib/lamal/types';

export const GUIDE_HEALTH_COPY = {
  /** LAMal's three premium classes, as a table's row label (row L5). */
  ageClass: {
    adult: 'Adulte',
    youngAdult: 'Jeune adulte',
    child: 'Enfant',
  } satisfies Record<AgeClass, string>,

  /**
   * What a year's ceiling IS. R671: an announced ceiling is labelled as
   * announced wherever it is printed, so the two wordings must differ.
   */
  passStatus: {
    final: 'Définitif',
    announced: 'Annoncé par l’Urssaf, arrêté à paraître',
  } satisfies Record<PassStatus, string>,
} as const;
