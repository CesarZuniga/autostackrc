# ADR-0001 — El soporte SDD es un módulo de autostackrc

- **Status**: Aceptada (2026-10-20)

## Context

Queremos una CLI que detecte el stack y genere el arnés de Spec-Driven Development (constitución, `specs/`, skill `sdd`, comandos `/sdd-*`, agentes coordinator/planner/implementer/reviewer y MCP) en el formato de cada asistente de IA. autostackrc ya resuelve el problema base: detecta el stack, genera una IR agnóstica (`ir.ts`) y la proyecta con writers para Claude Code, Cursor, Copilot y opencode. Además, gestiona bloques en archivos compartidos y enriquece con el CLI del usuario sin API key.

## Decision

Implementar SDD como un módulo interno de este repositorio: plantillas en `templates/sdd/`, extensión de la IR (skills, agentes, docs y MCP) y extensión de los writers existentes.

## Consequences

- Se reutilizan la detección, los writers, el CI, el portal y la distribución npm ya existentes.
- La IR y los writers crecen en responsabilidad. Hay que mantenerlos separados por tipo de documento para no romper SRP.
- El nombre del paquete no transmite "SDD"; se compensa con el README y el portal.

## Alternatives

- **Repo nuevo (`autospec`) que importe autostackrc como librería**: separa mejor los públicos, pero obliga a estabilizar y publicar una API de autostackrc antes de tiempo y duplica el CI y la distribución. Descartada.
- **Construir sobre midudev/autoskills**: su licencia CC BY-NC 4.0 impide el uso comercial y su modelo es instalar skills de terceros, no generar un flujo de trabajo. Descartada.
