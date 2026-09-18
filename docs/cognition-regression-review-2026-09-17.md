# Regresiones de cognition: revisión por API y correcciones

## Evidencia y alcance

Se recuperaron **26 generaciones** de la tanda del 17/09, 21:42–21:45 hora local,
usando los generation IDs y ambos endpoints autenticados de OpenRouter:

- `GET /api/v1/generation?id=...`: proveedor, tokens, caché y coste.
- `GET /api/v1/generation/content?id=...`: mensajes y completion originales.

Se usó `OPENROUTER_API_KEY` de `.env`, sin imprimirla. No se usó navegador en esta
revisión. Los JSON de la API están en `out/openrouter-review-2026-09-17/api`.
Cuatro percepciones/respuestas exactas quedaron como fixtures de regresión en
`packages/cognition/test/fixtures/openrouter-regressions.json`.

La tanda original contiene 19 respuestas de decisión (incluyen cuatro reparaciones),
tres planes (incluyen una reparación), un diálogo, dos reflexiones y un periódico.
La API suma 80.555 tokens nativos de entrada, 3.988 de salida, 25.730 cacheados y
USD 0,005110815. Sus contadores normalizados son distintos: 64.248/3.310. No deben
mezclarse ambos tipos de contador en comparaciones.

Esta corrección modifica exclusivamente preparación/validación de cognition,
tests y documentación. No hay diff en engine, protocolo ni apps. No cambia
Perception, simulación, memoria persistida, conversaciones ni schemas canónicos.
Se conservaron los cambios de optimización y validación semántica anteriores.

## Causas y cambios

1. **Opcionales vacíos tratados como nombres inválidos.** En
   `gen-1789692217-ZD1y6gKFhx6LxqsMuSrt`, una compra de pan con `sell:""`
   era ejecutable. La reparación `gen-1789692222-rUUmybUPlz5PO988GqFV` la convirtió
   en una venta de pan no transportado. `schema/normalize.ts` ahora omite strings
   opcionales vacíos/blancos antes de la validación canónica y semántica de
   OpenRouter. Recorre objetos, arrays y variantes discriminadas por `kind`,
   incluidos pasos de skills. Conserva campos requeridos, nulls, cero, false y
   strings no vacíos. Anthropic aplica la misma normalización tras su parseo SDK
   y antes del control semántico; el parseo previo del SDK sigue siendo su límite.
   No reescribe compras, ventas o importes. El replay automatizado acepta la
   compra en una sola respuesta y verifica ejecución equivalente en el engine
   original. Se evita la reparación que la empeoraba.

2. **Datos útiles presentes pero poco destacados, y alojamiento sin ubicación.**
   El contexto dinámico muestra alimentos transportados reconocidos por experiencia;
   diferencia consejo no verificado y objetos no clasificados; enumera IDs de
   destinos conocidos y personas despiertas presentes; añade el alojamiento propio
   desde `AgentState.home`. Mantiene íntegro el JSON de Perception. El mapa es
   parcial, no un allowlist nuevo. No inventa un catálogo de alimentos ni consulta
   inventarios ajenos. Para descansar fuera de su alojamiento señala el destino
   conocido y que dormir requiere una cama local.

3. **Planes sin actividad.** El prompt pide `{hour, do, place}` y `planIssue`
   detecta `do` ausente/blanco. El schema canónico mantiene su compatibilidad.
   Una actividad escrita sigue siendo una intención, no prueba de factibilidad
   ni de ejecución.

4. **Errores de referencias convertidos en conclusiones físicas.** La reflexión
   etiqueta `no such place/person/agent` como referencia sin resolver. Conserva el
   texto original y distingue estos fallos de `no bed here`, falta de dinero o
   impedimentos físicos reales. También da la ubicación del alojamiento pagado.

5. **Información privada y declaraciones confundidas con hechos públicos.**
   `gen-1789692311-ShGwdUmScoGlY6VwCuQW` recibió un evento `would now say of
   themself` dentro del periódico. El engine actual ya filtra `agent.self`; el
   log demuestra una entrada anterior/incompleta, no que ese filtro actual falle.
   Cognition filtra defensivamente los formatos de eventos privados conocidos,
   también antes del fallback. Separa eventos públicos registrados de declaraciones
   que requieren atribución. El calendario se presenta como la agenda suministrada,
   sin invitar a completar fiestas/reuniones. No cambia el system prompt editorial.

## Verificación

- `pnpm --filter @unwatched/cognition typecheck`: correcto.
- `pnpm --filter @unwatched/cognition test`: **104 tests**; antes había 95.
- `pnpm --filter @unwatched/engine test`: **96 tests**, sin modificar engine.
- Replay de `sell:""`: una respuesta, compra original preservada; original y
  normalizada compran el mismo pan por una moneda en instancias del engine.
- Tests adicionales cubren opcionales anidados, campos requeridos vacíos,
  ventas intencionales, trade abreviado, comida, consejos, presencia, alojamiento,
  planes, procedencia de errores, privacidad y fallback del periódico.

Se hicieron **9 respuestas reales adicionales** del mismo modelo por OpenRouter,
sin ejecutar un nuevo día simulado ni almacenar memorias. Se conservaron las
personas y reglas originales de los logs. Coste conjunto: USD **0,0032671435**;
30.804 tokens de entrada, 3.087 de salida, 4.608 cacheados según `usage`.
No hubo reparaciones automáticas, fallbacks ni errores JSON/schema en estas nueve
respuestas. Dos repeticiones adicionales fueron ajustes manuales tras observar
fallos semánticos, no resultados omitidos:

| Caso | Resultado final observado | Generation ID nuevo |
|---|---|---|
| Hambre y manzanas transportadas | `use: apples`, en vez de ir a comprar pan | `gen-1789696657-uJs03QbCrHMq2RjflVCS` |
| Agotado en huerto, alojamiento en inn | `move: inn` tras aclarar cama/destino | `gen-1789696736-h6MRtgP7CNjc9lxCzax7` |
| Nadie presente | Se mueve a market; deja de saludar al ausente | `gen-1789696669-udQCsto5PclTE3pl93Kp` |
| Destino inventado council_hall | Elige market, ID real; no prueba llegada al concejo | `gen-1789696675-pSdS1RF0iFlza9CDycIO` |
| Reflexión con error de ID | No concluye que el concejo sea inaccesible | `gen-1789696833-nNrDU6GOFlWi7Gy3Z7Zy` |
| Plan sin do | Todos los pasos incluyen actividad | `gen-1789696877-qlXqX0FEB80QO7nTCW1L` |
| Periódico | Sin reflexión privada, atribuye diálogo, lunes sin eventos añadidos | `gen-1789696968-jU2k04XbFZcmmXUDrfoA` |

El primer intento de descanso todavía eligió sleep fuera del alojamiento
(`gen-1789696662-fsBn2Q6KjjTd7SJI2BQU`). El primer periódico sin datos privados
todavía convirtió la declaración sobre el horno en propiedad establecida
(`gen-1789696814-OOAcEBkrz0cbQqqdobvk`). Ambos motivaron ajustes breves del contexto
dinámico y una repetición; los artefactos conservan también estos fallos.

Logs, metadata y resultados nuevos: `out/openrouter-regression-replay-2026-09-17`.
Los endpoints de logs respondieron temporalmente 404 para generaciones recién
creadas; se recuperaron después por el mismo ID sin repetir llamadas al modelo.

## Tokens y caché

Sobre las 19 percepciones originales, el tokenizer local de
`deepseek-ai/DeepSeek-V4-Flash-0731` mide **+84,05 tokens de media**, mínimo 49,
máximo 110, por el foco dinámico. No es un aumento del system prompt: las reglas
estables resultaron idénticas byte por byte frente a los 19 logs. La persona,
orden de bloques, cache controls, schema compacto y política de modelos permanecen.
El coste añadido es acotado y aporta ubicación/interpretación explícita de estado;
normalizar opcionales no agrega tokens y evita una llamada entera cuando era la
única causa del rechazo. La reparación errónea documentada consumió 6.374 tokens
nativos de entrada y USD 0,00024743; ese importe histórico no predice un nuevo día.

Los proveedores variaron (DeepInfra, Sail Research, Wafer, SiliconFlow). Algunas
respuestas tuvieron 2,5k de entrada y otras 5,7k–6k. No se atribuye esa diferencia
a esta edición ni se presenta el replay como un benchmark comparable de simulación.
No se repitió el soak completo en esta revisión.

## Límites conocidos

- Perception no expone camas/freeBeds. El alojamiento propio es conocido; en otros
  lugares la disponibilidad sigue siendo desconocida. No se inventa ausencia ni
  se añade un veto que cambie qué acciones admite el mundo.
- No se puede demostrar conducta equivalente o ausencia de regresiones por
  muestreos aislados y proveedores distintos. Los planes pueden seguir proponiendo
  trabajo que requerirá empleo y horario; el control de decisión sigue vigente.
- La reflexión nueva todavía contiene inferencias discutibles sobre el molino y
  lenguaje ambiguo sobre trabajar tras haber sido contratado. No se presenta como
  un verificador universal de hechos ni se borran memorias ya persistidas.
- PaperContext no trae event.kind. El filtro reconoce formatos concretos emitidos
  por el engine, no cualquier posible paráfrasis privada. Las publicaciones
  explícitas de ciudadanos conservan su carácter público.

Replay acotado reproducible, con logs API disponibles localmente:

```powershell
pnpm exec tsx packages/cognition/scripts/verify-log-regressions.ts --live out/openrouter-review-2026-09-17/api out/openrouter-regression-replay-new
```

Puede añadirse `away_from_bed`, `carried_food`, `empty_room` o `destination_id`
para seleccionar un caso. Requiere la clave en `.env`; máximo dos respuestas
por caso. Guarda IDs, resultados, costes y recupera los logs por API.
