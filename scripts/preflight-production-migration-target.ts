import { config } from "dotenv";
import { assertProductionNeonDatabaseTarget } from "../src/db/neon-database-target";

config({ path: ".env.local", override: true, quiet: true });
config({ path: ".env", quiet: true });

assertProductionNeonDatabaseTarget(process.env);
process.stdout.write("Production Neon migration target validated.\n");
