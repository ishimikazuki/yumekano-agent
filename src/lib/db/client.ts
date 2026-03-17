import { createClient, type Client } from '@libsql/client';

let db: Client | null = null;

export function getDb(): Client {
  if (!db) {
    db = createClient({
      url: process.env.DATABASE_URL ?? 'file:local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  return db;
}

export type { Client };
