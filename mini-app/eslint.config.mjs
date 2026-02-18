import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Allow underscore-prefixed args/vars to be unused
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Downgrade React compiler rules to warnings — these flag valid
      // patterns in this codebase (e.g., Date.now() in useMemo,
      // initializing form state from fetched data in effects).
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Telegram WebApp SDK must load synchronously in the root layout
    files: ['src/app/layout.tsx'],
    rules: {
      '@next/next/no-sync-scripts': 'off',
    },
  },
  prettier,
];

export default eslintConfig;
