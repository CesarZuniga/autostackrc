# Spec 001 — Detección de dependencias en varios ecosistemas

Estado: implementada (2026-10-20)

## Contexto y objetivo

La detección solo conoce las dependencias declaradas en `package.json`. Por eso, en proyectos Python, Java, .NET, PHP o Ruby, las tecnologías que se identifican por dependencia nunca aparecen. Por ejemplo, un proyecto FastAPI con `pyproject.toml` se detecta solo como `python`. Además, hay falsos positivos: cualquier proyecto Java o Kotlin se marca como Spring, cualquier proyecto PHP como Laravel y cualquier proyecto Ruby como Rails. El kit SDD (ADR-0002) adapta la constitución, la skill y los comandos al stack, así que una detección incorrecta contamina todo lo que se genera. Esta spec hace que la detección por dependencias funcione en los ecosistemas principales y elimina esos falsos positivos.

## Usuarios

- Desarrolladores que ejecutan `npx autostackrc` en un proyecto que no es (o no es solo) JavaScript.

## Historias de usuario

- HU-1. Como desarrollador Python, quiero que se detecte mi framework (FastAPI, Django, Flask) a partir de mis dependencias declaradas, para recibir reglas y un kit SDD adecuados.
- HU-2. Como desarrollador Java, Kotlin, PHP o Ruby, quiero que solo se me asigne un framework si realmente lo uso, para no recibir reglas que no aplican.
- HU-3. Como usuario actual de proyectos JS/TS, quiero que la detección siga dando el mismo resultado que hoy.

## Definiciones

- **Manifiesto**: archivo donde el proyecto declara sus dependencias (`package.json`, `pyproject.toml`, `requirements*.txt`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `*.csproj`, `composer.json`, `Gemfile`).
- **Nombre de dependencia**: el identificador del paquete sin versión, extras ni marcadores. En Maven/Gradle, `groupId:artifactId`. Para plugins de Gradle, su id.

## Requisitos funcionales

- RF-1: CUANDO exista `pyproject.toml` en la raíz, EL SISTEMA considerará como dependencias los nombres listados en `[project].dependencies`, en cada grupo de `[project.optional-dependencies]` y de `[dependency-groups]`, y las claves de `[tool.poetry.dependencies]` (excepto `python`).
- RF-2: CUANDO existan archivos `requirements*.txt` en la raíz, EL SISTEMA considerará como dependencias los nombres de cada línea, ignorando comentarios, líneas vacías, opciones (líneas que empiezan por `-`), versiones, extras (`[...]`) y marcadores (`; ...`).
- RF-3: EL SISTEMA comparará los nombres de dependencias Python sin distinguir mayúsculas y tratando `-`, `_` y `.` como equivalentes.
- RF-4: CUANDO exista `pom.xml` en la raíz, EL SISTEMA considerará como dependencias los `groupId:artifactId` de los elementos `<dependency>` (incluidos los de `<dependencyManagement>`) y del `<parent>`.
- RF-5: CUANDO exista `build.gradle` o `build.gradle.kts` en la raíz, EL SISTEMA considerará como dependencias los `group:name` de las declaraciones en formato de coordenadas (`"group:name:version"`) y los ids de plugins (`id("...")`, `id '...'`, `id "..."`).
- RF-6: CUANDO existan archivos `*.csproj` en la raíz o hasta dos niveles de profundidad, EL SISTEMA considerará como dependencias los atributos `Include` de cada `<PackageReference>`.
- RF-7: CUANDO exista `composer.json`, EL SISTEMA considerará como dependencias las claves de `require` y `require-dev`.
- RF-8: CUANDO exista `Gemfile`, EL SISTEMA considerará como dependencias los nombres de cada línea `gem '<nombre>'` o `gem "<nombre>"`.
- RF-9: EL SISTEMA detectará FastAPI, Flask y Django por su dependencia (`fastapi`, `flask`, `django`) en cualquiera de los manifiestos Python (RF-1, RF-2). En el caso de Django, la detección por `manage.py` se mantiene.
- RF-10: EL SISTEMA detectará `spring` solo si existe una dependencia con grupo `org.springframework.boot` o el plugin `org.springframework.boot`. Los archivos `.java` o un `pom.xml` sin Spring detectarán `java`, y los archivos `.kt` detectarán `kotlin`.
- RF-11: EL SISTEMA detectará `laravel` solo si existe la dependencia `laravel/framework` o el archivo `artisan`. Un `composer.json` o archivos `.php` sin Laravel detectarán `php`.
- RF-12: SI un manifiesto no se puede leer o está mal formado, ENTONCES EL SISTEMA lo ignorará, seguirá con el resto de la detección y no abortará. Con `-v` mostrará una traza indicando el archivo ignorado; sin `-v` no mostrará nada.
- RF-13: EL SISTEMA detectará sin ejecutar código del proyecto (p. ej. `setup.py` o scripts de Gradle) y sin acceder a la red.
- RF-14: EL SISTEMA producirá, para cualquier proyecto cuyo único manifiesto sea `package.json` y que no contenga archivos `.java`, `.kt`, `.php` ni `.rb`, el mismo resultado de detección que la versión 0.0.1.
- RF-15: EL SISTEMA detectará `rails` solo si existe la gema `rails`, `config/application.rb` o `bin/rails`. Un `Gemfile` o archivos `.rb` sin Rails detectarán `ruby`.
- RF-16: EL SISTEMA generará para `java`, `kotlin`, `php` y `ruby` una regla base del lenguaje, sin comandos propios.

## Requisitos no funcionales

- Sin dependencias runtime nuevas (constitución, principio 3): los formatos TOML, XML y Gradle se leen con un parseo mínimo, limitado a las claves de esta spec.
- La detección sobre un proyecto de 10 000 archivos no debe tardar más de 1 s adicional respecto a la v0.0.1.
- Sin cambios en la salida de la CLI más allá de las tecnologías detectadas y la traza de RF-12 con `-v`.

## Casos límite

- `pyproject.toml` que solo contiene `[build-system]`: no aporta dependencias.
- Dependencias con extras y marcadores: `fastapi[all]>=0.110 ; python_version >= "3.10"` → `fastapi`.
- Entradas de `[dependency-groups]` que son tablas (`{ include-group = "test" }`): se ignoran.
- `requirements.txt` con `-r otro.txt` o `-e .`: se ignoran esas líneas.
- Strings TOML multilínea y comentarios dentro de los arrays de dependencias.
- `pom.xml` con `<exclusions>` dentro de una dependencia: solo cuenta la dependencia, no lo excluido.
- Varios `*.csproj` (solución con proyecto de tests): se unen sus dependencias.
- Manifiesto vacío, con BOM UTF-8 o con finales de línea CRLF.
- Proyecto mixto (p. ej. `package.json` + `pyproject.toml`): se unen las dependencias de ambos ecosistemas.
- Proyecto con `artisan` y sin `composer.json`: `laravel`.

## Fuera de alcance

- Monorepos y workspaces, incluidos `requirements/*.txt` en subcarpetas (salvo los `*.csproj` de RF-6): spec futura.
- Lockfiles (`poetry.lock`, `uv.lock`, `packages.lock.json`…) y dependencias transitivas.
- Catálogos de versiones de Gradle (`gradle/libs.versions.toml`).
- Grupos de Poetry (`[tool.poetry.group.*.dependencies]`), `setup.py`, `setup.cfg` y `Pipfile`.
- Detección de comandos de test/lint/build (spec 002).
- Comandos propios para `java`, `kotlin`, `php` y `ruby` (RF-16).

## Criterios de finalización

- Cada RF tiene al menos un test en `tests/` cuyo nombre empieza por `RF-n` y pasa con `npm test`.
- `npx tsc --noEmit` en verde.
- Los 19 tests existentes siguen en verde.
- Ejecución manual con `--dry-run --no-llm` sobre un fixture FastAPI y otro Java sin Spring: muestra `fastapi` y `java` respectivamente.

## Dudas abiertas

- (ninguna)
