// Static half of the hybrid engine: detection + wiring.
// Rule content lives in templates/rules/<id>.md, commands in templates/commands/<id>.md;
// both are loaded at runtime. This file only maps how to detect each tech and which
// command ids it contributes. The LLM pass (generator.ts) enriches the loaded skeletons;
// with --no-llm they are emitted as-is.

import { loadCommands, loadRules } from "./templates.ts";
export type { CommandDef } from "./templates.ts";

export interface DetectRule {
  packages?: string[];
  packagePatterns?: RegExp[];
  configFiles?: string[];
  extensions?: string[];
}

export interface TechDef {
  id: string;
  name: string;
  category: string;
  detect: DetectRule;
  scope: "always" | "glob";
  globs?: string[];
  ruleSkeleton: string;
  commands?: string[];
}

// ── Commands ──────────────────────────────────────────────────
// Loaded from templates/commands/*.md. Each file: frontmatter + prompt body.
// GENERIC_COMMANDS = those marked `generic: true`, ordered by their `order` key.

const loadedCommands = loadCommands();
export const COMMAND_CATALOG = loadedCommands.catalog;
export const GENERIC_COMMANDS = loadedCommands.generic;

// ── Technologies ──────────────────────────────────────────────
// Detection + command wiring only. Rule content lives in templates/rules/<id>.md.

interface TechSeed {
  id: string;
  detect: DetectRule;
  commands?: string[];
}

const TECH_SEEDS: TechSeed[] = [
  { id: "typescript", detect: {"packages":["typescript"],"configFiles":["tsconfig.json"],"extensions":[".ts",".tsx"]} },
  { id: "node", detect: {"configFiles":["package.json"]}, commands: ["deps"] },
  { id: "react", detect: {"packages":["react","react-dom"]}, commands: ["component","hook","feature"] },
  { id: "nextjs", detect: {"packages":["next"],"configFiles":["next.config.js","next.config.mjs","next.config.ts"]}, commands: ["route","feature"] },
  { id: "vue", detect: {"packages":["vue"],"extensions":[".vue"]}, commands: ["component","feature"] },
  { id: "svelte", detect: {"packages":["svelte","@sveltejs/kit"],"configFiles":["svelte.config.js"],"extensions":[".svelte"]}, commands: ["component"] },
  { id: "angular", detect: {"packages":["@angular/core"],"configFiles":["angular.json"]}, commands: ["component","feature"] },
  { id: "astro", detect: {"packages":["astro"],"configFiles":["astro.config.mjs","astro.config.ts"]} },
  { id: "tailwind", detect: {"packages":["tailwindcss","@tailwindcss/vite"],"configFiles":["tailwind.config.js","tailwind.config.ts"]} },
  { id: "express", detect: {"packages":["express"]}, commands: ["endpoint","optimize"] },
  { id: "hono", detect: {"packages":["hono"]}, commands: ["endpoint","optimize"] },
  { id: "nestjs", detect: {"packages":["@nestjs/core"]}, commands: ["endpoint","optimize"] },
  { id: "python", detect: {"configFiles":["pyproject.toml","requirements.txt","setup.py","Pipfile"],"extensions":[".py"]} },
  { id: "fastapi", detect: {"packages":["fastapi"]}, commands: ["endpoint","optimize"] },
  { id: "django", detect: {"packages":["django"],"configFiles":["manage.py"]}, commands: ["migration","optimize"] },
  { id: "flask", detect: {"packages":["flask"]}, commands: ["endpoint"] },
  { id: "go", detect: {"configFiles":["go.mod"],"extensions":[".go"]} },
  { id: "rust", detect: {"configFiles":["Cargo.toml"],"extensions":[".rs"]} },
  { id: "prisma", detect: {"packages":["prisma","@prisma/client"],"configFiles":["prisma/schema.prisma"]}, commands: ["migration","optimize"] },
  { id: "drizzle", detect: {"packages":["drizzle-orm"],"configFiles":["drizzle.config.ts"]}, commands: ["migration","optimize"] },
  { id: "vitest", detect: {"packages":["vitest"],"configFiles":["vitest.config.ts","vitest.config.js"]}, commands: ["tdd"] },
  { id: "jest", detect: {"packages":["jest"],"configFiles":["jest.config.js","jest.config.ts"]}, commands: ["tdd"] },
  { id: "playwright", detect: {"packages":["@playwright/test"],"configFiles":["playwright.config.ts"]} },
  { id: "docker", detect: {"configFiles":["Dockerfile","docker-compose.yml","compose.yaml"]} },
  { id: "bun", detect: {"configFiles":["bun.lockb","bun.lock","bunfig.toml"]}, commands: ["deps"] },
  { id: "deno", detect: {"configFiles":["deno.json","deno.jsonc"]}, commands: ["deps"] },
  { id: "remix", detect: {"packages":["@remix-run/react","@remix-run/node"]}, commands: ["route"] },
  { id: "solid", detect: {"packages":["solid-js"]}, commands: ["component"] },
  { id: "expo", detect: {"packages":["expo","react-native"],"configFiles":["app.json","app.config.ts"]}, commands: ["component"] },
  { id: "electron", detect: {"packages":["electron"]} },
  { id: "tauri", detect: {"packages":["@tauri-apps/api"],"configFiles":["src-tauri/tauri.conf.json"]} },
  { id: "zod", detect: {"packages":["zod"]}, commands: ["schema"] },
  { id: "trpc", detect: {"packages":["@trpc/server","@trpc/client"]}, commands: ["endpoint"] },
  { id: "graphql", detect: {"packages":["graphql"],"extensions":[".graphql",".gql"]}, commands: ["optimize"] },
  { id: "supabase", detect: {"packages":["@supabase/supabase-js"],"configFiles":["supabase/config.toml"]} },
  { id: "mongoose", detect: {"packages":["mongoose"]}, commands: ["schema","optimize"] },
  { id: "vite", detect: {"packages":["vite"],"configFiles":["vite.config.ts","vite.config.js"]} },
  { id: "turborepo", detect: {"packages":["turbo"],"configFiles":["turbo.json"]} },
  { id: "eslint", detect: {"packages":["eslint"],"configFiles":["eslint.config.js","eslint.config.mjs",".eslintrc.json",".eslintrc.cjs"]} },
  { id: "spring", detect: {"packagePatterns":[/^org\.springframework\.boot(:|$)/]}, commands: ["endpoint"] },
  { id: "laravel", detect: {"packages":["laravel/framework"],"configFiles":["artisan"]}, commands: ["migration"] },
  { id: "rails", detect: {"packages":["rails"],"configFiles":["config/application.rb","bin/rails"]}, commands: ["migration"] },
  { id: "dotnet", detect: {"extensions":[".csproj",".cs",".sln"]}, commands: ["endpoint"] },
  { id: "terraform", detect: {"extensions":[".tf"]} },
  // Base languages (spec 001, RF-10/11/15/16): a rule only, no commands. Appended last so the
  // detection order for JS projects is unchanged (RF-14).
  { id: "java", detect: {"configFiles":["pom.xml"],"extensions":[".java"]} },
  { id: "kotlin", detect: {"extensions":[".kt"]} },
  { id: "php", detect: {"configFiles":["composer.json"],"extensions":[".php"]} },
  { id: "ruby", detect: {"configFiles":["Gemfile"],"extensions":[".rb"]} },
];

const ruleTemplates = loadRules();

export const TECH_CATALOG: TechDef[] = TECH_SEEDS.map((seed) => {
  const rule = ruleTemplates[seed.id];
  if (!rule) throw new Error(`autostackrc: missing rule template templates/rules/${seed.id}.md`);
  return {
    id: seed.id,
    name: rule.title,
    category: rule.category,
    detect: seed.detect,
    scope: rule.scope,
    globs: rule.globs,
    ruleSkeleton: rule.body,
    commands: seed.commands,
  };
});
