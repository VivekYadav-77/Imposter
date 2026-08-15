import type { Transaction } from "kysely";

import type { Database, DatabaseSchema } from "./database.js";

export type TransactionCallback<T> = (transaction: Transaction<DatabaseSchema>) => Promise<T>;

export async function inTransaction<T>(
  database: Database,
  callback: TransactionCallback<T>,
): Promise<T> {
  return database.transaction().setIsolationLevel("read committed").execute(callback);
}
