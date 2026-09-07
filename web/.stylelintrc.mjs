// web/.stylelintrc.mjs
//
// Token discipline, made mechanical. Two complementary rules:
//
//   scale-unlimited/declaration-strict-value  colour, spacing, type and the
//     rest must reference a token - a raw value is rejected even when the
//     number happens to be a legal one, because the token is the contract.
//
//   declaration-property-value-allowed-list   radius, per ruling R8(a):
//     token NAMES only at the point of use. A raw length is rejected even
//     when its value is in the set - 6px fails - and a var() from another
//     family is rejected, so var(--space-2) fails too. The closed numeric
//     set is enforced at the point of DEFINITION instead, by
//     tests/unit/tokens/radius.test.ts, which is R8(b).
//
//     This replaces the FW2 arrangement, where a raw value drawn from the
//     set was accepted. That satisfied the letter of R4's 6-versus-7 proof
//     but let border-radius: 16px past, where a token name is the contract.

// The nine names, and only these. Ruling R8 of 07.09.2026.
const RADIUS_TOKENS = [
  '--radius-xs',
  '--radius-checkbox',
  '--radius-sm',
  '--radius-md',
  '--radius-button-lg',
  '--radius-lg',
  '--radius-xl',
  '--radius-2xl',
  '--radius-pill',
];

// A term is one of those token names, or 0, or 50% (circles).
const RADIUS_TERM = `(?:var\\((?:${RADIUS_TOKENS.join('|')})\\)|0|50%)`;

// border-radius composes up to four corners, and "/" gives the elliptical
// form. The bottom sheet is "radius 24 top":
// var(--radius-2xl) var(--radius-2xl) 0 0.
const RADIUS_VALUE = `/^${RADIUS_TERM}(?:[ /]${RADIUS_TERM}){0,7}$/`;

export default {
  extends: ['stylelint-config-standard-scss'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'fill',
        'stroke',
        'font-size',
        '/^margin/',
        '/^padding/',
        '/gap$/',
        '/width$/',
        '/height$/',
        'line-height',
        'letter-spacing',
        'flex-basis',
        '/^inset/',
        'top',
        'right',
        'bottom',
        'left',
        'box-shadow',
      ],
      {
        expandShorthand: true,
        ignoreFunctions: false,
        ignoreValues: [
          '0',
          'auto',
          'none',
          'inherit',
          'initial',
          'unset',
          'revert',
          'currentColor',
          'transparent',
          'thin',
          'medium',
          'thick',
          '100%',
          '/^var\\(--/',
        ],
        disableFix: true,
        message:
          'Use a design token: ${property} may not carry the raw value "${value}". Tokens live in lib/ui/core/styles/tokens.scss (DESIGN-SYSTEM.md section 1).',
      },
    ],

    'declaration-property-value-allowed-list': [
      { '/radius$/': [RADIUS_VALUE] },
      {
        message: `Radius takes a token name only (ruling R8): one of ${RADIUS_TOKENS.join(', ')}, or 0, or 50%. A raw length is rejected even when its value is in the set.`,
      },
    ],

    'scss/comment-no-empty': null,
  },
  overrides: [
    {
      // CSS Modules are addressed as `styles.cardTitle` from TypeScript, so
      // their class names are camelCase. Kebab-case would force
      // styles['card-title'] at every use site. Global stylesheets keep the
      // preset's kebab-case rule.
      files: ['**/*.module.scss'],
      rules: {
        'selector-class-pattern': [
          '^[a-z][a-zA-Z0-9]*$',
          { message: 'CSS Module class selectors are camelCase.' },
        ],
      },
    },
    {
      // The one file allowed to carry raw values: it is the transcription of
      // DESIGN-SYSTEM.md section 1 and is diffed against it, so hex is kept at
      // the length the design document writes.
      files: ['lib/ui/core/styles/tokens.scss'],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
        'color-hex-length': null,
      },
    },
  ],
};
