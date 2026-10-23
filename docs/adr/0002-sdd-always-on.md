# ADR-0002 — SDD siempre activo

- **Status**: Aceptada (2026-10-20)

## Context

Con el módulo SDD (ADR-0001) podía ofrecerse como opción (`--sdd`) o generarse en cada ejecución. El objetivo del producto es desarrollar con SDD, y la v0.0.1 publicada solo genera reglas y comandos por stack.

## Decision

Cada ejecución de `npx autostackrc` genera tanto las reglas y comandos por stack como el kit SDD. No existe flag para desactivarlo. Internamente se organiza en dos packs (`base` y `sdd`) solo por orden del código.

## Consequences

- **Cambio incompatible**: la próxima ejecución en un proyecto que ya use la v0.0.1 crea `docs/`, `specs/`, `MEMORY.md`, skills y agentes. Se publica como **v0.1.0**, con entrada *Changed* en el CHANGELOG y un aviso en el README.
- Los documentos del usuario se protegen con propiedad `create-once` y hashes en el lockfile (constitución, principio 1).
- Los comandos genéricos `feature`, `tdd` y `review` se reescriben para convivir con `/sdd-*`: `feature` queda como vía rápida para cambios pequeños.
- La CLI debe generar el kit aunque falten datos (por ejemplo, sin comando de test), marcándolos como `[NECESITA ACLARACIÓN]` en lugar de bloquear.
- Un único camino simplifica la documentación, los tests y el soporte.

## Alternatives

- **SDD opt-in (`--sdd`)**: no cambia el comportamiento para los usuarios actuales, pero mantiene dos caminos que documentar y probar. Descartada.
- **Opt-out (`--no-sdd`)**: deja una salida a quien no lo quiera, pero contradice el objetivo del producto. Descartada; se puede revisar si aparece demanda real.
