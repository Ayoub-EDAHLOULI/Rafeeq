#!/usr/bin/env node
// Fails if a known network-capable Tauri plugin appears in either
// dependency manifest. Run manually or wire into CI before Rafeeq ships
// anything that could quietly reintroduce a network path.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const NETWORK_CAPABLE_PLUGINS = [
  "tauri-plugin-http",
  "@tauri-apps/plugin-http",
  "tauri-plugin-updater",
  "@tauri-apps/plugin-updater",
  "tauri-plugin-shell",
  "@tauri-apps/plugin-shell",
  "tauri-plugin-websocket",
  "@tauri-apps/plugin-websocket",
];

function readDeps(file, extractor) {
  const text = readFileSync(file, "utf8");
  return extractor(text);
}

function fromPackageJson(text) {
  const pkg = JSON.parse(text);
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
}

function fromCargoToml(text) {
  const names = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
    if (match) names.push(match[1]);
  }
  return names;
}

const found = [];

for (const name of readDeps(
  path.join(root, "package.json"),
  fromPackageJson,
)) {
  if (NETWORK_CAPABLE_PLUGINS.includes(name)) found.push(`package.json: ${name}`);
}

for (const name of readDeps(
  path.join(root, "src-tauri", "Cargo.toml"),
  fromCargoToml,
)) {
  if (NETWORK_CAPABLE_PLUGINS.includes(name)) found.push(`Cargo.toml: ${name}`);
}

if (found.length > 0) {
  console.error("Network-capable dependency detected:");
  for (const entry of found) console.error(`  - ${entry}`);
  console.error(
    "\nIf this is intentional, update src-tauri/src/offline_audit.rs's " +
      "NETWORK_CAPABLE_PLUGINS list and this script's allowlist together.",
  );
  process.exit(1);
}

console.log("No known network-capable dependencies found.");
