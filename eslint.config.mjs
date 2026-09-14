import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/*
 * Database and service-role access is server-only by construction: `@/lib/server/db`,
 * `drizzle-orm` and the Supabase admin client may be imported only from lib/server/**,
 * scripts/** and tests/**. Everything else calls lib/server/data/* through server actions
 * or Server Components.
 */
const serverOnlyImports = {
  paths: [
    { name: '@/lib/server/db', message: 'Database access lives in lib/server/data/*. Import a data function instead.' },
    { name: '@/lib/server/schema', message: 'The schema is server-only. Use lib/server/data/* or lib/shared types.' },
    { name: '@/lib/server/supabase-admin', message: 'The service-role Supabase client is server-only (lib/server/**).' },
    { name: 'drizzle-orm', message: 'Drizzle is server-only. Use lib/server/data/*.' },
    { name: 'postgres', message: 'Database access is server-only.' },
  ],
  patterns: [
    { group: ['drizzle-orm/*'], message: 'Drizzle is server-only. Use lib/server/data/*.' },
    { group: ['**/lib/server/db', '**/lib/server/schema', '**/lib/server/supabase-admin'], message: 'Server-only module.' },
  ],
}

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'supabase/.temp/**',
    'supabase/.branches/**',
    'drizzle/**',
    'qa/**',
    'backups/**',
    'test-results/**',
    'playwright-report/**',
    'scratchpad/**',
  ]),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-restricted-imports': ['error', serverOnlyImports],
    },
  },
  {
    files: ['lib/server/**', 'scripts/**', 'tests/**', 'drizzle.config.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Playwright fixtures call `use(...)`, which is not React's hook.
    files: ['tests/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
])
