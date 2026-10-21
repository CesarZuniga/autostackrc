# Tareas — Spec 001: Detección de dependencias en varios ecosistemas

Orden de dependencia. Una tarea cada vez: tests primero (en rojo), después el código, `npm test` y `npx tsc --noEmit` en verde, marcar la tarea y parar.

- [x] **T1. Prueba *golden* de regresión JS.** RF-14
  - Hecho cuando: `tests/detector.test.ts` tiene `RF-14 …` con los ids del proyecto JS representativo fijados, y pasa **sobre el código actual**, antes de cualquier cambio.

- [x] **T2. `manifests.ts`: Python.** RF-1, RF-2, RF-3
  - `normalizePythonName`, `parsePyproject` (incluye `[dependency-groups]` y Poetry) y `parseRequirements`.
  - Hecho cuando: los tests `RF-1/2/3` de `tests/manifests.test.ts` cubren extras, marcadores, multilínea, `include-group`, solo `[build-system]`, BOM y CRLF, y están en verde.

- [x] **T3. `manifests.ts`: JVM.** RF-4, RF-5
  - `parsePom` (con `<parent>`, `<dependencyManagement>`, `<exclusions>` y comentarios) y `parseGradle` (coordenadas + ids de plugins, Groovy y Kotlin DSL).
  - Hecho cuando: los tests `RF-4/5` están en verde.

- [x] **T4. `manifests.ts`: .NET, PHP y Ruby.** RF-6, RF-7, RF-8
  - `parseCsproj`, `parseComposer` y `parseGemfile`.
  - Hecho cuando: los tests `RF-6/7/8` están en verde.

- [x] **T5. `readManifestDeps` + integración en `detector.ts`.** RF-6, RF-12, RF-13
  - Lector tolerante a errores con `onTrace`, búsqueda de `*.csproj` a 2 niveles y `detectStack(dir, { onTrace })`.
  - Hecho cuando: los tests `RF-12` (manifiesto corrupto no aborta y emite traza) y `RF-13` (test estructural) están en verde, y `RF-14` sigue en verde.

- [x] **T6. Frameworks Python por dependencia.** RF-9
  - `django` con `packages: ["django"]` en `catalog.ts`.
  - Hecho cuando: los tests de integración `RF-9` detectan FastAPI (`pyproject`), Flask (`requirements`) y Django (solo por dependencia y solo por `manage.py`).

- [x] **T7. Separar Java/Kotlin de Spring.** RF-10, RF-16
  - Semillas `java` y `kotlin` + `templates/rules/{java,kotlin}.md`; `spring` con `packagePatterns`.
  - Hecho cuando: los tests `RF-10` dan `java` sin `spring` para un `pom.xml` sin Spring, `spring` vía `<parent>` y vía plugin de Gradle, y `kotlin` para `.kt`. El test `RF-16` verifica que no tienen comandos.

- [x] **T8. Separar PHP de Laravel y Ruby de Rails.** RF-11, RF-15, RF-16
  - Semillas `php` y `ruby` + `templates/rules/{php,ruby}.md`; nuevas reglas de detección de `laravel` y `rails`.
  - Hecho cuando: los tests `RF-11` y `RF-15` cubren con/sin framework y `artisan` sin `composer.json`, y están en verde.

- [x] **T9. Traza con `-v` y verificación manual.** RF-12, NFR
  - `main.ts` pasa `onTrace` cuando `-v`.
  - Hecho cuando: `node index.mjs --dry-run --no-llm -v` sobre un fixture con `pom.xml` corrupto muestra la traza; sobre los fixtures FastAPI y Java sin Spring muestra `fastapi` y `java`; y la medición con 10 000 archivos añade ≤ 1 s respecto a `main`.

- [x] **T10. Cierre.** —
  - Crear `CHANGELOG.md` (Keep a Changelog, *Unreleased* → *Added*/*Fixed*) y actualizar `MEMORY.md`.
  - Hecho cuando: los criterios de finalización de `spec.md` están cumplidos y `/sdd-validate 001-multi-ecosystem-detection` da VEREDICTO: APROBADO.

- [x] **T11. Documentación pública (añadida tras el cierre).** —
  - README (*How it works*, `-v`) y `docs/index.html` (paso DETECT, tabla de opciones y lista de tecnologías).
  - Hecho cuando: la lista del sitio tiene el mismo número de tecnologías que `TECH_CATALOG` (48).
