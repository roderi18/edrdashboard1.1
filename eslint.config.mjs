import globals from 'globals';
import eslintJs from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import importPlugin from 'eslint-plugin-import';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import perfectionistPlugin from 'eslint-plugin-perfectionist';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';

// ----------------------------------------------------------------------

/**
 * @rules common
 * from 'react', 'eslint-plugin-react-hooks'...
 */
const commonRules = () => ({
  ...reactHooksPlugin.configs.recommended.rules,
  'no-shadow': 2,
  'func-names': 1,
  'no-bitwise': 2,
  'object-shorthand': 1,
  'no-useless-rename': 1,
  'default-case-last': 2,
  'consistent-return': 2,
  'no-constant-condition': 1,
  'no-unused-vars': [1, { args: 'none' }],
  'default-case': [2, { commentPattern: '^no default$' }],
  'lines-around-directive': [2, { before: 'always', after: 'always' }],
  'arrow-body-style': [2, 'as-needed', { requireReturnForObjectLiteral: false }],
  // react
  'react/jsx-key': 0,
  'react/prop-types': 0,
  'react/display-name': 0,
  'react/no-children-prop': 0,
  'react/jsx-boolean-value': 2,
  'react/self-closing-comp': 2,
  'react/react-in-jsx-scope': 0,
  'react/jsx-no-useless-fragment': [1, { allowExpressions: true }],
  'react/jsx-curly-brace-presence': [2, { props: 'never', children: 'never' }],
  'react-hooks/refs': 0,
  'react-hooks/immutability': 0,
  'react-hooks/set-state-in-effect': 0,
  'react-hooks/incompatible-library': 0,
  'react-hooks/preserve-manual-memoization': 0,
});

/**
 * @rules import
 * from 'eslint-plugin-import'.
 */
const importRules = () => ({
  ...importPlugin.configs.recommended.rules,
  'import/named': 0,
  'import/export': 0,
  'import/default': 0,
  'import/namespace': 0,
  'import/no-named-as-default': 0,
  'import/newline-after-import': 2,
  'import/no-named-as-default-member': 0,
  'import/no-cycle': [
    0, // disabled if slow
    { ignoreExternal: true, disableScc: true },
  ],
});

/**
 * @rules unused imports
 * from 'eslint-plugin-unused-imports'.
 */
const unusedImportsRules = () => ({
  'unused-imports/no-unused-imports': 1,
  'unused-imports/no-unused-vars': [
    0,
    { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
  ],
});

/**
 * @rules sort or imports/exports
 * from 'eslint-plugin-perfectionist'.
 */
const sortImportsRules = () => {
  const customGroups = {
    mui: ['custom-mui'],
    auth: ['custom-auth'],
    hooks: ['custom-hooks'],
    utils: ['custom-utils'],
    types: ['custom-types'],
    routes: ['custom-routes'],
    sections: ['custom-sections'],
    components: ['custom-components'],
  };

  const typeGroups = [
    ['type', 'external-type', 'builtin-type'],
    { newlinesBetween: 'never' },
    ['index-type', 'parent-type', 'sibling-type', 'internal-type'],
  ];

  return {
    'perfectionist/sort-named-imports': [1, { type: 'line-length', order: 'asc' }],
    'perfectionist/sort-named-exports': [1, { type: 'line-length', order: 'asc' }],
    'perfectionist/sort-exports': [
      1,
      {
        order: 'asc',
        type: 'line-length',
        groupKind: 'values-first',
      },
    ],
    'perfectionist/sort-imports': [
      2,
      {
        order: 'asc',
        ignoreCase: true,
        type: 'line-length',
        environment: 'node',
        maxLineLength: undefined,
        newlinesBetween: 'always',
        internalPattern: ['^src/.+'],
        groups: [
          'style',
          'side-effect',
          ...typeGroups,
          ['builtin', 'external'],
          customGroups.mui,
          customGroups.routes,
          customGroups.hooks,
          customGroups.utils,
          'internal',
          customGroups.components,
          customGroups.sections,
          customGroups.auth,
          customGroups.types,
          ['parent', 'sibling', 'index'],
          'object',
          'unknown',
        ],
        customGroups: {
          value: {
            [customGroups.mui]: ['^@mui/.+'],
            [customGroups.auth]: ['^src/auth/.+'],
            [customGroups.hooks]: ['^src/hooks/.+'],
            [customGroups.utils]: ['^src/utils/.+'],
            [customGroups.types]: ['^src/types/.+'],
            [customGroups.routes]: ['^src/routes/.+'],
            [customGroups.sections]: ['^src/sections/.+'],
            [customGroups.components]: ['^src/components/.+'],
          },
        },
      },
    ],
  };
};

/**
 * Custom ESLint configuration.
 */
export const customConfig = {
  plugins: {
    'react-hooks': reactHooksPlugin,
    'unused-imports': unusedImportsPlugin,
    perfectionist: perfectionistPlugin,
    import: importPlugin,
  },
  settings: {
    'import/resolver': {
      alias: {
        map: [['src', './src']],
        extensions: ['.js', '.jsx', '.json'],
      },
    },
  },
  rules: {
    ...commonRules(),
    ...importRules(),
    ...unusedImportsRules(),
    ...sortImportsRules(),
  },
};

// ----------------------------------------------------------------------

export default [
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
  { ignores: ['*', '!src/', '!eslint.config.*'] },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { react: { version: 'detect' } },
  },
  eslintJs.configs.recommended,
  reactPlugin.configs.flat.recommended,
  customConfig,
  // --------------------------------------------------------------------
  // La puerta de cambios se OBLIGA aqui, no con una norma escrita.
  //
  // Escribir directamente en la base de datos —Firestore o la API— queda
  // PROHIBIDO POR DEFECTO en toda la aplicacion. Lo que no pase por
  // `solicitudes-cambio-service` no compila el lint, y por tanto no entra.
  //
  // Esto es lo que hace que la garantia no dependa de que alguien se acuerde:
  // un rol nuevo, un permiso nuevo, un modulo nuevo o un fichero nuevo chocan
  // con la prohibicion desde el primer dia, sin que nadie tenga que anadirlos a
  // ninguna lista. La regla mira la ESCRITURA, no quien la hace, asi que ningun
  // rol futuro puede quedar fuera por definicion.
  //
  // `ignores` es la deuda: los ficheros que escribian directo desde antes de
  // existir la puerta. Cada uno que se engancha SALE de la lista y ya no puede
  // volver. La lista solo puede encoger.
  // --------------------------------------------------------------------
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: [
      // Infraestructura: son la puerta misma, o el registro, o el acceso de bajo
      // nivel sobre el que la puerta se apoya.
      'src/services/solicitudes-cambio-service.js',
      'src/services/audit-log-service.js',
      // Solo contiene la funcion que `proponerCambio` ejecuta DESPUES de haber
      // registrado el cambio: es el brazo que aplica, no una puerta paralela.
      'src/services/primer-acceso-service.js',
      // Las rutas de `src/app/api/**` son el proxy hacia el backend .NET: la
      // puerta esta del lado de quien decide el cambio, no del transporte.
      'src/app/api/**',

      // --- DEUDA: enganchar a la puerta y borrar de aqui ---
      'src/auth/components/context/firebase/action.js',
      'src/auth/permissions/firebase-permissions.js',
      'src/sections/account/account-change-password.jsx',
      'src/sections/account/account-general.jsx',
      'src/sections/auth/signup/signup-without-email.jsx',
      'src/sections/member/member-create-edit-form.jsx',
      'src/sections/user-account/user-account-general.jsx',
      'src/services/address-service.js',
      'src/services/admin-maintenance-service.js',
      'src/services/admin-permissions-service.js',
      'src/services/attendance-service.js',
      'src/services/award-status-change-request-service.js',
      'src/services/cart-service.js',
      'src/services/certificate-service.js',
      'src/services/directivas-organizacionales-service.js',
      'src/services/file-manager-service.js',
      'src/services/inventory-service.js',
      // Parcial: el progreso de Ascenso/Academia YA pasa por la puerta; quedan
      // el vinculo de certificado, el favorito y dos escrituras auxiliares.
      'src/services/member-awards-service.js',
      'src/services/member-health-access-service.js',
      'src/services/member-health-documents-service.js',
      'src/services/member-health-service.js',
      'src/services/member-history-service.js',
      'src/services/notification-service.js',
      'src/services/notification-settings-service.js',
      'src/services/order-service.js',
      'src/services/organigrama-directiva-destacamentos-service.js',
      'src/services/principal-service.js',
      'src/services/principal-social-service.js',
      'src/services/product-review-service.js',
      'src/services/product-service.js',
      'src/services/receipt-service.js',
      'src/services/solicitudes-cambio-miembro-service.js',
      'src/utils/firebase-admins.js',
      'src/utils/firebase-calendar.js',
      'src/utils/firebase-notificaciones.js',
      'src/utils/firebase-photos.js',
      'src/utils/member-access.js',
      // Servicios de nivel organizacional: se enganchan en el paso siguiente.
      'src/services/dest-service.js',
      'src/services/sectional-service.js',
      'src/services/regional-service.js',
      'src/services/church-service.js',
      'src/services/member-service.js',
      'src/actions/calendar.js',
      'src/actions/mail.js',
      'src/sections/dest/dest-table-toolbar.jsx',
      'src/sections/member/member-table-toolbar.jsx',
      'src/sections/regional/regional-table-toolbar.jsx',
      'src/sections/sectional/sectional-table-toolbar.jsx',
      'src/services/cargos-api-service.js',
      'src/services/pastor-destacamento-service.js',
    ],
    rules: {
      'no-restricted-syntax': [
        2,
        {
          selector:
            "CallExpression[callee.name=/^(setDoc|updateDoc|addDoc|deleteDoc|writeBatch)$/]",
          message:
            'Escritura directa en Firestore. Todo cambio debe pasar por proponerCambio() de src/services/solicitudes-cambio-service.js, que lo registra en Historial antes de aplicarlo.',
        },
        {
          selector: "Property[key.name='method'][value.value=/^(POST|PUT|PATCH|DELETE)$/i]",
          message:
            'Escritura directa contra la API. Todo cambio debe pasar por proponerCambio() de src/services/solicitudes-cambio-service.js, que lo registra en Historial antes de aplicarlo.',
        },
      ],
    },
  },
];
