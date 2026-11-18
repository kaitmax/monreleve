// web/app/(account)/mon-releve/connexion/code/page.tsx
//
// Step two of the website's sign-in: the code. FW-WEB-ACCOUNT (R901, R908).
//
// THE ADDRESS IS NOT IN THE URL. The query carries a sealed step
// (lib/web-account/step.ts) - ciphertext - which this page opens to show the
// person where the code went, and which the form posts back in a hidden field.
// A seal that does not open (expired, tampered, from another key) sends the
// person back to step one with one sentence.
//
// A PLAIN <form method="post">, like step one.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { accountAreaOpen } from '@/lib/web-account/open';
import { Container } from '@/lib/ui/react/Container/Container';
import { MON_RELEVE_COPY as COPY, isCodeError } from '@/lib/fr/mon-releve';
import { CODE_LENGTH, CODE_PATTERN } from '@/lib/web-account/code-shape';
import { accountSessionFrom } from '@/lib/web-account/session';
import { ACCOUNT_FIELDS, ACCOUNT_PARAMS, ACCOUNT_PATHS, withQuery } from '@/lib/web-account/paths';
import { openStep } from '@/lib/web-account/step';
import styles from '../../mon-releve.module.scss';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: COPY.code.title,
  description: COPY.description,
};

export default async function CodePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Queue Ruling 13 item 5: switched off, the area is not there.
  if (!accountAreaOpen()) notFound();

  const session = await accountSessionFrom((await headers()).get('cookie'));

  if (session.state === 'signed-in') redirect(ACCOUNT_PATHS.home);

  const query = await searchParams;
  const sealed = query[ACCOUNT_PARAMS.step];
  const email = typeof sealed === 'string' ? openStep(sealed) : null;

  if (email === null || typeof sealed !== 'string') {
    redirect(withQuery(ACCOUNT_PATHS.signIn, { [ACCOUNT_PARAMS.state]: 'demande-expiree' }));
  }

  const error = query[ACCOUNT_PARAMS.error];
  const shown = isCodeError(error) ? error : null;

  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.heading}>{COPY.code.title}</h1>
        <p className={styles.lead}>{COPY.code.requested(email)}</p>
        <p className={styles.links}>
          <a href={ACCOUNT_PATHS.signIn}>{COPY.code.change}</a>
        </p>

        <div className={styles.card}>
          {shown === null ? null : (
            <p className={styles.alert} role="alert" id="mon-releve-code-erreur" data-error={shown}>
              {COPY.errors[shown]}
            </p>
          )}

          <form action={ACCOUNT_PATHS.verify} className={styles.form} method="post">
            <input name={ACCOUNT_FIELDS.step} type="hidden" value={sealed} />
            <label className={styles.label} htmlFor="mon-releve-code" id="mon-releve-code-label">
              {COPY.code.codeLabel}
            </label>
            <div className={styles.row}>
              <input
                aria-describedby={
                  shown === null ? 'mon-releve-code-aide' : 'mon-releve-code-erreur mon-releve-code-aide'
                }
                aria-invalid={shown === null ? undefined : true}
                autoComplete="one-time-code"
                className={styles.input}
                id="mon-releve-code"
                inputMode="numeric"
                maxLength={CODE_LENGTH}
                name={ACCOUNT_FIELDS.code}
                pattern={CODE_PATTERN}
                required
                type="text"
              />
              <button className={styles.submit} type="submit">
                {COPY.code.submit}
              </button>
            </div>
            <p className={styles.helper} id="mon-releve-code-aide">
              {COPY.code.help}
            </p>
          </form>
        </div>

        <p className={styles.links}>
          <a href={ACCOUNT_PATHS.signIn}>{COPY.code.restart}</a>
        </p>
      </Container>
    </main>
  );
}
