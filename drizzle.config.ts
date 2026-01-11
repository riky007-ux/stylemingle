import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
  },
} satisfies Config;
