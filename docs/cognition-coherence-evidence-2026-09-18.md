# Evidencia y avance de coherencia cognitiva

**Iteración 13:** [informe consolidado de implementación, nueve simulaciones, auditoría y tres objetivos abiertos](cognition-coherence-final-review-2026-09-18.md). Incluye la elección del usuario de excluir datos privados del diálogo manteniendo llamadas, nuevas regresiones, contraste antes/después, costes reales y rutas de los archivos. Los resultados históricos siguientes permanecen tal como se obtuvieron.

## Fuentes y baseline

El usuario identificó seis generaciones de OpenRouter. Se recuperaron sus entradas, salidas y metadatos mediante consultas de lectura a `generation/content` y `generation`. Las capturas completas de contenido, identificadores, hash del archivo original y modelo/proveedor están en `packages/cognition/test/fixtures/coherence-captures.json`. Las versiones originales descargadas, con metadatos completos, quedan localmente en `out/cognition-coherence-20260918/originals/`.

El baseline del checkout tiene HEAD `0a5663f6a98cfe283aa0813a8f75d3fcbf14a33f` y cambios locales anteriores. Antes de editar se guardaron hashes y el diff de cognition en `out/cognition-coherence-20260918/baseline.json` y `baseline-cognition.patch`. Pasaban 129 pruebas de cognition. Las dos primeras regresiones sintéticas nuevas fallaron con `undefined` en lugar de `intent_action_mismatch` y `memory_unverified_outcome`, antes de introducir las correcciones. Los casos sintéticos permanecen separados de las capturas auténticas.

No se identificó un `events.jsonl` local completo de la corrida indicada por el usuario. Las entradas de decisión/reflexión sí contienen percepciones y eventos personales parciales. No se atribuye a esta corrida el seed o el ejecutable de otra corrida anterior por coincidencia de personajes. El commit exacto, flags completos, política global de fallback y total de gasto de la corrida original no están acreditados por estas seis generaciones.

## Casos originales

| Caso | Generación | Evidencia comprobada y límite |
| --- | --- | --- |
| R1 | `gen-1789705637-qaa4XTCNeeXAjMF4mQSd` | Inés, día 2 a las 15:00, inventario `suitcase,bread`, 37 monedas, hambre 1. El prompt ya mostraba pan transportado, diferenciaba compra/consumo y proponía `use`. La respuesta decide comer directamente sin comprar y devuelve `trade` con `with:inn`; también inventa un recuerdo de consumo. No es una carencia de esa información en esta llamada. |
| R2 original | `gen-1789705655-6q5lQaegSnuFhkaJXj0t` | Propone comprar `flour` en `mill` con `sell:"."`, `coins:5`. La percepción no ofrece harina en el mostrador. Corregir la puntuación no basta para hacer viable la compra. |
| R2 reparación | `gen-1789705657-uRziC09WVp3XOzhc8d5O` | Los dos primeros mensajes coinciden con los de la original; el turno añadido contiene solo el error de referencia y las instrucciones genéricas de reparación. No incluye la propuesta original. La respuesta cambia a `market,bread` y deja `sell:""`, sin explicar por qué abandona la harina. |
| R3 | `gen-1789705491-i0df6nFfc94tMPdPcyox` | A es Pedro (`ag_2`), B es Inés (`ag_1`). Inés introduce cinco monedas por saco como rumor; `b_remember` atribuye la cotización a Pedro. El contexto ya contiene una conversación anterior que condicionaba el pago a la entrega del pan. |
| R4a | `gen-1789705658-f1Cr1aLPlteUnbghWXhh` | Inés, día 2 a las 20:00: propone `trade` y recuerda “Bought bread at the market for 1 coin, hunger eased.” Los cambios desde la decisión anterior incluían menor hambre, pero no acreditan el resultado de esta nueva propuesta. |
| R4b | `gen-1789705671-U7aI92Cjjc43li4TkcKA` | La reflexión conserva “I still owe Pedro his ten” sin entrega de Pedro acreditada en la entrada. Su evidencia sí registra compras y consumos propios; eso no demuestra el cumplimiento de la condición del acuerdo. |

La reflexión muestra eventos `agent.trade` 90/92/97/104 y `agent.eat` 99/106, además de movimientos. Sus registros con timestamp sitúan compras de Inés en los minutos 2280, 2340, 2460 y 2640. Hay correspondencia temporal entre R1 y la compra del minuto 2340, y entre R4a y la del 2640, pero esos eventos no llevan el ID de generación: se informa como correlación temporal, no recibo inequívoco de la llamada. El registro parcial de consumos no permite atribuirlos a una propuesta concreta o distinguir hábito/modelo sin el log completo.

Hay además una condición del contrato de conversación que cognition debe respetar: el engine guarda `outcome.rumor` como algo que **A le contó a B**. No es un rumor bidireccional. Si B lo originó, devolverlo allí produce atribución engañosa al persistirlo. La salida debe dejar ese campo en `null` y mantener el origen B en las líneas y recuerdos. No se ha modificado esa persistencia.

## Inventario de datos por operación

| Operación | Datos legítimos ya suministrados | Tratamiento y límites |
| --- | --- | --- |
| Decisión | Percepción completa, estado propio, necesidades, inventario repetido por unidad, monedas, ofertas locales, presencia, recuerdos etiquetados, plan, heading e intenciones. | Índice ordenado y cantidades sin retirar el JSON. El historial acotado conserva propuestas y deltas, nunca causalidad. `self.desires[].last_attempt`, cuando existe, acredita aceptación del intento ligado al deseo, no cumplimiento del objetivo general. |
| Conversación | Estado privado de A/B para el narrador, recuerdos separados, rumores de A, lugar observado y relaciones. | Estado privado motiva a su dueño; no se convierte en conocimiento del interlocutor. Un solo modelo sigue escribiendo ambos lados; las instrucciones no constituyen aislamiento criptográfico ni garantía contra toda filtración narrativa. |
| Planificación | Necesidades, inventario y recursos propios, proyectos/intenciones, empleos y lugares suministrados. | Se incorporó inventario al texto; antes no se serializaba. No se inventan ofertas, autorización sobre fondos ni tiempos de viaje. |
| Reflexión | Recuerdos etiquetados, `actionEvidence`, `desireEvidence`, deudas del propio agente, metas/creencias anteriores y pasos del plan. | Se muestran deudas actuales y se validan afirmaciones en todos los campos de texto. Los eventos personales existentes se aprovechan sin consultar el historial global. Las dos listas de evidencia son parciales y tienen coberturas distintas. |

No hay recibo dedicado y completo para la última llamada de `decide`. Los cambios por hábitos u otros actores pueden ocurrir entre percepciones. La pérdida del historial efímero al reiniciar Brain no elimina las intenciones persistentes. `done`/`missed` siguen significando lo que establece el engine; cognition no los reinterpreta como ejecución o cancelación.

## Implementación y límites de las comprobaciones

- `semantics/intent.ts`: contradicciones explícitas entre operación inmediata e intención, con negaciones y controles de secuencias comprar → comer. Objetivos generales, personalidad y alternativas legítimas permanecen permitidos.
- `semantics/repair.ts`: candidato acotado como datos, sin recuerdos inventados ni bucles; comparación de campos afectados y no afectados; estados `preserved`, `reconsidered` y `drift` en diagnósticos. Dos intentos como antes. No compara equivalencia literaria completa de objetivos.
- `semantics/evidence.ts`: registros tipados internos de observación/evento/habla, tiempo cuando existe y contraste de afirmaciones físicas y obligaciones. Conserva la incertidumbre y comprueba condiciones explícitas. No añade almacenamiento ni campos públicos.
- `semantics/dialogue.ts`: hablantes existentes, atribución de afirmaciones con coincidencia léxica suficiente, dirección de rumores y condiciones; protección del fallback. No determina la veracidad del rumor ni prohíbe mentiras atribuidas.
- `semantics/lifecycle.ts`: validación contextual de reflexión y sus campos anidados; fallback no introduce resultados sin respaldo.
- Ambos adaptadores aplican las barreras. OpenRouter conserva reparación compartida de hasta dos respuestas. Anthropic conserva sus límites existentes: reparación en decisión y fallback en conversación/reflexión, ahora comprobado y marcado.

Son comprobaciones conservadoras de alta confianza en inglés/español, **no un verificador universal del lenguaje**. Paráfrasis lejanas, referencias implícitas, números escritos complejos, condiciones fuera del contexto y contradicciones narrativas sutiles pueden escapar o causar rechazo. El matching de resultados exige objeto/importe/fuente compatibles: una paráfrasis demasiado distinta puede requerir formular el recuerdo con la evidencia literal u omitirlo. No se garantiza fidelidad total con expresiones regulares.

`trade` local se contrasta con `for_sale`, no con stock. La comprobación no supone que las ofertas del mostrador describan el inventario privado de otro agente. Las acciones con campos omitidos que el engine puede completar se solicitan explícitas al modelo para hacer su decisión revisable; no se altera la normalización del engine. No se añadió una lista global de items/personas ni se filtraron acciones por `options`.

## Verificación local

Las pruebas cubren capturas originales, controles positivos, reparaciones fieles y sustituciones silenciosas, fuente equivocada, condiciones, deuda real e inventada, compra/consumo y resultados antes/después de `Town.apply`, fallback y ambos proveedores simulados. Los costes y resultados de pruebas HTTP simuladas no se presentan como comportamiento del LLM real.

Resultado del checkout al finalizar la primera entrega (la segunda iteración se registra al final):

| Comprobación | Resultado |
| --- | --- |
| Cognition | 163 tests, incluidos 32 de coherencia y 12 de continuidad. Baseline: 129. |
| Suite general `pnpm test` | 377 tests: cognition 163, engine 96, server 49, web 58, store 11. Turbo reutilizó caché en engine/web/store. |
| Engine, ejecución adicional directa | 96 tests pasan sin caché de Turbo. |
| `pnpm typecheck` | 8 paquetes pasan. Se corrigió un uso de `findLast` en un test, incompatible con el target existente, sin cambiar la configuración. |
| `git diff --check` | Sin errores; avisos de conversión LF/CRLF de Git no son errores de UTF-8. |
| Frontera de cambios | 59 archivos de engine/protocol conservan su SHA-256 del baseline; diff vacío en ambas carpetas. Mundo/personajes sin cambios. |
| Revisión de la matriz | Los hashes de todos los fuentes de cognition coinciden con los guardados al iniciar las seis corridas. |

Las pruebas nuevas viven en cognition. Se restauró únicamente el `tsconfig.tsbuildinfo` de web generado por estas comprobaciones. Se conservaron los cambios locales anteriores.

## Evaluación real y metodología

Se añadieron dos comandos opt-in:

```powershell
pnpm exec tsx packages/cognition/scripts/check-coherence.ts --live out/coherence-replay-N
pnpm exec tsx packages/cognition/scripts/soak-coherence.ts --live out/coherence-matrix-N
```

Ambos requieren directorios nuevos. El primero reenvía los contextos originales con aclaraciones nuevas y evalúa cinco casos, hasta diez respuestas pagas; las reconstrucciones parciales del contexto de comprobación se identifican como tales. El segundo usa `OpenRouterBrain` y `Town` reales, dos personajes, dos días, seeds 84/85/86 y ticks 1/60 separados; guarda entradas, salidas, errores, fallback, métricas y eventos. Tiene límites declarados de 120 respuestas por corrida y USD 1 de coste conocido total, comprobados entre ticks; puede superar ligeramente el límite por llamadas del tick en curso. Una corrida que alcanza el límite se marca incompleta, no aprobada. Costes desconocidos no equivalen a cero.

El parámetro opcional final de `soak-coherence.ts` permite seleccionar una de esas tres seeds; la matriz final se ejecutó en tres procesos independientes, cada uno con sus ticks 1 y 60. El límite de USD 1 es por proceso. El pack y los personajes son los originales suministrados por `Town`/`seedPersonas`, con dos ciudadanos, ambos con owner `you`, y fallback permitido. No se levantó el servidor ni se inyectó su `primerOf(town)`: el `primer` del Brain de este arnés queda vacío. Por tanto, es una evaluación del arnés y los builders reales, **no una reproducción exacta de la aplicación desplegada**. El modelo registrado fue `deepseek/deepseek-v4-flash-0731`; OpenRouter varió el proveedor entre llamadas. Los proveedores, tokens y modelos efectivos figuran en los logs.

Primera repetición real: `out/cognition-coherence-20260918/replay-1/`. R1 y R2 agotaron los dos intentos; R4a entregó una nueva decisión sin consumo inventado; R3 produjo un recuerdo `":"` además de contenido narrativo, que el validador todavía aceptaba. Se agregó su regresión. También se corrigió un falso rechazo de “comprar primero, comer después” al reconocer la primera operación explícita dentro de una oración. La evaluación de reflexión reconstruía evidencia incompleta: el script se corrigió para conservar también los eventos personales presentes en la entrada original. Estas incidencias se conservan; no se descarta esta tanda para presentar solo resultados favorables.

La segunda tanda, `replay-2`, tuvo 9 respuestas, 43.307 tokens de entrada y 1.627 de salida, USD 0,0029262944. Se conservó junto con la primera (8 respuestas, USD 0,002994365). La matriz diagnóstica `matrix-1` completó solamente seed 84/tick 1: 51 respuestas, 9 fallbacks, USD 0,020366115. Se interrumpió el siguiente caso para fijar la revisión final tras corregir falsos positivos; sus archivos parciales y el motivo permanecen guardados. Esos resultados no se mezclan con la matriz final.

### Repetición dirigida final, sin fallback

Artefactos: `out/cognition-coherence-20260918/replay-final/{results.json,provider.jsonl}`.

| Caso | Resultado en el presupuesto existente | Interpretación |
| --- | --- | --- |
| R1 | Aceptado en la segunda respuesta: `use bread`, intención de comer, memoria vacía. | La primera repitió `trade` mientras decía comer; la barrera lo detectó. No fue correcto al primer intento. |
| R2 | Sin salida aceptada tras dos respuestas. | Primero intentó harina no ofrecida; después propuso moverse al mercado, con explicación en `remember` y sin `intent`. La comparación contra el original lo rechazó. No acredita reparación exitosa. |
| R3 | Diálogo aceptado al primer intento. | Conserva el acuerdo pendiente y los hablantes. Esta nueva generación no repite el precio de cinco monedas: la regresión exacta está en la fixture, no queda cubierta por este nuevo diálogo por sí solo. |
| R4a | Sin salida aceptada tras dos respuestas. | El primer recuerdo anticipa la compra. El segundo quita ese recuerdo, pero elimina `desire_id`; la comparación lo clasifica como drift. **No hubo cambio de producto/destino en esa segunda respuesta:** requiere revisar si la regla de metadatos está rechazando demasiado. |
| R4b | Sin salida aceptada tras dos respuestas. | Ambas fueron rechazadas por afirmaciones físicas. La primera ya evitaba la deuda efectiva y describía compras/consumos que sí aparecen parcialmente en la entrada: el matching de paráfrasis y agregados requiere revisión. No debe atribuirse todo rechazo a una alucinación del modelo. |

Total: **2/5 casos con salida aceptada**, 9 respuestas HTTP, 40.523 tokens de entrada, 2.018 de salida, USD **0,0028985974**. La latencia por caso fue R1 7,2 s; R2 2,8 s; R3 12,2 s; R4a 7,5 s; R4b 30,8 s. Se retienen las tres tandas; no se repitió hasta lograr cinco ejemplos favorables.

### Matriz final de simulaciones

Artefactos locales: `out/cognition-coherence-20260918/final-seed{84,85,86}/seed{N}-tick{1,60}/`. Cada corrida guarda `provider.jsonl`, `outputs.jsonl`, `events.jsonl` y `summary.json`; cada seed tiene `sample.json` con huellas del código. `final-metrics.json` y `final-rejections.json` agregan los datos, mediante `summarize.mjs`, sin realizar llamadas pagas.

| Seed | Tick | Completó dos días | Respuestas del proveedor | Salidas observadas del Brain | Fallback / salidas | Fallback en reflexión | Coste USD | Latencia p50 / p95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 84 | 1 | No; tope de 120 respuestas, último output en minuto 2679 | 120 | 107 | 1/107 | 1/2 | 0,04826146 | 3,1 / 15,3 s |
| 84 | 60 | Sí | 51 | 43 | 3/43 | 2/4 | 0,02174193 | 3,1 / 28,2 s |
| 85 | 1 | Sí | 99 | 87 | 4/87 | 2/4 | 0,04165445 | 3,7 / 16,1 s |
| 85 | 60 | Sí | 48 | 39 | 3/39 | 2/4 | 0,01727156 | 3,7 / 49,8 s |
| 86 | 1 | Sí | 43 | 32 | 6/32 | 4/4 | 0,01673883 | 3,9 / 30,9 s |
| 86 | 60 | Sí | 51 | 38 | 4/38 | 3/4 | 0,01817771 | 3,9 / 25,8 s |

Se observaron **346 salidas de decide/converse/plan/reflect**, 21 sintéticas: 6/288 decisiones, 1/12 conversaciones, 0/24 planes y **14/22 reflexiones**. Las 412 respuestas del proveedor incluyen reparaciones y otras operaciones que el engine solicitó, como `paper`; por eso no equivalen a 346 salidas observadas. Hubo 1.563.792 tokens de entrada, 66.950 de salida y USD **0,163845945408** de coste informado, sin costes desconocidos entre esas 412 respuestas. Se registró un error de transporte recuperado. Un intento sin respuesta no tiene necesariamente uso/coste informado.

La latencia es la de cada método observado completo, incluidas reparaciones/fallback; no solo la del HTTP. No existe una comparación previa equivalente con esta revisión/configuración. No se infieren ahorros, mejora causal de conducta ni superioridad de una cadencia a partir de estas cifras. Tampoco se usa la corrida incompleta como si tuviera la misma exposición que las otras cinco.

### Métricas semánticas: contadores y límites

En 412 respuestas se registraron 335 aceptaciones de schema/validación, 72 rechazos semánticos y 5 de schema. **Son resultados del comprobador, no etiquetas independientes de verdad.** Entre los 72 rechazos: 11 de intención/acción, 39 de resultados sin respaldo, 1 de atribución, 1 de dirección de rumor, 1 de pérdida de condición, 1 de drift de reparación y 18 de otras precondiciones.

En 32 comparaciones de reparación: 6 `preserved`, 25 `reconsidered`, 1 `drift`. Esta clasificación no demuestra que toda reconsideración sea narrativamente correcta. Hubo 61 decisiones iguales a la decisión anterior del mismo agente entre 288 decisiones; su progreso, justificación o ausencia de información nueva **no está etiquetado independientemente**, por lo que no se informa una tasa de “bucles incorrectos”.

La revisión cualitativa encontró límites concretos que impiden cerrar P7:

- Falso rechazo de paráfrasis/agregados en reflexión: los casos con “bought and ate bread several times” y referencias a turnos no siempre coinciden con la representación de los eventos personales. El caso dirigido R4b conserva el texto y las fuentes para corregirlo. Los 39 rechazos de resultados no pueden contabilizarse como 39 recuerdos falsos.
- La intención “I acknowledge Pedro's presence and set my immediate course…” junto a `say` fue rechazada como desplazamiento inmediato (`gen-1789709666-nDdW9C1aD5goMSoRkBSF`): requiere separar el acto de anunciar del paso posterior.
- En el diálogo aceptado de seed 86/tick 1, minuto 2161, `a_remember` comienza con “.Bellamy? Romer?” sin respaldo en las líneas. La comprobación de atribución no detecta toda incorporación de nombres o contenido extraño. Es un caso pendiente, no una memoria validada por completo.
- La segunda respuesta de R4a fue rechazada por pérdida de `desire_id`, aunque conservó la operación y corrigió el recuerdo. Hay que revisar la proporcionalidad de esa regla, sin volver a permitir sustituciones silenciosas de acciones.
- No se auditó exhaustivamente cada afirmación aceptada contra su fuente. La tasa de falsos positivos, falsos negativos y R1–R4 aceptados permanece **desconocida**; no se informa cero.

Los controles y las fixtures mejoran la detección de los casos concretos, pero esta muestra **no acredita que la lógica cognitiva esté resuelta**. En particular, 14/22 reflexiones con fallback exige corregir el matching antes de considerar estable esa parte.

## Próximo trabajo y estado del plan

El [plan](cognition-coherence-plan-2026-09-18.md) conserva abiertas las tareas parciales. Prioridad: convertir los falsos rechazos y la contaminación de nombres de esta muestra en regresiones; mejorar la relación afirmación/fuente sin acumular reglas que obliguen a una acción; completar contratos informales y cumplimiento de proyectos; probar diálogo → memoria persistida → reflexión → entrega/pago con engine intacto; repetir una muestra fijada con el contexto de servidor, después de corregir esas causas.

No se declara completo el plan. Los resultados locales, las barreras implementadas y la ejecución de evaluaciones tienen evidencia; la calidad integral, el progreso sostenido y el cierre de P7/P8 siguen pendientes.

## Segunda iteración: rechazos y recorrido completo

Continuación del 18/09/2026. Se conservan íntegros los resultados anteriores. El plan pasa a **24 tareas completadas y 13 pendientes/parciales**, al cerrar P5.6 y P7.2 con las comprobaciones que siguen.

### Correcciones verificadas

1. **Salarios y dirección del dinero.** El evento real `was paid N for a shift` respalda trabajar ese turno y cobrar ese importe; no respalda haber pagado a otro. La transferencia `agent.give` con monedas respalda un pago del emisor, con destinatario e importe compatibles. Una entrega de pan no prueba una transferencia de monedas.
2. **Operaciones y objetos separados.** “Bought and ate bread” exige evidencia de compra de pan y consumo de pan: haber comprado harina y comido pan no basta. “Ate bread and soup” requiere ambos objetos. Se conserva el sujeto al expandir operaciones coordinadas; la entrega observada de Pedro puede recordarse como acto de Pedro, no como acto propio.
3. **Frecuencia y duplicados.** “Twice”, “several times” y las expresiones numéricas cubiertas se contrastan con eventos distintos. El ID se conserva entre `actionEvidence` y `desireEvidence`; la misma compra en dos listas no cuenta como dos compras. Frecuencia e importe se comprueban por separado.
4. **Negaciones y operación inmediata.** “I haven't given…” no afirma una entrega. Una cláusula positiva después de “but” sí se comprueba por separado. Anunciar un viaje sigue siendo `say`; no se confunde con ejecutar ya el desplazamiento.
5. **Asociación del deseo al reparar.** Si el modelo corrige la memoria y conserva exactamente la acción, un `desire_id` omitido se recupera del candidato original. No se inventa un ID, no se modifica la respuesta original, no se sobrescribe un valor explícito ni se conserva tras cambiar de acción o cuando el error estaba en ese campo. Ambos proveedores tienen pruebas del recorrido, con dos respuestas como máximo.

`evidence-grounding.test.ts` comenzó con cuatro de cinco casos fallando antes de la corrección: salarios, agregados, coordinación y llegada/contratación. Al cierre contiene siete tests, incluidos controles negativos de importes, duplicados, objetos, sujetos y pagos. `coherence.test.ts` y `anthropic-semantics.test.ts` añaden cobertura de intención y reparación.

Son comprobaciones de una gramática acotada; no traducen automáticamente los nombres de items, no resuelven cualquier pronombre y no convierten todo verbo narrativo en un evento. Las afirmaciones fuera de esa cobertura siguen requiriendo revisión.

### Integración desde cognition, con engine intacto

`coherence-integration.test.ts` ejecuta tres escenarios independientes: **promesa, entrega sin pago y entrega pagada**. En cada uno:

- `Town.tick()` solicita la conversación al adaptador OpenRouter, que recibe HTTP simulado en modo estricto.
- El engine guarda el diálogo y los recuerdos; se guarda y restaura su snapshot real.
- Cuando corresponde, `Town.apply()` entrega el pan y, en otro paso, transfiere las diez monedas. Se comprueban inventarios y saldos.
- El tick de medianoche construye el contexto real de reflexión y persiste la respuesta del adaptador.
- Sin pago, “I paid Pedro 10 coins” se rechaza; después de transferir las monedas, se acepta. La promesa y la entrega por sí solas no crean un préstamo en `agent.debts`.

Cada escenario usa una conversación y dos reflexiones, tres respuestas controladas, sin reparaciones ni fallback. Esto acredita el recorrido y su evidencia. **No acredita todavía la inferencia general de deuda informal después de cumplir una condición**, que sigue pendiente en P5.3.

### Revisión offline de la muestra anterior

Nuevo comando, sin red:

```powershell
pnpm exec tsx packages/cognition/scripts/audit-grounding.ts <informe-nuevo.json> <directorio-corrida> [más-directorios]
```

El script reevalúa los campos exactos de reflexión anteriormente rechazados por `memory_unverified_outcome`, usando los eventos que figuraban en cada request y el nombre del agente registrado en el resumen de su corrida. Conserva IDs, campo, texto y evidencia en el informe; no sobrescribe archivos existentes. Es una comprobación limitada a eventos: no reconstruye todo `ReflectContext`, no incorpora respaldo exclusivamente observacional y no aplica todos los validadores.

Sobre los seis directorios `final-seed*`, revisó **30 campos de reflexión**: 10 ya no son rechazados y 20 siguen siéndolo. Resultado: `out/cognition-coherence-20260918/grounding-audit-v2.json`. Los 39 rechazos físicos del informe anterior incluían también otras operaciones; no son el denominador de esta revisión de reflexión. Un campo que ahora pasa no convierte toda su respuesta en verdadera ni demuestra que una nueva generación del modelo vaya a ser correcta. No se recalcula retrospectivamente el número de fallbacks de aquellas corridas.

### Nuevo replay real y corrección posterior

`replay-grounding-v2` conservó la metodología y los contextos originales del replay previo. Resultado medido: **3/5 casos con salida aceptada**, 8 respuestas, 33.354 tokens de entrada, 1.920 de salida y USD **0,0029296019**. R1 pasó en una respuesta, R4a en dos y el diálogo R3 en una. R2 agotó los dos intentos; R4b también fue rechazado dos veces. No se interpreta 3/5 frente a 2/5 como una mejora estadística o causal demostrada.

La revisión de R4b mostró dos problemas adicionales del comprobador: un prefijo temporal en “Today I…” y la negación contraída “I haven't given…”. Se corrigieron después de esa ejecución, con regresiones. La reevaluación **offline** de esas dos mismas respuestas (`gen-1789712259-o9orl30MkffYbtNVd6BO` y `gen-1789712265-oEvKI3UeZ5H4WCj84qoS`), con el mismo contexto parcial reconstruido del replay, ya no produce error del validador. Está en `replay-grounding-v2/offline-reflections.json`. **No se cambia el resultado medido a 4/5**, ni se considera verificado todo su contenido: siguen apareciendo afirmaciones narrativas, como una supuesta interacción con el molinero, que estos controles no verifican por completo.

### Comprobación final de esta iteración

- **177 tests de cognition**, 14 más que en la entrega anterior; 13 archivos de tests.
- **391 tests en la suite general**: cognition 177, engine 96, server 49, web 58 y store 11. Turbo reutilizó engine/store; no se presentan como otra ejecución directa.
- `pnpm typecheck`: ocho paquetes pasan. `git diff --check`: sin errores con la configuración del repositorio.
- Los 59 archivos protegidos de engine/protocol mantienen sus hashes originales. No se modificaron world packs ni personajes.

Continúan abiertos los contratos informales completos, los indicadores de cumplimiento de proyectos, los nombres/detalles narrativos añadidos sin fuente y la evaluación integral con el contexto de servidor. Los nuevos tests y el análisis offline no sustituyen esa muestra.

## Tercera iteración: marco de fuentes y arquitectura objetivo

Continuación del 18/09/2026 a partir de la imagen aportada por el usuario. Se cierra
**P5.1**: el plan queda en **25 tareas completadas y 12 pendientes/parciales**.
La [correspondencia arquitectónica](cognition-architecture.md#correspondencia-con-la-arquitectura-objetivo-del-usuario)
documenta qué bloques existen, qué límites tienen y qué beneficios siguen sin medir.

### Cambio implementado

`semantics/sources.ts` define una representación interna por input/utterance:
afirmación literal, referencia a la entrada, tipo de fuente, ID/tipo de evento
cuando existe, hablante explícito o desconocido, tiempo registrado o desconocido,
certeza y condición textual no verificada. Mantiene también el registro completo:
no descarta fragmentos desconocidos ni citas anidadas que no puede extraer.

Las categorías de certeza son procedencia, no una puntuación de verdad. Una
conversación puede estar registrada como evento sin que lo dicho sea un resultado
físico. Una cita dentro de una interpretación sigue siendo interpretada. La fecha
de un recuerdo no demuestra cuándo se cumplió una condición.

`context/reflection-evidence.ts` reconstruye el marco exclusivamente con las listas
suministradas en cada llamada. No consulta `agent.memory`, historiales globales ni
el estado privado de terceros. El prompt y el comprobador de reflexión comparten
ese marco. El prompt conserva las entradas originales y añade anotaciones de las
fuentes ambiguas; los recibos físicos no se duplican en ese índice. El lector de
evidencia utilizado por decisión y diálogo reutiliza la misma clasificación.

No cambian salidas canónicas, engine, protocol, persistencia, routing, presupuesto
de llamadas ni mecanismos de reparación. Las anotaciones sí añaden texto al prompt
de reflexión; no se atribuye a este cambio ahorro de tokens ni costo.

### Verificación de esta iteración

- `source-evidence.test.ts`: **7 pruebas nuevas**, sobre tipos de fuente, emisor y
  condición, repetición, formato desconocido, interpretaciones con citas, UTF-8 y
  nombres con puntuación, separación de habla/rechazo/recibo, privacidad y frescura
  del marco por llamada.
- Los tres escenarios de `coherence-integration.test.ts` ahora comprueban también
  el emisor y la condición después de restaurar el snapshot real, y la presencia
  separada de recibos de entrega y pago en el marco de evidencia.
- `pnpm --filter @unwatched/cognition test`: **184 tests pasan, en 14 archivos**.
- `pnpm --filter @unwatched/cognition typecheck`: correcto.
- `git diff --check`: correcto. **59 hashes protegidos de engine/protocol sin cambios**.

Esta iteración usa pruebas locales y HTTP simulado. No se ejecutó una nueva muestra
con el proveedor real ni se recalcularon los resultados históricos como actuales.

### Pendiente siguiente

**P5.3 permanece abierto.** Ahora la condición tiene representación explícita, pero
no hay un intérprete general que vincule cualquier promesa con su entrega y calcule
una obligación informal vigente. Una entrega observada prueba la entrega; no
identifica por sí sola qué acuerdo satisface ni demuestra que no haya existido un
pago fuera de la evidencia parcial disponible. Resolver esas transiciones exige
conservar participantes, objeto, importe, secuencia temporal y referencias de
respaldo, manteniendo desconocido lo que no se pueda establecer. No se crea deuda
del engine a partir de una promesa narrada.

## Cuarta iteración: etapas de compromisos y campo dialogue

Continuación del 18/09. Se agrega y completa **P8.4**, solicitado por el usuario:
logs de habla. El plan queda en **26 tareas completadas y 12 pendientes/parciales**
de un total actualizado de 38. P5.3 avanza sin marcarse completo.

### Evidencia de los compromisos

`semantics/commitments.ts` deriva trazas por llamada desde las fuentes ya
suministradas. Para formas explícitas reconocidas de pago condicionado conserva
pagador, destinatario, importe, condición y referencias. Separa aceptación
explícita, entrega y transferencia monetaria. Solo vincula recibos `agent.give`
compatibles con los participantes y el objeto/importe; exige orden temporal,
usando IDs de eventos cuando ocurren en el mismo minuto. Si faltan IDs para
resolver ese orden, no lo adivina.

La misma evidencia repetida en dos listas no cuenta dos veces. Varias ofertas o
entregas compatibles quedan ambiguas; no se reparte un recibo entre acuerdos.
Interpretaciones, cartas, negaciones de aceptación, pronombres ambiguos y requisitos
adicionales no acreditan una aceptación o entrega. La gramática cubre formas
explícitas de inglés/español; no traduce automáticamente items del mundo.

El contexto de reflexión incluye estas trazas, compartidas con el constructor de
evidencia. **No calcula una deuda informal vigente:** una transferencia coincidente
no demuestra que liquidó ese acuerdo y la evidencia es parcial. `outstanding`
permanece desconocido; las deudas actuales siguen viniendo del engine. P5.3 mantiene
pendiente esa transición, la liquidación y la cobertura general de lenguaje.

### Logs de habla

El logger de OpenRouter añade `dialogue: [{speaker, text}]` a `validation` de una
conversación aceptada. El modo legible presenta `dialogue=[...]` sin recortar las
frases ni mezclar sus recuerdos. Los candidatos rechazados no reciben este campo.

El callback de eventos existente del servidor también emite `[town] dialogue`
con `eventId`, minuto, tipo y `dialogue: [{speakerId, speaker, text}]`. Esta fuente
registra el habla ya emitida en el mundo: conversaciones y acciones `say` con
texto. Excluye acercamientos, escritos, apodos, propuestas y acciones rechazadas.
No se modifica `Town`, sus eventos ni los schemas del modelo. El cambio mínimo en
`apps/server/src/main.ts` conecta un extractor independiente y aislado de fallos.
El [filtro documentado](openrouter-console-logs.md#ver-solamente-lo-que-hablan-los-personajes)
permite leer únicamente nombres y frases desde el log del servidor.

### Verificación

- **205 tests de cognition pasan**: 15 nuevos de compromisos, tres escenarios
  adicionales de integración y tres de logging; 15 archivos de tests en total.
- **53 tests del servidor pasan**, incluidos cuatro nuevos del extractor de habla.
  La integración usa `Town.tick()` y `Town.apply()` reales: registra una conversación
  y una frase válida una vez, y no registra la frase rechazada.
- Los seis escenarios de persistencia/restauración/reflexión conservan las pruebas
  originales; los tres nuevos verifican aceptación explícita, entrega y transferencia
  después de restaurar un snapshot, mediante OpenRouter con HTTP controlado.
- Typecheck de cognition y servidor correcto. No se añadieron dependencias,
  variables de entorno ni llamadas al modelo.
- `git diff --check` correcto; 14 archivos de esta iteración comprobados en UTF-8
  estricto y 59 hashes de engine/protocol iguales al baseline protegido.

Durante las pruebas se corrigió el tratamiento de cantidades escritas dentro de
una condición: “two bread” queda fuera del enlace simple de un objeto. También se
cambió un fixture de logging que repetía la misma frase y era correctamente
rechazado por el control de degeneración; el caso final usa prosa larga válida.
No se desactivó ningún validador para hacer pasar la prueba.

Los tests son locales, con el engine real y el proveedor simulado. No se reinició
el servidor del usuario ni se ejecutó una nueva muestra facturada. Las métricas de
calidad/costo de corridas anteriores permanecen históricas.

## Iteración 5: log del usuario, seed 468

La [auditoría específica](cognition-seed468-review-2026-09-18.md) cruza las 28
respuestas del log pegado con sus 61 eventos y requests originales recuperados.
Se completaron P9.1–P9.4 y P9.6: destinatarios locales de comercio, hablantes
canónicos, falsos rechazos de promesas/alojamiento, errores de schema conjuntos,
primer compartido, `dialogue.jsonl`, protección del destino y asociación de deseo
añadida durante una reparación sin cambio de acción. El plan queda en 31 tareas
completadas y 13 pendientes; P2.4, P5.5 y P9.5 conservan hallazgos de esta prueba.

Verificación: 214 tests de cognition y 53 de servidor correctos; typecheck de
cognition, servidor y headless. Tras aclarar los contadores de reparación/HTTP se
repitieron los 53 tests de los módulos de logging y coherencia, todos correctos.
El mock headless terminó y su intento de reutilización falló sin sobrescribir el
archivo de eventos. `git diff --check` correcto. Los 59 hashes protegidos de
engine/protocol permanecen idénticos al baseline. Fuentes y documentación pasan
la lectura UTF-8 estricta; los archivos AppleDouble `__MACOSX/._*` de los logs
aportados son metadatos binarios preexistentes y no se modificaron.

Se ejecutó una muestra **real y facturada** de un día con seed 468: 59 eventos,
cero rechazos del mundo, cuatro compras y cuatro consumos, cuatro registros de
diálogo con 13 frases; 28 respuestas LLM, 144.879 tokens de entrada y 6.055 de
salida. Hubo dos fallbacks: decisión y reflexión de Pedro. El primero reveló el
falso drift al añadir `desire_id`; la corrección posterior tiene prueba local,
sin otra muestra real. El segundo mezcla una paráfrasis de llegada con un pago
no respaldado que persiste tras reparación. La tasa de aceptación no se presenta
como calidad semántica; no se cierra la evaluación integral ni se afirma ahorro.

## Iteración 6: cláusulas y originales en inglés

El usuario solicitó continuar y después indicó restaurar `island.ts` y
`personas.ts` desde los originales de sus carpetas para usar inglés. Se copiaron
**exactamente**, sin traducirlos otra vez:

- `packages/engine/src/packs/island - copia.ts` → `island.ts`.
- `packages/cognition/src/personas - copia.ts` → `personas.ts`.

Los hashes SHA-256 de origen/destino coinciden. El de island es
`801C77296C6F2C901F27FDE1F8F37F0ED9167B33C938B7B24C03C59346DCC575` y el de personas,
`11517C46182083C6234542A963037E49088E6D6DC1152A9EDE475ED100878E36`.
La comparación estructural del pack conserva 30 lugares, 13 trabajos, rutas,
posiciones, precios, stocks, horarios, salarios, producción, suministro, exportación
y calendario; cambian textos/nombres/distritos. La función `seedPersonas` es idéntica
al ignorar finales de línea. Se dejó también en inglés el texto neutral del fallback
de reflexión. No se tradujeron los fixtures históricos ni se migraron mundos guardados.

Esta es una **excepción explícita de datos** a la frontera anterior: de los 59
archivos protegidos originales, únicamente `packages/engine/src/packs/island.ts`
cambia. Los otros 58 hashes permanecen iguales. Las copias previas y el comprobador
local están en `out/cognition-coherence-20260918/iteration6/`.

### Evidencia física por cláusula

Cuatro nuevas pruebas fallaron antes de cambiar el comprobador. La corrección:

- Separa llegada/búsqueda/pago y otras coordinaciones de verbos reconocidos. Las
  listas como «bread and soup» mantienen la exigencia de ambos objetos.
- Conserva condiciones y declaraciones atribuidas a otro a través de sus cláusulas.
  Una negación con sujeto explícito no oculta otra compra afirmada. La puntuación
  dentro de citas delimitadas no convierte sus frases internas en hechos propios.
- Usa `agent.arrive` para llegar genéricamente al pueblo/isla; una llegada inicial
  no prueba visitar un castillo. Para un lugar concreto exige evidencia de destino.
- Reconoce `went to` de los eventos de movimiento y excluye `on the way to`: esa
  parte describe el destino pendiente, no el lugar alcanzado.
- La reparación de «I arrived in town, paid for three nights at the inn, and
  looked for work» señala el pago. Una prueba con el adaptador OpenRouter, evento
  de llegada real y HTTP controlado verifica la respuesta corregida en dos
  llamadas, sin fallback ni recibo inventado.

Las pruebas inglesas/españolas son controles construidos a partir del fallo
observado; no se presentan como otra respuesta del modelo real. P9.7 se completa
con esta cobertura acotada. P5.5 sigue abierto: no hay traducción general de objetos,
resolución universal de pronombres ni comprensión de toda paráfrasis. Tampoco se
valida aquí la verdad de haber buscado a alguien. Los pagos siguen requiriendo
evidencia propia; la reflexión histórica completa de Pedro no se declara válida.

### Verificación

- Suite general `pnpm test`: cinco paquetes con tests pasan (web servido desde
  caché); tras completar las regresiones se repite cognition: **219 tests**.
  Engine: 96; servidor: 53; store: 11; web: 58. Total vigente: **437 tests**.
- `pnpm typecheck`: ocho paquetes correctos. Se repite cognition después de los
  últimos cambios del comprobador.
- Soak nuevo con mock, un día/dos agentes/seed 468/tick 60: 53 eventos y diez
  registros de habla. Usa **Rosa Vidal y Petar Ilić** y nombres del pack original.
  Artefactos: `apps/headless/out/coherence-english-iteration6/`.
- Igualdad por hash de ambos originales, invariantes del pack, UTF-8 estricto
  y `git diff --check` verificados. No se agregan dependencias ni variables.

No se hizo otra corrida facturada en esta iteración. El idioma/configuración de
personas cambia respecto de la muestra Inés/Pedro; una comparación posterior debe
registrar esa diferencia. No se atribuyen todos los errores anteriores al idioma.
El plan queda en **33 objetivos completados y 13 pendientes**.

## Iteración 7: actualizaciones estructuradas de reflexión

El usuario pidió dejar de lado la gaceta. Se retiró íntegramente el inicio de
implementación de esta iteración: `context/paper.ts` conserva su contenido anterior,
no queda el módulo de validación editorial iniciado y no se conectaron cambios a
`writePaper`. P9.5 queda **diferida por el usuario**, fuera del trabajo activo.

Se completan **P5.7 y P5.8** dentro de cognition. La inspección confirmó que el
engine ya ignora el cierre narrativo de una construcción y las actualizaciones
de deseos con referencias incompatibles. La mejora es detectarlas antes de
devolver la reflexión, señalar el campo exacto y permitir la reparación habitual.
No se atribuye un fallo de ejecución al engine ni se altera su comportamiento.

### Cambios

- `context/reflection-updates.ts`: recibe `ReflectContext` y construye una vista
  compartida por prompt y validador: contadores de construcción de proyectos
  seleccionados, deseos visibles mediante `desiresForMind` y eventos suministrados
  que incluyen al propio agente. No consulta el mundo ni memorias no seleccionadas.
- `semantics/reflection-updates.ts`: devuelve un `SemanticIssue` con código,
  campo y motivo, o `null`. Se invoca desde `reflectionIssue`, por lo que se aplica
  en OpenRouter, Anthropic y el fallback de reflexión.
- `projects[].done: true` se rechaza si contradice el contador de una obra conocida:
  por ejemplo, 1/6 jornadas. El propio booleano guardado, una frase de progreso o
  un paso del plan marcado como alcanzado no reemplazan ese contador.
- Un ID de deseo debe estar entre los visibles. Cada referencia de evidencia debe
  existir entre los eventos personales suministrados. Un deseo nuevo empieza
  activo; cambios a `fulfilled` o `set_aside` deben identificar uno existente.
  El modelo puede omitir una actualización sin respaldo y conservar el estado.

Conversaciones y otros eventos personales pueden motivar cambios subjetivos de
intereses. Validar su ID **no certifica la interpretación**, la relevancia causal
ni que haya ocurrido lo que alguien afirmó. Un objetivo genérico sin contador de
construcción continúa siendo subjetivo: P5.4/P5.5 siguen abiertos. Tampoco se
resuelven títulos ambiguos o renombrados inventando asociaciones de proyectos.

### Verificación

- Siete regresiones nuevas fallaron antes de implementar el control; pasan después.
  La prueba positiva de objetivos subjetivos se mantuvo válida.
- Nueve tests del módulo cubren contadores, `done`, omisiones, nombres, referencias
  ausentes/ajenas, motivaciones subjetivas, reparación y fallback. Una prueba
  adicional comprueba Anthropic con SDK simulado y fallback inválido, sin llamadas extra.
- Integración con engine real: crear obra, trabajar una jornada, serializar/restaurar
  snapshot y llegar a la reflexión nocturna. El primer output intenta marcarla
  terminada y se repara con el motivo **1/6 labor**, en dos respuestas de OpenRouter
  controladas. La obra permanece pendiente y no aparece aviso de objetivo terminado.
  Cinco jornadas físicas posteriores completan 6/6, generan `town.built` y permiten
  reconocer el resultado. No se edita el engine ni se simula ese resultado con texto.
- **229 tests de cognition y 53 del servidor correctos**; `pnpm typecheck` correcto
  en los ocho paquetes. Los tests de engine/store/web de la iteración anterior
  conservan su carácter histórico; no se presentan aquí como otra ejecución.
- Se comprueban UTF-8 y `git diff --check`. Los originales en inglés conservan los
  hashes de la iteración 6. Frente al baseline original, el único cambio entre los
  59 archivos protegidos sigue siendo el pack restaurado con autorización; los otros
  58 permanecen idénticos. No hubo nuevos cambios de engine/protocolo en esta iteración.

No se hizo una corrida facturada. No se afirma que el modelo real haya mejorado su
tasa de reparación o fallback: las comprobaciones de adaptadores usan HTTP/SDK
controlados. El plan queda en **35 objetivos completados, 12 pendientes activos
y uno diferido por el usuario (gaceta)**.

## Iteración 8: revisión de la corrida seed 853

[Auditoría detallada](cognition-seed853-review-2026-09-18.md). Se contrastó el
adjunto con los 59 eventos completos y cinco solicitudes originales recuperadas
por lectura de OpenRouter. La corrida tiene cuatro compras, tres consumos y cero
transferencias. `dialogue.jsonl` contiene cinco registros y 18 intervenciones.
El fragmento de consola contiene 25 outputs; termina antes de completar las
reflexiones del proveedor, por lo que no acredita totales finales de uso/fallback.

Se cierran **P10.1 y P10.2**: contratación válida rechazada por frecuencia de otra
cláusula y recepción afirmada sin evidencia. Las tres regresiones iniciales fallan
antes y pasan después. La reparación conserva el habla y cambia el recuerdo; una
insistencia inválida agota los mismos dos intentos y produce fallback marcado.
Se cubren receptor, origen, objeto, repetición, citas y actividades ambiguas.
Se amplían seis escenarios de integración con engine real para validar la toma
del objeto solo después de su entrega, incluso tras restaurar un snapshot.

**237 tests de cognition correctos, en 18 archivos**, y typecheck general correcto
en ocho paquetes. No se hizo una nueva simulación facturada ni se afirma una
reducción real de errores o fallbacks. Los resultados de servidor/engine/store/web
de iteraciones anteriores siguen siendo históricos, no otra ejecución actual.

El plan conserva **37 objetivos completados, 14 pendientes activos y uno diferido
por el usuario (gaceta)**. P10.3/P10.4 concretan la validación pendiente de premisas
físicas en intenciones y paráfrasis de portar/entregar. Las nuevas barreras no
reescriben las memorias existentes. El engine/protocolo y los originales ingleses
se verifican con hashes en `out/cognition-coherence-20260918/iteration8/verification.json`.

## Iteración 9: premisas físicas dentro de intent

Se completa **P10.3**. Se recuperó por lectura HTTP 200 la solicitud original
`gen-1789719507-5Fr2fYOy2ceIM3UXoSib`; el output y su percepción completa se añadieron
a `seed853-regressions.json`. No se lanzó una nueva generación facturada.

El caso afirma «Rosa gave me soup for the loaf» y propone `use soup` mientras
expresa intención de comprar. Antes ya se rechazaba la contradicción de operación.
Al aislar ese fallo cambiando solamente a `trade`, la premisa sin evidencia pasaba.
Esa variante está identificada como contrafactual; el output original se conserva.
Ahora ambos fallos se informan juntos cuando aparecen en la misma respuesta.

`semantics/intent.ts` contrasta premisas físicas reconocibles usando únicamente
observaciones seleccionadas de `Perception.recent`, deudas suministradas y el
nombre del propio agente. Se aplican las mismas reglas de procedencia que a los
recuerdos. Inventario actual, diálogo y reflexión anterior no prueban cómo se
obtuvo un objeto. La ausencia de evidencia exige incertidumbre, no afirmar que
el hecho sea falso. La compra viable puede conservarse al reparar la premisa.

Se protegen futuros, propósitos pasivos, condiciones, citas, negaciones y
creencias explícitas. Las cláusulas causales separan el resultado pasado de una
meta futura. Las entregas en primera persona contrastan el destinatario: dar sopa
a otra persona no acredita que yo la recibí. Una regresión de la suite existente
detectó confusión entre `compro` y `compró` por normalización; se corrigió.

Validación:

- Cinco regresiones iniciales fallaron antes y pasan después. Diez tests nuevos
  en `intent-premises.test.ts`, más uno del adaptador Anthropic: **248 tests de
  cognition correctos en 19 archivos**.
- OpenRouter con HTTP controlado reproduce el output original y corrige ambos
  problemas en dos respuestas; otro caso conserva una compra ya coherente al
  reparar solo el texto. Cambiar de acción sin explicarlo sigue siendo drift.
- Fallback inválido pasa a espera neutral marcada. Anthropic usa el mismo control
  y no consulta una memoria verdadera pero no seleccionada para esa llamada.
- Engine real: hablar de entrega → rechazo de la premisa → ejecutar `give` →
  confirmar inventarios → snapshot/restauración → percepción → premisa respaldada.
  Ningún cambio del engine o protocolo fue necesario.
- `pnpm typecheck`: ocho paquetes correctos. Se verificaron UTF-8, diff y hashes
  protegidos en `out/cognition-coherence-20260918/iteration9/verification.json`.

No se midió todavía una mejora con nuevas respuestas del modelo real. P10.4
mantiene pendientes paráfrasis, pronombres y reciprocidad de trueques; reconocer
una entrega no prueba la contraprestación. P5.4 sigue abierto como cobertura
general, y la gaceta sigue diferida. Estado: **38 completados, 13 pendientes
activos y uno diferido**.

## Iteración 10: transferencias, comercio y exclusión de la gaceta

La instrucción actual del usuario es **no modificar la gaceta y quitarla del plan**.
Se elimina la tarea editorial y sus referencias como trabajo pendiente. Las
entradas anteriores de este informe conservan su carácter histórico; el estado
vigente ya no incluye tareas diferidas: **38 completadas y 13 pendientes**.
No se tocó código editorial, engine ni protocolo.

P10.4 continúa parcial. Se amplía `groundedClaimIssue` con formulaciones de
entrega (`handed`, `delivered`), recepción (`received`) y comercio (`traded`,
`exchanged`, `swapped`). La recepción se contrasta con la dirección y el objeto
del recibo; portar, tomar, comprar o repetir una declaración no prueban una
entrega por otra persona. La proyección conserva ID, fuente y origen y solo vive
dentro de cognition. No se añade un tipo de evento ni otro almacén de memoria.

Un evento de comercio genérico no acredita sus mercancías. Dos regalos en
direcciones opuestas tampoco prueban que liquidaron un trueque. La reparación
puede conservar ambas entregas como hechos separados y mantener incierto el
vínculo con el acuerdo. Se añade `exchange_unverified` a las reparaciones que
deben conservar el objetivo y la acción salvo reconsideración explícita.

Validación:

- Cinco regresiones iniciales fallaron antes de implementar el cambio. Diez tests
  nuevos en `transfer-language.test.ts`; **258 tests de cognition correctos en
  20 archivos**, más typecheck general en ocho paquetes.
- Controles positivos y negativos de receptor/origen, objetos, frecuencia,
  cantidades, citas, negaciones, futuros, expresiones no físicas y consumo.
  No se introduce un catálogo fijo de bienes ni equivalencias inventadas.
- Comercio real con engine: Rosa entrega sopa y recibe pan mediante `trade`;
  los inventarios se comprueban antes/después de restaurar el estado. El evento
  emitido es `Rosa Vidal traded with Petar Ilić.`. Permite el recuerdo genérico
  y deja desconocido el detalle de bienes al validador. **El snapshot no restaura
  la lista de eventos**: la prueba conserva el evento emitido en el llamador y
  no lo atribuye a la restauración.
- Reflexión con HTTP controlado: dos regalos documentados, afirmación de trueque
  rechazada y reparación en dos respuestas conservando cada transferencia.
- UTF-8, diff y hashes protegidos registrados en
  `out/cognition-coherence-20260918/iteration10/verification.json`.

No se hizo una nueva generación facturada ni se afirma una mejora medida en el
modelo real. Siguen pendientes `brought`, pronombres ambiguos, alias como
`loaf`/`bread`, otras formas de intercambio y la vinculación verificable al
acuerdo. P10.4 permanece abierto por esos límites; no se cierra por agregar
verbos o por obtener una reparación controlada.

## Iteración 11: archivos de diagnóstico y estado de las corridas

Se cierra **P8.5**, solicitado expresamente por el usuario. Estado del plan:
**39 objetivos completados y 13 pendientes**. La gaceta continúa fuera del plan.

La corrida histórica `apps/headless/out/openrouter-deepseek-hola/` ya tenía
`events.jsonl`, `dialogue.jsonl`, `summary.json` y `construction.json`. Sus
diagnósticos de proveedor se enviaban solo a stderr: no existe allí un `run.log`
que permita recuperar retroactivamente las respuestas desde esos archivos.

`apps/headless/src/run-logs.ts` recibe la ruta, configuración explícita y mensajes
de los callbacks; guarda eventos, habla y diagnósticos en UTF-8 y un manifiesto de
estado `run.json`. Solo depende de Node. `soak.ts` conecta el helper con los
callbacks existentes, duplica su progreso en `run.log` y espera `flushLogs()` antes
del cierre, también cuando falla o recibe una señal de interrupción. No se cambian
contratos, acciones, prompts ni presupuesto del modelo. Se validan argumentos de
inicio para evitar corridas vacías, ticks sin avance y nombres de brain inválidos.

Los archivos se escriben de forma síncrona. La protección cubre también logs y
manifiestos de corridas parciales. Un fallo de escritura no provoca otra decisión:
se advierte y la corrida termina con estado `logging_failed` y código de error.
Ctrl+C solicita terminar tras el tick en curso. Una terminación forzosa puede dejar
el estado `running`; no hay garantía ante cortes de energía ni discos llenos.

Verificación:

- **14 pruebas en dos archivos de headless**, incluyendo CLI real con brain mock,
  terminación normal, fallo controlado tras un tick, señal SIGINT controlada,
  conservación de eventos parciales y rechazo de destinos previamente usados.
- Pruebas de UTF-8, texto completo y aislamiento ante fallo de disco. Proveedor
  OpenRouter con HTTP simulado: respuesta inválida y reparación aceptada quedan
  en el archivo; ambas generaciones con metadata demorada se guardan antes de
  cerrarlo. La clave de prueba no aparece en los logs.
- `pnpm --filter @unwatched/headless test` y `pnpm typecheck` correctos; ocho
  paquetes en el chequeo de tipos (siete reutilizaron resultados de caché).
- Comando real: `pnpm --filter @unwatched/headless soak -- --days 1 --agents 2
  --brain mock --seed 853 --tick 60 --out out/coherence-logs-iteration11`.
  Resultado conservado: **55 eventos, 10 registros de diálogo, 16 frases**;
  `run.json` final en `completed`, sin errores de escritura y `usage: null`.
- Rutas y modo detallado documentados en `docs/openrouter-console-logs.md`.
  El modo predeterminado guarda completions completos; los prompts exactos se
  guardan únicamente con `UW_OR_LOG_CONTENT=1`. El servidor sigue en consola.
- UTF-8, diff y hashes del engine/protocolo comprobados en
  `out/cognition-coherence-20260918/iteration11/verification.json`.

No hubo nuevas generaciones facturadas ni se afirma una mejora conductual a partir
del mock. P10.4, privacidad P2.4 y evaluación integral permanecen abiertos. La
instrumentación permite auditar las próximas corridas sin depender del texto
copiado de la terminal.

## Iteración 12: traer, entregar y conservar quién realizó la acción

Se avanza en **P10.4**, que permanece abierto. No cambian los totales:
**39 objetivos completados y 13 pendientes**. No se modifica el engine,
protocolo, originales en inglés ni código editorial.

Se reprodujeron seis grupos de regresiones que fallaban antes del cambio:
`brought` sin observación pasaba sin contraste, las coletillas `like he said`
o `as promised` ocultaban la afirmación física y el pronombre inglés `He`
podía usar el recibo del narrador. Se conserva la distinción con el auxiliar
español `he comprado`. Los casos añadidos son sintéticos salvo la reproducción
identificada de la captura original seed 853.

`semantics/evidence.ts` incorpora una operación interna de portar/traer,
distinta de la recepción. La forma explícita `brought me X` admite un recibo
de entrega al narrador con actor y objeto correctos. Una observación de portar
no acredita entregar; un regalo tampoco acredita un trayecto de transporte.
Las proyecciones conservan la fuente e identidad del recibo y no se persisten
en el mundo. Se mantienen separados cantidades, repeticiones, consumo y
contraprestación. Un pronombre no resuelto pide actor explícito en la reparación;
no se resuelve usando el evento que convenga para aprobar la frase.

La captura original dice `He brought me a loaf like he said, even if it's a
bit stale, and he told me to keep quiet about him buying mainland flour`.
Su afirmación de entrega ya no se omite por el `said` o `if` posterior.
El sufijo comparativo y la concesión delimitada por coma se separan para
comprobar el hecho principal; una atribución como `Petar said he brought...`
continúa siendo habla. Esto no certifica el cumplimiento de una promesa.

Verificación:

- **268 tests de cognition correctos, en 21 archivos**. Diez tests nuevos en
  `test/brought-claims.test.ts`, con negativos y controles positivos de objeto,
  destinatario, persona, citas, condicionales, futuros y expresiones no físicas.
- Reflexión con la frase capturada y evidencia seleccionada original: primera
  respuesta rechazada, segunda conserva la atribución a Petar y la incertidumbre
  de entrega. HTTP controlado, dos respuestas. Si el modelo insiste dos veces,
  se devuelve el fallback marcado existente, sin nuevas llamadas.
- Integración con el engine real desde cognition: decir que se trajo pan no
  respalda la premisa; un `give` real sí. Tras restaurar el snapshot, inventario
  y memoria observada permiten validar `Petar brought me bread as promised`.
  Esto verifica la entrega física, no el acuerdo ni un trueque.
- Chequeo de tipos general y comprobación de archivos protegidos en
  `out/cognition-coherence-20260918/iteration12/verification.json`.

No hubo nuevas generaciones facturadas. No se midió una mejora conductual en
una corrida real nueva. Se mantienen pendientes equivalencias como `loaf`/`bread`,
resolución general de pronombres, otras construcciones de entrega y vínculos
entre recibos y acuerdos. La reparación puede solicitar un nombre o vocabulario
explícito aunque una persona pudiera inferirlo; no se presenta como comprensión
general del lenguaje.
