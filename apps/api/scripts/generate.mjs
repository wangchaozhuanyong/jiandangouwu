import { spawnSync } from "node:child_process";

const generateDatabaseUrl = "mysql://cloudbridge:generate-only@localhost:3306/cloudbridge";
const generateShadowDatabaseUrl = "mysql://cloudbridge:generate-only@localhost:3306/cloudbridge_shadow";

const result = spawnSync("npx", ["prisma", "generate"], {
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? generateDatabaseUrl,
    SHADOW_DATABASE_URL: process.env.SHADOW_DATABASE_URL ?? generateShadowDatabaseUrl,
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
