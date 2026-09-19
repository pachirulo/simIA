# Revisión de Kaka: evidencia, continuidad y reparación

18/09/2026. Cambios limitados a cognition, regresiones y este informe. Se preservaron
engine, protocol, gaceta y `personas.ts`, incluidos sus cambios anteriores.

## Fuente y método

- Corrida: `apps/headless/out/openrouter-deepseek-Kaka`, seed 42, tres agentes,
  dos días, tick 60, `deepseek/deepseek-v4-flash-0731`.
- `run.json`: completed, minuto 2880, 157 eventos, 87 generaciones. Los requests
  no estaban en `run.log`: `logContent=false`. Las respuestas sí estaban completas.
- Se recuperaron **87/87 requests y outputs originales** mediante el endpoint
  de contenido de generaciones del proveedor. Se contrastaron con `events.jsonl`,
  `dialogue.jsonl`, `run.log`, `summary.json` y el código que construyó cada contexto.
- Capturas, índice con IDs completos/líneas, snapshot previo de cognition y comparación
  offline: `packages/cognition/out/kaka-review-20260918/` (artefactos locales ignorados).
- Fixture versionable: `packages/cognition/test/fixtures/kaka-regressions.json`.
  Contiene 26 respuestas seleccionadas y su evidencia original. En reflexión,
  los IDs efectivamente seleccionados se unen a los eventos para recuperar tiempo,
  actor y texto completo disponible al validador. También se conserva el texto
  abreviado que recibió el modelo; no se añaden eventos ausentes del request.
- No existe un snapshot íntegro de `AgentState` por llamada. Las pruebas reconstruyen
  solamente los campos necesarios. Los requests de diálogo no incluyen las memorias
  privadas entregadas al callback: el replay no pretende haberlas recuperado.
  Las pruebas de nuevas selecciones de `foodLessons` y del informe de alcaldía se
  identifican como reconstrucciones del camino del engine, separadas del request original.

Reproducción sin red:

```powershell
pnpm --filter @unwatched/cognition exec tsx scripts/check-kaka.ts
# Comparación con el snapshot local previo, si está disponible:
pnpm --filter @unwatched/cognition exec tsx scripts/check-kaka.ts out/kaka-review-20260918/before-src
pnpm --filter @unwatched/cognition exec vitest run test/kaka-regressions.test.ts
```

El replay informa diagnósticos semánticos, no una tasa nueva de éxito del proveedor.
Que una respuesta pase estos controles acotados no certifica toda su prosa.

## Casos reconstruidos y clasificación

Los códigos cortos son `callId` de `run.log`; el fixture conserva los IDs completos
de cada generación y el número de línea original.

| Caso | Evidencia y diagnóstico | Clasificación |
| --- | --- | --- |
| `4497e5c2`, diálogo inicial, líneas 51–57 | Llegadas 1–3 a las 06:00; conversación 18 a las 08:00. El writer tenía nombres, rasgos y sharedSpeech vacío; no fecha de llegada. El primer intento falló por JSON inválido. El segundo corrigió JSON, conservó la noche en common room y los varios días de Rosa, y fue ejecutado. | Error del modelo; contradicción autobiográfica no detectada; repair correcto de formato, insuficiente semánticamente. |
| `0929617c`, quarry, línea 221 | A «Have you been up to the quarry lately?» Rosa responde «Not for a few days». Seguía en su primer día. La frase posterior «I heard…» no vuelve rumor la experiencia propia afirmada antes. | Error del modelo; contradicción temporal no detectada. |
| `29c6b303`, roof/ledger/plots, línea 94 | No hay prueba de inspección, reparación ni historia personal en esos lugares. «The roof held up last storm» no dice que Petar lo haya presenciado: podría ser una afirmación de oídas o falsa. «I came to check» expresa un propósito, no una inspección terminada. | Detalle local sin respaldo; no alcanza para demostrar contradicción autobiográfica en cada frase. Sería un falso positivo censurarlas todas como acciones físicas incompatibles. |
| `aeb4eadc`, identidad Rosa/mayor, línea 548 | Ivana había oído «Rosa Vidal is mayor now» y la había tratado como mayor el día 1. La selección del día 2 no contiene esa asociación: ni dayMemories ni keyMemories. `town.mayor` 25 tiene a Rosa como actor y no entra en desireEvidence de Ivana. El dato persiste como rumor personal creado por el engine, pero no fue seleccionado. | Evidencia conocida no seleccionada; pérdida de identidad del modelo; contradicción no detectada por su control específico. El output fue rechazado por otro motivo, no ejecutado con esa intención. |
| `8896ff74`, Rosa contratada/pagada, líneas 524–533 | Movimiento 102, contratación 107 y salario 130 estaban seleccionados. «then walked … and was hired» se analizaba como un objeto de movimiento extendido; «worked a shift, paid 2 coins» se analizaba como pago activo. El recibo dice «was paid 2 for a shift as clerk at the chandlery». | Evidencia seleccionada pero no reconocida; falsos rechazos; fallback de reflexión injustificado respecto de esos diagnósticos. |
| `785ea9c7`, sopa de Rosa, línea 137 | Compra 41 a las 13:00; decisión a las 14:00. El request contiene soup en inventario y learned_food con una observación, pero no el recibo en recent. La compra normal emite evento y registra FoodLesson, no una memoria textual «I bought…» recuperable por relevance. | Evidencia real no seleccionada. La falta de recibo en el request justifica el rechazo conservador original; no demuestra que Rosa mintiera. El repair eliminó el recuerdo y fue aceptado. |
| `0019286f` / `daf6d800`, alojamiento en intent, líneas 475–490 | Perception.self.housing ya contiene inn y dos noches restantes; además el prompt muestra Own lodging. El validador de intent no recibía ese estado y el parser no reconocía bed paid for / nights left paid. Rosa repitió una variante verdadera y terminó en fallback; Petar eliminó paid y pasó. | Evidencia seleccionada pero no utilizada; falsos rechazos. Fallback de Rosa injustificado. Repair de Petar evita el falso rechazo conservando su destino. |
| `0467d158`, prepago inicial, línea 245 | Tres noches iniciales y dos actuales estaban documentadas. «Arrived this morning … three nights paid» tenía sujeto elidido que el parser rechazaba. Al corregirlo apareció otro falso rechazo latente de «ate both», pese a dos consumos seleccionados. | Falsos rechazos; repair aceptado sin necesidad de negar el prepago. |
| `236613e4`, Petar, líneas 537–545 | Estado explícito: 39 monedas, una noche. «one paid night left» se rechazó porque solo se reconocía el orden nights paid. El repair «39 coins left after paying for my lodging» fue aceptado: paying no estaba cubierto como pasado causal. No hay un pago de alojamiento que lo respalde. | Falso rechazo inicial; repair con drift; afirmación física falsa/no respaldada no detectada. Ahora se rechaza el repair original. |
| `41b1372f`, Ivana día 1, líneas 256–265 | «she gave general answers» se confundía con entrega física. El repair introdujo «paid for three nights», que sí carece de recibo. | Falso rechazo inicial; repair con drift; pago activo correctamente rechazado. El fallback final es justificable para esa segunda salida, aunque el primer rechazo era evitable. |
| `8331a21a`, trade, líneas 430–442 | El segundo request sí contenía literalmente `Set action.buy to "bread"`, ruta action.buy y candidato anterior. La segunda respuesta repitió exactamente action e intent. | Error del modelo; repair sin corrección; ambos rechazos correctos; fallback justificado. `preserved` solo describía que no cambió los campos, no que hubiera corregido el error. |
| `206bd64f`, outcome, líneas 406–414 | La línea 3 recién generada pregunta si el mercado estará tranquilo. El recuerdo lo resume como «Petar asked Ivana about market prospects given wind». El parser identifica given como entrega. | Falso rechazo léxico. El segundo diálogo cambia a cart/road: drift de contenido provocado por un rechazo innecesario. |
| `aeb4eadc`, comida de Ivana, líneas 548–555 | Los consumos 81 y 139 sí estaban seleccionados. El inglés once coincidía con la entrada española once=11 y exigía once recibos. El segundo intento dice «ate one of them … the other I still have»; no es una reparación fiel y el pronombre no se resolvía. | Primer rechazo con diagnóstico falso, evidencia seleccionada no reconocida; segundo intento sigue problemático. No se equipara ausencia de error del parser con exactitud del balance narrado. |

### Negaciones: qué estaba realmente demostrado

El control físico anterior descartaba las cláusulas negadas sin cotejarlas con
hechos positivos. Eso era una carencia real, pero no convierte toda frase negativa
de Kaka en falsa. Petar llegó al molino en el evento **119, minuto 2280 (14:00)**:
«I did not get to the mill in the morning» es compatible con ese evento. Rosa no
había ido a la chandlery el día 1. «No fui a ofrecer trabajo» tampoco equivale
a negar cualquier visita al edificio.

Las regresiones contrastan negaciones de visita, trabajo y encuentro con eventos
positivos propios. Incluyen negativos de control para otro actor, otro período,
un destino todavía «on the way to», un propósito incumplido y un encuentro formal.
La contradicción Rosa/mayor se prueba con el mismo reporte personal omitido, sin
transformarlo en una observación institucional verificada.

### Orden de validación del diálogo

`dialogueIssue` recibe el output completo, resuelve los speakers de `out.lines`
y usa esas líneas para atribución y condiciones antes del control de resultados
físicos de cada outcome. Los recibos físicos vienen de las memorias previas: las
nuevas líneas no pueden probar que se entregó o consumió algo. El caso `given wind`
falla en ese último control por clasificar mal una palabra. **No confirma la
hipótesis de que el outcome solo pueda recordar el diálogo anterior**.

La regresión acepta el output original con las dos listas privadas vacías y
conserva rechazado un outcome que afirma una entrega de bread. No convierte el
diálogo propuesto en un evento ejecutado; ese paso sigue correspondiendo al engine.

## Implementación

- `context/decision-evidence.ts`: proyección de hasta seis compras propias exitosas
  de las últimas 24 horas desde `foodLessons`, con ID real, tiempo, producto,
  coste y lugar. Sin inferencias a partir de inventario ni probabilidades;
  excluye fallos, consejos, entradas sin recibo, futuras o antiguas. Deduplica IDs.
  OpenRouter y Anthropic usan la misma copia enriquecida para request y validator.
  No modifica AgentState, el Perception original ni los eventos del mundo.
- `context/reflection-evidence.ts`: recupera como máximo el último reporte personal
  explícito de quién es mayor, conservando fuente/tiempo y sin leer memorias ajenas.
  `context/reflect.ts` muestra la fuente y asociación; no cambia reported a observed.
- `semantics/continuity-claims.ts`: cotejo de negaciones contra registros positivos
  seleccionados y resolución acotada persona–cargo. Las conversaciones prueban
  participación, no el contenido material de lo dicho. Separa desconocimiento de
  oficina, no haber conversado y no haber tenido una audiencia formal.
- `semantics/dialogue-history.ts`: contexto público de llegada y control de
  contradicciones temporales directas. No expone biografías, empleos, dinero,
  planes ni recuerdos privados. Una mentira deliberada sigue siendo posible si
  el recuerdo de su emisor la identifica como tal; «I said…» por sí solo no
  declara intención de engañar. Los rumores y la especulación siguen permitidos.
- `semantics/lodging.ts`, intent y remember: comparten el estado de housing ya
  incluido en la percepción. Reconocen bed paid for, nights left paid, paid night
  left y prepaid lodging. Conservan verificaciones de titular, cantidad y lugar,
  y distinguen observación inicial de estado actual. there requiere antecedente
  espacial explícito; no se resuelve automáticamente con la acción propuesta.
- `semantics/evidence.ts`: cláusulas de movimiento/contratación, pasiva de salario,
  cantidades de turnos independientes del sueldo, giros no materiales gave answers /
  took my day / given wind, conteo inglés once, y antecedente acotado de ate both.
  Compras y consumos siguen exigiendo recibos independientes. Se detecta el pasado
  causal after paying; el prepago no lo respalda.
- Repair: instrucción común contra fortalecer estados en acciones o inventar
  causas. Para el error existente de trade se muestra un ejemplo concreto con
  buy, derivado de la corrección exacta emitida por el validador. No se rellena
  buy en la respuesta ni se ejecuta el ejemplo. Dos respuestas inválidas siguen
  terminando en fallback. El cuerpo de `tradeIssue` quedó idéntico al snapshot.

## Límites abiertos

- No se ejecutó otra simulación ni se pidieron nuevas completions. Los 87 requests
  consultados son lecturas de la corrida original. La nueva guía de repair está
  probada por request e integración con transporte simulado, no por una mejora
  medida de obediencia de DeepSeek. Puede volver a ignorarla y caer justificadamente
  en fallback.
- La selección nueva recupera compras de comida registradas en FoodLesson. No es
  acceso al historial global ni soluciona recibos de otras operaciones que el
  engine no haya entregado o conservado en el estado personal disponible.
- Los controles lingüísticos son acotados. No verifican toda escena inventada,
  intención de mentir, cantidad exacta narrada, pronombre o referencia temporal.
  En particular, once deja de significar once consumos; el control de frecuencia
  sigue comprobando mínimos, no un balance completo de todo el día. El resumen
  original de Ivana subestima dos consumos como uno; el parser no certifica ese balance.
- «ate one of them» sigue sin resolución general y puede producir rechazos
  conservadores. Tampoco se promueven los detalles de ledger, plots, agua o tormentas
  a hechos del mundo. La guía de diálogo pide fuentes/preguntas; no demuestra esas
  observaciones ni elimina toda invención posible.
- Un reporte viejo de alcaldía sigue siendo conocimiento fechado, no garantía del
  cargo global actual si no llegó un reporte más nuevo. La selección conserva su
  incertidumbre; no consulta un estado omnisciente de otras personas.

## Verificación

30 regresiones nuevas, incluyendo los textos y evidencia originales, controles
contrarios y una compra ejecutada por el engine sin modificarlo. Se compara también
la implementación anterior con la actual sobre las mismas capturas, separando
las pruebas de nueva selección del replay original.

Resultados finales:

- **603 tests correctos** en el monorepo, incluidos **371 de cognition** y
  **30 regresiones nuevas**. Comando: `pnpm exec turbo run test --concurrency=1`.
- `pnpm typecheck`: correcto en los **ocho paquetes**.
- `git diff --check`: correcto; Git solo informa su conversión configurada LF/CRLF.
- Comparación offline de 26 respuestas fijas: once dejan de tener el rechazo
  reproducido; tres salidas antes aceptadas reciben ahora un rechazo (diálogo
  inicial, quarry y pago inventado en el repair). No son tasas de fallback nuevas.

El primer `pnpm test` final tuvo un `ETIMEDOUT` de 20 segundos en el arranque de
headless mientras corría typecheck; la ejecución en serie pasa sin cambiar ese
límite. Typecheck también detectó `findLast` en una prueba nueva, incompatible
con el target: se sustituyó por `filter(...).at(-1)` y se verificó de nuevo.

Logs definitivos: `tests-verified.log`, `typecheck-verified.log`,
`diff-check-final.log` en el directorio local de evidencia. Los intentos previos
permanecen guardados, incluidos sus fallos. Las huellas de
`personas.ts` y del cambio previo en `engine/src/packs/island.ts` se verificaron
idénticas a las del inicio de esta revisión.
