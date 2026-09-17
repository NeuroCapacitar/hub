import type { LegacyMigrationCompatibility } from "./e2e-migrator";

/**
 * These exact rows already exist in the shared Development ledger, but their
 * source files are not part of the current staging history. They are accepted
 * only by the Development migrator; the ledger is never edited or reordered.
 */
export const DEVELOPMENT_LEGACY_MIGRATIONS = [
  {
    createdAt: 1_785_793_942_565,
    hash: "9f1b093bdef2e295aa572cab85f7ae8cb6fd32149c00685e8957e30a7298c721",
  },
  {
    createdAt: 1_785_974_378_129,
    hash: "b6203b5161d909c7e925d1d9473d6878a4c909c4c9c5d5e81aba11b6974e7907",
  },
  {
    createdAt: 1_789_584_189_002,
    hash: "f5781350225aaee30d1193d700eda249bbfb836321bd7288e20a1e629af5d2c4",
  },
] as const satisfies readonly LegacyMigrationCompatibility[];
