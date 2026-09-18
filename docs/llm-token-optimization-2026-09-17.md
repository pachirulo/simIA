# Auditoría y optimización de entrada LLM — 17/09/2026

## Alcance y resultado

Base medida: commit `5e2e5a87c5785caf7d89c1a3106e759f491f3d10`.
Modelo de los tres slots: `deepseek/deepseek-v4-flash-0731`, OpenRouter.
Cambios de ejecución exclusivamente en `packages/cognition`: preparación de decisiones
y schema enviado a OpenRouter. Engine, protocolo canónico, percepción, memoria,
salience, conversaciones, economía, acciones, validación y scheduling sin cambios.
Los prompts de las otras operaciones y del adaptador Anthropic directo se conservan.

Resultado controlado: **14,9% menos entrada** con el mismo contexto y endpoint Sail Research.
Sobre los 25 contextos originales, la reducción local media es **13,7%**, sin quitar
información de Perception. El benchmark completo reportó **49,8% menos prompt tokens**
y **45,4% menos coste**, pero cambió de proveedores y trayectoria: no atribuir esos
porcentajes completos a la compactación ni certificar equivalencia conductual.

## Qué se envía en action_proposal

Recorrido: `OpenRouterBrain.decide` → `buildDecideContext` → `withPrimer` →
`OpenRouterProvider.call` → POST `/api/v1/chat/completions`.

1. Un mensaje system, con bloques de texto: reglas compartidas y, si existe, primer;
   después la persona completa. El primero lleva `cache_control: ephemeral`.
   La persona conserva la política de caché existente, según `thinkEvery <= 5`.
2. Un mensaje user: mechanics seleccionadas con la percepción, instrucciones de
   decisión y `JSON.stringify(p)` íntegro, sin indentación.
3. `response_format: {type: "json_schema", json_schema: {name: "action_proposal",
   strict: true, schema: ...}}`. No hay una segunda copia del schema en system/user.
4. `max_tokens: 1024`, `stream: false`, `provider.require_parameters: true` y
   `reasoning.enabled: false` para este modelo, igual que antes.
5. La respuesta sigue pasando por el mismo `truncateProse` y `schema.safeParse`.
   Presupuestos, reparaciones, retries, fallbacks y elección de modelo no se alteran.

En este headless el primer está vacío. En server puede contener hechos dinámicos del
mundo; `withPrimer` lo sigue conservando completo. No se lee memoria adicional del
engine: la decisión recibe lo ya seleccionado en `p.recent` y demás campos de `p`.

Las capturas exactas, sin headers ni claves, están en `out/token-audit/before.jsonl`
y `after.jsonl`. Registran requests, responses y usage; contienen sólo los contextos
de esta simulación local. No son una función de logging de producción.

## Peso de cada bloque

Tokenizer oficial `deepseek-ai/DeepSeek-V4-Flash-0731/tokenizer.json`, sin tokens
especiales. SHA-256: `8f9f37ca37fdc4f5fd36d5cf4d3b0e8392edb4e894fd10cc0d70b4957c8633cf`.
Son conteos del texto cliente, no facturación: el formato interno de chat/schema del
proveedor no es visible. Media sobre **los mismos 25 inputs originales**:

| Bloque | Antes | Después | Ahorro |
| --- | ---: | ---: | ---: |
| Reglas base + instrucciones estáticas en system | 605 | 625 | −20 |
| Persona | 205 | 205 | 0 |
| Mechanics | 569,4 | 447,6 | 121,8 |
| Instrucciones en user | 321,8 | 61 | 260,8 |
| Perception completa | 1.195,9 | 1.195,9 | 0 |
| Schema de respuesta | 3.027 | 2.576 | 451 |
| **Suma por bloques** | **5.924,1** | **5.110,5** | **813,6 (13,7%)** |

System crece 20 tokens netos porque ahora incorpora instrucciones antes repetidas
en user. Base + instrucciones ahorran 240,8 tokens netos. La suma por bloques puede
diferir ligeramente de tokenizar el texto concatenado por las fronteras BPE.

Subconjuntos de Perception (ya incluidos en la fila anterior; no volver a sumarlos):

| Campo | Media | Mínimo–máximo |
| --- | ---: | ---: |
| `recent` | 602,8 | 129–1.142 |
| `today` | 148,8 | 144–152 |
| `options` | 45,9 | 43–49 |
| `self` | 138,9 | 126–162 |
| Perception completa | 1.195,9 | 676–1.961 |

El schema era el mayor bloque: 11.445 caracteres compactos / 3.027 tokens locales,
aproximadamente el 51% de la suma media. Ahora: 9.567 caracteres / 2.576 tokens.
El segundo componente variable importante es `recent`, especialmente tras hablar.

## Duplicaciones y contenido conservado

- El antiguo prefacio repetía hora, tiempo, temperatura redondeada, ocasión,
  gathering, turno/salario y crossroads que ya estaban en el JSON. También repetía
  hint y la obligación de responder JSON. Se conservan los valores exactos una vez.
- Las mechanics de skills/decoration repetían sintaxis, enumeraciones y límites de
  campos ya expresados por el schema. Se conservan los límites físicos y condiciones
  que **no** expresa éste: recursos, lugar, evidencia, interrupciones y voluntariedad.
- Las instrucciones generales sobre deseos, cuerpo, cartas y plan eran repetidas
  en cada prefacio variable. Ahora están en `DECIDE_TASK`, idéntico entre requests.
- Se conserva persona completa, sus ejemplos de voz, toda Perception, arrays vacíos,
  nulls, precisión numérica, memoria, plan, options y los marcadores de fuente.
- `type`, `agent_id` y `deadline_ms` aportan poco a elegir la acción, pero cuestan
  pocos tokens. No se eliminaron ni se creó un contexto alternativo del engine.
- No se deduplican recuerdos por texto: dos menciones pueden tener fuentes o
  momentos distintos. No se resume ni recorta evidencia.
- No se redondean needs/confidence; tampoco se cambia JSON por tablas/abreviaturas.
  La serialización ya era compacta y mantenerla exacta reduce el riesgo.

## Schema completo y compatibilidad

Sí: antes se enviaban **44 variantes de Action** en cada decisión y se siguen
permitiendo las 44. `options` no es una allowlist exhaustiva: tiene 40 tipos y omite
`offer`, `accept`, `refuse`, `settle`. Filtrarlo literalmente rompería acuerdos.
Tampoco se agregó una lista manual de excepciones que pudiera desincronizarse.

`compactActionSchema` trabaja sobre una copia de la conversión canónica:

- Agrupa sólo alternativas idénticas salvo el literal obligatorio `kind`.
- `join_institution`, `leave_institution`, `repair`, `work`, `quit`, `search`,
  `sleep`, `wait` comparten la rama sin parámetros mediante enum.
- `test_skill` y `practice_skill` comparten la rama con `id`.
- 44 ramas pasan a 36, manteniendo 44 valores posibles; también compacta SkillStep.
- Elimina `type: "string"` únicamente cuando const/enum ya lo implica. El dialecto
  estricto OpenAI conserva tipos explícitos y su transformación nullable existente.
- Mantiene properties, required, additionalProperties, cotas, descripciones y tipos
  restantes. No introduce `$ref`, `allOf`, ramas permisivas ni defaults nuevos.

Un test independiente expande los enums y restituye tipos implícitos; el resultado
coincide con todas las ramas y restricciones originales, también después de la
transformación OpenAI. Otro comprueba que diferencias en límites, required,
descripciones o discriminador opcional impiden agrupar.

Se probó también la emisión Zod con `reused: "ref"`: bajaba caracteres de 11.445 a
11.323 pero **subía tokens de 3.027 a 3.104**. No se adoptó.

## Ahorro aislado por cambio: proveedor real fijo

Se repitió **un único input original congelado** fuera de la simulación, conservando
persona, Perception, modelo y presupuesto. Endpoint `sail-research/us`, sin fallback
de proveedor. Estas llamadas auxiliares no están incluidas en el benchmark.

| Variante | Prompt tokens reportados | Ahorro frente al original |
| --- | ---: | ---: |
| Original | 6.413 | — |
| Sólo schema compacto | 5.798 | 615 (9,6%) |
| Sólo prompts compactos | 6.071 | 342 (5,3%) |
| Ambos | 5.456 | 957 (14,9%) |

Las seis respuestas auxiliares (cuatro anteriores y dos en OpenInference) fueron
HTTP 200, JSON válido y compatibles con ActionProposal canónico, sin reparación.
Coste adicional total: USD 0,001496115. Los costes individuales no sirven para
atribuir ahorro: el calentamiento de caché y los tamaños de respuesta difieren.

## Por qué aparecen llamadas de 2.500 y de 6.500 tokens

No son dos tamaños de schema seleccionados por percepción. En la versión original
el schema de action_proposal era constante. Hay tres factores distintos:

1. Mecánicas seleccionadas, recuerdos y crossroads varían entre contextos.
2. El mismo identificador de modelo puede resolver a proveedores distintos.
3. El proveedor procesa/representa/contabiliza el schema de respuesta de forma
   diferente; el tamaño del JSON cliente no basta para predecir su usage.

En el baseline, Sail sirvió las 25 decisiones: 6.330–8.113 tokens. Después, Sail
sirvió 9 (5.548–5.950), OpenInference 11 (1.805–2.383), y otros 5 proveedores una
cada uno; Mancer reportó exactamente 2.500. Registros anteriores del repo también
mostraban action_proposal de 2.921 con Wafer y 6.358 con Alibaba.

La prueba fijando `open-inference/fp8` con el mismo input dio **6.427 original y
2.043 compacto**. Por tanto, ni el nombre del proveedor por sí solo ni el tokenizer
local explican el salto: también depende del schema que recibe. La inferencia es
que cambia su tratamiento interno o su contabilidad; la API no expone la petición
upstream y no permite afirmar que lo omita, ni que siempre lo convierta en texto.
No se fuerza proveedor en el producto ni se usa response caching para simular ahorro.

## Prompt caching

El código ya separaba reglas compartidas, persona y contexto dinámico. Se conserva
ese orden, el primer opaco y la política de caché de persona. El cambio añade al
prefijo estático las instrucciones comunes de decisión. El schema compacto es
idéntico entre localizaciones; no depende de options.

DeepSeek tiene caching automático. No hace falta otro cache_control específico.
El benchmark reportó 122.083 tokens cacheados antes y 59.438 después (60,3% y 58,4%
de sus respectivos totales). **No se ha demostrado una mejora de tasa de caché**:
cambiaron los prefijos, proveedores y textos. Caching reduce coste de entrada;
no elimina esos tokens del campo prompt_tokens.

Sería posible evaluar `session_id` para afinidad de proveedor en llamadas de un
agente, pero no se agregó: puede cambiar routing y hay que separar su efecto de
la compactación. Los primers dinámicos del server también pueden invalidar prefijos.

## Benchmark completo antes/después

Se ejecutó dos veces este comando exacto desde la raíz:

```powershell
pnpm --filter @unwatched/headless soak -- --days 1 --agents 2 --brain openrouter --seed 27 --tick 1 --out out/token-optimization-test
```

pnpm ejecuta el paquete en `apps/headless`; el resultado final vive en
`apps/headless/out/token-optimization-test`. Se copió el baseline antes de repetir.

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Llamadas totales | 36 | 35 |
| Llamadas action_proposal | 25 | 25 |
| Prompt tokens totales | 202.507 | 101.722 |
| Prompt tokens action_proposal | 173.227 | 87.436 |
| Media por action_proposal | 6.929,08 | 3.497,44 |
| Completion tokens totales | 7.113 | 5.328 |
| Completion tokens action_proposal | 1.845 | 2.706 |
| Coste reportado USD | 0,0112206947 | 0,0061250799 |
| JSON inválido / schema mismatch | 0 / 0 | 0 / 0 |
| Errores HTTP / transporte | 0 / 0 | 0 / 0 |
| Fallbacks / truncamientos | 0 / 0 | 0 / 0 |
| Duración | 251,3 s | 188,1 s |

El baseline histórico del usuario (44 / 255.978 / 6.468) no es el baseline medido de
esta comparación. La semilla 27 fija el mundo, no las respuestas del LLM; el request
no fija seed/temperature ni proveedor. Incluso los planes iniciales, cuyo prompt
no cambió y cuyo input costó exactamente lo mismo, produjeron textos distintos.

## Comportamiento y riesgos

Ambos agentes sobrevivieron, comieron, compraron, durmieron y reflexionaron. En las
dos corridas terminaron con 38 monedas cada uno, alojamiento en `inn` por 2 noches,
4 eventos de compra, 4 de comida y 2 de sueño.

**Hubo divergencia relevante, no equivalencia demostrada:**

| Observable | Antes | Después |
| --- | ---: | ---: |
| Eventos totales | 99 | 376 |
| Desplazamientos | 40 | 318 |
| Conversaciones | 5 | 0 |
| Eventos agent.do | 2 | 10 |
| Acciones rechazadas por el mundo | 4 | 7 |
| Empleados al final | 0 | 1 |

Inés obtuvo `inn.help` después. Se registró una secuencia repetida de desplazamientos
entre mercado/mesón, sin añadir llamadas de decisión en cada minuto. No se investigó
ni modificó ese flujo del engine. Rechazos: antes, cuatro intentos de trabajar en
domingo; después, cinco de esos, un destino inexistente `council_hall` y un segundo
experimento de skill en el mismo día. Son rechazos del mundo, no errores JSON/schema.

Las instrucciones siguen diciendo que los domingos no hay turnos; las reglas no
fueron retiradas. Los datos no permiten separar cuánto de las diferencias se debe
al muestreo, a los planes iniciales, al proveedor o a la redacción. Es compatible
a nivel de contrato; no hay base para afirmar equivalencia estadística de conducta.

Validación: cognition 55 tests; engine 96 tests; typecheck de cognition correcto.
Tests de contexto conservan JSON completo, persona, fuentes, UTF-8 y no mutación;
contratos de las otras operaciones y reparaciones siguen pasando. No hubo cambios
en `packages/engine`, `packages/protocol` ni `apps`.

## Herramientas y reproducción de medidas

Scripts nuevos, sin dependencias de aplicación adicionales:

- `packages/cognition/scripts/capture-requests.mjs`: preload opt-in. Usa la variable
  **de sesión del auditor** `UW_CAPTURE_REQUESTS` con un destino absoluto; no es una
  variable de configuración del producto ni debe incorporarse al `.env` operativo.
  Intercepta sólo el endpoint OpenRouter, sin modificar bodies ni registrar headers.
- `measure-token-input.ts`: reconstruye prompts nuevos sobre inputs capturados
  originales; valida Perception sin usar la copia transformada y exporta textos.
- `report-token-input.py`: cuenta textos con un tokenizer suministrado y agrega
  usage/costes/errores/eventos. Requiere Python `tokenizers` para la auditoría.
- `probe-token-input.ts`: ablations pagadas opt-in con `--live`; seis requests
  independientes de la simulación. Permite seleccionar una sola variante.

Ejemplo de captura en una terminal dedicada; elegir otro destino para otra corrida:

```powershell
$env:NODE_OPTIONS='--import=file:///C:/Users/cleka/Documents/simIA/packages/cognition/scripts/capture-requests.mjs'
$env:UW_CAPTURE_REQUESTS='C:/Users/cleka/Documents/simIA/out/token-audit/after.jsonl'
pnpm --filter @unwatched/headless soak -- --days 1 --agents 2 --brain openrouter --seed 27 --tick 1 --out out/token-optimization-test
Remove-Item Env:NODE_OPTIONS
Remove-Item Env:UW_CAPTURE_REQUESTS
```

El observer añade registros; usar un archivo nuevo para cada ejecución. No ejecutar
probes durante el soak porque contaminaría la medición de caché. Las capturas y los
logs son locales e ignorados por Git; no activar esta captura en tráfico privado.

```powershell
pnpm exec tsx packages/cognition/scripts/measure-token-input.ts out/token-audit/before.jsonl out/token-audit/frozen-inputs.json
python packages/cognition/scripts/report-token-input.py out/token-audit out/token-audit/tokenizer/tokenizer.json
# Opcional: llamadas pagadas, fuera del benchmark
pnpm exec tsx packages/cognition/scripts/probe-token-input.ts --live out/token-audit
```

Evidencia local: `out/token-audit/report.json`, `before.log`, `after.log`,
`before/`, `after/`, `before.jsonl`, `after.jsonl`, `frozen-inputs.json`, `probes.jsonl`.
El coste del benchmark excluye expresamente los probes.

## Otras optimizaciones posibles sin tocar el engine

1. Medir una matriz de proveedor fijo y calidad sobre los mismos contextos, con
   repeticiones. El ahorro de schema y la fidelidad de structured outputs varían.
2. Evaluar afinidad `session_id` y caché por separado, midiendo coste y cache hits,
   sin reducir frecuencia de llamadas ni cambiar conversaciones.
3. Ampliar la compactación semántica de instrucciones sólo tras un conjunto de
   pruebas de conducta; no hay evidencia para recortar más grounding con seguridad.
4. Probar un formato tabular reversible para listas largas sólo en transporte,
   preservando cada dato, fuente y orden. Hoy JSON íntegro es la opción conservadora.
5. Estudiar más factorización algebraica del schema con medición real; `$ref` ya
   resultó contraproducente en tokens para este caso. Evitar un objeto genérico que
   pierda requisitos por tipo de acción y provoque reparaciones.
6. No filtrar por options mientras no se pueda demostrar exhaustividad sin cambiar
   el contrato actual. No resumir recent ni truncar planes como supuesto ahorro seguro.

Referencias oficiales: [prompt caching de OpenRouter](https://openrouter.ai/docs/guides/best-practices/prompt-caching),
[structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs),
[tokenizer DeepSeek](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731/blob/main/tokenizer.json).
