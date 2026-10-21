# Constitución — autostackrc

Principios innegociables. Toda spec, plan y tarea debe cumplirlos.

1. **El trabajo del usuario es sagrado**: nunca se sobrescribe un archivo que el usuario haya editado. Lo que es suyo (constitución, specs, MEMORY) solo se crea si no existe.
2. **Determinista y sin efectos laterales**: la detección no ejecuta código del proyecto ni accede a la red. Con `--no-llm`, la misma entrada produce exactamente la misma salida.
3. **Cero dependencias runtime**: solo la biblioteca estándar de Node ≥ 22.6 (*type stripping*). Una dependencia nueva requiere un ADR.
4. **La spec manda**: nada se implementa si no está en una spec aprobada (`specs/NNN-*/`). Si falta una decisión, se para y se pregunta.
5. **Tests como puerta**: cada RF tiene al menos un test con `node --test`. `npm test` y `npx tsc --noEmit` en verde antes de marcar una tarea. Prohibido avanzar en rojo.
6. **SDD siempre activo y protegido**: cada ejecución genera el kit SDD. El LLM solo rellena *slots* marcados y nunca altera las reglas del flujo.
7. **Idioma**: código, README y CLI en inglés; constitución, specs y ADR en español.
