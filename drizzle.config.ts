import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/server/schema.ts',
  out: './drizzle',
  // Supabase owns auth/storage/etc. Only `public` is ours.
  schemaFilter: ['public'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
  strict: true,
  verbose: true,
})
