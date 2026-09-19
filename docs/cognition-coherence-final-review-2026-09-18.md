# Revisión final de implementación y evaluación cognitiva

18/09/2026. Alcance: cognition, adaptadores, instrumentación autorizada y documentación. **La implementación tiene regresiones verificadas; el criterio de calidad global del plan todavía no está cumplido.** Este informe conserva los resultados desfavorables y distingue las correcciones posteriores de las versiones que ejecutaron cada muestra.

## Cambios comprobados

- **Privacidad del diálogo, elección expresa del usuario:** una llamada normal y hasta dos respuestas en OpenRouter; no se separan los interlocutores en dos llamadas. Se excluyen biografías, secretos, recursos, empleo, planes, deseos y recuerdos individuales. Se proporcionan nombres, temperamento, entorno público y habla explícita presente en los recuerdos seleccionados de ambos. Las interpretaciones y cartas compartidas tampoco se convierten en habla confirmada. El fallback usa saludos públicos y recuerdos vacíos. Anthropic conserva su presupuesto existente.
- **Precondiciones observables:** empleo/apertura local, renuncia, destinatario e inventario de regalos, monedas personales, materiales de reparación, propiedad explícita y obras financiables. La ausencia de datos queda desconocida. La validación definitiva y las carreras temporales siguen siendo del engine.
- **Producto e intención:** una elección directa de un producto observado necesita el mismo `trade.buy`. El comercio sin producto sigue permitido cuando no declara una elección específica. Esto impide pedir sopa y comprar silenciosamente el pan que el engine elige por defecto.
- **Reparación:** omitir una asociación vacía y quitar un campo ajeno al schema, como `food` al corregir `item`, no cambia por sí mismo el objetivo. Producto, destino y campos válidos siguen protegidos.
- **Evidencia y significado:** se cubren las expresiones de viaje `walked to/from` y `set out from`, el emisor de una afirmación al recordarla posteriormente y la inversión detectada entre buscar a un familiar y ser buscado por él. `Nothing bought`, una investidura descrita como `handed the mayor's seat` y usar monedas para comprar dejan de disparar diagnósticos físicos incorrectos. `loaf` puede respaldarse con `bread`, conservando cantidades y calificadores; no se traduce ni reescribe ningún ID de objeto.
- **Reflexión:** todos sus campos de texto pasan por el contraste disponible; los indicadores estructurados de deseos y construcción tienen sus verificadores específicos. Esto acredita cobertura del recorrido, no comprensión de cualquier frase.
- **Continuidad:** metas e intenciones siguen siendo revisables; `missed` no las cancela ni `done` acredita una operación física. Las propuestas anteriores y los cambios percibidos siguen separados. La muestra incluye compra, consumo y retorno posterior hacia la meta del molino; no demuestra que toda meta progrese ni autoriza atribuir un cambio a una propuesta concreta.

Módulos nuevos de esta iteración: `semantics/preconditions.ts` recibe acción/percepción y devuelve un problema observable o `null`; `semantics/attribution.ts` recibe texto, fuentes seleccionadas e identidad y devuelve una atribución contradictoria o `null`. Son funciones puras, sin red, persistencia ni lectura global. Los adaptadores continúan devolviendo los schemas canónicos.

## Muestra predefinida y conservación de evidencia

Artefactos locales: `packages/cognition/out/plan-closure-20260918/`.

Tres tandas, cada una con **seeds 84, 85 y 86, un día, dos personajes ingleses, tick 60 y fallback habilitado**. Las tres usan `deepseek/deepseek-v4-flash-0731` según sus manifests y comparten el engine. Cada tanda fija antes de comenzar los límites de 80 respuestas por corrida, 20 minutos y USD 0,50 de coste conocido acumulado. No se reutilizan directorios ni se descartan seeds desfavorables. No se comparan con las muestras históricas de tick 1 como si fueran equivalentes.

- `baseline-runs`: código congelado al inicio de esta iteración, conservado en `baseline/src`. **Ya incluía trabajo de iteraciones anteriores**; no es el sistema original de los casos históricos.
- `final-runs`: primera versión con privacidad y precondiciones. Su nombre es el del artefacto, no una certificación de calidad.
- `corrected-runs`: correcciones tras la primera comparación, incluida la selección explícita de producto. La tanda ya estaba cargada cuando se añadieron atribución posterior, nuevas expresiones de viaje, inversión de parentesco y limpieza de campos durante repair. No se adjudican esas correcciones a sus resultados en vivo.

Cada seed conserva `provider.log`, `usage.jsonl`, `inputs.jsonl`, `outputs.jsonl`, `events.jsonl`, `dialogue.jsonl`, snapshots inicial/final y `summary.json`. Los manifests registran modelos, revisión y hashes. `inputs.jsonl` es una serialización JSON de contexto: no conserva entradas de `Map`; los prompts exactos enviados están en `provider.log`. Los artefactos no contienen cabeceras de autorización.

## Resultados de las nueve simulaciones

Todas terminaron el día previsto. Una operación es una llamada a `plan`, `decide`, `converse` o `reflect`; una respuesta del proveedor puede corresponder a un intento de reparación. El uso facturado incluye las llamadas editoriales existentes, que se excluyen de la auditoría semántica y cuyo código no se modificó.

| Tanda | Operaciones | Salidas del modelo | Fallbacks | Respuestas facturadas registradas | Tokens entrada / salida | Coste conocido USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Referencia | 53 | 47 | 6/53 | 69 | 326.103 / 13.422 | 0,034984257017 |
| Primera versión | 50 | 40 | 10/50 | 70 | 319.464 / 15.865 | 0,025006701276 |
| Correcciones intermedias | 59 | 48 | 11/59 | 79 | 350.821 / 14.432 | 0,031935872577 |

**No hay evidencia de una reducción de fallbacks.** Tampoco se atribuye causalmente el coste menor a una optimización: cambian las decisiones, cantidad de operaciones y respuestas de un proveedor no determinista. La última tanda registra un error de transporte; una petición sin respuesta puede tener facturación desconocida.

| Métrica operativa | Referencia | Primera versión | Correcciones intermedias |
| --- | ---: | ---: | ---: |
| Intentos rechazados, sin contenido editorial | 19 | 26 | 25 |
| Repair: preservada / reconsiderada / drift, según diagnóstico | 4 / 2 / 1 | 3 / 3 / 1 | 7 / 0 / 2 |
| Decisiones idénticas consecutivas por agente / decisiones aceptadas | 3/37 | 2/32 | 2/38 |
| Repeticiones sin cambio observado en el estado medido | 0/3 | 0/2 | 0/2 |
| Errores de transporte registrados | 0 | 0 | 1 |

Las siete repeticiones de decisión tuvieron algún cambio de inventario, monedas, ubicación, empleo o descenso del hambre; su causa sigue desconocida y eso **no prueba avance hacia el objetivo**. La última tanda repitió dos conversaciones completas: `corrected/84/19` y `corrected/85/13`; se añadió después la instrucción de continuar el habla anterior, sin afirmar que ese cambio de prompt ya eliminó los bucles. Latencia por operación, por seed: referencia 8,13/7,06/8,17 s; primera versión 9,97/6,53/7,33 s; última tanda 12,04/12,03/7,92 s. Cifras exactas en `counters.json`. No es una comparación de latencia para entradas idénticas.

Los estados de repair son contadores del código, **no etiquetas independientes de corrección**. La revisión identificó al menos cinco diagnósticos iniciales incorrectos entre los 70 intentos rechazados: asociación vacía, campo `food` ajeno al schema, `Nothing bought`, investidura figurada y usar monedas para comprar. Se corrigieron y probaron. Un diagnóstico inicial incorrecto no acredita que el resto de esa salida fuese válido; en varios casos también había recuerdos inventados. No se clasificaron exhaustivamente los otros 65 rechazos como verdaderos/falsos.

## Auditoría independiente de salidas aceptadas

`manual-audit.json` contiene una etiqueta por operación y referencias a contexto, diálogo o eventos. Se generó mediante revisión del contenido, sin usar la aceptación del validador como prueba de verdad. `current-validator-replay.json` es una comprobación offline separada con el código posterior; nunca sustituye esta auditoría.

| Hallazgos confirmados / salidas aceptadas | Referencia | Primera versión | Correcciones intermedias |
| --- | ---: | ---: | ---: |
| Intención/comando | 0/47 | 2/40 | 1/48 |
| Emisor cambiado | 1/47 | 0/40 | 0/48 |
| Historia física contradictoria | 2/47 | 0/40 | 2/48 |
| Significado del recuerdo cambiado | 1/47 | 0/40 | 1/48 |
| Salidas con incertidumbre explícita en la revisión | 1/47 | 1/40 | 1/48 |

El denominador cuenta salidas, no afirmaciones individuales ni exposiciones equivalentes. No hay escenas verificadas de liquidación informal en estas simulaciones: **0/0, sin cobertura**, no una tasa de éxito del 100 %. La opinión sobre las existencias de harina, la expansión de «mi lugar» a «mi panadería» y un viaje verdadero sin recibo en el contexto seleccionado quedan explícitamente inciertos.

Casos que motivaron correcciones durante esta iteración:

- `baseline/85/13`: Petar recuerda como declaración de Rosa su propia afirmación sobre la harina.
- `baseline/86/4`, `corrected/84/7`, `corrected/86/13`: viaje recordado dentro de la propuesta que todavía debe realizarlo.
- `final/85/4` y `/6`: sopa en la intención, pan en los eventos 9 y 13.
- `corrected/85/13`: dirección de la búsqueda del hermano invertida.
- `corrected/86/9`: desplazamiento narrado dentro de `do`, que solo pasa el minuto.

Todos esos casos tienen regresión y rechazo en el replay del código posterior. Las muestras originales siguen contando sus errores. **No se realizó otra matriz completa con todas las correcciones posteriores.**

## Pruebas controladas y proveedor real

`critical-regressions.json` compara fuentes de HEAD con el código actual usando las mismas respuestas HTTP sintéticas y el mismo engine. Las cinco regresiones R1/R2/R3/R4a/R4b se entregaban antes; ahora se rechazan tras el presupuesto de dos respuestas, en modo estricto. Los controles positivos, reparaciones válidas y fallbacks están en la suite. No se presenta HEAD como una reconstrucción de toda la configuración histórica original.

La repetición real dirigida `strict-replay/` usa los requests históricos más instrucciones nuevas; el contexto de comprobación de diálogo/reflexión está parcialmente reconstruido. Obtuvo **4/5 casos aceptados, 7 respuestas, USD 0,004278265**, sin fallback. R1 devuelve consumo, R2 reconsidera explícitamente una compra de harina que el mostrador no ofrece, R4a conserva compra sin recuerdo de consumo y R3 preserva habla/condición. R4b falla ambos intentos por afirmar compras repetidas sin respaldo suficiente; no se entrega una reflexión falsa. Este replay no certifica el prompt público nuevo del diálogo.

Coste conocido total de esta iteración de evaluación: **USD 0,09620509587**, 225 respuestas registradas. El error de transporte queda fuera de cualquier afirmación de facturación completa.

Verificación del repositorio: `pnpm typecheck` en ocho paquetes y `pnpm test` en las seis tareas de pruebas: **523 tests, 291 de cognition**, todos correctos. Servidor y headless comprueban persistencia y aislamiento del logger. Los conteos definitivos y hashes quedan en `verification.json`; `latest-src/` conserva las fuentes posteriores a todas las correcciones. Las pruebas de engine, web y store se reutilizaron desde la caché de Turbo cuando sus inputs no cambiaron.

## Frontera de cambios y archivos de logs

Se cotejaron los 59 archivos protegidos del baseline de engine/protocol. El único distinto es `engine/src/packs/island.ts`, restaurado por autorización previa. `island.ts` y `personas.ts` coinciden byte a byte con sus respectivos `- copia.ts` ingleses. El contexto editorial coincide con el baseline. No se modifica lógica del engine, protocolo ni la gaceta.

Para el comando habitual `pnpm --filter @unwatched/headless soak -- ... --out out/nombre`, los logs quedan en **`apps/headless/out/nombre/`**:

- `dialogue.jsonl`: solo habla de eventos confirmados, con hablantes.
- `run.log`: diagnósticos del proveedor, validación, reparaciones y progreso que emite headless.
- `run.json`: estado, configuración y finalización/fallo/interrupción.
- `events.jsonl`, `summary.json`: eventos y balance de la simulación.

La prueba histórica `apps/headless/out/openrouter-deepseek-hola/` conserva eventos/diálogo, pero no se le inventaron retrospectivamente `run.log` ni `run.json`. La prueba de persistencia está en `apps/headless/out/coherence-logs-iteration11/`. Véase [guía de logs](openrouter-console-logs.md).

## Objetivos que no se cierran por falta de evidencia

1. **P5.3 — saldo de acuerdos informales.** Entrega y transferencia se registran por separado. Los eventos actuales no siempre asignan una transferencia a un acuerdo concreto ni certifican su saldo. `outstanding: unknown` es la conducta implementada; no es un sistema de liquidación. Hacerlo general exige una fuente inequívoca de asignación, no más inferencia narrativa.
2. **P5.5 — fidelidad general de recuerdos.** Quedan casos concretos: `baseline/84/19` niega haber visto una panadería a la que el agente llegó; `baseline/85/11` transforma una posible aceptación de ayuda en un rechazo. Ampliar indiscriminadamente expresiones regulares puede aumentar falsos rechazos. Estos casos requieren una representación de afirmaciones con tiempo, negación y modalidad más completa; quedan en el plan con sus capturas, sin prometer solución universal ni añadir llamadas de diálogo.
3. **P8.3 — certificación final de calidad.** No se marca el plan como 100 % terminado: las muestras tuvieron recurrencias, la escena de liquidación no tuvo exposición real y la última ronda de correcciones tiene verificación local/offline, no una nueva matriz completa. Los módulos y métricas acreditados sí se marcan terminados. La gaceta sigue excluida y no constituye trabajo pendiente.
