#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "apps", "sites", "dist");
const target = path.join(root, "dist");

const requiredSourceFiles = [
  path.join(source, "server", "index.js"),
  path.join(source, ".openai", "hosting.json"),
  path.join(source, ".openai", "drizzle", "0003_chunky_tattoo.sql"),
  path.join(source, ".openai", "drizzle", "0004_sweet_adam_warlock.sql"),
  path.join(source, ".openai", "drizzle", "0005_concerned_war_machine.sql"),
  path.join(source, ".openai", "drizzle", "0006_nice_doctor_faustus.sql"),
];

for (const file of requiredSourceFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing complete Sites platform build input: ${file}`);
  }
}

const clientAssets = path.join(source, "client", "assets");
const hasAdminClient = readdirSync(clientAssets)
  .some((name) => /^sites-admin-client-.*\.js$/u.test(name));
if (!hasAdminClient) {
  throw new Error("The complete Sites platform build is missing its admin client");
}

rmSync(target, { force: true, recursive: true });
cpSync(source, target, { recursive: true });

console.log("Prepared complete Sites platform release in dist/");
