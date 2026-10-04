export const PRODUCTION_NEON_COMPUTE = "ep-hidden-tooth-ac843qc2";
const POOLED_HOST_MARKER = "-pooler.";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const LEADING_SLASHES = /^\/+/;

type Environment = Readonly<Record<string, string | undefined>>;

export type NeonNonProductionEnvironment = "development" | "staging";

export const EXPECTED_PRODUCTION_NEON_TARGET = {
  branchId: "br-dark-boat-ac5ju6m4",
  branchName: "production",
  databaseName: "neondb",
  host: "ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech",
  projectId: "damp-snow-22911188",
} as const;
export type ProductionNeonDatabaseTarget =
  typeof EXPECTED_PRODUCTION_NEON_TARGET;

// Reviewed Neon metadata is the independent source of truth for every
// non-production branch. Recreating a branch requires updating this tuple in
// the same reviewed change as the protected GitHub Environment values.
export const EXPECTED_NEON_TARGETS = {
  development: {
    branchId: "br-square-recipe-b67a4ch7",
    branchName: "development",
    databaseName: "neondb",
    host: "ep-autumn-hill-b6erdexq.c-2.sa-east-1.aws.neon.tech",
    parentId: "br-sparkling-tree-b6c6emws",
    projectId: "shy-bar-59728129",
  },
  staging: {
    branchId: "br-cool-bread-b69twnrp",
    branchName: "staging",
    databaseName: "neondb",
    host: "ep-noisy-band-b6lcc8jk.c-2.sa-east-1.aws.neon.tech",
    parentId: "br-sparkling-tree-b6c6emws",
    projectId: "shy-bar-59728129",
  },
} as const satisfies Record<
  NeonNonProductionEnvironment,
  {
    branchId: string;
    branchName: string;
    databaseName: string;
    host: string;
    parentId: string;
    projectId: string;
  }
>;

const TARGET_ENVIRONMENT_KEYS = {
  development: {
    branchId: "DEVELOPMENT_NEON_BRANCH_ID",
    host: "DEVELOPMENT_DATABASE_HOST",
    projectId: "DEVELOPMENT_NEON_PROJECT_ID",
  },
  staging: {
    branchId: "STAGING_NEON_BRANCH_ID",
    host: "STAGING_DATABASE_HOST",
    projectId: "STAGING_NEON_PROJECT_ID",
  },
} as const satisfies Record<
  NeonNonProductionEnvironment,
  { branchId: string; host: string; projectId: string }
>;

const normalizeNeonHost = (host: string): string =>
  host.trim().toLowerCase().replace(POOLED_HOST_MARKER, ".");

const isPooledNeonHost = (host: string): boolean =>
  host.trim().toLowerCase().includes(POOLED_HOST_MARKER);

const parsePostgresUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
};

export const getNeonMetadataProblems = (
  environment: Environment,
  target: NeonNonProductionEnvironment
): string[] => {
  const expected = EXPECTED_NEON_TARGETS[target];
  const keys = TARGET_ENVIRONMENT_KEYS[target];
  const expectedHost = environment[keys.host]?.trim();
  const projectId = environment[keys.projectId]?.trim();
  const branchId = environment[keys.branchId]?.trim();
  const problems: string[] = [];

  if (!expectedHost) {
    problems.push(`${keys.host} is required`);
  } else if (expectedHost.toLowerCase() !== expected.host) {
    problems.push(`${keys.host} must match the approved ${target} Neon host`);
  }

  if (!projectId) {
    problems.push(`${keys.projectId} is required`);
  } else if (projectId !== expected.projectId) {
    problems.push(`${keys.projectId} does not match the approved Neon project`);
  }

  if (!branchId) {
    problems.push(`${keys.branchId} is required`);
  } else if (branchId !== expected.branchId) {
    problems.push(`${keys.branchId} does not match the approved Neon branch`);
  }

  return problems;
};

export interface NeonDatabaseTarget {
  branchId: string;
  branchName: string;
  databaseName: string;
  host: string;
  parentId: string;
  projectId: string;
}

export const getNeonTargetProblems = (
  environment: Environment,
  target: NeonNonProductionEnvironment
): string[] => {
  const problems: string[] = [];
  const expected = EXPECTED_NEON_TARGETS[target];
  const rawDatabaseUrl = environment.DATABASE_URL_DIRECT?.trim();

  if (!rawDatabaseUrl) {
    problems.push("DATABASE_URL_DIRECT is required");
  } else {
    const databaseUrl = parsePostgresUrl(rawDatabaseUrl);
    if (!databaseUrl) {
      problems.push("DATABASE_URL_DIRECT must be a valid PostgreSQL URL");
    } else {
      const rawHost = databaseUrl.hostname.trim().toLowerCase();
      const host = normalizeNeonHost(rawHost);
      if (isPooledNeonHost(rawHost)) {
        problems.push(
          "DATABASE_URL_DIRECT must use the direct Neon endpoint, not a pooler"
        );
      }
      if (host.startsWith(PRODUCTION_NEON_COMPUTE)) {
        problems.push(
          "DATABASE_URL_DIRECT must not target the Production Neon compute"
        );
      } else if (LOOPBACK_HOSTS.has(host)) {
        problems.push("Non-Production database target must be a remote Neon host");
      } else if (!isPooledNeonHost(rawHost) && rawHost !== expected.host) {
        problems.push(
          `DATABASE_URL_DIRECT must target the approved ${target} Neon host`
        );
      }

      const databaseName = decodeURIComponent(databaseUrl.pathname).replace(
        LEADING_SLASHES,
        ""
      );
      if (databaseName !== expected.databaseName) {
        problems.push(
          `DATABASE_URL_DIRECT must target the ${target} database`
        );
      }
    }
  }

  problems.push(...getNeonMetadataProblems(environment, target));
  return problems;
};

export const assertNeonDatabaseTarget = ({
  environment,
  target,
}: {
  environment: Environment;
  target: NeonNonProductionEnvironment;
}): NeonDatabaseTarget => {
  const problems = getNeonTargetProblems(environment, target);
  if (problems.length > 0) {
    throw new Error(
      `${target[0]?.toUpperCase()}${target.slice(1)} database target is unsafe:\n- ${problems.join("\n- ")}`
    );
  }

  const expected = EXPECTED_NEON_TARGETS[target];
  return { ...expected };
};

export const isProductionNeonHost = (host: string): boolean =>
  normalizeNeonHost(host).startsWith(PRODUCTION_NEON_COMPUTE);

export const getProductionNeonTargetProblems = (
  environment: Environment
): string[] => {
  const problems: string[] = [];
  const expected = EXPECTED_PRODUCTION_NEON_TARGET;
  const rawDatabaseUrl = environment.DATABASE_URL_DIRECT?.trim();
  const expectedHost = environment.PRODUCTION_DATABASE_HOST?.trim();
  const projectId = environment.PRODUCTION_NEON_PROJECT_ID?.trim();
  const branchId = environment.PRODUCTION_NEON_BRANCH_ID?.trim();

  if (!rawDatabaseUrl) {
    problems.push("DATABASE_URL_DIRECT is required");
  } else {
    const databaseUrl = parsePostgresUrl(rawDatabaseUrl);
    if (!databaseUrl) {
      problems.push("DATABASE_URL_DIRECT must be a valid PostgreSQL URL");
    } else {
      const host = databaseUrl.hostname.trim().toLowerCase();
      if (isPooledNeonHost(host)) {
        problems.push(
          "DATABASE_URL_DIRECT must use the direct Neon endpoint, not a pooler"
        );
      } else if (host !== expected.host) {
        problems.push(
          "DATABASE_URL_DIRECT must target the approved Production Neon host"
        );
      }

      const databaseName = decodeURIComponent(databaseUrl.pathname).replace(
        LEADING_SLASHES,
        ""
      );
      if (databaseName !== expected.databaseName) {
        problems.push("DATABASE_URL_DIRECT must target the Production database");
      }
    }
  }

  if (!expectedHost) {
    problems.push("PRODUCTION_DATABASE_HOST is required");
  } else if (expectedHost.toLowerCase() !== expected.host) {
    problems.push("PRODUCTION_DATABASE_HOST does not match the approved Neon host");
  }

  if (!projectId) {
    problems.push("PRODUCTION_NEON_PROJECT_ID is required");
  } else if (projectId !== expected.projectId) {
    problems.push("PRODUCTION_NEON_PROJECT_ID does not match the approved Neon project");
  }

  if (!branchId) {
    problems.push("PRODUCTION_NEON_BRANCH_ID is required");
  } else if (branchId !== expected.branchId) {
    problems.push("PRODUCTION_NEON_BRANCH_ID does not match the approved Neon branch");
  }

  return problems;
};

export const assertProductionNeonDatabaseTarget = (
  environment: Environment
): ProductionNeonDatabaseTarget => {
  const problems = getProductionNeonTargetProblems(environment);
  if (problems.length > 0) {
    throw new Error(
      `Production database target is unsafe:\n- ${problems.join("\n- ")}`
    );
  }

  return EXPECTED_PRODUCTION_NEON_TARGET;
};
