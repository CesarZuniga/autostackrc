---
title: PHP
category: Language
scope: glob
globs: ["**/*.php"]
---

- Start files with `declare(strict_types=1);` and type every parameter, return, and property.
- Follow PSR-12 style and PSR-4 autoloading via Composer; never `require` classes manually.
- Use prepared statements (PDO) — never interpolate input into SQL.
- Escape output for its context (`htmlspecialchars` for HTML); validate input at the boundary.
- Prefer readonly properties, enums, and value objects over loose arrays.
- Run static analysis (PHPStan/Psalm) and PHPUnit in CI.
