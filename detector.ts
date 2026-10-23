import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { TECH_CATALOG } from "./catalog.ts";
import type { TechDef } from "./catalog.ts";
import { readManifestDeps, SKIP_DIRS } from "./manifests.ts";

export interface DetectedStack {
  techs: TechDef[];
  language: string;
  packageManager: string;
  frontend: boolean;
}

export interface DetectOptions {
  /** Receives diagnostic messages, e.g. manifests skipped because they are malformed (RF-12). */
  onTrace?: (msg: string) => void;
}

function readJson(path: string, onTrace?: (msg: string) => void): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    onTrace?.(`skipped ${basename(path)}: ${(err as Error).message}`);
    return null;
  }
}

function packageNames(pkg: Record<string, unknown> | null): Set<string> {
  const names = new Set<string>();
  if (!pkg) return names;
  for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
    const block = pkg[key] as Record<string, string> | undefined;
    if (block) for (const name of Object.keys(block)) names.add(name);
  }
  return names;
}

// Shallow-ish recursive extension scan with a depth cap.
function collectExtensions(dir: string, maxDepth = 4): Set<string> {
  const found = new Set<string>();

  function scan(current: string, depth: number): void {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isFile()) {
        const dot = entry.name.lastIndexOf(".");
        if (dot > 0) found.add(entry.name.slice(dot).toLowerCase());
      } else if (entry.isDirectory() && depth < maxDepth) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        scan(join(current, entry.name), depth + 1);
      }
    }
  }

  scan(dir, 0);
  return found;
}

function detectPackageManager(dir: string): string {
  if (existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock"))) return "bun";
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "package-lock.json"))) return "npm";
  if (existsSync(join(dir, "deno.json")) || existsSync(join(dir, "deno.jsonc"))) return "deno";
  if (existsSync(join(dir, "poetry.lock")) || existsSync(join(dir, "pyproject.toml"))) return "python";
  if (existsSync(join(dir, "go.mod"))) return "go";
  if (existsSync(join(dir, "Cargo.toml"))) return "cargo";
  return "unknown";
}

function primaryLanguage(exts: Set<string>): string {
  if (exts.has(".ts") || exts.has(".tsx")) return "TypeScript";
  if (exts.has(".js") || exts.has(".jsx") || exts.has(".mjs")) return "JavaScript";
  if (exts.has(".py")) return "Python";
  if (exts.has(".go")) return "Go";
  if (exts.has(".rs")) return "Rust";
  return "unknown";
}

const FRONTEND_IDS = new Set([
  "react",
  "nextjs",
  "vue",
  "svelte",
  "angular",
  "astro",
  "tailwind",
]);

export function detectStack(projectDir: string, opts: DetectOptions = {}): DetectedStack {
  const pkg = readJson(join(projectDir, "package.json"), opts.onTrace);
  const pkgNames = packageNames(pkg);
  for (const name of readManifestDeps(projectDir, opts.onTrace)) pkgNames.add(name);
  const exts = collectExtensions(projectDir);

  const techs: TechDef[] = [];

  for (const tech of TECH_CATALOG) {
    const d = tech.detect;
    let found = false;

    if (d.packages && d.packages.some((p) => pkgNames.has(p))) found = true;
    if (!found && d.packagePatterns) {
      found = d.packagePatterns.some((re) => [...pkgNames].some((n) => re.test(n)));
    }
    if (!found && d.configFiles) {
      found = d.configFiles.some((f) => existsSync(join(projectDir, f)));
    }
    if (!found && d.extensions) {
      found = d.extensions.some((e) => exts.has(e.toLowerCase()));
    }

    if (found) techs.push(tech);
  }

  const frontend = techs.some((t) => FRONTEND_IDS.has(t.id));

  return {
    techs,
    language: primaryLanguage(exts),
    packageManager: detectPackageManager(projectDir),
    frontend,
  };
}

// ── Assistant presence detection (for default target selection) ──

export function detectPresentAgents(projectDir: string): string[] {
  const present: string[] = [];
  if (existsSync(join(projectDir, "CLAUDE.md")) || existsSync(join(projectDir, ".claude")))
    present.push("claude-code");
  if (existsSync(join(projectDir, ".cursor"))) present.push("cursor");
  if (
    existsSync(join(projectDir, ".github", "copilot-instructions.md")) ||
    existsSync(join(projectDir, ".github", "prompts")) ||
    existsSync(join(projectDir, ".github", "instructions"))
  )
    present.push("copilot");
  if (existsSync(join(projectDir, "AGENTS.md")) || existsSync(join(projectDir, ".opencode")))
    present.push("opencode");
  return present;
}
