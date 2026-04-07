import {
  createClient as createLibsqlClient,
  type Client as LibsqlClient,
  type InArgs,
} from '@libsql/client';
import postgres from 'postgres';

// Database result type compatible with libSQL interface
interface DbResult {
  rows: Record<string, unknown>[];
  rowsAffected?: number;
}

// Client interface compatible with libSQL
interface DbClient {
  execute(query: string | { sql: string; args?: unknown[] }): Promise<DbResult>;
  close(): Promise<void>;
}

type DbBackend = 'postgres' | 'libsql';

let backend: DbBackend | null = null;
let postgresClient: ReturnType<typeof postgres> | null = null;
let libsqlClient: LibsqlClient | null = null;
let libsqlUrl: string | null = null;
let fallbackLogged = false;

function isPostgresUrl(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

function getLocalDbUrl(): string {
  return process.env.LOCAL_DATABASE_URL || 'file:local.db';
}

function getPostgresClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  if (!postgresClient) {
    const isLocal = connectionString.includes('127.0.0.1') || connectionString.includes('localhost');
    postgresClient = postgres(connectionString, {
      ssl: isLocal ? false : 'require',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  return postgresClient;
}

function getLibsqlClient(url: string = getLocalDbUrl()) {
  if (!libsqlClient || libsqlUrl !== url) {
    libsqlClient = createLibsqlClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    libsqlUrl = url;
  }
  return libsqlClient;
}

function getInitialBackend(): DbBackend {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString && isPostgresUrl(connectionString)) {
    return 'postgres';
  }

  return 'libsql';
}

function isConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeCode = 'code' in error ? (error as { code?: unknown }).code : undefined;
  const code = typeof maybeCode === 'string' ? maybeCode : '';
  const message = error instanceof Error ? error.message : '';

  return (
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    message.includes('getaddrinfo') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT')
  );
}

function normalizeQuery(query: string | { sql: string; args?: unknown[] }): {
  sqlString: string;
  args: unknown[];
} {
  if (typeof query === 'string') {
    return { sqlString: query, args: [] };
  }

  return { sqlString: query.sql, args: query.args || [] };
}

async function executeWithPostgres(sqlString: string, args: unknown[]): Promise<DbResult> {
  const client = getPostgresClient();

  // Convert ? placeholders to $1, $2, etc. for PostgreSQL
  let paramIndex = 0;
  const pgSql = sqlString.replace(/\?/g, () => `$${++paramIndex}`);

  // Guard: postgres package rejects undefined values — coerce to null
  const safeArgs = args.map(v => v === undefined ? null : v);

  const result = await client.unsafe(pgSql, safeArgs as postgres.SerializableParameter[]);
  return {
    rows: result as Record<string, unknown>[],
    rowsAffected: result.count,
  };
}

async function executeWithLibsql(sqlString: string, args: unknown[]): Promise<DbResult> {
  const client = getLibsqlClient();
  const result = await client.execute(sqlString, args as InArgs);

  return {
    rows: result.rows as Record<string, unknown>[],
    rowsAffected: result.rowsAffected,
  };
}

/**
 * Get database client with libSQL-compatible interface.
 * This allows minimal changes to existing repository code.
 */
export function getDb(): DbClient {
  return {
    async execute(query: string | { sql: string; args?: unknown[] }): Promise<DbResult> {
      if (!backend) {
        backend = getInitialBackend();
      }

      const { sqlString, args } = normalizeQuery(query);

      if (backend === 'libsql') {
        return executeWithLibsql(sqlString, args);
      }

      try {
        return await executeWithPostgres(sqlString, args);
      } catch (error) {
        if (isConnectivityError(error)) {
          backend = 'libsql';

          if (!fallbackLogged) {
            fallbackLogged = true;
            console.warn(
              `PostgreSQL unavailable (${(error as { code?: string }).code || 'unknown'}); falling back to ${getLocalDbUrl()}`
            );
          }

          return await executeWithLibsql(sqlString, args);
        }

        console.error('Database query error:', error);
        console.error('Query:', sqlString);
        console.error('Args:', args);
        throw error;
      }
    },

    async close(): Promise<void> {
      if (postgresClient) {
        await postgresClient.end();
        postgresClient = null;
      }
      if (libsqlClient) {
        libsqlClient.close();
        libsqlClient = null;
        libsqlUrl = null;
      }
      backend = null;
      fallbackLogged = false;
    },
  };
}

export type { DbClient as Client };
