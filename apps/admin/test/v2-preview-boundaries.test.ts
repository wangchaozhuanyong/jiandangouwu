import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const adminRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const previewRoot = join(adminRoot, "src", "preview-v2");
const appFile = join(adminRoot, "src", "App.tsx");
const previewFixtureFile = join(previewRoot, "preview-fixtures.ts");
const bannersPreviewFile = join(previewRoot, "banners-preview.tsx");
const settingsPreviewFile = join(previewRoot, "settings-preview.tsx");

type SourceFile = {
  path: string;
  source: string;
};

const listSourceFiles = (directory: string): SourceFile[] => {
  assert.equal(
    existsSync(directory),
    true,
    `missing agreed admin preview directory: ${relative(adminRoot, directory)}`,
  );

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    if (!/\.(?:ts|tsx|js|jsx)$/u.test(entry.name)) return [];
    return [{ path, source: readFileSync(path, "utf8") }];
  });
};

const combinedSource = (files: SourceFile[]) => files
  .map((file) => `// ${relative(adminRoot, file.path)}\n${file.source}`)
  .join("\n");

test("admin V2 preview is lazy-loaded only in development and production takes a 404 path", () => {
  const app = readFileSync(appFile, "utf8");
  const preview = combinedSource(listSourceFiles(previewRoot));
  const sessionGateIndex = app.indexOf("if (!user)");
  const previewGateIndex = app.indexOf("if (previewV2Route.requested)", sessionGateIndex);

  assert.ok(sessionGateIndex >= 0, "admin app must retain its real session gate");
  assert.ok(previewGateIndex > sessionGateIndex, "admin preview must remain behind the real session gate");
  assert.match(
    app,
    /const isPreviewV2Development[\s\S]*?import\.meta\.env\?\.DEV/u,
  );
  assert.match(
    app,
    /const PreviewV2App\s*=\s*import\.meta\.env\?\.DEV\s*\?\s*lazy\(\(\)\s*=>\s*import\("\.\/preview-v2\/preview-v2-app"\)\)\s*:\s*null/u,
  );
  assert.match(app, /matchPreviewV2Route/u);
  assert.match(
    app,
    /if \(!canLoadPreviewV2\(isPreviewV2Development\(\), previewV2Route\) \|\| !PreviewV2App\)\s*\{\s*return <PreviewV2Unavailable/u,
  );
  assert.match(`${app}\n${preview}`, /\b404\b|not found|notFound/iu);
  assert.match(preview, /PREVIEW_V2_PREFIX/u);
  assert.match(preview, /PREVIEW_V2_PAGE_IDS/u);
});

test("admin V2 preview source is static and cannot call APIs or browser persistence", () => {
  const source = combinedSource(listSourceFiles(previewRoot));
  const forbidden = [
    ["fetch", /\bfetch\s*\(/u],
    ["XMLHttpRequest", /\bXMLHttpRequest\b/u],
    ["WebSocket", /\bWebSocket\b/u],
    ["sendBeacon", /\bsendBeacon\s*\(/u],
    ["EventSource", /\bEventSource\b/u],
    ["/v1 API path", /["'`]\/v1(?:\/|["'`])/u],
    ["localStorage", /\blocalStorage\b/u],
    ["sessionStorage", /\bsessionStorage\b/u],
    ["IndexedDB", /\bindexedDB\b/u],
    ["document.cookie", /\bdocument\.cookie\b/u],
    ["Cookie Store", /\bcookieStore\b/u],
    ["Cache Storage", /\bcaches\.open\s*\(/u],
    ["Storage Manager", /\bnavigator\.storage\b/u],
  ] as const;

  for (const [label, pattern] of forbidden) {
    assert.doesNotMatch(source, pattern, `admin preview must not use ${label}`);
  }
});

test("admin advertising placements and setting keys use only the same three surfaces", () => {
  const fixtures = readFileSync(previewFixtureFile, "utf8");
  const banners = readFileSync(bannersPreviewFile, "utf8");
  const settings = readFileSync(settingsPreviewFile, "utf8");
  const approved = ["HOME", "TRANSIT_SUBSCRIPTIONS", "AI_RECHARGE"];
  const unique = (values: string[]) => [...new Set(values)];
  const stringValues = (source: string) => [...source.matchAll(/["'`]([A-Z_]+)["'`]/gu)]
    .map((match) => match[1] ?? "");
  const arrayBody = (source: string, name: string) => {
    const body = new RegExp(`const ${name}[^=]*= \\[([\\s\\S]*?)\\n\\];`, "u")
      .exec(source)?.[1];
    assert.ok(body, `missing ${name} declaration`);
    return body;
  };

  const placementType = /export type ProductPlacementId\s*=([\s\S]*?);/u.exec(fixtures)?.[1];
  const settingsKeys = /export const previewSettings[\s\S]*?advertising:\s*\{([\s\S]*?)\},\s*transitEnabled/u
    .exec(fixtures)?.[1];
  assert.ok(placementType, "missing ProductPlacementId declaration");
  assert.ok(settingsKeys, "missing previewSettings advertising keys");

  const surfaces = [
    ["placement type", unique(stringValues(placementType))],
    ["banner fixtures", unique([...fixtures.matchAll(/\bplacement\s*:\s*["'`]([A-Z_]+)["'`]/gu)]
      .map((match) => match[1] ?? ""))],
    ["banner tabs", unique([...arrayBody(banners, "placements").matchAll(/\bid\s*:\s*["'`]([A-Z_]+)["'`]/gu)]
      .map((match) => match[1] ?? ""))],
    ["settings fixture", unique([...settingsKeys.matchAll(/\b([A-Z_]+)\s*:/gu)]
      .map((match) => match[1] ?? ""))],
    ["settings switches", unique([...arrayBody(settings, "advertisingSwitches").matchAll(/\bid\s*:\s*["'`]([A-Z_]+)["'`]/gu)]
      .map((match) => match[1] ?? ""))],
  ] as const;

  for (const [label, values] of surfaces) {
    assert.deepEqual(values, approved, `${label} must use the approved advertising surfaces`);
  }
  assert.doesNotMatch(fixtures, /\bplacement\s*:\s*["'`](?:PRODUCT|SKILL)["'`]/u);
});

test("admin preview uses DEMO fixtures and a persistent bilingual truth banner", () => {
  const files = listSourceFiles(previewRoot);
  const source = combinedSource(files);
  const fixtureFiles = files.filter((file) => /(?:fixture|data)/iu.test(file.path));
  const fixtureSource = combinedSource(fixtureFiles);
  const entityArrays = ["previewProducts", "previewPrimaryCategories", "previewSecondaryCategories", "previewBanners", "previewSkillCategories", "previewSkills"];
  const ids = entityArrays.flatMap((name) => {
    const body = new RegExp(`export const ${name}[^=]*= \\[([\\s\\S]*?)\\n\\];`, "u")
      .exec(fixtureSource)?.[1] ?? "";
    return [...body.matchAll(/\bid\s*:\s*["'`]([^"'`]+)["'`]/gu)]
      .map((match) => match[1] ?? "");
  });
  const skillUrls = [...fixtureSource.matchAll(/\bsourceUrl\s*:\s*["'`]([^"'`]+)["'`]/gu)]
    .map((match) => match[1] ?? "");

  assert.ok(fixtureFiles.length > 0, "admin preview must keep mock data in an explicit fixture file");
  assert.ok(ids.length > 0, "admin preview fixtures must declare stable IDs");
  assert.equal(
    ids.every((id) => id.startsWith("DEMO-")),
    true,
    `fixture IDs must start with DEMO-: ${ids.filter((id) => !id.startsWith("DEMO-")).join(", ")}`,
  );
  assert.match(source, /preview-v2-truth-banner/u);
  assert.match(source, /界面设计预览/u);
  assert.match(source, /Interface design preview/u);
  assert.ok(skillUrls.length > 0, "admin Skill fixtures must include a verified source URL");
  assert.equal(
    skillUrls.every((url) => /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\/[^\s]*)?$/u.test(url)),
    true,
    `admin Skill links must be HTTPS GitHub URLs: ${skillUrls.join(", ")}`,
  );
});

test("admin preview covers the five approved pages plus permission and conflict states", () => {
  const source = combinedSource(listSourceFiles(previewRoot));
  const model = readFileSync(join(previewRoot, "preview-model.ts"), "utf8");

  for (const pageId of ["products", "categories", "banners", "skills", "settings"]) {
    assert.match(model, new RegExp(`["']${pageId}["']`, "u"));
  }
  assert.match(source, /["']forbidden["']/u);
  assert.match(source, /无权限状态预览|Forbidden state preview/u);
  assert.match(source, /["']conflict["']/u);
  assert.match(source, /版本冲突|version-conflict/iu);
});

test("admin category preview enforces two levels and product cascading in memory", () => {
  const source = combinedSource(listSourceFiles(previewRoot));
  const fixtures = readFileSync(previewFixtureFile, "utf8");

  assert.match(source, /preview-v2-category-layout/u);
  assert.match(source, /preview-v2-category-mobile-tree/u);
  assert.match(source, /"PRIMARY" \| "SECONDARY"/u);
  assert.match(source, /二级分类必须选择一个一级分类/u);
  assert.match(source, /不支持三级分类|does not provide a third level/u);
  assert.match(source, /商品分类（最终归属二级分类）/u);
  assert.match(source, /updatePrimaryCategory[\s\S]*?secondaryCategoryId/u);
  assert.match(source, /界面校验完成，未保存服务器数据/u);
  assert.match(fixtures, /primaryCategoryId/u);
  assert.match(fixtures, /secondaryCategoryId/u);
});
