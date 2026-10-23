// Dependency manifests beyond package.json (spec 001).
// Parsers are pure (text → dependency names) and deliberately minimal: they read only the
// keys detection needs, with no third-party parsers (constitution, principle 3). Nothing here
// executes project code or touches the network (RF-13).

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Directories never descended into when scanning a project. */
export const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".output",
  "vendor",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".turbo",
  "coverage",
]);

// .NET build output; only skipped when looking for .csproj files.
const DOTNET_OUTPUT_DIRS = new Set(["bin", "obj"]);

function clean(text: string): string {
  return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

// ── Python ───────────────────────────────────────────────────

/** Normalizes a Python package name per PEP 503: lowercase, runs of `-_.` collapse to `-`. */
export function normalizePythonName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

// A PEP 508 requirement starts with its name; everything after (extras, versions, markers) is dropped.
function requirementName(spec: string): string | null {
  const m = spec.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
  return m ? normalizePythonName(m[1]!) : null;
}

// Drop a TOML `#` comment that is outside any string.
function stripTomlComment(line: string): string {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quote) {
      if (ch === "\\" && quote === '"') i++;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "#") return line.slice(0, i);
  }
  return line;
}

// Scan a TOML array literal. Returns its top-level strings (strings inside inline tables are
// skipped) and whether the closing bracket has been seen yet.
function scanArray(buf: string): { strings: string[]; closed: boolean } {
  const strings: string[] = [];
  let depth = 0;
  let braces = 0;
  for (let i = 0; i < buf.length; i++) {
    const ch = buf[i]!;
    if (ch === '"' || ch === "'") {
      let value = "";
      let j = i + 1;
      for (; j < buf.length && buf[j] !== ch; j++) {
        if (ch === '"' && buf[j] === "\\") j++;
        value += buf[j] ?? "";
      }
      if (braces === 0 && depth === 1) strings.push(value);
      i = j;
    } else if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return { strings, closed: true };
  }
  return { strings, closed: false };
}

const unquote = (key: string) => key.trim().replace(/^["']|["']$/g, "");

/** Dependency names from `pyproject.toml` (RF-1): PEP 621, PEP 735 dependency groups and Poetry. */
export function parsePyproject(text: string): string[] {
  const names: string[] = [];
  let table = "";
  let pending = ""; // multi-line array being accumulated

  const takeArray = (buf: string): boolean => {
    const { strings, closed } = scanArray(buf);
    if (closed) {
      for (const s of strings) {
        const name = requirementName(s);
        if (name) names.push(name);
      }
    }
    return closed;
  };

  for (const raw of clean(text).split("\n")) {
    const line = stripTomlComment(raw);

    if (pending) {
      pending += "\n" + line;
      if (takeArray(pending)) pending = "";
      continue;
    }

    const header = line.match(/^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*$/);
    if (header) {
      table = header[1]!.split(".").map(unquote).join(".");
      continue;
    }

    const kv = line.match(/^\s*("[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    if (!kv) continue;
    const key = unquote(kv[1]!);
    const value = kv[2]!;

    if (table === "tool.poetry.dependencies") {
      if (key.toLowerCase() !== "python") names.push(normalizePythonName(key));
      continue;
    }

    const isArrayKey =
      (table === "project" && key === "dependencies") ||
      table === "project.optional-dependencies" ||
      table === "dependency-groups";
    if (isArrayKey && value.trimStart().startsWith("[") && !takeArray(value)) pending = value;
  }

  return names;
}

/** Dependency names from a `requirements*.txt` file (RF-2). */
export function parseRequirements(text: string): string[] {
  const names: string[] = [];
  for (const raw of clean(text).split("\n")) {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    if (!line || line.startsWith("-") || /^[a-z+]+:\/\//i.test(line)) continue;
    const name = requirementName(line);
    if (name) names.push(name);
  }
  return names;
}

// ── JVM ──────────────────────────────────────────────────────

/** `groupId:artifactId` of each `<dependency>` and the `<parent>` in a `pom.xml` (RF-4). */
export function parsePom(text: string): string[] {
  const xml = clean(text).replace(/<!--[\s\S]*?-->/g, "");
  const names: string[] = [];
  for (const block of xml.matchAll(/<(dependency|parent)>([\s\S]*?)<\/\1>/g)) {
    const body = block[2]!.replace(/<exclusions>[\s\S]*?<\/exclusions>/g, "");
    const group = body.match(/<groupId>\s*([^<\s]+)\s*<\/groupId>/)?.[1];
    const artifact = body.match(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/)?.[1];
    if (group && artifact) names.push(`${group}:${artifact}`);
  }
  return names;
}

/** `group:name` coordinates and plugin ids from `build.gradle` / `build.gradle.kts` (RF-5). */
export function parseGradle(text: string): string[] {
  const src = clean(text)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const names: string[] = [];
  for (const m of src.matchAll(/["']([\w.-]+):([\w.-]+)(?::[^"'\s]*)?["']/g)) {
    names.push(`${m[1]}:${m[2]}`);
  }
  for (const m of src.matchAll(/\bid\s*\(?\s*["']([\w.-]+)["']/g)) names.push(m[1]!);
  return names;
}

// ── .NET / PHP / Ruby ────────────────────────────────────────

/** `Include` of each `<PackageReference>` in a `.csproj` (RF-6). */
export function parseCsproj(text: string): string[] {
  const names: string[] = [];
  for (const m of clean(text).matchAll(/<PackageReference\b[^>]*?\bInclude\s*=\s*"([^"]+)"/gi)) names.push(m[1]!);
  return names;
}

/** Keys of `require` and `require-dev` in `composer.json` (RF-7). Throws on malformed JSON. */
export function parseComposer(text: string): string[] {
  const json = JSON.parse(clean(text)) as Record<string, unknown>;
  const names: string[] = [];
  for (const key of ["require", "require-dev"]) {
    const block = json[key];
    if (block && typeof block === "object") names.push(...Object.keys(block));
  }
  return names;
}

/** Gem names declared with `gem '<name>'` in a `Gemfile` (RF-8). */
export function parseGemfile(text: string): string[] {
  return [...clean(text).matchAll(/^\s*gem\s+["']([^"']+)["']/gm)].map((m) => m[1]!);
}

// ── Reader ───────────────────────────────────────────────────

type Parser = (text: string) => string[];

const ROOT_MANIFESTS: [RegExp, Parser][] = [
  [/^pyproject\.toml$/, parsePyproject],
  [/^requirements.*\.txt$/i, parseRequirements],
  [/^pom\.xml$/, parsePom],
  [/^build\.gradle(\.kts)?$/, parseGradle],
  [/^composer\.json$/, parseComposer],
  [/^Gemfile$/, parseGemfile],
];

const skipDir = (name: string) => SKIP_DIRS.has(name) || DOTNET_OUTPUT_DIRS.has(name) || name.startsWith(".");

// `.csproj` files at the root and up to two levels below it (RF-6).
function findCsproj(dir: string, depth = 0): string[] {
  const found: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".csproj")) found.push(join(dir, entry.name));
    else if (entry.isDirectory() && depth < 2 && !skipDir(entry.name)) {
      found.push(...findCsproj(join(dir, entry.name), depth + 1));
    }
  }
  return found;
}

/**
 * Collects dependency names from every non-npm manifest in `projectDir`.
 * Never throws: an unreadable or malformed manifest is skipped and reported via `onTrace` (RF-12).
 */
export function readManifestDeps(projectDir: string, onTrace?: (msg: string) => void): Set<string> {
  const deps = new Set<string>();

  const apply = (path: string, parse: Parser) => {
    try {
      for (const name of parse(readFileSync(path, "utf-8"))) deps.add(name);
    } catch (err) {
      onTrace?.(`skipped ${relative(projectDir, path) || path}: ${(err as Error).message}`);
    }
  };

  let rootFiles: string[] = [];
  try {
    rootFiles = readdirSync(projectDir);
  } catch {
    return deps;
  }
  for (const file of rootFiles.sort()) {
    const match = ROOT_MANIFESTS.find(([re]) => re.test(file));
    if (match) apply(join(projectDir, file), match[1]);
  }
  for (const path of findCsproj(projectDir).sort()) apply(path, parseCsproj);

  return deps;
}
