import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

// During static builds, env vars might be missing. Avoid throwing here.
let db: any;

if (url && authToken) {
  const client = createClient({ url, authToken });
  db = drizzle(client);
} else {
  console.warn('TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing; database client disabled.');
  db = undefined;
}

export { db };
export default db;
