#!/usr/bin/env node
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredRuleFiles = [
  "AGENTS.md",
  "docs/PRODUCT.md",
  "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT.md",
  "docs/DATA_API_SECURITY.md",
  "docs/INTERACTION_RULES.md",
  "docs/TESTING_AND_RELEASE.md",
  "docs/ROADMAP.md",
  ".env.example",
];
const requiredDocs = requiredRuleFiles.filter((file) => file.startsWith("docs/"));
const errors = [];

const read = (file) => readFileSync(path.join(root, file), "utf8");
const assertRule = (condition, message) => {
  if (!condition) errors.push(message);
};

for (const file of requiredRuleFiles) {
  assertRule(existsSync(path.join(root, file)), `缺少规则文件：${file}`);
}

if (errors.length === 0) {
  const packageJson = JSON.parse(read("package.json"));
  const storefrontPackage = JSON.parse(read("apps/storefront/package.json"));
  const adminPackage = JSON.parse(read("apps/admin/package.json"));
  const sitesPackage = JSON.parse(read("apps/sites/package.json"));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const agents = read("AGENTS.md");
  const architecture = read("docs/ARCHITECTURE.md");
  const product = read("docs/PRODUCT.md");
  const testing = read("docs/TESTING_AND_RELEASE.md");
  const interaction = read("docs/UX_INTERACTION_SYSTEM.md");
  const rootViteVersion = String(dependencies.vite ?? "").replace(/^[^\d]*/u, "");
  const sitesViteVersion = String(
    sitesPackage.devDependencies?.vite ?? "",
  ).replace(/^[^\d]*/u, "");

  assertRule(packageJson.name === "cloudbridge-platform", "package.json 项目标识必须保持为 CloudBridge 平台");
  assertRule(packageJson.packageManager === undefined || packageJson.packageManager.startsWith("npm@"), "当前项目必须继续使用 npm");
  assertRule(/^19\./u.test(String(dependencies.react ?? "").replace(/^[^\d]*/u, "")), "React 主版本必须保持为 19");
  assertRule(/^8\./u.test(rootViteVersion), "根项目 Vite 主版本必须保持为 8");
  assertRule(/^16\./u.test(String(storefrontPackage.dependencies?.next ?? "").replace(/^[^\d]*/u, "")), "客户端 Next.js 主版本必须保持为 16");
  assertRule(/^8\./u.test(String(adminPackage.devDependencies?.vite ?? "").replace(/^[^\d]*/u, "")), "管理后台 Vite 主版本必须保持为 8");
  assertRule(/^16\./u.test(String(sitesPackage.dependencies?.next ?? "").replace(/^[^\d]*/u, "")), "Sites Next.js 主版本必须保持为 16");
  assertRule(/^8\./u.test(sitesViteVersion), "Sites Vite 主版本必须保持为 8");
  assertRule(rootViteVersion === sitesViteVersion, "根项目与 Sites 必须使用同一 Vite 版本");
  assertRule(sitesPackage.dependencies?.["drizzle-orm"] !== undefined, "Sites 必须保留 D1 Drizzle 数据层");
  assertRule(!existsSync(path.join(root, "apps", "api")), "Sites-only 项目不应保留 apps/api");
  assertRule(!existsSync(path.join(root, "infra")), "Sites-only 项目不应保留 infra");
  assertRule(!existsSync(path.join(root, "compose.yaml")), "Sites-only 项目不应保留 compose.yaml");

  for (const dependency of ["vue", "element-plus", "tailwindcss"]) {
    assertRule(!(dependency in dependencies), `规则基线不允许引入未批准依赖：${dependency}`);
  }

  assertRule(packageJson.scripts?.["check:rules"] === "node scripts/check-project-rules.mjs", "package.json 缺少标准 check:rules 命令");
  assertRule(typeof packageJson.scripts?.check === "string", "package.json 缺少统一 check 命令");

  for (const doc of requiredDocs) {
    assertRule(agents.includes(`(${doc})`), `AGENTS.md 未链接规则文档：${doc}`);
  }

  for (const phrase of ["Sites Worker", "D1", "R2", "ChatGPT"]) {
    assertRule(architecture.includes(phrase), `架构文档缺少技术决策：${phrase}`);
  }
  for (const phrase of ["已实现", "当前生产门禁", "暂缓"]) {
    assertRule(product.includes(phrase), `产品文档缺少能力状态：${phrase}`);
  }
  for (const command of ["npm ci", "npm run check", "npm run build:sites"]) {
    assertRule(testing.includes(command), `测试文档缺少命令：${command}`);
  }
  assertRule(
    agents.includes("viewport-owned application shell")
      && agents.includes("No route may create page-level horizontal overflow"),
    "AGENTS.md 缺少后台视口壳层与页面级溢出禁令",
  );
  assertRule(
    interaction.includes("唯一纵向工作区滚动容器")
      && interaction.includes("不得产生页面级横向溢出"),
    "UX 规则缺少后台唯一滚动容器与内容边界约束",
  );

  const ruleDocuments = requiredRuleFiles
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ file, content: read(file) }));
  const forbiddenProjectTerms = [
    "AI 软件代充管理软件",
    "ai软件代充管理软件",
    "Apple ID",
    "兑换码",
    "redeem code",
  ];

  for (const { file, content } of ruleDocuments) {
    for (const term of forbiddenProjectTerms) {
      assertRule(!content.toLowerCase().includes(term.toLowerCase()), `${file} 混入其他项目专属术语：${term}`);
    }

    const links = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu);
    for (const match of links) {
      const target = match[1].trim().replace(/^<|>$/gu, "").split(/[?#]/u)[0];
      if (!target || /^(?:https?:|mailto:)/u.test(target)) continue;
      const resolved = path.resolve(root, path.dirname(file), target);
      assertRule(existsSync(resolved), `${file} 包含无效本地链接：${match[1]}`);
    }
  }
}

const sourceFiles = [];
const walk = (target) => {
  if (!existsSync(target)) return;
  const stats = statSync(target);
  if (stats.isFile()) {
    if (/\.(?:js|jsx|mjs|ts|tsx)$/u.test(target)) sourceFiles.push(target);
    return;
  }
  for (const entry of readdirSync(target)) {
    if (["node_modules", "dist", ".git", ".next"].includes(entry)) continue;
    walk(path.join(target, entry));
  }
};

for (const entry of ["src", "scripts", "worker", "vite.config.mjs", "apps", "packages"]) {
  walk(path.join(root, entry));
}

if (existsSync(path.join(root, ".env.example"))) {
  const declaredEnv = new Set(
    read(".env.example")
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/u)?.[1])
      .filter(Boolean),
  );
  const usedEnv = new Set();
  const builtInViteEnv = new Set(["BASE_URL", "DEV", "MODE", "PROD", "SSR"]);
  const builtInNodeEnv = new Set(["CI", "NODE_ENV"]);

  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(/import\.meta\.env\.([A-Z][A-Z0-9_]*)/gu)) {
      if (!builtInViteEnv.has(match[1])) usedEnv.add(match[1]);
    }
    for (const match of content.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/gu)) {
      if (!builtInNodeEnv.has(match[1])) usedEnv.add(match[1]);
    }
  }

  for (const key of usedEnv) {
    assertRule(declaredEnv.has(key), `.env.example 缺少代码使用的环境变量：${key}`);
  }
}

if (errors.length > 0) {
  console.error("CloudBridge 规则检查失败：");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`CloudBridge 规则检查通过：${requiredRuleFiles.length} 个基线文件、${sourceFiles.length} 个源码文件。`);
}
