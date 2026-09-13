// web/lib/content/alertes.ts
//
// The alert list's own route. FW14.
//
// Its own module rather than a line in routes.ts because FW14 increment 5
// builds the page and increment 2 needs the path before that page exists -
// and a handler redirecting to a string literal is a handler nobody can
// rename the page under.
export const ALERTES_PATH = '/alertes';
