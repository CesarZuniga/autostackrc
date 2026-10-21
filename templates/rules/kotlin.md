---
title: Kotlin
category: Language
scope: glob
globs: ["**/*.kt"]
---

- Prefer `val` and immutable collections; reach for `var`/mutable types only when needed.
- Embrace null safety: avoid `!!`; use `?.`, `?:`, and early returns instead.
- Use `data class` for value types and `sealed` hierarchies for closed sets of states.
- Use coroutines with structured concurrency; never use `GlobalScope`; inject dispatchers for testability.
- Keep extension functions discoverable and close to the type they extend.
- Format and lint with ktlint or detekt in CI.
