import { test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TECH_CATALOG } from "../catalog.ts";
import { detectStack, detectPresentAgents } from "../detector.ts";
import { readManifestDeps } from "../manifests.ts";
import { tmpProject, writeFile, writePkg } from "./helpers.ts";

test("detects packages from dependencies and devDependencies", () => {
  const dir = tmpProject();
  writePkg(dir, {
    dependencies: { react: "18", next: "15" },
    devDependencies: { typescript: "5", vitest: "2" },
  });
  const ids = detectStack(dir).techs.map((t) => t.id);
  ok(ids.includes("react"));
  ok(ids.includes("nextjs"));
  ok(ids.includes("typescript"));
  ok(ids.includes("vitest"));
});

test("detects tech from config files", () => {
  const dir = tmpProject();
  writePkg(dir, {});
  writeFile(dir, "go.mod", "module x\n");
  const ids = detectStack(dir).techs.map((t) => t.id);
  ok(ids.includes("go"));
});

test("detects tech from file extensions", () => {
  const dir = tmpProject();
  writeFile(dir, "src/main.rs", "fn main() {}\n");
  writeFile(dir, "Cargo.toml", "[package]\n");
  const ids = detectStack(dir).techs.map((t) => t.id);
  ok(ids.includes("rust"));
});

test("flags frontend and picks package manager", () => {
  const dir = tmpProject();
  writePkg(dir, { dependencies: { react: "18" } });
  writeFile(dir, "pnpm-lock.yaml", "");
  const stack = detectStack(dir);
  strictEqual(stack.frontend, true);
  strictEqual(stack.packageManager, "pnpm");
});

test("empty project detects nothing but node when package.json present", () => {
  const dir = tmpProject();
  writePkg(dir, {});
  const ids = detectStack(dir).techs.map((t) => t.id);
  ok(ids.includes("node"));
});

test("detectPresentAgents finds existing assistant files", () => {
  const dir = tmpProject();
  writeFile(dir, "CLAUDE.md", "# x");
  writeFile(dir, ".cursor/rules/x.mdc", "");
  const present = detectPresentAgents(dir);
  ok(present.includes("claude-code"));
  ok(present.includes("cursor"));
});

// ── Spec 001: multi-ecosystem detection ──────────────────────

test("RF-14 JS-only project detects exactly what v0.0.1 detected", () => {
  const dir = tmpProject();
  writePkg(dir, {
    dependencies: { react: "18", "react-dom": "18", next: "15", "@prisma/client": "5", zod: "3" },
    devDependencies: { typescript: "5", vitest: "2", eslint: "9", tailwindcss: "4", prisma: "5" },
  });
  writeFile(dir, "tsconfig.json", "{}");
  writeFile(dir, "next.config.ts", "");
  writeFile(dir, "src/app/page.tsx", "");
  writeFile(dir, "pnpm-lock.yaml", "");
  const stack = detectStack(dir);
  deepStrictEqual(
    stack.techs.map((t) => t.id),
    ["typescript", "node", "react", "nextjs", "tailwind", "prisma", "vitest", "zod", "eslint"],
  );
  strictEqual(stack.language, "TypeScript");
  strictEqual(stack.packageManager, "pnpm");
  strictEqual(stack.frontend, true);
});

test("RF-12 malformed manifest is skipped with a trace and detection continues", () => {
  const dir = tmpProject();
  writeFile(dir, "composer.json", "{ not json");
  writeFile(dir, "requirements.txt", "flask\n");
  const traces: string[] = [];
  const ids = detectStack(dir, { onTrace: (m) => traces.push(m) }).techs.map((t) => t.id);
  ok(ids.includes("flask"));
  ok(traces.some((t) => t.includes("composer.json")), `expected a trace for composer.json, got ${JSON.stringify(traces)}`);
});

test("RF-12 without onTrace a malformed manifest is silent and does not throw", () => {
  const dir = tmpProject();
  writeFile(dir, "pyproject.toml", "[project\ndependencies = [");
  ok(Array.isArray(detectStack(dir).techs));
});

test("RF-13 manifest reading never spawns processes or uses the network", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "manifests.ts"), "utf-8");
  for (const forbidden of ["node:child_process", "node:http", "node:https", "node:net", "fetch("]) {
    ok(!src.includes(forbidden), `manifests.ts must not use ${forbidden}`);
  }
});

test("RF-6 csproj up to two levels deep contributes dependencies; deeper ones do not", () => {
  const dir = tmpProject();
  writeFile(dir, "src/Api/Api.csproj", '<Project><ItemGroup><PackageReference Include="Swashbuckle.AspNetCore" /></ItemGroup></Project>');
  writeFile(dir, "a/b/c/Deep.csproj", '<Project><ItemGroup><PackageReference Include="Too.Deep" /></ItemGroup></Project>');
  const deps = readManifestDeps(dir);
  ok(deps.has("Swashbuckle.AspNetCore"));
  ok(!deps.has("Too.Deep"));
});

const idsOf = (dir: string) => detectStack(dir).techs.map((t) => t.id);

test("RF-9 FastAPI via pyproject, Flask via requirements", () => {
  const api = tmpProject();
  writeFile(api, "pyproject.toml", '[project]\ndependencies = ["FastAPI>=0.110"]\n');
  ok(idsOf(api).includes("fastapi"));

  const web = tmpProject();
  writeFile(web, "requirements.txt", "Flask==3.0\n");
  ok(idsOf(web).includes("flask"));
});

test("RF-9 Django by dependency alone and by manage.py alone", () => {
  const byDep = tmpProject();
  writeFile(byDep, "requirements.txt", "Django>=5\n");
  ok(idsOf(byDep).includes("django"));

  const byFile = tmpProject();
  writeFile(byFile, "manage.py", "");
  ok(idsOf(byFile).includes("django"));
});

test("RF-10 pom.xml without Spring is java, not spring", () => {
  const dir = tmpProject();
  writeFile(dir, "pom.xml", "<project><dependencies><dependency><groupId>org.apache.commons</groupId><artifactId>commons-lang3</artifactId></dependency></dependencies></project>");
  writeFile(dir, "src/main/java/App.java", "class App {}");
  const ids = idsOf(dir);
  ok(ids.includes("java"));
  ok(!ids.includes("spring"));
});

test("RF-10 Spring via Maven parent and via Gradle plugin", () => {
  const maven = tmpProject();
  writeFile(maven, "pom.xml", "<project><parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId></parent></project>");
  ok(idsOf(maven).includes("spring"));

  const gradle = tmpProject();
  writeFile(gradle, "build.gradle.kts", 'plugins { id("org.springframework.boot") version "3.3.0" }\n');
  ok(idsOf(gradle).includes("spring"));
});

test("RF-10 .kt files are kotlin, not spring; build.gradle.kts alone is not kotlin", () => {
  const kt = tmpProject();
  writeFile(kt, "src/Main.kt", "fun main() {}");
  const ids = idsOf(kt);
  ok(ids.includes("kotlin"));
  ok(!ids.includes("spring"));

  const kts = tmpProject();
  writeFile(kts, "build.gradle.kts", "plugins { java }\n");
  ok(!idsOf(kts).includes("kotlin"));
});

test("RF-11 composer.json without Laravel is php; laravel/framework or artisan is laravel", () => {
  const plain = tmpProject();
  writeFile(plain, "composer.json", JSON.stringify({ require: { "slim/slim": "^4" } }));
  writeFile(plain, "index.php", "<?php");
  const ids = idsOf(plain);
  ok(ids.includes("php"));
  ok(!ids.includes("laravel"));

  const byDep = tmpProject();
  writeFile(byDep, "composer.json", JSON.stringify({ require: { "laravel/framework": "^11" } }));
  ok(idsOf(byDep).includes("laravel"));

  const byArtisan = tmpProject();
  writeFile(byArtisan, "artisan", "#!/usr/bin/env php");
  ok(idsOf(byArtisan).includes("laravel"));
});

test("RF-15 Gemfile without rails is ruby; rails gem or config/application.rb is rails", () => {
  const plain = tmpProject();
  writeFile(plain, "Gemfile", "gem 'sinatra'\n");
  writeFile(plain, "app.rb", "");
  const ids = idsOf(plain);
  ok(ids.includes("ruby"));
  ok(!ids.includes("rails"));

  const byGem = tmpProject();
  writeFile(byGem, "Gemfile", "gem 'rails', '~> 7.1'\n");
  ok(idsOf(byGem).includes("rails"));

  const byConfig = tmpProject();
  writeFile(byConfig, "config/application.rb", "");
  ok(idsOf(byConfig).includes("rails"));
});

test("RF-16 java, kotlin, php and ruby get a base rule and no commands", () => {
  for (const id of ["java", "kotlin", "php", "ruby"]) {
    const tech = TECH_CATALOG.find((t) => t.id === id);
    ok(tech, `missing tech ${id}`);
    ok(tech.ruleSkeleton.trim().length > 0, `${id} has an empty rule`);
    ok(!tech.commands || tech.commands.length === 0, `${id} must not contribute commands`);
  }
});

test("mixed project merges dependencies from every ecosystem", () => {
  const dir = tmpProject();
  writePkg(dir, { dependencies: { react: "18" } });
  writeFile(dir, "pyproject.toml", '[project]\ndependencies = ["fastapi"]\n');
  const ids = idsOf(dir);
  ok(ids.includes("react"));
  ok(ids.includes("fastapi"));
});
