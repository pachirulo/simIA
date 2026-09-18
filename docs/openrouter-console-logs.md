# Logs legibles de OpenRouter en consola

Por defecto la consola muestra líneas breves: agente e identificador de llamada,
operación, modelo consultado, tokens/caché/coste, propuesta normalizada y motivo,
rechazo o reparación, y confirmación de OpenRouter con generation ID. No imprime
prompts, schemas, respuestas crudas ni objetos completos de metadata.

Los resúmenes largos se acortan con `…`. Una propuesta válida no acredita ejecución
del engine. La simulación, los prompts enviados y la política de reparación no cambian.

Ejemplo ilustrativo:

```text
[LLM 23:30:00 ag_1 a1b2c3d4] action_proposal | consultando deepseek/deepseek-v4-flash-0731 · intento 1/1
[LLM 23:30:02 ag_1 a1b2c3d4] action_proposal | DeepInfra · tokens 2177 entrada / 41 salida · caché 0 · $0.000138 · 2.0s · fin=stop
[LLM 23:30:02 ag_1 a1b2c3d4] action_proposal | propuesta válida: {"kind":"use","item":"bread"} · motivo: Tengo hambre
```

## Modo detallado (opcional)

Sólo con `UW_OR_LOG_CONTENT=1`, cada línea empieza por `openrouter <evento>` seguida de un objeto JSON completo.
El servidor añade su prefijo `[town]`. Los saltos dentro de textos se codifican
como `\n`: son strings completos, sin truncamiento del nuevo registro estructurado.

| Evento | Contenido |
|---|---|
| `request` | Body exacto del POST: mensajes system/persona/user, reparaciones, response_format/schema, modelo, límites y parámetros. No headers de autenticación. |
| `response` | ID, proveedor, finish reason, tiempo local del intento, tokens, caché, coste, usage completo y respuesta completa antes de normalizar/validar. |
| `validation` | accepted/not_json/schema_mismatch/semantic_mismatch/truncated, causa y si habrá reparación. En accepted incluye el valor normalizado que devuelve cognition; no acredita ejecución del engine. |
| `generation` | Metadata real leída por API y enlace al log de OpenRouter. Conserva sus nombres de campos y valores null. |
| `generation_unavailable` | ID y causa cuando la consulta no fue posible, no hay ID o se alcanzó el límite de consultas concurrentes. No es un fallback del modelo. |
| `http_error` / `transport_error` | Estado HTTP o causa de transporte con correlación y duración. Los diagnósticos de error anteriores también se conservan. |

`callId` enlaza la operación lógica completa; `agentId`, `kind`, `model` y `slot`
identifican su contexto. `attempt` identifica el intento de respuesta/reparación;
`httpAttempt` distingue reintentos de transporte. El `id` de respuesta enlaza con
su propia generación. Así dos llamadas simultáneas o dos reparaciones no se mezclan.

El objeto `metadata` incluye los campos entregados por OpenRouter: tokens
normalizados (`tokens_prompt/completion`) y nativos (`native_tokens_*`), caché,
descuento, coste final, latencia/generation_time, modelo canónico, proveedor,
finish reason nativo, streaming/cancelación e intentos de proveedores. No se suman
ni se sustituyen contadores de distinto origen. `durationMs` es el tiempo local
del intento, separado de los tiempos informados por OpenRouter.

La fuente de estos datos es [GET generation](https://openrouter.ai/docs/api/api-reference/generations/get-generation),
consultado con el generation ID y la misma clave que realizó la llamada. No se
necesita el navegador ni GET generation/content: los mensajes y respuesta exactos
ya se registran localmente en el momento de enviarlos/recibirlos.

## Configuración

Configuración predeterminada cuando existe un logger:

```dotenv
UW_OR_LOG_CONTENT=0
UW_OR_LOG_GENERATION=1
```

`UW_OR_LOG_CONTENT=0` usa el resumen legible de métricas y decisiones;
`UW_OR_LOG_CONTENT=1` recupera los JSON completos para una depuración puntual. `UW_OR_LOG_GENERATION=0` desactiva las consultas GET adicionales;
continúan los datos inmediatos de la respuesta. `OpenRouterBrainOptions` y
`ProviderOptions` también aceptan `logContent`/`logGeneration` como booleanos que
tienen prioridad sobre el entorno. Sin un logger no se hacen consultas de logs.

Un servidor ya iniciado necesita reiniciarse para cargar el código actualizado.
Los logs completos incluyen la información privada del personaje que forma parte
del prompt, únicamente en el destino técnico del logger; no pasan al periódico.
No se registran headers Authorization ni se añade la clave al body registrado.

## Ejecución y límites

La metadata se consulta en segundo plano: la decisión no espera su publicación.
Hay hasta cuatro GET por generación (inicio, y esperas de 1, 4 y 12 segundos),
con timeout de 5 segundos y máximo 32 generaciones pendientes por proveedor local.
404/429/5xx y errores de transporte tienen reintento acotado; otros errores se
registran directamente. No se repite el POST al modelo por un fallo del logger.
Estas lecturas no llaman a `onUsage`, no duplican costes y no disparan fallback.

`await brain.flushLogs()` permite esperar la metadata pendiente al terminar un CLI,
con límite de 40 segundos. Headless lo hace después de finalizar la simulación y
escribir sus resultados. Los timers de reintento no mantienen por sí solos un
proceso en ejecución. Si el logger falla, el resultado del modelo se conserva.

## Verificación

- Cognition: 116 tests, incluidos contenido completo, UTF-8, normalización,
  correlación entre reparaciones, 404 temporal, errores persistentes, límite de
  concurrencia, clave ausente del log y logger defectuoso.
- Prueba real: `gen-1789698593-g1gkQmXIoo2bPlxgXECw`, DeepInfra,
  2.177 tokens de entrada, 41 de salida, USD 0,000138. Una respuesta del modelo.
  Se obtuvieron request, response, validation y generation con el mismo ID.
- La metadata apareció unos 18 segundos después de la respuesta; la decisión
  no esperó. Se observó `sell:""` en la respuesta cruda y su omisión en el valor
  normalizado. El artefacto es una prueba de logging, no de conducta del agente.
- Evidencia local: `out/openrouter-console-logging/provider.log` y `summary.json`.

Implementación: `packages/cognition/src/provider/logging.ts` centraliza formato,
enriquecimiento y aislamiento de errores; `provider/openrouter.ts` emite los
registros en los límites reales de request, respuesta y validación. Sin nuevas
dependencias.
