// web/tests/db/support/rappel-links.ts
//
// FW-DELAI-RAPPEL, R1002 and R204: OPENING A LINK FROM A REMINDER MESSAGE, AND
// PRESSING THE BUTTON ON THE PAGE IT OPENS, through the entry points Next
// would serve - never through the library beneath them.
//
//   open(link)   a GET of whatever Next serves at the link's path: the page,
//                rendered as the server renders it, or a route handler's GET.
//                It is what a mail client fetching the link does.
//   press(html)  the page's one form, sent where its own action says - the
//                action and the hidden fields READ OUT OF THE RENDERED HTML,
//                so a page whose button posted anywhere else would fail here.
//
// WHY OPENING DISPATCHES ON THE PATH. Before R1002 the delete link named
// /api/rappel-delai/suppression, whose GET deleted at once. The same
// assertion - "opening the link leaves the row" - ran against that design
// (its RED) and runs against this one, because nothing here assumes which
// kind of thing the link names.

import { expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { renderToStaticMarkup } from 'react-dom/server';
import { TEST_ORIGIN } from '../../../lib/content/identity';
import { siteOrigin } from '@/lib/content/site';

/**
 * The handler the delete page's button must reach, and so the path Next
 * serves it at - derived from where the file lives (R171: the role, never a
 * literal that happens to match).
 */
export const DELETE_ROUTE_FILE = 'app/api/rappel-delai/suppression/route.ts';
export const DELETE_ROUTE_PATH = `/${DELETE_ROUTE_FILE.replace(/^app\//u, '').replace(/\/route\.ts$/u, '')}`;

type Handler = (request: NextRequest) => Promise<Response>;

/** The link in a message's text that points at `path`, with its token. */
export function linkIn(text: string, path: string): string {
  const found = text.split('\n').find((line) => line.startsWith(`${siteOrigin()}${path}?token=`));

  expect(found, `no ${path} link in the message`).toBeDefined();

  return found ?? '';
}

/** The page file Next would serve a path from, under the public route group. */
function pageFileFor(pathname: string): string {
  return join('app', '(public)', ...pathname.split('/').filter(Boolean), 'page.tsx').split('\\').join('/');
}

/** OPEN a link as a mail client fetching it would. Returns the page's HTML, or '' for a handler. */
export async function open(link: string): Promise<string> {
  const url = new URL(link);
  const pageFile = pageFileFor(url.pathname);

  if (existsSync(pageFile)) {
    const page = (await import(/* @vite-ignore */ `@/${pageFile.replace(/\.tsx$/u, '')}`)) as {
      default: (props: { searchParams: Promise<Record<string, string>> }) => Promise<React.ReactElement>;
    };

    return renderToStaticMarkup(
      await page.default({ searchParams: Promise.resolve(Object.fromEntries(url.searchParams)) }),
    );
  }

  // No page at that path: a route handler, if it answers GET at all.
  const handler = (await import(/* @vite-ignore */ `@/app${url.pathname}/route`)) as Record<string, unknown>;
  const get = handler.GET as Handler | undefined;

  if (get !== undefined) await get(new NextRequest(link));

  return '';
}

/** What a rendered page's form would send: its action, its method, its fields, and its buttons. */
export function formIn(html: string): { action: string; method: string; fields: URLSearchParams; buttons: number } {
  const forms = html.match(/<form\b[^>]*>/gu) ?? [];

  expect(forms, 'the page renders exactly one form').toHaveLength(1);

  // `\\b` in the template: the regular expression's word boundary, not a backspace.
  const attribute = (tag: string, name: string): string => new RegExp(`\\b${name}="([^"]*)"`, 'u').exec(tag)?.[1] ?? '';
  const fields = new URLSearchParams();

  for (const input of html.match(/<input\b[^>]*>/gu) ?? []) {
    fields.append(attribute(input, 'name'), attribute(input, 'value'));
  }

  return {
    action: attribute(forms[0] ?? '', 'action'),
    method: attribute(forms[0] ?? '', 'method'),
    fields,
    buttons: (html.match(/<button\b/gu) ?? []).length,
  };
}

/** PRESS the page's one button: its form, sent to the handler Next serves at its action. */
export async function press(html: string): Promise<Response> {
  const { action, method, fields } = formIn(html);

  expect(method).toBe('post');
  expect(action, 'the button posts to the delete handler').toBe(DELETE_ROUTE_PATH);

  const handler = (await import(/* @vite-ignore */ `@/app${action}/route`)) as Record<string, unknown>;
  const post = handler.POST as Handler | undefined;

  expect(post, `nothing answers POST at ${action}`).toBeDefined();

  return (post as Handler)(
    new NextRequest(`${TEST_ORIGIN}${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: fields.toString(),
    }),
  );
}

/** Open a delete link and press its page's button: what a person does. */
export async function pressLink(link: string): Promise<Response> {
  return press(await open(link));
}
