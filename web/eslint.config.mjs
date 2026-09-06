// web/eslint.config.mjs
//
// The spec's module boundaries, made mechanical. SPEC section 5 states them as
// "each a review rejection when violated"; here they fail lint and therefore
// CI, before any feature code exists to violate them (tasks/plan.md).

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';

const ENGINE_MESSAGE =
  'lib/calc-engine imports nothing beyond its own files (SPEC section 5). ' +
  'Relative imports inside the engine are allowed; a bare package, an alias ' +
  'or a path out of the directory is not. Any runtime dependency here is an ' +
  'ask-first item (SPEC section 20).';

const CORE_MESSAGE =
  'lib/ui/core is pure TypeScript and SCSS (SPEC section 5): no react, no ' +
  'react-dom, no component library. It renders in the browser, the PDF and ' +
  'the OG image, so it must stay DOM-free.';

const UI_LIBRARIES = [
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
  'lucide-react',
  'next',
  'next/*',
  '@carbon/*',
  '@mui/*',
  'antd',
];

export default tseslint.config(
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node tooling.
  {
    files: ['scripts/**/*.mjs', '*.mjs'],
    languageOptions: { globals: globals.nodeBuiltin },
  },

  // Application and library sources run in the browser.
  {
    files: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },

  // (a) Engine purity. The engine is ported to Kotlin (D20) and must stay
  // free of anything that cannot cross that boundary.
  //
  // The pattern is a negative-lookahead regex, not a glob group: gitignore
  // semantics cannot express "everything except a relative path" - a group of
  // '*' also restricts './types', which would make the engine's own files
  // unimportable.
  {
    files: ['lib/calc-engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '^(?!\\./)', message: ENGINE_MESSAGE }] },
      ],
      // no-restricted-imports only sees static import declarations. These two
      // close the dynamic-import and require() holes.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^(?!\\.\\/)/]',
          message: ENGINE_MESSAGE,
        },
        {
          selector: 'CallExpression[callee.name="require"]',
          message: ENGINE_MESSAGE,
        },
      ],
    },
  },

  // (b) lib/ui/core bans React and every component library.
  {
    files: ['lib/ui/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: UI_LIBRARIES, message: CORE_MESSAGE }] },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportExpression[source.value=/^(react|react-dom|lucide-react|next|@carbon|@mui|antd)/]',
          message: CORE_MESSAGE,
        },
        {
          selector: 'CallExpression[callee.name="require"]',
          message: CORE_MESSAGE,
        },
      ],
    },
  },

  // (c) User-facing strings come from lib/fr only.
  //
  // noStrings: true is required - without it the canonical "fix" for a bare
  // JSX text node is to wrap it in braces, which the rule then accepts.
  // ignoreProps: true keeps technical attributes (className, data-*, lang,
  // type) writable, as the task requires. The consequence is that
  // user-facing PROPS (placeholder, alt, title, aria-label) are not yet
  // fenced; recorded in the report as owed.
  {
    files: ['app/**/*.tsx', 'lib/ui/react/**/*.tsx'],
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, allowedStrings: [] },
      ],
    },
  },
);
