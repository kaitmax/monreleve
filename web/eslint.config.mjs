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

const ENGINE_TYPES_ONLY_MESSAGE =
  'lib/ui/core may import TYPES from lib/calc-engine and nothing else ' +
  '(SPEC section 5): "lib/ui imports types from calc-engine, never logic; it ' +
  'computes nothing." Use `import type`. If you need a threshold, take it as ' +
  'a parameter - SPEC 7.7 makes RuleSet the only place a threshold may appear.';

const SPIKE_MESSAGE =
  'app/dev/spike is the FW2 bundle spike: throwaway markup that exists to be ' +
  'weighed, not reused. The component library is lib/ui/react (FW8-FW9).';

// Every way of naming the spike directory from outside it.
const SPIKE_PATHS = ['@/app/dev/spike', '@/app/dev/spike/*', '**/dev/spike', '**/dev/spike/*'];

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
    files: ['lib/calc-engine/**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // Anything that is not a relative path.
            { regex: '^(?!\\./)', message: ENGINE_MESSAGE },
            // ...and any path that walks upward out of the directory. The
            // first pattern alone is defeated by './../fr', which is a
            // one-character escape that resolves identically under Node, the
            // bundler and tsc.
            { regex: '(^|/)\\.\\.(/|$)', message: ENGINE_MESSAGE },
          ],
        },
      ],
      // no-restricted-imports only sees static import declarations. These
      // close the dynamic-import and require() holes.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^(?!\\.\\/)/]',
          message: ENGINE_MESSAGE,
        },
        {
          selector: 'ImportExpression[source.value=/(^|\\/)\\.\\.(\\/|$)/]',
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
    // Every TypeScript extension, not just .ts: a React component accidentally
    // written here would carry .tsx, which is exactly the shape the fence
    // exists to stop.
    files: ['lib/ui/core/**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: UI_LIBRARIES, message: CORE_MESSAGE },
            { group: SPIKE_PATHS, message: SPIKE_MESSAGE },
          ],
        },
      ],

      // SPEC section 5, boundary 3 of 5: "lib/ui imports TYPES from
      // calc-engine, never logic; it computes nothing." Until FW6 there was
      // no code here to violate it and no rule to stop it; zones.ts is the
      // first file to import from the engine, so the fence lands with it.
      //
      // This is the typescript-eslint variant specifically, because only it
      // understands allowTypeImports. `import type { RuleSet }` passes;
      // `import { ruleSetFor }` does not.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/calc-engine', '@/lib/calc-engine/*', '**/calc-engine', '**/calc-engine/*'],
              allowTypeImports: true,
              message: ENGINE_TYPES_ONLY_MESSAGE,
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportExpression[source.value=/^(react|react-dom|lucide-react|next|@carbon|@mui|antd)/]',
          message: CORE_MESSAGE,
        },
        {
          selector: 'ImportExpression[source.value=/dev\\/spike/]',
          message: SPIKE_MESSAGE,
        },
        // The engine fence's dynamic half. @typescript-eslint's
        // no-restricted-imports above rejects every STATIC value import of
        // the engine, but neither variant of that rule inspects an
        // ImportExpression, so `await import('@/lib/calc-engine')` was clean
        // - verified by running eslint against a probe file before this
        // selector existed. allowTypeImports has no analogue to worry about
        // here: a dynamic import is always a value import.
        //
        // It sits in THIS array rather than a new config object because flat
        // config replaces a rule instead of merging it - a second
        // lib/ui/core block would silently delete the React fence above.
        {
          selector: 'ImportExpression[source.value=/calc-engine/]',
          message: ENGINE_TYPES_ONLY_MESSAGE,
        },
        {
          selector: 'CallExpression[callee.name="require"]',
          message: CORE_MESSAGE,
        },
        // JSX itself, not just the imports that usually come with it.
        //
        // Found by adversarially probing this fence in FW6: a .tsx file here
        // that uses only intrinsic elements and imports NOTHING was clean
        // under both eslint and tsc. Every import-based selector above misses
        // it because it has no imports, and tsc accepts it because
        // next-env.d.ts pulls React's JSX globals in project-wide, so the
        // namespace is available even to a file that never mentions React.
        //
        // A component is exactly what must not live here: lib/ui/core renders
        // into the browser, the PDF and the OG image, so it has to stay
        // DOM-free (SPEC section 5). The component library is lib/ui/react.
        {
          selector: 'JSXElement',
          message: CORE_MESSAGE,
        },
        {
          selector: 'JSXFragment',
          message: CORE_MESSAGE,
        },
      ],
    },
  },

  // The spike is quarantined. This block deliberately targets file sets that
  // carry no other no-restricted-imports rule: flat config replaces a rule
  // rather than merging it, so putting this on lib/** would silently delete
  // the engine fence above. lib/calc-engine already rejects every
  // non-relative import, and lib/ui/core carries SPIKE_PATHS in its own
  // group, so coverage is complete without that risk.
  {
    files: [
      'app/**/*.{ts,tsx}',
      'lib/ui/react/**/*.{ts,tsx}',
      'lib/fr/**/*.ts',
      'tests/**/*.ts',
      'e2e/**/*.ts',
    ],
    ignores: ['app/dev/spike/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: SPIKE_PATHS, message: SPIKE_MESSAGE }] },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/dev\\/spike/]',
          message: SPIKE_MESSAGE,
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
