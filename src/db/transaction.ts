import type { PoolClient } from "pg";
import { getPool } from "@/db";

export const withPostgresTransaction = async <Result>(
  operation: (client: PoolClient) => Promise<Result>
): Promise<Result> => {
  const client = await getPool().connect();
  let transactionOpen = false;

  try {
    await client.query("begin");
    transactionOpen = true;
    const result = await operation(client);
    await client.query("commit");
    transactionOpen = false;
    return result;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the original failure if rollback also fails.
      }
    }
    throw error;
  } finally {
    client.release();
  }
};
