---
title: Java
category: Language
scope: glob
globs: ["**/*.java"]
---

- Target a current LTS JDK and pin it in the build (`maven.compiler.release` / Gradle toolchains).
- Prefer immutability: `final` fields, `record` for data carriers, unmodifiable collections.
- Use `Optional` for absent return values, never for fields or parameters; never return `null` collections.
- Handle checked exceptions deliberately; never swallow them — log with context or rethrow wrapped.
- Use try-with-resources for anything `AutoCloseable`.
- Keep packages cohesive; depend on interfaces at module boundaries.
- Test with JUnit 5 + AssertJ; keep tests independent of execution order.
