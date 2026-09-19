# Continuidad entre intención y acción

## Alcance

Cambios acotados a `packages/cognition`: preparación de contexto, memoria de trabajo del adaptador y validación de respuestas. Sin cambios en engine, protocolo canónico, salience, hábitos, presupuestos, número de acciones por tick, conversaciones ejecutadas por el mundo ni persistencia de agentes.

La referencia es `apps/headless/out/openrouter-deepseek-YYYYMMDD`: 2 días, 2 agentes, seed 84, 122 eventos. Los tiempos de las acciones avanzan de 60 en 60 minutos. Se reprodujo ese intervalo con `--tick 60`; el resumen original no guarda los argumentos del tick. No equivale a una simulación con ticks de un minuto.

## Causas verificadas

- La decisión era independiente de la anterior. El `intent` de una propuesta llega a los eventos, pero no existe un historial de propuestas dentro de `Perception`. Sus ocho recuerdos se eligen por relevancia, importancia y recencia: no garantizan la última conversación ni el último intento.
- `AgentState.heading` guarda un destino de viaje, pero no se exponía al modelo. Tampoco se exponían directamente sus intenciones persistentes en el contexto de decisión.
- `today.steps.done` puede significar únicamente presencia en el lugar/hora o haber gastado un pensamiento. El modelo podía interpretarlo como trabajo realizado y olvidar objetivos con `missed: true`.
- Las conversaciones recibían personalidad, metas y recuerdos, pero no inventario, monedas ni estado físico actual. Podían reafirmar un propósito y resumir una salida como realizada sin movimiento alguno.
- El modelo confundía efectos: vender pan para cobrar se justificaba como comprar sopa y comerla. Se confirmó por la API de OpenRouter, no por la apariencia de un JSON válido.
- `DayPlan.steps[].do` era opcional en el schema enviado, pese a ser obligatorio en el contrato semántico. Hubo planes sin actividad, reparaciones fallidas y sustitución por MockBrain.
- Un string opcional nulo, por ejemplo `desire_id: null`, podía invalidar una acción física correcta y causar una reparación/fallback innecesaria.

Generaciones originales consultadas mediante `GET /api/v1/generation/content?id=...`, guardadas en `out/continuity-review/`:

- `gen-1789702439-ga5udodtm7GVT8YXOArw`: vender pan con intención de obtener sopa y calmar el hambre; cuatro panes en inventario, hambre 1.
- `gen-1789702444-lGs0nlAjo9gYuYPNSyPy`: `sell: bread` con intención de comprar sopa; además, destino de comercio incorrecto.
- `gen-1789702420-6mlOzY7FOyyru7GbmLUZ`: conversación sobre ir al molino.
- `gen-1789702454-rOfPq1m2V1K5eWx6lm4E`: finalmente `use: bread` a las 23:00 del segundo día.

## Implementación

`context/continuity.ts` contiene dos piezas:

1. `DecisionContinuity`, una `WeakMap` por objeto de agente y por instancia de Brain. Guarda hasta tres propuestas válidas devueltas por el modelo, durante un máximo de 1.440 minutos. Compara la siguiente percepción con el estado previo: lugar, inventario, monedas, empleo, hambre y descanso. Etiqueta las diferencias como observaciones, sin atribuir causalidad ni inferir aceptación/rechazo. No conserva candidatos rechazados por la validación, ni transforma una propuesta en resultado.
2. `personalContinuity`, lectura acotada de datos del propio agente: destino, hasta tres intenciones y hasta dos fragmentos recientes de conversación omitidos por `recent`/`heard`. Las fuentes siguen siendo habla o interpretación; no se extraen órdenes de frases ni compromisos del interlocutor. No modifica recuerdos del engine.

Los adaptadores OpenRouter y Anthropic usan el mismo contexto. No hay llamadas adicionales a otro modelo para extraer metas, ni cola de acciones que se ejecute sin una decisión. Un aviso de continuidad pide reconsiderar el próximo paso o explicar una postergación voluntaria; permite seguir hablando, vender alimentos o cambiar de opinión.

El contexto dinámico también:

- distingue asistencia al horario de finalización del objetivo;
- conserva los IDs de destinos ya presentes en el plan;
- muestra comida transportada y el efecto separado de comprar, vender y consumir;
- da estado físico/recursos al escritor de conversaciones como información privada para motivar al personaje, no como contenido que deba revelar;
- recuerda que una persona ausente no ha dado un precio, consentimiento o garantía de disponibilidad.

`CognitiveDayPlan` exige actividad en los planes nuevos del LLM, manteniendo salida compatible con `DayPlan`. El schema canónico y los planes antiguos no cambian. Se omiten los nulos únicamente en strings opcionales no anulables; los campos requeridos, números, booleanos y nulos permitidos conservan su validación.

La validación semántica detecta un `move` al lugar actual y destinatarios de `say` ausentes/dormidos, conservando los alias de nombre que admite el resolver. No rechaza una conversación por no producir progreso económico ni fuerza una acción de supervivencia.

## Caché y tamaño

Se conserva el prefijo de decisión, byte por byte: reglas globales → persona. La continuidad va después, en el mensaje dinámico, junto a mecánicas y percepción. No se cambia ni se elimina ningún campo de la percepción serializada.

Medición offline con el tokenizer local de DeepSeek, escenario de tres anuncios de partida: 73 tokens de continuidad personal y 170 de historial/diferencias, 243 en total. Es contenido nuevo útil, no un ahorro garantizado. Los tamaños dependen de recuerdos y acciones; se limitan historial, extractos e intenciones para evitar crecimiento ilimitado. La prueba verifica que el prefijo estable no cambia. Los contadores de distintos proveedores de OpenRouter no son una medida homogénea del tamaño del texto.

## Verificación reproducible

```powershell
pnpm --filter @unwatched/cognition test
pnpm --filter @unwatched/cognition typecheck
pnpm --filter @unwatched/cognition exec tsx scripts/check-continuity.ts --live
pnpm --filter @unwatched/headless soak -- --days 2 --agents 2 --brain openrouter --seed 84 --tick 60 --out out/continuity-final-seed84-tick60
```

El diagnóstico `--live` usa la clave/modelos del `.env` y genera gastos de OpenRouter. Es optativo, no forma parte de los tests automáticos. Guarda propuestas, métricas y resultados reales de `Town.apply` en `out/continuity-review/live/`.

Las dos secuencias dirigidas con modelo real se completaron: comprar pan → consumirlo, y anunciar una visita → tres movimientos reales hasta el aserradero → comprar `timber`. Seis respuestas, seis acciones aceptadas; ningún fallback. La harina no se sustituyó artificialmente por otro resultado: la segunda prueba usa una mercancía que el escenario realmente vende.

Uso de esa prueba dirigida: 13.037 tokens de entrada, 327 de salida, USD 0,00092788. IDs: `gen-1789703994-FxC7lHNRmCfB7lBWYODq`, `gen-1789703996-W7yzmF9bop7VMnS7gb95`, `gen-1789704000-SUf32HMOtor7w9TPNtLF`, `gen-1789704004-BGTWurIzdOatNILRe0Il`, `gen-1789704008-vTYCHCJer8LBObErbz6u`, `gen-1789704009-YYxbqnDYziIXl9TefQ8l`.

### Corrida completa con la versión final

| Medida | Referencia anterior | Versión final |
| --- | ---: | ---: |
| Compras de comida | 13 | 7 |
| Ventas de comida | 4 | 0 |
| Comidas consumidas (`agent.eat`) | 5 | 7 |
| Visitas reales al molino | 0 | 2 (Pedro) |
| Agentes con empleo al terminar | 0/2 | 2/2 |
| Acciones `say` | 22 | 6 |
| Conversaciones completas | 5 | 3 |
| Mayor racha de `say`, Inés / Pedro | 9 / 8 | 2 / 2 |
| Rechazos del engine | 4 | 2 |
| Llamadas con respuesta contabilizada | 71 | 56 |
| Tokens de entrada contabilizados | 317.522 | 227.321 |
| Tokens de salida contabilizados | 11.366 | 9.877 |

La racha cuenta eventos propios `say` consecutivos entre movimientos, compras/ventas, comidas, sueño y trabajo, no minutos sin hacer nada. El tiempo entre primera compra y primera comida bajó de 4 horas para ambos a 2 horas para Inés y 1 hora para Pedro. No significa que cada compra posterior se consuma inmediatamente.

La versión final registró 44 respuestas `action_proposal` (incluidas reparaciones), media 4.397,18 tokens de entrada. No hay logs completos de llamadas de la referencia para calcular su media o coste con rigor. Sus totales de uso proceden del resumen de consola conservado; los comportamientos proceden de los JSONL de eventos de ambas corridas.

Se consultó la API `/generation` para los 56 IDs finales, guardados en `out/continuity-review/final-api/`: 227.321 tokens nativos de entrada, 9.877 de salida, 66.140 de caché y **USD 0,02264811**. El importe cubre esas generaciones identificadas; no permite determinar la facturación de una petición que expiró sin devolver ID. OpenRouter distribuyó las llamadas entre nueve proveedores; no se atribuye la reducción de tokens totales exclusivamente al texto nuevo.

Validación de respuestas final: **0 errores de JSON/schema**, 5 rechazos semánticos (dos destinatarios ausentes, trabajo fuera de horario y dos propuestas de consumir comida no transportada). Hubo dos fallbacks: un plan por timeout de 45 segundos y una decisión tras repetir `use` sobre un ítem ausente. Por ello la corrida completa es mixta. La prueba dirigida anterior desactiva fallback y sí verifica exclusivamente decisiones reales del modelo.

Los dos rechazos del engine finales se conservan como evidencia: a minuto 1980 Inés se movió después de la percepción y antes del `say` de Pedro; a minuto 2340 Pedro propuso `do` con `with: "./mill"`, interpretado como una persona inexistente. No se repararon cambiando reglas de ejecución. Además, las reflexiones todavía inventaron detalles de una avería y falta de harina: mejorar continuidad física no garantiza fidelidad narrativa.

La primera corrida diagnóstica, previa al ajuste del schema de plan y los nulos, queda en `out/continuity-seed84-tick60` dentro de headless. No se mezcla con la comparación final. El clima del segundo día también difirió (viento en la referencia, tormenta en la corrida final), y las respuestas LLM no son deterministas. Estos resultados son evidencia de mejora observada, no un experimento controlado ni una garantía universal.

Verificación local: **129 tests de cognition y 96 del engine aprobados**, typecheck de cognition, headless y server; `git diff --check` sin errores. Doce tests nuevos cubren continuidad, aislamiento por agente, expiración, compatibilidad de planes, normalización, integración compra/consumo y caracterización de los límites del engine.

## Problemas del engine detectados y NO corregidos

1. **Plan completado por presencia/pensamiento.** `progressPlan` marca `done` al estar en el lugar desde la hora prevista; `noteThought` también lo marca al gastar el pensamiento. No verifica comer, negociar o producir. Un test reproduce `done: true` sin evento de comida. Una solución en engine necesitaría separar estado del horario y evidencia de cumplimiento, conservando por separado los disparadores de salience. Cognition solo explica el significado real del campo.
2. **Observación falsa por hambre.** `decayNeeds` puede escribir «I am very hungry and have nothing to eat» sin comprobar inventario. La generación original de las 21:00 contiene esa observación y cuatro panes simultáneamente. El cambio necesario sería eliminar la afirmación de ausencia o comprobar existencias antes de escribirla. No se borran ni reescriben esas memorias externamente.
3. **Destino pendiente por encima de una compra para comer.** En el camino de hábitos, `heading` reemplaza acciones distintas de `sleep`/`use`, incluida la compra de comida disponible. Un test reproduce hambre .9, 40 monedas, pan local y destino `mill`: camina a `hill`, sin comprar. Revisar esa prioridad exige un cambio explícito del engine; no se modifica desde cognition.
4. **Ticks largos cambian el comportamiento.** Las necesidades decaen por `minutesPerTick`, pero cada tick ofrece una sola operación física por agente. Con 60, comprar y comer pueden requerir dos horas y tres caminos tres horas. No se agregan acciones ni se alteran cadencias para esconderlo. Para evaluar el comportamiento normal hay que contrastar también `--tick 1`.

## Límites del escenario y de la solución

- El molino del pack tiene stock de harina, pero no la vende en su `sells`. La prueba verifica que `trade buy: flour` allí se rechaza. Tener stock no implica disponibilidad comercial. Es una limitación del escenario, no un fallo probado del validador.
- Con dos agentes no existe el molinero adicional supuesto por la charla. Visitar el edificio sí es posible; negociar con una persona inexistente o materializar crédito hablado, no. Cambiar eso requeriría población/oferta real, fuera de esta corrección.
- El historial del adaptador no tiene recibos de ejecución. Las diferencias de estado pueden incluir hábitos y otros eventos; una acción sin cambio visible puede ser válida. No se presenta como completada ni rechazada por deducción.
- La memoria de trabajo se pierde al reiniciar Brain; intenciones, planes y recuerdos persistentes se vuelven a leer. No se crea persistencia paralela al engine.
- La continuidad no crea más turnos ni garantiza que el modelo elija bien. Quedan riesgos de alucinación de interlocutores, efectos o recuerdos y variación entre proveedores. Las métricas de una sola corrida no prueban equivalencia ni una tasa garantizada de mejora.
- MockBrain/fallback conserva su política previa. Los resultados que lo usen deben identificarse como mixtos, no atribuirse íntegramente al modelo real.
