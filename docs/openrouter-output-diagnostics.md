# OpenRouter: salida vacía o truncada

## Diagnóstico y recorrido del código

`packages/cognition/src/openrouter.ts` elige modelo/tier y construye contextos separados de decide, converse, plan y reflect. `provider/openrouter.ts`, método `call`, convierte el schema Zod y arma el body. Su método `post` envía `POST https://openrouter.ai/api/v1/chat/completions` con timeout de 45 s para routine/stakes y 90 s para reflect (variables `UW_OR_TIMEOUT_MS` y `UW_OR_TIMEOUT_REFLECT_MS`).

La selección usa `UW_OR_MODEL_ROUTINE`, `UW_OR_MODEL_STAKES` y `UW_OR_MODEL_REFLECT`; `modelsFor` puede sobrescribirlos por ciudadano y el servidor aplica reglas de presupuesto y suscripción. El tier selecciona el slot; antes no configuraba reasoning. La configuración local actual usa `deepseek/deepseek-v4-flash-0731`; el identificador canónico de generación puede figurar como `deepseek/deepseek-v4-flash-20260731`.

| Operación / nombre del request | Slot base | max_tokens inicial |
| --- | --- | ---: |
| decide / action_proposal | routine; stakes con tier >= 2 | 1024 |
| converse / dialogue | routine | 1500 |
| plan / day_plan | routine; stakes con tier >= 2 | 1200 |
| reflect / reflection | reflect; stakes en noche tranquila sin reflexión incluida | 2000; 900 si tranquila |
| enrich / persona_depth | reflect | 900 |
| digest | stakes | 700 |
| child | stakes | 900 |
| writePaper / paper | reflect | 3000 |
| judge / judgement | routine | 400 |
| life | reflect | 3200 |

El schema va tanto en el system prompt como en `response_format: {type: "json_schema", json_schema: {name, strict: true, schema}}`. `cleanSchema` elimina pattern/default/$schema y convierte oneOf a anyOf. Sólo los modelos OpenAI usan además `strictSchema` y normalización de nulls. Los demás conservan su schema actual; la validación final siempre usa Zod.

`post` extrae exclusivamente `choices[0].message.content`; los campos de reasoning no son la respuesta JSON. `call` quita fences JSON, usa `JSON.parse`, aplica límites de prosa y `schema.safeParse`. El log exacto `not json from ...` nace en el catch de `JSON.parse` dentro de `OpenRouterProvider.call`.

## Causa comprobada

El catálogo público consultado para V4 Flash 0731 indica reasoning opcional, habilitado por defecto en high. OpenRouter documenta que, en la mayoría de proveedores, reasoning y contenido visible consumen el mismo `max_tokens`. La muestra con 1200 tokens nativos de salida, 994 de reasoning y `finish_reason=length` es consistente con agotamiento del presupuesto antes de completar el JSON. Antes se ignoraba `finish_reason`, y se repetía una petición vacía con el mismo límite.

El otro registro aportado (`cancelled=true`, `streamed=true`, finish_reason null, 2 tokens) no demuestra truncamiento. Muestra un 429 de DeepInfra y un 200 de OpenInference. Puede corresponder a cancelación/desconexión; no alcanza para atribuirla a timeout de nuestro proceso. El cliente de este repositorio consume una respuesta JSON completa, no SSE; ahora envía `stream:false` explícitamente.

## Corrección limitada al adaptador

- Para los dos identificadores de DeepSeek V4 Flash 0731 se envía `reasoning: {enabled:false}`. Se mantienen los límites originales destinados al JSON y la política de otros modelos.
- `provider.require_parameters=true` exige soporte declarado para los parámetros solicitados. No fija un proveedor ni garantiza por sí solo que cualquier implementación sea perfecta.
- Se conserva `finish_reason`, proveedor, generation id y tokens de reasoning en `onUsage` y logs de metadatos. No se registra el Authorization ni el texto interno de reasoning.
- Una salida `length` se rechaza incluso si parece JSON válido. Se reintenta una sola vez con el doble del límite original, sin adjuntar el fragmento truncado. Si persiste, se informa `finish_reason=length` al fallback.
- Errores incluidos en HTTP 200 y finalizaciones distintas de stop/length no se aceptan como respuestas válidas.
- JSON vacío/incompleto sin length conserva la reparación existente (máximo dos intentos de formato); un mismatch recibe una nota con el campo incorrecto. Un timeout no se reenvía porque el consumo previo es incierto. Los 429/5xx conservan un reintento HTTP. Estos reintentos HTTP pueden ocurrir dentro de cada uno de los dos intentos de formato.
- El servidor usa `allowFallback:false`: no entrega MockBrain como respuesta válida. `enrich` retorna null al fallar; las demás operaciones propagan indisponibilidad. El headless original permite fallback; no debe confundirse con una verificación del proveedor.

No cambia engine, context builders, prompts por operación, schemas de negocio ni selección de tiers.

## Verificación y repetición

Prueba real completada el 17-09-2026: 5 operaciones válidas en 42,865 s, todas con `finish_reason=stop`; cero reintentos, fallbacks, mismatches o timeouts observados. Proveedores: DeepInfra, OpenInference y Alibaba. Prompt: 14.601 tokens; completion: 1.212; cached: 7.278; reasoning: 0. Coste total informado: USD 0,001468808 (media USD 0,0002937616 por llamada). Los cached son parte del prompt, no se suman otra vez. Es una validación de contratos, no una prueba de comportamiento de una simulación prolongada.

Artefactos conservados en `out/cognition-live-2026-09-17T21-14-11-606Z/`: `calls.jsonl`, `provider.log`, `outputs.jsonl`, `summary.json`. Checks locales: cognition 51 tests, server 49 tests y typechecks de ambos correctos.

```powershell
cd C:\Users\cleka\Documents\simIA
pnpm --filter @unwatched/cognition test
pnpm --filter @unwatched/cognition typecheck
pnpm exec tsx packages/cognition/scripts/verify-openrouter.ts --live
```

El último comando consume OpenRouter real usando la clave y modelos de `.env`. Hace cinco operaciones secuenciales sobre contextos de prueba del engine, no una simulación de un día. No ejecuta ticks ni llamadas al brain de fixture; todas las respuestas cognitivas se obtienen de OpenRouter con fallback deshabilitado. Termina tras las cinco operaciones o el primer fallo. Conserva `calls.jsonl`, `provider.log`, `outputs.jsonl`, `summary.json` y, si hay fallos, `failures.jsonl` en una nueva carpeta `out/cognition-live-<fecha>`.

Para aplicar el cambio a un servidor ya iniciado con `start`, reiniciarlo. No usar el script server `dev`, que fuerza mock:

```powershell
$env:PORT='4100'
$env:UW_BRAIN='openrouter'
pnpm --filter @unwatched/server start
```

El servidor es continuo y consume modelos mientras simula; detenerlo con Ctrl+C al terminar.

Referencias oficiales: [reasoning y presupuesto de salida](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [structured outputs y soporte de proveedores](https://openrouter.ai/docs/guides/features/structured-outputs), [catálogo de modelos](https://openrouter.ai/api/v1/models).
