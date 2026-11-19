// web/app/(account)/mon-releve/connexion/page.tsx
//
// Step one of the website's sign-in: the address. FW-WEB-ACCOUNT (R901, R908).
//
// A PLAIN <form method="post">, no script: the browser posts the field to
// envoi/route.ts, which answers with a 303 to the code page. It works with
// JavaScript off, and e2e/mon-releve.nojs.spec.ts drives it that way (R346).
//
// THE PAGE READS ONE THING FROM THE URL, a closed-set `etat` naming why it was
// shown again (an invalid address, a session that ended, a sign-out). Anything
// outside the set renders nothing extra.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { accountAreaOpen } from '@/lib/web-account/open';
import { Container } from '@/lib/ui/react/Container/Container';
import { MON_RELEVE_COPY as COPY, isSignInState } from '@/lib/fr/mon-releve';
import { accountSessionFrom } from '@/lib/web-account/session';
import { ACCOUNT_FIELDS, ACCOUNT_PARAMS, ACCOUNT_PATHS } from '@/lib/web-account/paths';
import styles from '../mon-releve.module.scss';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: COPY.signIn.title,
  description: COPY.description,
};

/** The states that report something good, shown in the calm style. */
const CALM = new Set(['deconnecte']);

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Queue Ruling 13 item 5: switched off, the area is not there.
  if (!accountAreaOpen()) notFound();

  // Already signed in: there is nothing to do here.
  const session = await accountSessionFrom((await headers()).get('cookie'));

  if (session.state === 'signed-in') redirect(ACCOUNT_PATHS.home);

  const state = (await searchParams)[ACCOUNT_PARAMS.state];
  const shown = isSignInState(state) ? state : null;

  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.heading}>{COPY.signIn.title}</h1>
        <p className={styles.lead}>{COPY.signIn.lead}</p>

        <div className={styles.card}>
          {shown === null ? null : (
            <p
              className={CALM.has(shown) ? styles.message : styles.alert}
              role={CALM.has(shown) ? 'status' : 'alert'}
              data-state={shown}
            >
              {COPY.states[shown]}
            </p>
          )}

          <form action={ACCOUNT_PATHS.send} className={styles.form} method="post">
            <label className={styles.label} htmlFor="mon-releve-adresse" id="mon-releve-adresse-label">
              {COPY.signIn.emailLabel}
            </label>
            <div className={styles.row}>
              <input
                autoComplete="email"
                className={styles.input}
                id="mon-releve-adresse"
                inputMode="email"
                name={ACCOUNT_FIELDS.email}
                required
                type="email"
              />
              <button className={styles.submit} type="submit">
                {COPY.signIn.submit}
              </button>
            </div>
          </form>
          <p className={styles.helper}>{COPY.signIn.readOnlyNote}</p>
        </div>
      </Container>
    </main>
  );
}
