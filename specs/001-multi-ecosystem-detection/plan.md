# Plan — Spec 001: Detección de dependencias en varios ecosistemas

Cumple: `docs/constitution.md` (principios 2, 3 y 5). Cubre RF-1 a RF-16.

## Archivos

| Archivo | Cambio | Responsabilidad | RF |
|---|---|---|---|
| `manifests.ts` | **nuevo** | Parsers puros (texto → nombres) y `readManifestDeps(dir, onTrace?)`, que localiza los manifiestos, aplica los parsers y tolera errores. Sin efectos más allá de leer archivos. | 1–8, 12, 13 |
| `detector.ts` | modificar | `packageNames()` pasa a unir `package.json` + `readManifestDeps()`. `detectStack(dir, opts?)` acepta `onTrace`. | 9–12, 14 |
| `catalog.ts` | modificar | Reglas de detección de `django`, `spring`, `laravel` y `rails`; nuevas semillas `java`, `kotlin`, `php` y `ruby` (sin `commands`). | 9–11, 15, 16 |
| `templates/rules/{java,kotlin,php,ruby}.md` | **nuevos** | Regla base del lenguaje (`scope: glob`). | 16 |
| `main.ts` | modificar | Pasa `onTrace` a `detectStack` cuando `-v`. | 12 |
| `tests/manifests.test.ts` | **nuevo** | Tests unitarios de los parsers. | 1–8, 13 |
| `tests/detector.test.ts` | ampliar | Tests de integración con proyectos temporales y la prueba *golden* de RF-14. | 9–12, 14–16 |
| `CHANGELOG.md` | **nuevo** | Keep a Changelog, sección *Unreleased*. | — |

## Interfaz de `manifests.ts`

```ts
/** Normaliza un nombre de paquete Python (PEP 503): minúsculas y [-_.]+ → "-". */
export function normalizePythonName(name: string): string;

export function parsePyproject(text: string): string[];   // RF-1 (+RF-3)
export function parseRequirements(text: string): string[]; // RF-2 (+RF-3)
export function parsePom(text: string): string[];          // RF-4  → "group:artifact"
export function parseGradle(text: string): string[];       // RF-5  → "group:name" | plugin id
export function parseCsproj(text: string): string[];       // RF-6
export function parseComposer(text: string): string[];     // RF-7
export function parseGemfile(text: string): string[];      // RF-8

/** Lee todos los manifiestos conocidos de `dir`. Nunca lanza (RF-12). */
export function readManifestDeps(dir: string, onTrace?: (msg: string) => void): Set<string>;
```

Todos los parsers reciben **texto**, no rutas, para que sean puros y fáciles de testear. Antes de parsear, se quita el BOM (`﻿`) y se aceptan `\r\n`.

## Algoritmos

**`parsePyproject`** (TOML mínimo, sin dependencias):
```
tabla_actual = ""
para cada línea (sin comentarios fuera de strings):
  si es cabecera [x] o [[x]] → tabla_actual = x
  si tabla_actual == "project" y clave == "dependencies"       → leer array de strings (puede ser multilínea: acumular hasta cerrar "]")
  si tabla_actual == "project.optional-dependencies"           → leer array de cada clave
  si tabla_actual == "dependency-groups"                        → leer array de cada clave; ignorar elementos {…}
  si tabla_actual == "tool.poetry.dependencies" y clave != "python" → añadir clave
para cada string: nombre = prefijo hasta el primer [ <>=!~;( o espacio → normalizePythonName
```

**`parseRequirements`**: por línea, `trim`; descartar las vacías y las que empiezan por `#` o `-`; cortar en ` #`; aplicar la misma extracción de nombre y normalizar.

**`parsePom`**: quitar `<!-- … -->`. Para cada bloque `<dependency>…</dependency>` y `<parent>…</parent>`, eliminar antes el sub-bloque `<exclusions>…</exclusions>` y extraer el primer `<groupId>` y `<artifactId>` → `g:a`.

**`parseGradle`**: quitar comentarios `//` y `/* */`. Coordenadas: strings `"g:n(:v)?"` o `'g:n(:v)?'` con `g` y `n` en `[\w.-]+` → `g:n`. Plugins: `\bid\s*\(?\s*["']([\w.-]+)["']` → id.

**`parseCsproj`**: atributos `Include="…"` de `<PackageReference` (sin distinguir mayúsculas en el nombre del elemento).

**`parseComposer`**: `JSON.parse` → claves de `require` y `require-dev`.

**`parseGemfile`**: `^\s*gem\s+["']([^"']+)["']` en modo multilínea.

**`readManifestDeps`**:
```
deps = Set()
para cada (archivo, parser) en MANIFESTS:            # pyproject, requirements*.txt, pom, gradle(.kts), composer, Gemfile
  si existe en la raíz → try { añadir parser(leer(archivo)) } catch (e) { onTrace?("skipped <archivo>: <e>") }
para cada *.csproj en la raíz, raíz/*, raíz/*/* (saltando SKIP_DIRS y carpetas ocultas): mismo try/catch
devolver deps
```

## Detección en el catálogo

El catálogo ya admite `packages`, `packagePatterns`, `configFiles` y `extensions` (cualquiera activa la tecnología). Basta con cambiar los datos:

| Tech | Antes | Después |
|---|---|---|
| `django` | `configFiles: [manage.py]` | `+ packages: [django]` |
| `fastapi`, `flask` | `packages` (solo `package.json`) | sin cambios: ahora llegan los nombres Python |
| `spring` | `pom.xml`, `build.gradle*`, `.java`, `.kt` | `packagePatterns: [/^org\.springframework\.boot(:|$)/]` (cubre dependencias y el id del plugin) |
| `java` | — | `configFiles: [pom.xml]`, `extensions: [.java]` |
| `kotlin` | — | `extensions: [.kt]` (no `.kts`, ver D4) |
| `laravel` | `artisan`, `composer.json`, `.php` | `packages: [laravel/framework]`, `configFiles: [artisan]` |
| `php` | — | `configFiles: [composer.json]`, `extensions: [.php]` |
| `rails` | `config/application.rb`, `bin/rails`, `.rb` | `packages: [rails]`, `configFiles: [config/application.rb, bin/rails]` |
| `ruby` | — | `configFiles: [Gemfile]`, `extensions: [.rb]` |

Las semillas nuevas se añaden **al final** de `TECH_SEEDS` para no alterar el orden de salida en proyectos JS (RF-14).

## Decisiones

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| D1 | Un único `Set` de nombres para todos los ecosistemas | Un set por ecosistema y `detect.packages` tipado por ecosistema | KISS: el catálogo no cambia de forma; colisiones de nombres entre npm y PyPI irrelevantes para las tecnologías del catálogo. |
| D2 | Parseo mínimo con regex/escáner propio | `smol-toml`, `fast-xml-parser` | Constitución, principio 3 (cero dependencias runtime). |
| D3 | Parsers puros sobre texto + un único lector con `try/catch` | Cada parser lee su archivo | Testabilidad y un solo punto que cumple RF-12. |
| D4 | `kotlin` solo por `.kt`, no por `.kts` | Incluir `.kts` | `build.gradle.kts` aparece en proyectos Java puros; detectaría Kotlin de forma errónea. |
| D5 | Normalizar solo los nombres Python (RF-3) | Normalizar todo | npm y Composer distinguen `/` y mayúsculas; normalizarlos podría crear falsos positivos. |

## Estrategia de tests (`node --test`)

- **Unitarios** (`tests/manifests.test.ts`): un `test("RF-n …")` por parser y caso límite de la spec (BOM, CRLF, extras/marcadores, `include-group`, `<exclusions>`, comentarios, manifiesto vacío).
- **Integración** (`tests/detector.test.ts`): proyectos temporales con `tmpProject()`/`writeFile()` existentes:
  - FastAPI vía `pyproject` y vía `requirements`; Django solo por dependencia; Java sin Spring; Spring vía `<parent>` y vía plugin de Gradle; Kotlin; PHP vs Laravel (incluido `artisan` sin `composer.json`); Ruby vs Rails; proyecto mixto; `*.csproj` a 2 niveles; manifiesto corrupto con traza.
- **RF-13**: test estructural que verifica que `manifests.ts` no importa `node:child_process`, `node:http(s)`, `node:net` ni usa `fetch`.
- **RF-14 (*golden*)**: antes de tocar código, fijar los ids detectados en un proyecto JS representativo (React + Next + Vitest + ESLint + Tailwind + Prisma) y comprobar que no cambian.
- **NFR rendimiento**: medición manual (no test) con un árbol sintético de 10 000 archivos, antes y después.
