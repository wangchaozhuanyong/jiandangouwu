import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const fileUrl = (file) => new URL(`../${file}`, import.meta.url);
const read = (file) => readFileSync(fileUrl(file), "utf8");

test("仓库只保留 Sites 生产工作区", () => {
  const root = JSON.parse(read("package.json"));

  assert.deepEqual(root.workspaces, [
    "apps/admin",
    "apps/sites",
    "apps/storefront",
    "packages/contracts",
  ]);
  assert.equal(existsSync(fileUrl("apps/api")), false);
  assert.equal(existsSync(fileUrl("infra")), false);
  assert.equal(existsSync(fileUrl("compose.yaml")), false);
  assert.equal(existsSync(fileUrl("apps/admin/Dockerfile")), false);
  assert.equal(root.scripts["dev:api"], undefined);
  assert.equal(root.scripts["db:up"], undefined);
  assert.doesNotMatch(JSON.stringify(root), /@cloudbridge\/api|@cloudbridge\/infra|docker compose/u);
});

test("Sites 发布依赖与 D1/R2 绑定保持完整", () => {
  const hosting = JSON.parse(read(".openai/hosting.json"));
  const sitesPackage = JSON.parse(read("apps/sites/package.json"));
  const worker = read("apps/sites/worker/index.ts");
  const types = read("apps/sites/server/types.ts");

  assert.equal(typeof hosting.project_id, "string");
  assert.ok(hosting.project_id.length > 10);
  assert.match(JSON.stringify(hosting), /D1|R2|MEDIA/u);
  assert.equal(sitesPackage.name, "@cloudbridge/sites");
  assert.match(sitesPackage.scripts.build, /VITE_ADMIN_AUTH_PROVIDER=sites/u);
  assert.match(worker, /handleCloudBridgeRequest/u);
  assert.match(types, /DB:\s*D1Database/u);
  assert.match(types, /MEDIA:\s*R2Bucket/u);
});

test("根构建兼容发布链未被旧平台清理误删", () => {
  for (const file of [
    "src/App.jsx",
    "worker/index.js",
    "scripts/prepare-sites-build.mjs",
    "scripts/prepare-sites-platform-release.mjs",
    "tests/sites-worker.test.mjs",
  ]) {
    assert.equal(existsSync(fileUrl(file)), true, `${file} should remain`);
  }
});

test("CI 只执行 Sites-only 完整门禁", () => {
  const workflow = read(".github/workflows/ci.yml");

  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/u);
  assert.match(workflow, /node-version:\s*"24"/u);
  assert.match(workflow, /run:\s*npm ci/u);
  assert.match(workflow, /run:\s*npm run check/u);
  assert.match(workflow, /npm run audit:prod/u);
  assert.doesNotMatch(workflow, /docker build|CDK|synth|apps\/api|infra\//iu);
});

test("环境模板没有数据库、缓存或 AWS 遗留", () => {
  const env = read(".env.example");

  assert.match(env, /CLOUDBRIDGE_DATA_KEY=/u);
  assert.match(env, /TELEGRAM_BOT_TOKEN=/u);
  assert.match(env, /TELEGRAM_ORDER_CHAT_ID=/u);
  assert.match(env, /VITE_ADMIN_AUTH_PROVIDER=sites/u);
  assert.doesNotMatch(env, /MYSQL|DATABASE_URL|REDIS|VALKEY|AWS_|SESSION_SECRET|AUTH_ENCRYPTION_KEY/u);
});
