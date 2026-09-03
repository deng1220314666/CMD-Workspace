import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://nexus:nexus@127.0.0.1:5433/cmd_workspace?sslmode=disable',
  },
  strict: true,
  verbose: true,
})
