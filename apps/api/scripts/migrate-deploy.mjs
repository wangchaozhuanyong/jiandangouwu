import { spawnSync } from "node:child_process";

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required for deployment migrations.`);
}

const username = encodeURIComponent(process.env.DB_USER);
const password = encodeURIComponent(process.env.DB_PASSWORD);
const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const database = encodeURIComponent(process.env.DB_NAME);
const databaseUrl = `mysql://${username}:${password}@${host}:${port}/${database}`;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL
  ?? `mysql://${username}:${password}@${host}:${port}/${database}_shadow`;

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SHADOW_DATABASE_URL: shadowDatabaseUrl,
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
