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

const JEST_DOM_MESSAGE =
  'RULING R66: @testing-library/jest-dom is not imported in this repo, and ' +
  'must not be. Its matchers NORMALISE whitespace - toHaveTextContent, ' +
  'toHaveValue, toHaveDisplayValue, toHaveAccessibleName, ' +
  'toHaveAccessibleDescription - and U+202F (formatDays group separator) ' +
  'and U+00A0 (formatPercent) are whitespace to that regex. Measured: DOM ' +
  'with U+00A0 MATCHES a matcher written with an ASCII space, silently. ' +
  'Assert formatted values with textContent and compare exactly. If you ' +
  'need a jest-dom matcher that does not touch text, add it here by name ' +
  'with a reason.';

const NAMESPACE_IMPORT_MESSAGE =
  'Import the names you use (ruling R116). A namespace import from a package ' +
  'with per-export entry points is what allows a runtime lookup, and a runtime ' +
  'lookup defeats tree-shaking: ZoneBadge shipped the whole lucide-react ' +
  'library, 207 KiB, for four tasks. node: builtins are exempt.';

const SPIKE_MESSAGE =
  'app/dev/spike is the FW2 bundle spike: throwaway markup that exists to be ' +
  'weighed, not reused. The component library is lib/ui/react (FW8-FW9).';

// Every way of naming the spike directory from outside it.
const SPIKE_PATHS = ['@/app/dev/spike', '@/app/dev/spike/*', '**/dev/spike', '**/dev/spike/*'];

/**
 * RULING R116, as a SHARED ENTRY rather than one block's rule.
 *
 * A flat-config block that sets `no-restricted-syntax` REPLACES the value from
 * every earlier block rather than merging with it. Declaring R116 once in the
 * app/lib block therefore did nothing for lib/ui/react, lib/ui/core or
 * lib/calc-engine: --print-config showed ZoneBadge's effective rule was the
 * SPIKE selector alone, and the namespace import lint-passed.
 *
 * THIRD OCCURRENCE OF THIS TRAP IN THIS REPOSITORY. The eslint `ignores` key
 * behaves the same way (FW10), and so does a Playwright project's
 * `testIgnore` (FW10, where the chromium project silently stopped running the
 * runtime guard). A narrower scope deleting a broader rule is invisible in a
 * diff and green in every run.
 *
 * So it is spread into every array, and
 * tests/unit/meta/eslint-namespace-rule.test.ts asserts the EFFECTIVE config
 * for a file in each product directory - which is the only thing that could
 * have caught this.
 */
const SPIKE_IMPORT_RULE = {
  selector: 'ImportExpression[source.value=/dev\\/spike/]',
  message: SPIKE_MESSAGE,
};

const NAMESPACE_IMPORT_RULE = {
  selector: 'ImportDeclaration[source.value!=/^node:/] > ImportNamespaceSpecifier',
  message: NAMESPACE_IMPORT_MESSAGE,
};

export default tseslint.config(
  {
    // '.next-visual-*' is R98's per-run build directory. It should never
    // exist on a workstation - the container builds into a volume - but a
    // local NEXT_DIST_DIR would put one here, and linting a generated build
    // tree produces thousands of errors from files nobody wrote.
    // EVERY GENERATED DIRECTORY, and the list is deliberately exhaustive
    // rather than minimal. All of these are gitignored, but eslint 9's flat
    // config does not read .gitignore - so a directory can be invisible to git
    // and fully visible to the linter, which is how playwright-report/ came to
    // contribute 6 000-odd errors from Playwright's own bundled report JS.
    //
    // The failure only appears on the SECOND gate run in a session: pnpm gate
    // lints before it runs e2e, so on a clean tree the report does not exist
    // yet. That is the worst kind of latency - it passes for whoever adds it
    // and fails for whoever runs it twice.
    //
    // Third instance of this shape here: web/public threw ENOENT in a test
    // walker because git does not track it, and .next-visual-* leaked a build
    // tree into the repository. A generated path reaching a tool that should
    // not see it is a class, not an incident.
    ignores: [
      '.next/**',
      '.next-visual-*/**',
      // RULING R129 builds the dev-enabled tree here, and Next generates a
      // .ts type file per route inside it. Not ignoring it made eslint report
      // 6 708 errors in generated code - the same shape as the visual runner
      // directories above, which is why it sits beside them.
      '.next-dev-routes/**',
      'node_modules/**',
      'public/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
      'dist-parity/**',
      'next-env.d.ts',
    ],
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
    rules: {
      // RULING R116: no namespace import from a package with per-export entry
      // points. This cost 207 KiB.
      //
      // ZoneBadge did `import * as icons from 'lucide-react'` and then looked
      // the component up by a runtime string. The namespace import alone is
      // tree-shakeable - measured: static destructuring from it still shakes -
      // but it is what MAKES the runtime index possible, and the runtime index
      // is what a bundler cannot resolve. So it shipped every icon in the
      // library.
      //
      // The rule forbids the SHAPE rather than the mechanism, because the
      // mechanism is undetectable by lint: no rule can tell an index by a
      // literal from an index by a variable that happens to hold one. Removing
      // the namespace binding removes the possibility.
      //
      // node: builtins are exempt. They have no per-export entry points, and
      // `import * as fs from 'node:fs'` is the idiom rather than an accident.
      // Test files are a separate config block and unaffected: vitest-axe's
      // matcher bag is consumed wholesale by expect.extend and never bundled.
      'no-restricted-syntax': ['error', NAMESPACE_IMPORT_RULE],
    },
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
        NAMESPACE_IMPORT_RULE,
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
      // The DOM itself, not just the packages that wrap it.
      //
      // Found by probing in FW7: a file here using document.createElementNS,
      // new XMLSerializer() and window.innerWidth linted CLEAN. Every rule in
      // this block was import-based, and the DOM needs no import - it is
      // ambient, and `globals: globals.browser` is applied to lib/** at the
      // top of this file, so the identifiers are declared and no-undef says
      // nothing.
      //
      // The rail is the module with a real reason to reach for it: XML
      // escaping and serialisation. XMLSerializer would produce different
      // bytes in Node and the browser - destroying the byte-identity SPEC 19
      // and 21 require - and would give the PDF path no escaping at all,
      // because it does not exist in Node.
      'no-restricted-globals': [
        'error',
        ...[
          'document',
          'window',
          'navigator',
          'location',
          'history',
          'localStorage',
          'sessionStorage',
          'XMLSerializer',
          'DOMParser',
          'getComputedStyle',
          'requestAnimationFrame',
          'HTMLElement',
          'SVGElement',
          'Element',
          'Node',
        ].map((name) => ({ name, message: CORE_MESSAGE })),
      ],

      'no-restricted-syntax': [
        'error',
        NAMESPACE_IMPORT_RULE,
        {
          selector:
            'ImportExpression[source.value=/^(react|react-dom|lucide-react|next|@carbon|@mui|antd)/]',
          message: CORE_MESSAGE,
        },
        // globalThis.document is a MEMBER EXPRESSION, so no-restricted-globals
        // - which matches bare identifiers resolving to the global scope -
        // does not see it. Probed and confirmed in FW7. Same for
        // globalThis['document'].
        {
          selector:
            'MemberExpression[object.name="globalThis"][property.name=/^(document|window|navigator|location|history|localStorage|sessionStorage|XMLSerializer|DOMParser)$/]',
          message: CORE_MESSAGE,
        },
        {
          selector: 'MemberExpression[object.name="globalThis"][computed=true]',
          message: CORE_MESSAGE,
        },
        // A dynamic import that LEAVES this directory, which is how the DOM
        // gets in indirectly. Probed in FW7 before these three existed:
        // import('../../dom-helper'), import('@/lib/whatever') and
        // import(someVariable) were all CLEAN, so every rule above could be
        // satisfied by a module that simply imported its way out.
        //
        // A './' import that stays inside is deliberately still allowed: the
        // module it reaches is under lib/ui/core and is fenced by this very
        // block, so it cannot hold the DOM either. The fence is the
        // directory, not the file.
        //
        // Same negative-lookahead shape as the engine fence, and for the same
        // reason: a group of '*' would also forbid './types', and gitignore
        // semantics cannot express "everything except a path that stays here".
        {
          selector: 'ImportExpression[source.value=/^(?!\\.\\/)/]',
          message: CORE_MESSAGE,
        },
        {
          selector: 'ImportExpression[source.value=/(^|\\/)\\.\\.(\\/|$)/]',
          message: CORE_MESSAGE,
        },
        // A computed specifier cannot be checked at all, so it is refused
        // rather than guessed at.
        {
          selector: 'ImportExpression[source.type!="Literal"]',
          message: CORE_MESSAGE,
        },
        SPIKE_IMPORT_RULE,
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

  // (b2) lib/lamal is pure and stands apart from the engine. FW-COMPARATEUR,
  // R657: the LAMal / CMU comparison is a different domain from the telework
  // engine, with different sources and a different verification status, so it
  // never imports lib/calc-engine; and it is pure - no React, no Next, no
  // filesystem - so the island and the tests run the same arithmetic. A
  // separate file set from every other no-restricted-imports block, because
  // flat config replaces a rule rather than merging it.
  {
    files: ['lib/lamal/**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/calc-engine', '@/lib/calc-engine/*', '**/calc-engine', '**/calc-engine/*'],
              message: 'lib/lamal never imports lib/calc-engine (R657): a different domain and different sources.',
            },
            {
              group: ['react', 'react-dom', 'next', 'next/*', 'node:*', 'fs', 'path'],
              message: 'lib/lamal is pure (R657): no React, no Next, no I/O.',
            },
          ],
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
      // .tsx as well as .ts, for the same reason ruling R63 gives about
      // vitest's include globs: a glob ending in .ts matches NEITHER of the
      // two extensions a .tsx file could be linted under, and the failure is
      // silent - eslint reports no error for a file it was never given. This
      // directory now holds a .tsx canary, so the hole was real rather than
      // theoretical.
      'tests/**/*.{ts,tsx}',
      'e2e/**/*.{ts,tsx}',
    ],
    ignores: ['app/dev/spike/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: SPIKE_PATHS, message: SPIKE_MESSAGE },
            // RULING R66. Added to THIS block rather than a new one: flat
            // config REPLACES a rule instead of merging it, so a second
            // block for these same files would silently delete the spike
            // fence above. The config already carries that warning twice.
            {
              group: ['@testing-library/jest-dom', '@testing-library/jest-dom/*'],
              message: JEST_DOM_MESSAGE,
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        NAMESPACE_IMPORT_RULE,
        SPIKE_IMPORT_RULE,
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

      // Every injection site must be DECLARED. The product has exactly one -
      // ThresholdRail, whose input is renderRailSvg over validated numbers,
      // escaped by lib/ui/core/rail/xml.ts - and the two in the dev gallery
      // are a screenshot harness. Turning the rule on means a new site is an
      // error rather than something a reviewer has to notice, and it makes
      // each existing one carry its justification at the line.
      'react/no-danger': 'error',
    },
  },

  // ---------------------------------------------------------------------
  // RULING R116 IS ABOUT BUNDLE SIZE, so it applies to code that ships.
  //
  // Test files are never bundled, and two namespace imports in them are
  // correct: vitest-axe exports a BAG of matchers consumed wholesale by
  // expect.extend, and tests/harness.test.ts imports the engine's barrel
  // precisely to assert its public surface. Both were in the R116 sweep and
  // both were classified as legitimate before the rule was written; the rule
  // then flagged them, which made it over-broad rather than them wrong.
  //
  // LAST, AND SETTING THE WHOLE ARRAY, because a flat-config block replaces
  // the rule rather than merging - the same semantics that made R116 silently
  // inert in three directories. So the selectors test files DO still need are
  // listed explicitly: importing the FW2 spike is as wrong in a test as
  // anywhere else.
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', SPIKE_IMPORT_RULE],
    },
  },
);
