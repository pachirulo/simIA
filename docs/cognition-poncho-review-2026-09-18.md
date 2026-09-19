# Revisión de Poncho: evidencia, correcciones y límites

18/09/2026, iteración 15 del [plan](cognition-coherence-plan-2026-09-18.md).

Se auditó `apps/headless/out/openrouter-deepseek-Poncho`: seed 42, tres personajes,
un día, tick 60, OpenRouter `deepseek/deepseek-v4-flash-0731`. No se modificaron
engine, protocol, gaceta, número de intentos, retries ni presupuesto de llamadas.
Las correcciones viven en cognition; el registro adicional solicitado vive en
el callback existente de headless. No se certifica una reducción de fallbacks.

## Fuentes y método

- Run original: `run.log`, `run.json`, `events.jsonl`, `dialogue.jsonl`, `summary.json`.
- 32 requests/outputs recuperados por generation ID mediante GET de contenido;
  no se realizaron nuevas llamadas de generación para esta auditoría.
- Capturas completas y snapshot de código anterior:
  `packages/cognition/out/poncho-review-20260918/`. `index.json` enlaza las 32
  respuestas; `cases.json` contiene las 31 operaciones no editoriales. La captura
  del conjunto no implica revisar o modificar la gaceta.
- Fixture permanente: `packages/cognition/test/fixtures/poncho-regressions.json`:
  15 respuestas originales, percepciones de decisión y evidencia seleccionada de
  tres reflexiones. Conserva errores y notas de reparación originales.
- Las percepciones son las de los requests. Para reflexión se reconstruyen los
  campos de estado necesarios y se conserva el texto seleccionado. Solo se unen
  timestamps/actores de los eventos cuyo ID figuraba en el request; no se agrega
  evidencia omitida ni se afirma disponer de un snapshot exacto de AgentState.
- `dialogue.jsonl`: seis registros, 18 intervenciones. Se contrasta lo dicho con
  recuerdos y reflexiones; una frase sobre una acción no prueba su ejecución.

Poncho tenía `logContent: false`. El endpoint recuperado incluye mensajes pero
**no el `response_format` completo enviado**. El código anterior construía schema
estricto con las claves canónicas; eso no permite demostrar qué parte del schema
respetó el proveedor de esa llamada ni atribuir la causa exacta de las variantes.
Para una próxima corrida, `UW_OR_LOG_CONTENT=1` guarda también el body efectivo.

## Resultado histórico, sin reinterpretarlo como una mejora

| Medida | Poncho original |
| --- | ---: |
| Eventos del mundo | 69 |
| Respuestas facturadas, incluidas reparaciones y operación editorial | 32 |
| Rechazos de validación registrados | 12 |
| Fallbacks de decisión | 3 |
| Fallbacks de reflexión | 3 de 3 |
| Tokens prompt / completion, reportados por el adaptador | 165218 / 7413 |
| Coste acumulado reportado | USD 0.014114829833 |

No son seis errores equivalentes. Los tres fallbacks de decisión incluyen un
producto ausente, una compra verdadera sin recibo visible y una reparación que
introduce otro error. En reflexión se mezclan schema, falsos positivos y hechos
secundarios aún no resueltos. Bloquear más respuestas no cuenta como mejora.

## Auditoría de los once puntos

### 1. Alojamiento inicial y noches restantes

`gen-1789760274-ehVDJm69WCVH6AznvH4P` y
`gen-1789760315-JNNttRLiK37bXYdnF5to` contienen las frases señaladas. Ambas llamadas
incluyen la observación inicial de 40 monedas y tres noches pagadas. Al terminar
el día, el estado suministrado dice dos noches. **Evidencia existente no
reconocida / falso rechazo de cognition** para esas cláusulas.

Corregido el reconocimiento acotado de llegada con alojamiento prepagado y de
`forty`. El alojamiento se verifica separadamente del viaje. Las regresiones
rechazan nueve noches, 90 monedas, hospedaje en el molino, tres noches actuales
cuando quedan dos y `I paid for three nights`. Prepago no prueba una transferencia.

### 2. Hechos compuestos y orden temporal

El segundo resumen de Petar combina llegada, dinero inicial, prepago, sopa, pan,
contratación y noches restantes. La evidencia de cada componente estaba
seleccionada. El antiguo análisis mezclaba objetos del viaje con alojamiento y
precio de sopa con salario. **Falso rechazo**, corregido para esas construcciones.

El primer intento, `gen-1789760267-HWtrDmLrWw7dicUCh6ws`, contiene además un
**error real del modelo**: comió y *después* lo contrataron. El evento 21 lo
contrata en t=540; el 29 registra consumo en t=600. Ahora se distinguen los hechos
respaldados de la secuencia invertida (`memory_event_order`). `and` sin afirmar
orden pasa; `then` invertido no. Comer por dos monedas requiere recibo de compra
por ese precio y consumo del mismo objeto por el personaje. Un salario no cubre
el precio de la comida. La gramática temporal sigue siendo acotada.

### 3. Compra de sopa ejecutada y visibilidad de su recibo

Compra: `gen-1789760204-KL32GU5t2cWp2DvBNRBe`, evento 16, t=480, dos monedas.
Decisión posterior: `gen-1789760208-83WfGZQ9an7vQJhbtXhm`, t=540. Su percepción
incluye sopa en inventario y 38 monedas, pero **no incluye el recibo de compra**.
El engine emite el evento de venta y actualiza el conocimiento alimentario; no
guarda automáticamente ese recibo minorista como memoria seleccionable.

El primer recuerdo también afirma alivio de hambre antes del consumo real,
evento 29 en t=600: **error del modelo**, no falso rechazo de todo el recuerdo.
La reparación `gen-1789760210-1JbptjOb2DkyWDAMsKgz` elimina el alivio, mantiene
compra y posesión: **reparación correcta de esa afirmación; evidencia existente
en el mundo pero ausente del request**. El fallback es conservador respecto al
contexto disponible; no demuestra que la compra fuera falsa.

Se reconoce `a bowl of soup` como sopa solo con recibo. El control que agrega el
evento 16 está marcado como contrafactual: no se inyectó retroactivamente en el
request original. Dos porciones requieren dos eventos distintos; `fish soup`
no equivale a sopa sin más. La posesión observable no demuestra compra, consumo
ni reducción de hambre. **Pendiente:** una ruta autorizada para hacer llegar
recibos ejecutados a decisiones posteriores; cognition no recibe hoy un callback
de ejecución, y no se añadió un almacén paralelo ni acceso omnisciente.

### 4–5. Reflexiones, variantes de schema y reparación única

| Personaje | Generaciones originales | Diagnóstico |
| --- | --- | --- |
| Rosa | `gen-1789760250-ckVdIdetcxEnsFWdNzNY` → `gen-1789760262-8r8HdFCQFPRwh2QxY10e` | Primero aliases y claves obligatorias ausentes; después `beliefs.about` de 61 y 69 caracteres, límite 60. Corrección parcial de schema, fallback justificado por estructura. |
| Petar | `gen-1789760267-HWtrDmLrWw7dicUCh6ws` → `gen-1789760274-ehVDJm69WCVH6AznvH4P` | Primer rechazo mezcla falso positivo y cronología realmente incorrecta. Segundo rechazo del resumen respaldado: falso positivo que provoca fallback. Quedan otros problemas de atribución en la respuesta completa. |
| Ivana | `gen-1789760297-HOTLpUH2tLLSuJnGnDX6` → `gen-1789760315-JNNttRLiK37bXYdnF5to` | `self:null`, beliefs sin `about/confidence`; luego falso positivo de llegada/prepago. `projects.standing` aún no es canónico y antes se descartaba silenciosamente al parsear. No era una respuesta íntegramente correcta. |

El prompt narrativo describía opiniones y certeza sin enumerar todas las claves
y límites. La reparación de schema diagnosticaba estructura antes de poder
revisar prosa mal formada. Se añade una guía explícita al primer request y a su
única reparación: `opinions`, `letter_to_owner`, `progress`, `confidence`, `about`
como tema breve, límites, campos opcionales. Se priorizan errores obligatorios
frente a claves extra al armar el diagnóstico limitado.

Los campos canónicos individualmente válidos se analizan también cuando el
objeto completo falla schema, **solo para diagnóstico**, nunca para aceptarlo.
`self:null` se normaliza a ausencia de actualización opcional, conservando la
identidad actual; no inventa un `self`. No se renombra `opinionChanges`, no se
recorta `about`, no se fabrican campos obligatorios. Los objetos contextuales
son estrictos para evitar perder silenciosamente `status/standing/sureness`.
El contrato canónico permanece intacto en protocol.

Esto no garantiza que el modelo deje de producir variantes. Aumentar rechazos
de claves extra no se presenta como mejora de coherencia. La guía y los
diagnósticos se comprobaron con respuestas controladas, no con otro run real.

### 6. Bread y contenido efectivo del repair

Primera pareja: `gen-1789760196-FK8EGnmWlKL9Ims810tb` →
`gen-1789760201-12usg5PtQ24SH0bKTshR`. Ambos proponen trade sin buy. El primer
diagnóstico enviado fue sobre `remember` de llegada; **el modelo aún no había
recibido la instrucción de corregir buy**. Borró recuerdos pero conservó la
compra incompleta. Ahora recibe conjuntamente el error de producto y memoria,
con `action.buy = "bread"`, manteniendo operación y destino en el ancla.

Segunda pareja: `gen-1789760230-KVuFZDShMEekKPunV4iq` →
`gen-1789760232-6iK1yr7JC9jQadIKNoiG`. Primero intenta usar pan no transportado;
la reparación reconsidera comprarlo y omite buy. **Error real nuevo durante la
reparación**, no repetición del mismo diagnóstico de producto. La reconsideración
es legítima al fallar la precondición, pero no queda completada. El mensaje de
`use_not_carried` ahora explicita que comprar requiere `action.buy`.

No se rellenan comandos silenciosamente; repetir trade incompleto conserva
fallback en dos respuestas. No hay drift de harina a otro producto en estas
parejas; sí cambió use por trade al reconsiderar una acción imposible.

### 7. Biografía y alcaldía

Rosa es elegida en el evento 25, t=600. El plan matinal de Ivana es anterior a
esa elección. `A second term as mayor` es una aspiración; no debe borrarse ni
contabilizarse automáticamente como afirmar un cargo presente. `careful mayor's
reputation` es ambiguo y procede de su biografía, no de un nombramiento insular.

Los prompts de decisión, plan y reflexión distinguen biografía, aspiración y
evidencia institucional. Un control acotado exige respaldo para `I am the mayor`,
`I'm the mayor` y `As mayor I…`. Conserva historia y ambición. Percepción de
alcaldía o una observación institucional seleccionada respaldan el cargo; rumor
no lo establece. Si el contexto no trae estado institucional, se señala como
desconocido. **Pendiente:** resolver lenguaje ambiguo y disponer de estado cívico
completo en contextos que no lo reciben; no se consulta el mundo oculto.

### 8. Consumo plural y cantidades

Regresiones derivadas, identificadas como sintéticas: `I bought soup and bread.
I ate both/them both` y dos bowls. La referencia solo se resuelve con antecedente
adyacente, explícito y propio. Requiere eventos de consumo de ambos objetos;
compras no sustituyen consumo. Eliminar un eat vuelve a rechazar la afirmación;
duplicar el mismo recibo no prueba dos porciones. `I ate both` aislado y el actor
ambiguo siguen sin resolverse. No se atribuye esa frase a una generación Poncho
que no la contiene. Quedan referencias no locales y cantidades generales abiertas.

### 9. Llegar al mesón y ver a Rosa

En `gen-1789760196-FK8EGnmWlKL9Ims810tb`, Ivana está en inn y Rosa aparece cerca:
su presencia es observable. El evento 8 documenta la llegada al mesón en el
mundo, pero no está seleccionado como recibo en esa decisión. El rechazo señala
el componente `arrived`, no `saw Rosa`. El barco inicial no acredita ese trayecto.
La separación de cláusulas evita atribuir a Rosa el error, pero **no se da por
resuelto el acceso al recibo de viaje**. El control contrafactual con evento 8
reconoce llegada al mesón. Estar aquí no prueba por sí solo cuándo o cómo se llegó.

### 10. Memoria anticipada de say

`gen-1789760196-cXbrsLAVmbYwhbmaMbbu` propone `say` con texto `Ivana`, pero
recuerda haberla saludado. El evento 10 posteriormente confirma esa única palabra,
no la frase Hello. Más importante: el engine guarda `remember` antes de intentar
aplicar la propuesta. Una carrera puede rechazarla después.

Se exige una frase propia anterior seleccionada para esas formas de memoria;
propuesta, interpretación personal o habla de otro personaje no son prueba.
La integración usa Town real y cambia la ubicación de la destinataria tras
la percepción: `action.rejected`, sin `agent.say` y sin recuerdo falso. La
corrección actúa en cognition, no cambia la persistencia del engine. Cobertura
acotada a las formas de habla probadas; no es un analizador universal de recuerdos.

### 11. Evaluación offline y pendientes reales

`scripts/check-poncho.ts` compara las 15 respuestas congeladas con el snapshot
anterior y la revisión actual, separando schema, primer error semántico y resumen.
Resultado en `out/poncho-review-20260918/offline-comparison.json`. No ejecuta LLM.

Desde la raíz, para repetir la comparación sin red:

```powershell
pnpm --filter @unwatched/cognition exec tsx scripts/check-poncho.ts out/poncho-review-20260918/before-src
```

Sin el argumento opcional se revisa únicamente el código actual. El snapshot
anterior y las capturas completas son artefactos locales ignorados por Git; los
fixtures y el script permanecen en el proyecto para las regresiones.

El resumen reparado de Petar deja de ser falso positivo; su primera cronología
continúa rechazada. La llegada de Ivana pasa, pero `projects.standing` sigue
inválido. La compra sin recibo sigue sin certificarse; el saludo anticipado deja
de aceptarse. Esos cambios no permiten calcular una nueva tasa real de fallback.

La respuesta reparada completa de Petar pasa el análisis acotado actual, pero
todavía atribuye `She said she is mayor now` a Rosa y a la vez dice que no lo
oyó directamente. Las conversaciones conservadas no respaldan esa atribución.
**No se cuenta ese pase como respuesta completamente fiel**: la atribución
pronominal entre campos queda registrada en el plan con la captura original.
También quedan diferencias de lugar/cronología en la prosa de Rosa, cuyo rechazo
estructural no certifica la corrección del contenido restante.

## Verificación y logs adicionales

Módulos nuevos: `semantics/institution.ts` recibe texto y estado institucional
observado (`true/false/null`), produce una nota de contexto o `SemanticIssue`, y
depende del extractor de fuentes; no lee Town. `semantics/speech-memory.ts`
recibe texto, ruta del campo y recuerdos seleccionados, y devuelve un issue o
null según encuentre una frase propia previa. Ambos se integran en los
validadores existentes; sus ejemplos positivos y negativos están en
`test/poncho-regressions.test.ts`.

- 23 nuevas regresiones Poncho, positivas, negativas, reparación y carrera real.
- `pnpm test`: 573 tests correctos (341 cognition, 96 engine, 58 web, 53 server,
  14 headless, 11 store). El primer intento concurrente con typecheck agotó el
  timeout de arranque del subproceso de headless; queda conservado. Reejecución
  sin typecheck concurrente: completa y correcta, sin ampliar timeouts.
- `pnpm typecheck`: ocho tareas correctas. `git diff --check`: correcto.
- 60 archivos protegidos cotejados con SHA-256 anterior: cero cambios. Incluye
  engine/protocol y archivos de gaceta. Las funciones `writePaper` se conservan.
  El cambio inglés preexistente de `island.ts` no se revirtió ni se amplió.
- Control de logging: `apps/headless/out/poncho-logging-check-20260918/`, mock,
  seed42, tres personajes, tick60, un día: 68 eventos, idénticos en ambos logs.
  No es una muestra de calidad del LLM.

Headless guarda cada evento completo como `event {…}` en consola y `run.log`,
incluidos los tipos pedidos y cualquier otro emitido. Los JSON son compactos,
sin saltos internos de formato; strings conservan saltos escapados. Se mantienen
`events.jsonl` y `dialogue.jsonl`. Las pruebas contrastan objetos completos y
conservan UTF-8 y contenido truncado del proveedor. [Formato y rutas](openrouter-console-logs.md).

Pendientes: acceso autorizado a recibos omitidos; atribución entre campos y
pronombres; rol ambiguo; anáforas no locales; negación/modalidad y acuerdos
informales de P5.3/P5.5; nueva corrida comparable con esta revisión para P8.3.
No se cierra el plan global ni se modifica la gaceta para resolverlos.
