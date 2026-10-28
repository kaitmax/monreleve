// web/lib/fr/faq.ts
//
// The calculator's inline FAQ. SPEC 14 names the three questions: the 40
// versus 49,9 confusion, whether mission days count, whether sick days count.
//
// ONE SOURCE, TWO CONSUMERS, AND THAT IS THE WHOLE DESIGN. The accordion a
// reader opens and the FAQPage a crawler reads are generated from the list
// below. A structured-data claim that is not visible on the page is cloaking,
// and the only way to be sure the two agree is for there to be one of them.
//
// THE ANSWERS RESTATE THE PAGE, THEY DO NOT EXTEND IT. Every claim here is
// already made in CALCULATEUR_COPY - fiscal(), social(), missions() and the
// days helper - in the same words wherever the words still fit the question
// form. A FAQ is the most tempting place in a product to write a new
// regulatory claim nobody reviewed, so this one deliberately says nothing the
// explanatory prose does not already say.
//
// THE THRESHOLDS ARE ARGUMENTS, NEVER LITERALS (R73). They belong to the
// year's RuleSet (SPEC 7.7), so a question containing "40 %" would go stale
// on a rule change with nothing failing. The question text takes them too,
// not just the answers - "quelle difference entre 40 % et 49,9 %" is exactly
// the sentence somebody would hardcode.
//
// FRENCH TYPOGRAPHY (R91): every no-break space is built by n() rather than
// typed, so it is visible in the source.
//
// TODO-COPY: realistic French, not reviewed by counsel.

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it. */
const n = (mark: string): string => `${NB}${mark}`;

/** One question and its answer, already resolved against the year's rules. */
/** One side of an Avant / Après answer (FW-HOME-A2, R717). */
export interface FaqPairSide {
  readonly label: string;
  readonly body: string;
}

export interface FaqEntry {
  /** Stable, so a link can address one question and a test can name it. */
  readonly id: string;
  readonly question: string;
  /**
   * The answer as plain text - ALWAYS, even when a pair is drawn instead, so
   * anything that reads answers as text (a FAQPage) reads what is shown.
   */
  readonly answer: string;
  /** Open on arrival (FW-HOME-A2: the home page's first question). */
  readonly open?: boolean;
  /** An Avant / Après answer, drawn as two cards in place of the paragraph. */
  readonly pair?: { readonly before: FaqPairSide; readonly after: FaqPairSide };
}

/**
 * What the answers need from the year's RuleSet, already formatted by the
 * caller - the same contract CALCULATEUR_COPY uses, for the same reason: this
 * module must not be able to format a percentage differently from the rest of
 * the product.
 */
export interface FaqInputs {
  /** The fiscal ceiling, formatted. */
  readonly fiscal: string;
  /** The social ceiling, formatted. */
  readonly social: string;
  /** RuleSet.simplifiedBasisDays, formatted. */
  readonly basisDays: string;
}

export const FAQ_COPY = {
  heading: 'Questions fréquentes',

  /**
   * SPEC 14's three, in the order a reader meets the confusion: what the two
   * thresholds are, then the two things people wrongly assume sit outside
   * them.
   */
  entries: ({ fiscal, social, basisDays }: FaqInputs): readonly FaqEntry[] => [
    {
      id: 'deux-seuils',
      question:
        `Quelle est la différence entre le seuil de ${fiscal} et celui de ` +
        `${social}${n('?')}`,
      answer:
        `Le premier est fiscal${n(':')} il décide du pays qui impose votre ` +
        `salaire. Tant que votre télétravail reste sous ${fiscal} de votre ` +
        `temps de travail annuel, votre salaire continue d’être imposé en ` +
        `Suisse. Le second est social${n(':')} il décide de votre affiliation ` +
        `à la sécurité sociale, et il se situe à ${social}. Ce sont deux ` +
        `règles distinctes, avec deux conséquences distinctes${n(';')} ` +
        `franchir l’une ne veut pas dire franchir l’autre.`,
    },
    {
      id: 'missions',
      question: `Les jours de mission hors de Suisse comptent-ils${n('?')}`,
      answer:
        `Oui, et ils comptent à l’intérieur de ces ${fiscal}, non en plus. ` +
        `Un quota annuel de jours de mission s’y ajoute, réduit ` +
        `proportionnellement si vous travaillez à temps partiel ou si votre ` +
        `année est incomplète. C’est la raison pour laquelle la question des ` +
        `missions est posée avant les options avancées.`,
    },
    {
      id: 'conges-maladie',
      question:
        `Les congés payés et les jours de maladie comptent-ils dans le ` +
        `calcul${n('?')}`,
      answer:
        `Ils ne sont pas à déclarer ici. Avec la base simplifiée de ` +
        `${basisDays} jours par an, la base annuelle les absorbe déjà${n(':')} ` +
        `comptez uniquement vos journées de télétravail. Si votre employeur ` +
        `applique un décompte exact, c’est son nombre total de jours ` +
        `travaillés qui sert de base, et la méthode doit être la même pour ` +
        `tout le personnel.`,
    },
  ],
} as const;
