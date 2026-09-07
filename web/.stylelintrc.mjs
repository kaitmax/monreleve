// web/.stylelintrc.mjs
//
// Token discipline, made mechanical. Two complementary rules:
//
//   scale-unlimited/declaration-strict-value  colour, spacing, type and the
//     rest must reference a token - a raw value is rejected even when the
//     number happens to be a legal one, because the token is the contract.
//
//   declaration-property-value-allowed-list   radius is different. Ruling R4
//     makes the radius scale a CLOSED SET, so the lint reads as the set:
//     a radius token, or a raw value drawn from the set, is accepted, and
//     anything else is rejected. This is the same shape as the Android
//     radius check in DESIGN-SYSTEM.md section 4.

// Ruling R4 of 07.09.2026 added 6 (checkbox, Frontier section 38).
const RADIUS_SCALE = ['4px', '6px', '8px', '12px', '14px', '16px', '20px', '24px', '999px'];

// A radius may also be a token reference, zero, or a percentage (circles).
const RADIUS_TERM = `(?:var\\(--radius-[a-z0-9-]+\\)|${RADIUS_SCALE.join('|')}|0|50%)`;

// border-radius takes up to four terms - the bottom sheet is "radius 24 top",
// i.e. `24px 24px 0 0` - so the pattern allows a space-separated list, and a
// "/" for the elliptical form.
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
        message: `Radius is a closed set (ruling R4): a --radius-* token or one of {${RADIUS_SCALE.join(', ')}}.`,
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
