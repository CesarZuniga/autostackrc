# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Dependency detection beyond `package.json`: `pyproject.toml` (PEP 621, PEP 735 dependency groups, Poetry), `requirements*.txt`, `pom.xml`, `build.gradle(.kts)`, `*.csproj` (up to two levels deep), `composer.json` and `Gemfile`.
- Base language rules for Java, Kotlin, PHP and Ruby.
- `-v` now reports manifests skipped because they are unreadable or malformed.
- SDD groundwork: project constitution, ADR-0001/0002 and spec 001.

### Changed

- README and docs site describe manifest-based detection and list 48 technologies.
- README and docs site announce the upcoming Spec-Driven Development module (marked as in progress).

### Fixed

- FastAPI, Flask and Django are now detected from Python dependencies (previously FastAPI and Flask were never detected).
- Spring is only detected with a Spring Boot dependency or plugin; plain Java/Kotlin projects are no longer reported as Spring.
- Laravel is only detected with `laravel/framework` or `artisan`; Rails only with the `rails` gem, `config/application.rb` or `bin/rails`.

## [0.0.1]

### Added

- Initial release: stack detection, static + LLM-enriched rules and commands for Claude Code, Cursor, GitHub Copilot and opencode.
