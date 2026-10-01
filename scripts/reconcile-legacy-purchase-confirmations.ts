import { Pool } from "pg";
import {
  type PurchaseConfirmationCutoverTarget,
  resolvePurchaseConfirmationCutoverTarget,
  runPurchaseConfirmationLegacyCutover,
} from "../src/tooling/purchase-confirmation-cutover";

const main = async (): Promise<void> => {
  let target: PurchaseConfirmationCutoverTarget;
  try {
    target = resolvePurchaseConfirmationCutoverTarget({
      argv: process.argv.slice(2),
      environment: process.env,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Purchase confirmation cutover target is invalid.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({
    application_name: "hub-purchase-confirmation-v1-cutover",
    connectionString: target.databaseUrl,
    max: 1,
  });
  try {
    const client = await pool.connect();
    try {
      const result = await runPurchaseConfirmationLegacyCutover({
        client,
        mode: target.mode,
      });
      process.stdout.write(
        `${JSON.stringify({
          ...result,
          environment: target.environment,
          mode: target.mode,
          status: target.mode === "execute" ? "reconciled" : "planned",
        })}\n`
      );
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch {
    process.stderr.write("Legacy purchase confirmation cutover failed.\n");
    process.exitCode = 1;
  }
}
