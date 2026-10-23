import { test } from "node:test";
import { deepStrictEqual } from "node:assert/strict";

import {
  normalizePythonName,
  parseComposer,
  parseCsproj,
  parseGemfile,
  parseGradle,
  parsePom,
  parsePyproject,
  parseRequirements,
} from "../manifests.ts";

const sorted = (xs: string[]) => [...xs].sort();

// ── Python ───────────────────────────────────────────────────

test("RF-1 pyproject: [project] dependencies, optional groups and dependency-groups", () => {
  const toml = [
    "[project]",
    'name = "api"',
    "dependencies = [",
    '  "fastapi[all]>=0.110 ; python_version >= \\"3.10\\"",  # web',
    "  'uvicorn',",
    "]",
    "",
    "[project.optional-dependencies]",
    'db = ["SQLAlchemy>=2", "alembic"]',
    "",
    "[dependency-groups]",
    'test = ["pytest>=8", "pytest-cov"]',
    'dev = [{ include-group = "test" }, "ruff"]',
  ].join("\n");
  deepStrictEqual(
    sorted(parsePyproject(toml)),
    ["alembic", "fastapi", "pytest", "pytest-cov", "ruff", "sqlalchemy", "uvicorn"],
  );
});

test("RF-1 pyproject: poetry dependencies skip python", () => {
  const toml = ["[tool.poetry.dependencies]", 'python = "^3.12"', 'Django = "^5.0"', 'django-ninja = { version = "1" }'].join("\n");
  deepStrictEqual(sorted(parsePyproject(toml)), ["django", "django-ninja"]);
});

test("RF-1 pyproject: only [build-system] yields nothing", () => {
  deepStrictEqual(parsePyproject('[build-system]\nrequires = ["hatchling"]\n'), []);
});

test("RF-1 pyproject: tolerates BOM and CRLF", () => {
  const toml = '﻿[project]\r\ndependencies = [\r\n  "flask",\r\n]\r\n';
  deepStrictEqual(parsePyproject(toml), ["flask"]);
});

test("RF-2 requirements: skips comments, options and strips specifiers", () => {
  const txt = [
    "# web",
    "",
    "-r base.txt",
    "-e .",
    "--index-url https://example.invalid/simple",
    "Flask==3.0.0  # pinned",
    "requests[socks]>=2 ; python_version > '3.8'",
    "gunicorn",
  ].join("\r\n");
  deepStrictEqual(sorted(parseRequirements(txt)), ["flask", "gunicorn", "requests"]);
});

test("RF-3 python names are normalized (case, - _ .)", () => {
  deepStrictEqual(normalizePythonName("Django_Rest.Framework"), "django-rest-framework");
  deepStrictEqual(parseRequirements("FastAPI\n"), ["fastapi"]);
});

// ── JVM ──────────────────────────────────────────────────────

test("RF-4 pom: dependencies, parent and dependencyManagement; exclusions ignored", () => {
  const xml = `<?xml version="1.0"?>
<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
  </parent>
  <!-- <dependency><groupId>commented</groupId><artifactId>out</artifactId></dependency> -->
  <dependencyManagement><dependencies>
    <dependency><groupId>com.acme</groupId><artifactId>bom</artifactId></dependency>
  </dependencies></dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.apache.commons</groupId>
      <artifactId>commons-lang3</artifactId>
      <exclusions><exclusion><groupId>x.y</groupId><artifactId>z</artifactId></exclusion></exclusions>
    </dependency>
  </dependencies>
</project>`;
  deepStrictEqual(
    sorted(parsePom(xml)),
    ["com.acme:bom", "org.apache.commons:commons-lang3", "org.springframework.boot:spring-boot-starter-parent"],
  );
});

test("RF-5 gradle (groovy): coordinates and plugin ids", () => {
  const gradle = [
    "plugins {",
    "  id 'org.springframework.boot' version '3.3.0'",
    '  id "java"',
    "}",
    "// implementation 'commented:out:1'",
    "dependencies {",
    "  implementation 'org.springframework.boot:spring-boot-starter-web'",
    '  testImplementation "org.junit.jupiter:junit-jupiter:5.10.0"',
    "}",
  ].join("\n");
  deepStrictEqual(
    sorted(parseGradle(gradle)),
    ["java", "org.junit.jupiter:junit-jupiter", "org.springframework.boot", "org.springframework.boot:spring-boot-starter-web"],
  );
});

test("RF-5 gradle (kotlin dsl): coordinates and plugin ids", () => {
  const kts = [
    "plugins {",
    '  id("org.springframework.boot") version "3.3.0"',
    '  kotlin("jvm") version "2.0.0"',
    "}",
    "/* block",
    '   implementation("hidden:dep:1") */',
    'dependencies { implementation("io.ktor:ktor-server-core:2.3.0") }',
  ].join("\n");
  deepStrictEqual(sorted(parseGradle(kts)), ["io.ktor:ktor-server-core", "org.springframework.boot"]);
});

// ── .NET / PHP / Ruby ────────────────────────────────────────

test("RF-6 csproj: PackageReference Include attributes", () => {
  const xml = `<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <packagereference include="xunit" version="2.9.0"></packagereference>
    <ProjectReference Include="..\\Core\\Core.csproj" />
  </ItemGroup>
</Project>`;
  deepStrictEqual(sorted(parseCsproj(xml)), ["Swashbuckle.AspNetCore", "xunit"]);
});

test("RF-7 composer: require and require-dev keys", () => {
  const json = JSON.stringify({ require: { php: ">=8.2", "laravel/framework": "^11" }, "require-dev": { "phpunit/phpunit": "^11" } });
  deepStrictEqual(sorted(parseComposer(json)), ["laravel/framework", "php", "phpunit/phpunit"]);
});

test("RF-7 composer: empty manifest yields nothing", () => {
  deepStrictEqual(parseComposer("{}"), []);
});

test("RF-8 gemfile: gem names with either quote style", () => {
  const gemfile = ["source 'https://rubygems.org'", "gem 'rails', '~> 7.1'", '  gem "puma"', "# gem 'commented'", "group :test do", "  gem 'rspec-rails'", "end"].join("\n");
  deepStrictEqual(sorted(parseGemfile(gemfile)), ["puma", "rails", "rspec-rails"]);
});
