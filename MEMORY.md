# MEMORY.md — autostackrc

Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual

- v0.0.1 publicada: detección → IR → writers (Claude Code, Cursor, Copilot, opencode) con enriquecimiento opcional por CLI.
- Rama `feat/sdd-module`: constitución aprobada; ADR-0001/0002 aceptadas.
- **Spec 001 implementada** (T1–T10): `manifests.ts` con parsers puros + `readManifestDeps`; detección multi-ecosistema; `java`/`kotlin`/`php`/`ruby` separados de sus frameworks. 46 tests en verde.

## Decisiones (y por qué)

- SDD como módulo de este repo (ADR-0001) y siempre activo (ADR-0002) → la próxima versión es v0.1.0 (cambio incompatible).
- Specs/ADR/constitución en español; código y README en inglés.
- Un único `Set` de nombres de dependencias para todos los ecosistemas; solo se normalizan los nombres Python (PEP 503).
- `kotlin` solo por `.kt` (no `.kts`: `build.gradle.kts` aparece en proyectos Java puros).
- `SKIP_DIRS` vive en `manifests.ts` y lo importa `detector.ts`; `bin`/`obj` solo se saltan al buscar `.csproj`.

## Aprendizajes y errores a evitar

- Las tecnologías nuevas se añaden al final de `TECH_SEEDS`: el orden de salida está fijado por el test RF-14.
- Toda spec que cambie comportamiento visible incluye una tarea de README + `docs/index.html` (la lista `TECH` del sitio debe cuadrar con `TECH_CATALOG`). En la spec 001 se olvidó.
- `npx tsc` requiere `npm ci` antes (TypeScript es dev dependency).
- `fmt.ts#writeOwned` sobrescribe sin comprobar ediciones del usuario (spec 003 pendiente).
- `primaryLanguage()` devuelve `unknown` para Java/PHP/Ruby/C#: abordarlo en la spec 002 (perfil y comandos).

## Próximos pasos

1. Commit de la spec 001 y validación final (`/sdd-validate 001-multi-ecosystem-detection`).
2. Redactar spec 002 (perfil del proyecto: comandos test/lint/build y lenguaje principal).
3. Redactar spec 003 (escritura segura con hashes en el lockfile).
