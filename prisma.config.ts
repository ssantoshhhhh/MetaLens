import { defineConfig } from "prisma/config"

try {
  process.loadEnvFile()
} catch {
  // .env is optional because the database is optional.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
})
