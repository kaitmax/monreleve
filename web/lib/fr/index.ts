// web/lib/fr/index.ts
// Every user-facing web string lives here. Nothing else declares one.
// French only, one locale, no i18n abstraction (SPEC section 1 non-goals).
//
// R172: a sentence about what the product CAN DO takes ProductState as an
// argument, exactly as one naming a threshold takes the formatted figure. The
// flags are facts; this file holds words.

import type { ProductState } from '@/lib/content/product-state';
import type { SourceId } from '@/lib/content/sources';
import { formatDate } from '@/lib/ui/core';
import { cardinal, n } from './compose';
import { GUIDES_COPY } from './guides';

// A SourceId[] typed at the point of use, so a key that is not in SOURCE_IDS is
// a compile error (§5.3). `import type` above keeps this a compile-time check
// only - lib/fr imports nothing from lib/content/sources at runtime (§5.4),
// which matters because this file is in the client shell's bundle.
const sourceIds = (...ids: SourceId[]): readonly SourceId[] => ids;

/**
 * THE PRODUCT NAME, accented, and the single source R188 names.
 *
 * "Mon Relevé" is the name in French prose, in headings and in the
 * wordmark. R155 makes the accented form authoritative for copy, which is
 * why it lives here rather than in lib/content beside the domain.
 *
 * THE OTHER TWO FORMS ARE CONSEQUENCES OF THIS ONE. lib/content/identity.ts
 * derives the byte-constrained spelling - "monreleve", for /api/health, the
 * package name and test identifiers - by stripping the accents off this
 * string rather than declaring a second literal beside it. A second literal
 * is a transcription, correct on the day it is written (R181).
 *
 * IT WAS "frontalier" UNTIL FW20c, which was also the French common noun for
 * the reader this product is built for - a frontalier is a cross-border
 * worker. The copy is full of the word in that sense and stays that way; the
 * rename is of the PRODUCT, not of the vocabulary, and SPEC 14 freezes the
 * slugs that carry the word as a URL.
 */
export const APP_NAME = 'Mon Relevé';

// The workbench: every component, every state. Noindex, out of the sitemap.
export const WORKBENCH_TITLE = 'Composants — workbench';


// ---------------------------------------------------------------------------
// THE HOME BODY (FW34, slice 2 of docs/.../2026-09-29-home-page-design.md).
// H1 reverses FW20's "no hero theatre": the two equal doors are gone and the
// page is a hero, three destination cards, a "Pourquoi une trace datée" band,
// a trust band and a closing strip - FD11, rendered by app/(public)/page.tsx.
//
// NO FIGURE IS TYPED (R147): the thresholds arrive formatted from
// guideScope(currentTaxYear()); the counts, topic labels, publishers, source
// counts and review date are computed by page.tsx and passed in. Every
// regulatory sentence carries a readonly SourceId[] (non-empty). Sentences
// about the product's own state take ProductState (R172) and are built from one
// clause per flag (R186), future until each flag flips (R138).
//
// TODO-COPY: realistic French, not reviewed by counsel.
// ---------------------------------------------------------------------------

export const HOME_COPY = {
  heading: (fiscal: string): string =>
    `Combien de jours de télétravail vous reste-t-il avant ${fiscal}${n('?')}`,

  /**
   * The meta description, and it was MISSING until the increment 6 Lighthouse
   * run said so - SEO 91, "Document does not have a meta description", on the
   * one page the whole SEO strategy points at. The three legal pages each had
   * one; the home page, which FW20 rewrites, had none, and nothing would have
   * noticed.
   *
   * SPEC 14 wants the thresholds named in the description, and they are -
   * but R147 says a figure is never TYPED, so both arrive as arguments,
   * already formatted, exactly as CALCULATEUR_COPY.description takes its own.
   *
   * IT WAS A CONSTANT WITH THE FIGURES IN IT until FW18b, and it is the
   * clearest case the extended scan found: the description of the one page
   * the whole SEO strategy points at, promising two thresholds by value, in a
   * file whose five neighbours each carry a comment explaining why that must
   * not be done.
   *
   * AND IT TOOK THE STATE FOR THE SAME REASON, in FW20b. It ended "puis tenez
   * le registre horodaté de vos journées" - an instruction to use a register
   * that does not exist, on the sentence Google prints under the product's
   * name. It is the FOURTH instance of the defect R172 was issued about and
   * the one FW20's read-through could not have found: a read-through reads
   * pages, and a meta description is never on one.
   */
  description: (fiscal: string, social: string, state: ProductState): string =>
    'Calculez votre part de télétravail annuelle et les jours qui vous ' +
    `restent avant les seuils de ${fiscal} et ${social}` +
    (state.trackerExists ? ', puis tenez le registre horodaté de vos journées.' : '.'),

  // -- the actions, one {label, href} each, rendered wherever they appear
  // (R206). calculator: hero and closing. guides: hero secondary before
  // release, and card 2. app: hero secondary at release, and card 3.
  actions: {
    calculator: { label: 'Calculer mes jours', href: '/calculateur-teletravail-frontalier' },
    guides: { label: 'Lire les guides', href: '/guides' },
    app: { label: 'Découvrir l’application', href: '/application' },
  },

  // -- the hero lead: three sentences, each with its own scope (§5.3).
  lead: {
    fiscal: {
      text: (fiscal: string): string =>
        'Depuis le 1er janvier 2026, un frontalier résidant en France et ' +
        `employé en Suisse peut télétravailler jusqu’à ${fiscal} de son temps ` +
        'de travail annuel sans changer d’imposition.',
      sources: sourceIds('fiscalCeiling'),
    },
    social: {
      text: (social: string, a1Threshold: string): string =>
        `Au-delà du maximum publié de ${social}, son affiliation à la sécurité ` +
        'sociale peut basculer en France' +
        n(';') +
        ` dès ${a1Threshold}, la garder en Suisse suppose un certificat A1 en ` +
        'cours de validité.',
      sources: sourceIds('socialCeiling', 'a1ThresholdRate'),
    },
    // Not a regulatory claim: a statement about what the site does (R172).
    tracker: (state: ProductState): string =>
      state.trackerExists
        ? 'Ce site calcule où vous en êtes et vous aide à en garder une trace datée.'
        : 'Ce site calcule où vous en êtes.',
  },

  // -- three destination cards (§5.3). `heading` is the band's visually hidden
  // h2, present so the document outline has no skipped level (h1 -> h2 -> h3).
  cards: {
    heading: 'Par où commencer',
    calculator: {
      title: 'Calculateur de télétravail',
      body: (fiscal: string, social: string): string =>
        'Votre part de télétravail annuelle, et les jours qu’il vous reste ' +
        `avant ${fiscal} et avant ${social}. Trois champs, sans inscription.`,
      sources: sourceIds('fiscalCeiling', 'socialCeiling'),
      link: { label: 'Ouvrir le calculateur', href: '/calculateur-teletravail-frontalier' },
    },
    guides: {
      title: 'Comprendre les règles',
      // count = publishedGuides().length (>= 5, so "Un guides" cannot occur);
      // topics = the five FD11 topic labels, lowercased and frenchList-joined by
      // page.tsx. "guides" is masculine, so cardinal takes 'un'.
      body: (count: number, topics: string): string =>
        `${cardinal(count, 'un')} guides, dont ${topics}.`,
    },
    app: {
      title: 'L’application',
      // One clause per flag (R186), future until each flips (R138). A single
      // flag flip changes the string - RELEVE_COPY.stateBody's pattern, not an
      // AND-combined getter. Manual entry first (D19); detection proposes (D16).
      body: (state: ProductState): string =>
        (state.appExists ? 'Disponible sur Android.' : 'En préparation pour Android.') +
        ' ' +
        (state.trackerExists
          ? 'Enregistrez vos journées en un geste, ou laissez l’application les détecter et vous les proposer.'
          : 'Vous y noterez vos journées en un geste, ou elle vous proposera celles qu’elle aura détectées, que vous confirmerez.') +
        ' ' +
        (state.dossierExists
          ? 'Exportez un relevé annuel horodaté.'
          : 'Elle exportera un relevé annuel horodaté.'),
    },
  },

  // -- "Pourquoi une trace datée" (§5.3). The 01/02/03 numerals are rendered by
  // page.tsx from each item's position, so no figure is typed here. A block with
  // no `sources` key is reasoning about records, not a regulatory claim.
  pourquoi: {
    heading: 'Pourquoi une trace datée',
    items: [
      {
        heading: 'Le seuil se joue sur l’année entière',
        body:
          'Quelques jours de trop en novembre suffisent à modifier douze mois ' +
          'd’imposition. Le calcul ne se fait pas au mois, mais sur l’ensemble ' +
          'de l’année.',
        sources: sourceIds('fiscalCeiling'),
      },
      {
        heading: 'Un relevé reconstitué reste une affirmation.',
        body:
          'Un tableau rempli en décembre est une affirmation. Un relevé dont ' +
          'chaque journée porte sa date d’enregistrement est un document.',
      },
      {
        heading: 'Une attestation d’employeur ne dit pas toujours tout.',
        body:
          'Si votre employeur vous remet une attestation de télétravail, votre ' +
          'propre relevé permet de la vérifier et, si elle omet vos jours de ' +
          'mission, d’en tenir compte vous-même.',
        sources: sourceIds('missionCapDays'),
      },
    ],
  },

  // -- the trust band: three columns (§5.3). `heading` is the band's visually
  // hidden h2 (document outline, as for the cards band).
  trust: {
    heading: 'Sources et vérification',
    sources: {
      eyebrow: 'Sources',
      // publishers = the distinct SourceEntry.sourceName in registry order,
      // frenchList-joined by page.tsx (the registry holds publishers, not
      // instruments, which would have to be typed - R181).
      body: (publishers: string): string =>
        'Chaque règle citée figure sur la page des sources, avec l’éditeur de ' +
        'sa source et son état de vérification. Éditeurs cités' +
        n(':') +
        ` ${publishers}.`,
      link: { label: 'Voir les sources', href: '/sources' },
    },
    review: {
      eyebrow: 'Relecture',
      // By key (R206): the chip's status is GUIDES_COPY.expertReview.
      status: GUIDES_COPY.expertReview,
      body: (transcribed: number, total: number, pending: number): string =>
        `${transcribed} des ${total} constantes de ce site ont été relevées sur ` +
        `leur source primaire et ${pending} restent à vérifier` +
        n(';') +
        ' aucune n’a été relue par un professionnel.',
      link: { label: 'Où en est la relecture', href: '/a-propos' },
    },
    verification: {
      eyebrow: 'Dernière vérification',
      // A pure function of review: string | null, like reviewNotice (§5.3).
      // reviewPending is passed in (SHELL_COPY.reviewPending) rather than
      // imported, because shell.ts imports APP_NAME from this module and the
      // reverse import would be a cycle.
      status: (review: string | null, pending: string): string =>
        review === null ? pending : formatDate(review),
      body: (review: string | null): string | null =>
        review === null
          ? null
          : 'Cette date est celle du dernier relevé des seuils appliqués par ' +
            'le calculateur' +
            n(';') +
            ' la page des sources indique, pour chaque règle, la date de son ' +
            'relevé ou qu’il reste à faire.',
      link: { label: 'Recevoir les alertes', href: '/alertes' },
    },
  },

  // -- the closing strip (§5.3). Its action is actions.calculator, the same key
  // as the hero's primary (R206, "One CTA, repeated").
  closing: {
    line: 'Estimez votre situation en moins d’une minute.',
  },
} as const;

/**
 * The title template. Next composes a page's own title into this, and the
 * default is the bare product name for the home route.
 */
export const TITLE_TEMPLATE = `%s — ${APP_NAME}`;

// ---------------------------------------------------------------------------
// THE 404 (FW10 increment 4).
//
// NO "OUPS", no apology and no illustration - the prompt is explicit, and it
// is right: a reader who mistyped an address wants the way out, not a joke
// about it. One sentence saying what happened, and two links that go
// somewhere useful.
//
// It says "peut-etre" because the page genuinely does not know which of the
// two happened, and guessing would be the same overclaiming this product
// avoids everywhere else.
//
// TODO-COPY: realistic French, not reviewed.
// ---------------------------------------------------------------------------

export const NOT_FOUND_COPY = {
  heading: "Cette page n’existe pas",
  body:
    'Le lien que vous avez suivi est peut-être ancien, ou son adresse ' +
    'comporte une erreur.',
  calculator: 'Aller au calculateur',
  calculatorHref: '/calculateur-teletravail-frontalier',
  home: "Revenir à l’accueil",
  homeHref: '/',
} as const;
