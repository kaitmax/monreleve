// web/app/(account)/mon-releve/page.tsx
//
// The signed-in page, « Mon Relevé » (the queue's C9 page; its name is APP_NAME).
// FW-WEB-ACCOUNT (R899, R903), rebuilt by W12 under Web Ruling 32.
//
// SIGNED OUT, IT IS NOT SHOWN. No cookie sends the person to step one; a cookie
// that no longer resolves - expired, revoked or unknown - sends them there with
// ONE sentence (R210: an unauthenticated caller is not told which case fired).
//
// TWO YEARS, NO SELECTOR (Web Ruling 32, R1067). The page shows the current tax
// year and the one before, both, always - accountYears() in
// lib/web-account/year.ts - and reads no year from its URL. A year with no rule
// set of its own carries the engine's warning (docs/api-v1.md 6.5): in January
// that is the current year, and today it is the year before.
//
// THE FIGURES ARE THE ENGINE'S, ON THE SERVER (R903). buildDossierFor is the
// function GET /api/v1/dossier serialises, so the page and the app read one
// computation; the view formats, it never counts.
//
// READ-ONLY (R904): nothing here records, edits or deletes a day.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { accountAreaOpen } from '@/lib/web-account/open';
import { prisma } from '@/lib/db/client';
import { buildDossierFor } from '@/lib/dossier/load';
import { MissingTitulaireError } from '@/lib/dossier/service';
import { CantonMissingError, YearBeforeActivityError } from '@/lib/dossier/aggregate';
import { currentTaxYear } from '@/lib/content/tax-year';
import { MON_RELEVE_COPY as COPY } from '@/lib/fr/mon-releve';
import { accountSessionFrom } from '@/lib/web-account/session';
import { ACCOUNT_PARAMS, ACCOUNT_PATHS, withQuery } from '@/lib/web-account/paths';
import { accountYears } from '@/lib/web-account/year';
import { SignedIn, type AccountYearView, type YearContent } from './SignedIn';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: COPY.title },
  description: COPY.description,
};

/** One year's content: the dossier, or the named refusal the page can say (R198). */
async function yearContent(userId: string, year: number): Promise<YearContent> {
  try {
    return { kind: 'figures', figures: await buildDossierFor(userId, year) };
  } catch (cause) {
    if (cause instanceof MissingTitulaireError || cause instanceof CantonMissingError) {
      return { kind: 'incomplete' };
    }

    if (cause instanceof YearBeforeActivityError) return { kind: 'before-activity' };

    throw cause;
  }
}

export default async function MonRelevePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Queue Ruling 13 item 5: switched off, the area is not there.
  if (!accountAreaOpen()) notFound();

  const session = await accountSessionFrom((await headers()).get('cookie'));

  if (session.state === 'absent') redirect(ACCOUNT_PATHS.signIn);

  if (session.state === 'ended') {
    redirect(withQuery(ACCOUNT_PATHS.signIn, { [ACCOUNT_PARAMS.state]: 'session-terminee' }));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  // The row cascaded away under a live cookie: the account was deleted.
  if (user === null) {
    redirect(withQuery(ACCOUNT_PATHS.signIn, { [ACCOUNT_PARAMS.state]: 'session-terminee' }));
  }

  const query = await searchParams;

  const years: AccountYearView[] = [];

  for (const year of accountYears(currentTaxYear())) {
    years.push({ year, content: await yearContent(session.userId, year) });
  }

  return (
    <SignedIn
      email={user.email}
      years={years}
      exportFailed={query[ACCOUNT_PARAMS.export] === 'echec'}
    />
  );
}
