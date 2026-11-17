// web/app/(public)/rappel-delai/suppression/page.tsx
//
// FW-DELAI-RAPPEL, R1002: WHERE THE DELETE LINK IN EVERY REMINDER MESSAGE
// LEADS - A PAGE WITH ONE BUTTON, AND ONLY THE BUTTON DELETES.
//
// WHY NOT A LINK THAT DELETES. The confirmation carries both links, the
// confirmation link and this one. A mail client that fetches every link to
// build a preview (or to scan it) would, if this GET deleted, remove the
// request before anybody read the message - and that message is the only
// one. So opening this page changes nothing: it reads no row and writes no
// row, and it renders the same for every token, so it answers no question
// about which tokens are real (R915). The POST its button sends is what
// deletes (app/api/rappel-delai/suppression/route.ts).
//
// A PLAIN FORM: method="post", the token in a hidden field, one button. No
// JavaScript of its own (a server component) and no cookie, so it works with
// scripting off (e2e/rappel-suppression.nojs.spec.ts presses the button).
//
// NOT IN lib/content/routes.ts (Web Ruling 9): the registry ships whole to
// the calculator page, which has about 55 B to spare. Not in the sitemap,
// and noindex, like the alert flow's landings: the tail of a transaction.
//
// SET WITH THE ALERT LANDINGS' STYLESHEET, not one of its own: a page with its
// own CSS module adds its CSS chunk to the webpack runtime every route loads
// (+9 B on every route, C10's byte probe), and that file's chunk exists
// already. The page reads like the alert flow's landings, which is right.
//
// DYNAMIC, because the token comes from the query. The address bar keeps it
// until the button is pressed; the POST answers 303 to the comparator, and
// the token leaves it then (R364: a relative Location).

import type { Metadata } from 'next';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import { DELETE_ENDPOINT } from '@/lib/rappel/landing';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from '../../alertes/alertes.module.scss';

export const metadata: Metadata = {
  title: RAPPEL_COPY.deletePage.title,
  robots: { index: false, follow: true },
};

/** A token as the messages carry it: 32 bytes, hex. Anything else posts as empty. */
const TOKEN = /^[0-9a-f]{64}$/;

interface Props {
  readonly searchParams: Promise<{ readonly token?: string | readonly string[] }>;
}

export default async function DeleteReminderPage({ searchParams }: Props): Promise<React.ReactElement> {
  const { token } = await searchParams;
  const value = typeof token === 'string' && TOKEN.test(token) ? token : '';

  return (
    <Container width="article">
      <article className={styles.outcome} data-rappel-suppression="true">
        <h1 className={styles.outcomeHeading}>{RAPPEL_COPY.deletePage.heading}</h1>
        <p className={styles.outcomeBody}>{RAPPEL_COPY.deletePage.body}</p>
        <form action={DELETE_ENDPOINT} className={styles.outcomeForm} method="post">
          <input name="token" type="hidden" value={value} />
          <button className={styles.outcomeButton} type="submit">
            {RAPPEL_COPY.deletePage.button}
          </button>
        </form>
      </article>
    </Container>
  );
}
