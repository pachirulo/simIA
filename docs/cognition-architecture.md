# Arquitectura cognitiva: refactor interno

Actualización del 18/09/2026: [coherencia cognitiva y evidencia](cognition-coherence-evidence-2026-09-18.md).
Añade comprobaciones puras de intención (`semantics/intent.ts`), fuente y resultados
(`semantics/evidence.ts`), atribución de diálogo (`semantics/dialogue.ts`) y conservación
de propuestas reparadas (`semantics/repair.ts`). Los builders ordenan los datos
actuales; el proveedor mantiene su presupuesto de respuestas. `reflectionIssue`
acepta el contexto ya existente; no se agrega una interfaz pública ni almacenamiento.
Los límites de cobertura y el avance pendiente están en el [plan](cognition-coherence-plan-2026-09-18.md).
El resto de este documento describe el refactor histórico; las menciones a cambios
de tests del engine corresponden a ese refactor, no a este trabajo de coherencia.

Actualización final de esta iteración: [implementación, métricas y fronteras](cognition-coherence-final-review-2026-09-18.md). La conversación tiene un único escritor con entradas públicas: se excluyen los datos privados de ambos agentes y solo se recuperan declaraciones explícitas compartidas. Esta es la alternativa elegida por el usuario para mantener el presupuesto; no implica dos mentes aisladas ni garantiza que el modelo no invente biografía. Las precondiciones y la atribución posterior se comprueban con funciones puras, antes de entregar resultados canónicos.

## Correspondencia con la arquitectura objetivo del usuario

La comparación visual aportada el 18/09 es una dirección de diseño. Su columna final
se desarrolla por objetivos del plan; no describe un resultado ya demostrado. La
columna anterior tampoco reemplaza la auditoría: por ejemplo, el request original
de R1 sí contenía el pan transportado.

| Bloque de la imagen | Implementación y estado comprobado |
| --- | --- |
| Percepción, inventario, ubicación y heading | Builders de contexto con datos suministrados; planificación incorpora recursos. La observabilidad y el aislamiento del conocimiento privado siguen teniendo límites. |
| Continuidad | Historial acotado de propuestas y cambios observados. Un cambio no se atribuye automáticamente a una propuesta; no hay un recibo nuevo de ejecución. |
| Evidencia y fuentes | `semantics/sources.ts` define `SourceAssertion`: texto, origen, hablante explícito, minuto registrado, certeza y condición. `context/reflection-evidence.ts` construye el mismo marco para prompt y validación, sin leer memoria no seleccionada. |
| LLM | Se mantienen proveedores, routing, contratos y presupuesto de respuestas. No se añade un juez LLM ni un cerebro paralelo. |
| Coherencia y validación semántica | Controles de intención/acción, referencias, recursos observables, fuente y resultados reconocidos. Son verificaciones acotadas, no comprensión universal del lenguaje. |
| Repair fiel | Solo se solicita ante error. Se conserva la propuesta original y se comprueba la reparación; una salida válida va directamente al engine. Reconsideración explícita y reparación local se distinguen. |
| Engine sin cambios | Continúa ejecutando y registrando eventos con sus reglas actuales. Única excepción autorizada: restaurar island.ts y personas.ts desde sus copias originales inglesas. No se cambia la lógica del engine ni el protocolo. |
| Memoria/reflexión con evidencia | Se comprueban afirmaciones nuevas contra evidencia personal parcial. Los recuerdos anteriores se conservan; condiciones, proyectos y paráfrasis todavía tienen objetivos abiertos. |
| Menos loops/fallbacks y mayor fiabilidad | Metas de evaluación pendientes. Las corridas anteriores contienen fallos y no se recalculan como si hubieran usado esta versión. |

Una diferencia importante respecto del dibujo: el engine guarda `proposal.remember`
**antes** de aplicar la acción. Este plan no mueve ese paso. Cognition debe impedir
que ese recuerdo anticipe un resultado; una reflexión posterior puede usar los
eventos que el engine ya suministra. El ciclo de evidencia usa esas llamadas
existentes, sin introducir un hook después de ejecutar ni una segunda persistencia.

El marco de fuentes conserva las etiquetas originales y distingue observación,
evento, habla, interpretación, carta, intención y origen desconocido. Una cita
extraída mantiene su procedencia: si estaba en una interpretación, sigue siendo
interpretada. `recordedAt` no es la fecha de cumplimiento de una promesa; `null`
significa desconocido. Las condiciones textuales reconocidas quedan `unverified`:
vincularlas con entregas y pagos corresponde al objetivo P5.3, aún abierto.

Avance posterior del 18/09: `semantics/commitments.ts` construye trazas temporales
para ofertas condicionales explícitas y formas de aceptación reconocidas. Los
recibos de entrega y transferencia se contrastan por participantes, objeto, importe
y orden. El prompt de reflexión recibe esas trazas junto con sus fuentes; el saldo
informal sigue desconocido. La gramática es acotada y no interpreta cualquier
promesa ni atribuye una transferencia a la liquidación de un acuerdo.

La petición adicional de logs se implementa en dos límites: `provider/logging.ts`
extrae `dialogue` del resultado aceptado, y `apps/server/src/dialogue-log.ts` extrae
las frases de los eventos confirmados del mundo mediante el callback existente.
Este último registro también incluye el habla ejecutada por `say`. Ninguno modifica
el engine o añade un campo al protocolo de salida del modelo.

## Antecedentes del refactor

Actualización semántica: [contratos y validaciones de cognición](cognition-semantic-contract.md).
Esa actualización incorpora comprobaciones posteriores a Zod y comparte los builders de
decisión, plan y reflexión con Anthropic directo. Las menciones posteriores a Anthropic
sin cambios describen el refactor histórico, anterior a esa actualización.

Actualización de prompts/OpenRouter: [auditoría de tokens del 17/09/2026](llm-token-optimization-2026-09-17.md).
Documenta el benchmark real, la compactación equivalente del schema de salida,
las instrucciones de decisión compactas y las diferencias de conducta observadas.
Las cifras del refactor incluidas más abajo son históricas, no el baseline de esa auditoría.

El engine sigue eligiendo `decide`, `converse`, `plan` o `reflect`. No hay otro router LLM ni nuevo estado cognitivo. `OpenRouterBrain` implementa la misma interfaz `Brain` y conserva opciones, modelos por defecto, callbacks, métodos de uso y exports anteriores.

## Recorrido y responsabilidades

```text
Engine → método de OpenRouterBrain → builder de contexto
       → reglas de operación + persona + datos suministrados
       → schema de protocol + selección de modelo existente
       → OpenRouterProvider → HTTP / JSON / reparación / Zod → Engine
```

La selección de modelo continúa siendo una función local, sin llamadas LLM. El orden interno de selección no cambia la operación elegida por el engine.

| Archivo nuevo dentro de `packages/cognition` | Responsabilidad |
| --- | --- |
| `src/context/decide.ts` | Recibe `Perception` y `AgentState`; conserva **todo** el JSON de percepción y el bloque de persona; añade mecánicas aplicables. |
| `src/context/converse.ts` | Recibe `ConverseContext`; compone ambas personas, observación local, recuerdos de cada lado, rumores, planes y confianza. Una sola llamada sigue escribiendo ambos lados. |
| `src/context/plan.ts` | Recibe `PlanContext`; conserva recursos, deseos, proyectos, relaciones, cartas, memorias seleccionadas, lugares, empleos, terrenos y costos de construcción dinámicos. |
| `src/context/reflect.ts` | Recibe `ReflectContext`; conserva memorias con fuentes, evidencia personal, deseos, plan alcanzado/incumplido, creencias, atención y proyectos. |
| `src/context/shared.ts` | Forma del contexto, política `cachePersona`, selección y composición del primer. No mantiene estado. |
| `src/prompts/core.ts` | Constitución común: prioridad de observaciones, procedencia de memorias, conocimiento limitado, agencia, restricciones físicas, cartas y voz. |
| `src/prompts/world-rules.ts` | Una única definición de las reglas existentes, con nombres. Reconstruye el `WORLD` anterior para compatibilidad. |
| `src/prompts/decide.ts` | Guía estable de decisión y selección de mecánicas según opciones/datos percibidos. |
| `src/prompts/decide-compact.ts` | Redacción compacta exclusiva de decisión; mantiene grounding y restricciones y deja intactos los prompts de otras operaciones. |
| `src/prompts/plan.ts` | Restricciones y oportunidades para organizar el día, sin el manual de sintaxis de todas las acciones. |
| `src/prompts/persona.ts` | `personaBlock` original, sin quitar campos ni profundidad de personalidad. |
| `src/model/router.ts` | `CallKind`, `Slot`, `Models`, `SLOT_OF` y `chooseModel` originales. |
| `src/provider/openrouter.ts` | HTTP, timeout, retry/backoff, cooldown, contabilidad, structured output, validación y reparación. |
| `src/provider/response.ts` | Límites y truncado de prosa, notas de reparación y marca no enumerable de fallback. |
| `src/schema/json.ts` | `cleanSchema`, `strictSchema`, `stripNulls`, detección del modo estricto. |
| `src/schema/action.ts` | Punto único de selección del schema de acciones; por compatibilidad devuelve el canónico. |
| `src/schema/compact.ts` | Compacta sólo la representación enviada de ActionProposal; agrupa alternativas equivalentes y conserva el validador canónico. |
| `scripts/measure-context.ts` | Comparación reproducible sin red, usando los mismos datos y schemas antes/después. |
| `test/fixtures.ts` | Estado y percepción creados por un `Town` real y contextos tipados representativos. |
| `test/context.test.ts` | Conservación de información, selección de reglas, reducción, inmutabilidad y compatibilidad de `WORLD`. |
| `test/operations.test.ts` | Requests reales del adaptador con HTTP simulado: routing, caching, primer, schemas, fallback y uso. |

Archivos modificados: `src/openrouter.ts` (fachada), `src/prompts.ts` (reexports compatibles y prompts auxiliares), `package.json` (comando de medición) y `tsconfig.json` (typecheck del script). `src/index.ts`, `src/mock.ts` y `src/anthropic.ts` no cambian.

Fuera de cognition se añaden este documento y su enlace en README. Se corrigen dos expectativas preexistentes en `packages/engine/test/calendar.test.ts` y `minds.test.ts`: consultan los nombres del world pack en vez de exigir los nombres ingleses. No cambia la simulación ni se sustituyen las personalizaciones de `personas.ts` e `island.ts`.

## Contratos y datos preservados

- No se modifica `Brain`, `AgentState`, ningún contexto del engine ni schema/export de protocol. El engine sigue validando la viabilidad física de cada acción.
- `decidePrompt`, `conversePrompt`, `planPrompt`, `reflectPrompt` y `personaBlock` se trasladan conservando su contenido. El cambio intencional es la composición de reglas que hace cada builder.
- No se serializa indiscriminadamente `AgentState`: cada operación continúa usando los mismos campos que recibía antes. Los builders reciben los objetos completos y pueden incorporar nuevos campos pertinentes sin otro estado ni cambio de contrato.
- `remember`, persistencia, recuperación de memorias, límites actuales de evidencia y `desiresForMind` no cambian. `converse` usa `aMemories`/`bMemories`, `plan` usa `keyMemories`, `reflect` usa `dayMemories`/`keyMemories`/evidencia. No leen una segunda copia de `agent.memory`.
- `routine`, `stakes`, `reflect`, overrides por ciudadano, `modelsFor`, `digestModel`, reglas por tier y tratamiento de reflexión silenciosa/incluida se conservan.
- `enrich`, `digest`, `child`, `writePaper`, `judge` y `life` conservan prompts específicos, schemas, modelos, límites de salida y fallback.

## Qué queda de WORLD

OpenRouter ya no utiliza `WORLD` completo en ninguna operación. El core reutiliza las reglas invariantes. Decisión añade fundamentos de recursos/supervivencia y selecciona reglas detalladas para las oportunidades o datos presentes: construcción, acuerdos, instituciones, aprendizaje, consejos, huertas, decoración, etc. Las oportunidades de viajar y actuar en otro lugar siguen mencionadas en su guía estable. Planificación mantiene calendario, abastecimiento, supervivencia y restricciones sociales/económicas necesarias para decidir qué hacer durante el día. Conversación y reflexión conservan el core y sus instrucciones originales específicas, sin el catálogo de acciones.

Las reglas mecánicas fijas conservan los valores que ya tenían. Los nombres, precios y contenidos generados por el mundo siguen llegando mediante percepción, contextos y primer; no se reemplazan por una isla nueva hardcodeada.

El `WORLD` completo sólo se reconstruye para el adaptador directo `AnthropicBrain` existente y como baseline de medición. Su contenido anterior queda comprobado por hash. Migrar ese adaptador a los builders requiere su propia validación del SDK; no se ha cambiado su comportamiento como efecto lateral de este refactor de OpenRouter.

## Primer y caching

Para reflexión, `context/reflection-updates.ts` comparte con el prompt y el
validador los contadores de construcción de proyectos seleccionados, deseos
visibles y eventos personales suministrados. `semantics/reflection-updates.ts`
valida las referencias y los indicadores estructurados antes de recorrer la
prosa. No crea otro almacenamiento ni convierte el cumplimiento subjetivo de un
deseo en ejecución física. Los límites y errores están en el contrato semántico.

`brain.primer` sigue siendo una cadena mutable inyectada por el server, leída en **cada** llamada, incluidas las auxiliares. `selectPrimer(kind, primer)` es el punto para una futura selección por operación. Actualmente devuelve la cadena completa: el contrato es texto opaco, por lo que adivinar secciones o recortarlo podría perder información dinámica. No se captura sólo en el constructor ni se guarda una copia obsoleta.

Desde la revisión seed 468 del 18/09, `context/world-primer.ts` expone
`worldPrimerOf(town)`: recibe nombre, lugares y world pack actuales y conserva el
texto que antes construía el servidor. Servidor y headless actualizan el primer
de OpenRouter antes de cada tick. No modifica el mundo ni hace llamadas al modelo.
`provider/dialogue-log.ts` comparte el extractor de eventos confirmados; el servidor
lo reexporta desde su módulo existente y headless persiste `dialogue.jsonl`.

Se mantiene el orden:

1. Bloque compartido: reglas estables de operación + primer + JSON schema, con `cache_control: ephemeral`.
2. Bloque propio: persona; lleva marcador sólo con `thinkEvery <= 5`, como antes. El bloque de situación de una conversación nunca lleva marcador.
3. User: datos dinámicos y, en decisión, reglas locales seleccionadas. Cambiar de lugar/opciones no altera el prefijo compartido.

Las reparaciones reutilizan esos bloques y agregan los turnos de reparación habituales. `cachedTokens()`, `usage()` y `onUsage` siguen informando los datos que devuelve el proveedor, incluidos costo y tokens de cada respuesta reparada.

Los tests comprueban estructura y estabilidad del caché, no un cache hit remoto. Al acortar un prompt puede quedar por debajo del mínimo cacheable del modelo; mantener un marcador no garantiza que el proveedor lo almacene. No se agrega texto irrelevante para rellenar ese mínimo. Evaluar ahorro monetario exige observar `cachedTokens`, `promptTokens` y `costUsd` reales por operación/modelo, además de la reducción de texto.

## Por qué no se restringe ActionProposal a options

`Perception.options` es `ActionKind[]`. Sin embargo, `Action` y el validador del engine soportan `offer`, `accept`, `refuse` y `settle`, que no pertenecen a `ActionKind` ni se anuncian en `options`. Por tanto, **options no es actualmente una allowlist completa**. Una unión Zod filtrada sólo por esa lista quitaría acciones funcionales de negociación/construcción.

`actionProposalSchema(perception)` conserva exactamente `ActionProposal`: no duplica schemas, no introduce casts ni permite acciones desconocidas. Se prueba tanto la compatibilidad de acuerdos como el rechazo/reparación de una acción inexistente. Reconciliar primero el contrato de opciones permitirá después seleccionar las ramas originales de `Action.options`, manteniendo sus validaciones y defaults. No se cambia ese contrato en esta fase.

## Medición reproducible

```sh
pnpm --filter @unwatched/cognition measure:context
```

Baseline: `WORLD` original + los renderers originales. Ambos lados usan la misma persona, primer dinámico derivado del world pack, percepción/contextos y schema JSON. Se cuentan caracteres de **system + user**, incluido el schema dentro de system. Se excluyen el schema duplicado en `response_format` y el envoltorio HTTP, que no cambian. Tokens estimados = caracteres/4; no son tokens facturados ni una medición de costos.

| Operación | System antes → después | User antes → después | Total antes → después | Reducción |
| --- | ---: | ---: | ---: | ---: |
| decide, mercado | 24.395 → 16.514 | 3.132 → 8.092 | 27.527 → 24.606 | 10,6% |
| decide, construcción/aprendizaje | 24.395 → 16.514 | 3.179 → 9.562 | 27.574 → 26.076 | 5,4% |
| converse | 14.050 → 5.081 | 1.716 → 1.716 | 15.766 → 6.797 | 56,9% |
| plan | 13.495 → 7.541 | 3.350 → 3.350 | 16.845 → 10.891 | 35,3% |
| reflect | 15.170 → 6.201 | 3.665 → 3.665 | 18.835 → 9.866 | 47,6% |

La reducción de decisión es deliberadamente conservadora: no recorta percepción, mantiene el schema completo por compatibilidad y añade más mecánicas cuando la tarea las requiere. Su user crece, pero el total disminuye. Las cifras cambian con el world pack, primer y contexto; no constituyen un objetivo fijo.

## Verificación y segunda fase

```sh
pnpm typecheck
pnpm test
pnpm --filter @unwatched/cognition measure:context
git diff --check
```

Cobertura específica: los cuatro métodos, llamadas auxiliares, fallback marcado/prohibido, cooldown, retries 429/5xx, timeout sin repetición incierta, cuerpo de respuesta incompleto, reparación JSON/Zod, normalización estricta, truncado, selección de modelos, callbacks de uso, costos desconocidos, tokens cacheados, primer reemplazado/eliminado y prefijo compartido entre ciudadanos/ubicaciones. Las pruebas son locales con HTTP simulado, sin gasto de proveedor. No demuestran equivalencia textual de respuestas de un LLM ni su tasa real de cache hits.

Resultado de la validación del 17/09/2026: typecheck correcto en los ocho paquetes; 43 tests de cognition, 96 de engine, 49 de server, 11 de store y 58 de web, todos correctos (257 en total). Antes del refactor había dos fallos en engine por nombres ingleses fijos; se corrigieron las expectativas para usar los nombres dinámicos, sin cambiar el world pack.

Segunda fase: acordar secciones explícitas del primer con el productor; reconciliar `ActionKind`/`Action`/`options`; introducir candidatos de memoria sin alterar ahora `remember`; experimentar con turnos de conversación independientes evaluando costo y timing; migrar el adaptador directo Anthropic; medir caché, costos y calidad de decisiones en una muestra controlada del proveedor real.
