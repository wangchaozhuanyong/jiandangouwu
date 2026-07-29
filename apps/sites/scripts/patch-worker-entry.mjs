import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const serverDirectory = resolve(process.cwd(), "dist", "server");
const createRequireImport = 'import { createRequire } from "node:module";\n';
const createRequireInitializer =
  "var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();";
const workerRequireShim = [
  "var __require = (id) => {",
  '\tif (id === "node:async_hooks") return { AsyncLocalStorage: AsyncLocalStorage$1 };',
  '\tthrow new Error(`Unsupported dynamic module request: ${id}`);',
  "};",
].join("\n");
const unsupportedRequireShim = [
  "var __require = (id) => {",
  '\tif (id === "node:async_hooks") return { AsyncLocalStorage: SitesAsyncLocalStorage };',
  "\tthrow new Error(`Unsupported dynamic module request: ${id}`);",
  "};",
].join("\n");

const javascriptFiles = await collectJavaScriptFiles(serverDirectory);
let patchedFiles = 0;

for (const file of javascriptFiles) {
  const source = await readFile(file, "utf8");
  if (!source.includes(createRequireInitializer)) continue;
  if (!source.includes(createRequireImport)) {
    throw new Error(`The vinext module has an unreviewed createRequire shape: ${file}`);
  }
  const requireUseCount = source.match(/__require\(/gu)?.length ?? 0;
  let next = source.replace(createRequireImport, "");
  if (requireUseCount === 0) {
    next = `import { AsyncLocalStorage as SitesAsyncLocalStorage } from "node:async_hooks";\n${next}`
      .replace(createRequireInitializer, unsupportedRequireShim);
  } else if (
    requireUseCount === 1
    && source.includes('__require("node:async_hooks")')
    && source.includes("AsyncLocalStorage as AsyncLocalStorage$1")
  ) {
    next = next.replace(createRequireInitializer, workerRequireShim);
  } else {
    throw new Error(`The vinext module has an unsupported dynamic require: ${file}`);
  }
  await writeFile(file, next);
  patchedFiles += 1;
}

if (patchedFiles === 0) {
  throw new Error("The vinext build no longer contains the reviewed Sites compatibility issue.");
}

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJavaScriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}
