# Plan de coherencia cognitiva y compatibilidad con el engine

Fecha: 18/09/2026. Estado: **correcciones verificadas; P5.3, P5.5, P8.3, P11.5 y los pendientes P12.5–P12.6 permanecen abiertos con causa documentada**.

**Estado vigente, iteración 15:** [revisión de Poncho, evidencia por llamada y regresiones](cognition-poncho-review-2026-09-18.md). Se conservan la [revisión de Monchi](cognition-monchi-review-2026-09-18.md) y la [evaluación anterior de nueve simulaciones](cognition-coherence-final-review-2026-09-18.md). Las notas inferiores son históricas; las casillas reflejan la evidencia más reciente. No se certifica calidad global ni menos fallbacks. La elección expresa del usuario para P2.4 es mantener las llamadas y excluir los datos privados del diálogo.

Este es el registro de objetivos y avance de este trabajo. Se actualizará al cerrar cada tarea, con evidencia; no se marcará una mejora como terminada solamente por haber cambiado un prompt o por obtener JSON válido.

## Objetivo y límite principal

Conseguir que los agentes decidan, conversen, planifiquen y recuerden de forma coherente con la información que reciben y con la semántica real de las acciones existentes:

**Lo que quiero hacer → lo que propongo hacer ahora → lo que consta que ocurrió.**

Son tres cosas distintas. Una propuesta puede ser coherente y después ser rechazada por un cambio del mundo. Una compra aceptada tampoco demuestra consumo ni cumplimiento del objetivo personal.

**No modificar la lógica del engine.** Se mantiene la prohibición de cambios en `packages/engine/**`, incluidos sus tests, reglas, hábitos, salience, percepción, memoria, economía, tiempos, ejecución y prioridades, salvo la excepción de datos autorizada abajo. Se pueden leer sus contratos y ejecutar sus pruebas. Las nuevas pruebas de integración vivirán en cognition y usarán el engine existente.

Excepción explícita del usuario, 18/09, iteración 6: restaurar `packages/engine/src/packs/island.ts`
y `packages/cognition/src/personas.ts` desde los originales en inglés `island - copia.ts`
y `personas - copia.ts` de sus respectivas carpetas. Ambos destinos deben coincidir
exactamente con esos originales. No autoriza otros cambios del engine ni migrar
mundos guardados. Las corridas posteriores usan nombres/personas diferentes de
los casos históricos de Inés/Pedro; deben identificarse como otra configuración.

El alcance de implementación previsto es `packages/cognition/**`, sus pruebas, scripts de diagnóstico y documentación. Se preservan `Brain`, los contextos públicos y los schemas de `packages/protocol/**`; no se introducen migraciones, persistencia paralela, NPC, ofertas ni reglas de juego para hacer pasar los casos. Los cambios locales anteriores a este plan deben conservarse.

Ampliación explícita del 18/09: el usuario solicitó el campo `dialogue` en los logs. Se incluye la instrumentación del callback de eventos existente en `apps/server/src/main.ts`, un extractor de habla y sus pruebas. Esta ampliación no autoriza cambios en engine/protocol ni altera acciones, tiempos o persistencia.

Ampliación por la corrida seed 468: el comando real del usuario es `apps/headless/src/soak.ts`. Se incluye ese ejecutor para registrar habla confirmada, compartir el primer existente del servidor y proteger artefactos anteriores. La simulación y sus reglas continúan intactas.

Ampliación por petición de persistencia, iteración 11: guardar también los diagnósticos del proveedor, progreso y estado de la corrida headless; conservar resultados parciales y documentar las rutas. No amplía el alcance del engine ni del contenido editorial.

Ampliación explícita, iteración 15: todos los eventos del mundo aparecen también en el log legible de headless y los JSON se presentan compactos, un registro por línea. Se conservan los archivos históricos y el contenido completo de los strings.

**La gaceta queda fuera de alcance por decisión del usuario. No se modificará.**
Su tarea se elimina del plan y no cuenta como pendiente ni diferida. Continúa el
trabajo sobre decisiones, memoria, reflexión y agentes.

No se busca obligar a comer, cumplir toda promesa, maximizar productividad ni eliminar rumores, mentiras o decisiones arriesgadas. La personalidad elige entre posibilidades y puede cambiar de opinión. Lo exigible es representar correctamente esa elección, sus límites y su evidencia.

## Punto de partida comprobado

Inspección de código realizada el 18/09/2026 sobre HEAD `0a5663f6a98cfe283aa0813a8f75d3fcbf14a33f` **con modificaciones locales preexistentes**. El commit por sí solo no reproduce este estado. En P1 habrá que identificar también el diff y los artefactos de la corrida.

| Área existente | Qué hay en el código consultado | Qué sigue sin acreditar |
| --- | --- | --- |
| `context/decide.ts` y `context/continuity.ts` | Percepción completa, inventario alimentario conocido, destino, intenciones, hasta tres propuestas recientes y diferencias de estado; estas últimas se etiquetan como observaciones sin causalidad. | Que el modelo mantenga coherencia entre intención, comando y resultado. El historial no contiene recibos de ejecución. |
| `semantics/decision.ts` | Controles de referencias, inventario, trabajo, algunos usos de `do`, destinatarios y ciertos recuerdos físicos. | Comprobación general entre `intent` y `action`; cobertura robusta de paráfrasis, negaciones, atribución y condiciones. |
| `provider/openrouter.ts` | Hasta dos intentos de salida; reparación de schema con respuesta anterior; reparación semántica con motivo, sin reenviar la propuesta rechazada. | Conservación del objetivo y de los campos ajenos al error durante una reparación. |
| `context/converse.ts` y `openrouter.ts` | Instrucciones de procedencia y estado privado para cada hablante; `converse` no suministra un validador específico de atribución. | Que cada recuerdo preserve quién dijo qué y no convierta declaraciones en hechos. |
| `context/reflect.ts` y `semantics/lifecycle.ts` | Reflexión recibe evidencia personal parcial; `reflectionIssue` recibe solo la salida y comprueba referencias al sistema en algunos campos. | Contrastar afirmaciones de cumplimiento, pagos y deudas con el contexto; cubrir todos los campos que pueden contaminar decisiones posteriores. |
| `engine.ts` y `types.ts`, solo lectura | `proposal.remember` se guarda antes de aplicar la acción; `ReflectContext.actionEvidence` ya existe; `Brain.decide` no recibe un recibo dedicado de su propuesta anterior. | Un canal fiable de resultados para cada decisión. No se agregará uno cambiando el engine. |

Referencias: [arquitectura](cognition-architecture.md), [contrato semántico](cognition-semantic-contract.md), [continuidad](cognition-continuity-2026-09-18.md) y [diagnósticos de OpenRouter](openrouter-console-logs.md). Sus resultados históricos no cuentan como validación de este nuevo plan.

## Casos que motivan el trabajo

Los cuatro casos siguientes proceden del análisis aportado por el usuario. Se conservan como requisitos de regresión; se recuperaron sus seis generaciones originales. Las capturas y la correlación parcial con eventos están en el [informe de evidencia](cognition-coherence-evidence-2026-09-18.md).

| ID | Fallo reportado | Comportamiento exigido |
| --- | --- | --- |
| R1 | Inés decide consumir el pan que tiene, explícitamente sin comprar más, pero devuelve `trade`. | Detectar la contradicción. Si mantiene esa decisión, proponer el consumo compatible; si cambia de idea, expresar una nueva intención coherente. Comprar para consumir después puede ser legítimo en otro contexto. |
| R2 | Pedro quiere comprar harina en el molino; al reparar `sell: "."`, cambia a pan en el mercado. | Una corrección de formato conserva producto, destino y objetivo cuando sean viables. Si la compra original no es viable, distinguir una reconsideración de una reparación fiel. |
| R3 | Inés introduce el rumor del precio de cinco monedas; su recuerdo lo atribuye a Pedro. | Mantener emisor, contenido, carácter de rumor y origen. Repetir el rumor no aporta confirmación independiente. |
| R4 | Pago de diez monedas condicionado a entregar pan pasa a deuda afirmada; una propuesta de comercio contiene un recuerdo de compra y alivio del hambre. | Mantener condiciones pendientes; no afirmar entrega, deuda efectiva, pago, compra o consumo sin evidencia suficiente para cada hecho. |

Estos ejemplos no prueban que el engine bloquee comer ni establecen por sí solos la causa del fallo. El plan no hereda como hechos todas las interpretaciones de documentos anteriores.

## Reglas de aceptación transversales

1. **Realidad y conocimiento:** usar el estado actual suministrado y sus fuentes. Inventario actual prevalece sobre una afirmación narrativa contradictoria de no tener comida. Ausente significa desconocido, no falso; un mapa parcial no es una lista de todo lo que existe.
2. **Operación inmediata:** separar objetivo final del paso actual. Comprar no come; vender no compra; llegar no completa; hablar no formaliza automáticamente un acuerdo; solicitar empleo no acredita contratación.
3. **Precondiciones observables:** validar solo lo que puede comprobarse con el contexto. Stock no implica oferta; cargo no implica permiso para gastar fondos; localización conocida no implica presencia. El engine conserva la autoridad final y resuelve cambios entre percepción y ejecución.
4. **Procedencia:** distinguir observación, dicho de otro, rumor, interpretación, recuerdo anterior y plan. Mantener quién emitió la afirmación y cuándo, si esa información está disponible. Confianza personal no equivale a verificación.
5. **Resultados:** no usar una propuesta, una reparación, `done`, un relato repetido o un simple delta de estado como recibo. Hablar prueba que se dijo algo, no la verdad del contenido. Sin evidencia, conservar incertidumbre.
6. **Reparación:** no sustituir silenciosamente la decisión. Si se requiere cambiar de objetivo o de operación por imposibilidad, registrarlo como reconsideración en los diagnósticos y expresar una intención compatible, manteniendo el contrato público.
7. **Autonomía:** permitir demora deliberada, exploración, conversación, compras justificadas, mentira en diálogo y riesgo reconocido. La memoria puede recordar una mentira como algo dicho; no debe convertirla en experiencia verificada.
8. **Compatibilidad:** conservar primer dinámico, routing, caché, límites de intentos, timeouts, contabilidad y política de fallback. No agregar un segundo modelo juez ni llamadas ilimitadas. No confundir fallback con éxito del modelo real.
9. **Razonamiento observable:** evaluar intención breve, acción y evidencia disponible; no exigir ni almacenar una cadena de pensamiento privada extensa.

## Fases y lista de avance

Convención: `[ ]` pendiente; `[x]` completado y verificado. Una tarea parcialmente implementada conserva `[ ]` y una nota. Una dependencia no disponible se registra con su límite y siguiente paso, sin marcarla como resuelta. Los IDs son estables para poder continuar en otra sesión.

### P0. Documentar alcance y criterios — completada

- [x] **P0.1** Revisar el adjunto del usuario, la estructura y los documentos actuales; identificar las piezas existentes sin modificarlas.
- [x] **P0.2** Fijar invariantes, frontera de cognition y prohibición de cambios en engine/protocol.
- [x] **P0.3** Crear este plan con regresiones, cobertura de los 33 puntos y reglas de cierre.
- [x] **P0.4** Restaurar los dos originales en inglés indicados por el usuario, comprobar igualdad por hash y verificar que las mecánicas del pack y la función de generación de personas conservan su lógica. Ejecutar tests, typecheck y una corrida nueva con los originales.

Evidencia: inspección de los archivos de la tabla inicial y este documento. Esta fase no acredita implementación ni ejecución de pruebas funcionales nuevas.

### P1. Reconstruir evidencia y fijar baseline — completada en el alcance documentado

- [x] **P1.1** Identificar la corrida analizada por sus artefactos y generaciones. Para R1–R4 guardar contexto exacto enviado, salida original, validación, intento reparado y salida final; incluir personaje, tiempo, modelo/proveedor e identificadores disponibles. Si falta una entrada, dejarlo explícito; no reconstruirla como si fuera original.
- [x] **P1.2** Cruzar propuestas con eventos y observaciones posteriores, conservando diferencias entre acciones del modelo, hábitos, fallback y otros agentes. Cuando no haya correlación inequívoca, marcar resultado desconocido.
- [x] **P1.3** Crear fixtures mínimos reproducibles en cognition, separando capturas auténticas de casos sintéticos. Caracterizar qué acepta/rechaza hoy cada barrera y registrar fallos anteriores a los cambios.
- [x] **P1.4** Guardar configuración de reproducción: commit y diff, pack, personajes, modelos/proveedores, seed, días, duración de tick y política de fallback. Fijar muestra y métricas antes de comparar mejoras.

Puntos de partida disponibles: `apps/headless/out/continuity-final-seed84-tick60/`, `out/continuity-review/final-api/` y los registros descritos en el documento de continuidad. **Son candidatos, no una identificación ya comprobada de la última run del usuario.** No reemplazar ni sobrescribir capturas históricas.

Avance 18/09: capturas auténticas y metadatos recuperados; fixtures separadas de casos sintéticos; baseline de 129 tests, hashes y diff guardados antes de editar. P1.2 se cierra con correlación temporal parcial y resultado desconocido donde falta recibo. **P1.4 sigue abierto:** se fijaron seeds/configuración de la muestra nueva, pero no se recuperaron el seed, checkout y log global de la corrida original; tampoco existe una comparación conductual anterior/posterior equivalente. Véase [evidencia](cognition-coherence-evidence-2026-09-18.md).

Cierre: R1–R4 tienen una ficha de evidencia con límites explícitos y fixtures; existe baseline reproducible. No basta con una interpretación del texto de salida.

### P2. Ordenar contexto y distinguir conocimiento de realidad — completada en el alcance documentado

- [x] **P2.1** Inventariar por operación qué datos ya llegan a `decide`, `converse`, `plan` y `reflect`, cuáles se omiten al construir el prompt y cuáles no están disponibles. Distinguir acceso técnico a un objeto de conocimiento legítimo del personaje.
- [x] **P2.2** Organizar el contexto dinámico de decisión: cuerpo → inventario y cantidades → recursos/autoridad → ubicación/presencia → viaje → cambios observados → propuestas anteriores → oportunidades y restricciones → objetivos/compromisos. Conservar la percepción completa y limitar duplicación/tamaño.
- [x] **P2.3** Resolver en las instrucciones contradicciones entre estado actual y narrativas antiguas sin borrar ni reescribir memorias. Mantener procedencia, certeza y fecha cuando existan; no inventar stock, permisos, interlocutores, horarios, duración de acciones ni tiempo restante de viaje.
- [x] **P2.4** Verificar inventario y recursos en planificación; aislamiento de información privada entre interlocutores; conservación de `heading`, intenciones y significado real de `done`/`missed`.

Archivos de referencia: `src/context/{decide,continuity,converse,plan,reflect,evidence}.ts`, `src/prompts/{core,decide,decide-compact,plan}.ts`. Se decidirá la distribución exacta al implementar, respetando las responsabilidades actuales.

Avance 18/09: índice dinámico, inventario contado, recursos desconocidos y precedencia de percepción implementados y comprobados sin mutación. **P2.4 parcial:** inventario, heading y done/missed tienen pruebas; el estado privado de ambas personas sigue visible al único modelo narrador. La instrucción de no compartirlo no demuestra aislamiento narrativo completo.

Evidencia seed 468: `gen-1789715581-uZ5WAOdOwCQwIKdmFy8e` recibe A=Pedro/B=Inés, pero mezcla sus papeles durante el diálogo y expone información compatible con el secreto de Pedro. Corregir los IDs de hablante no repara esa incoherencia narrativa. P2.4 debe incluir una prueba de no transferencia de secretos/biografía entre hablantes y evaluar contexto separado por turno, con su costo y presupuesto explícitos. No se reasignan frases automáticamente según quién «parece» que debería decirlas.

Cierre: pruebas de contenido, precedencia, inmutabilidad y conocimiento limitado; ausencia de datos se representa como desconocida. No se afirma que añadir contexto por sí solo haya corregido la conducta.

### P3. Coherencia de intención, comando y precondiciones — completada en el alcance documentado

- [x] **P3.1** Definir y probar la relación entre intención inmediata y `action`, contemplando negaciones, paráfrasis y objetivos de varios pasos. Cubrir R1 y compra/venta/consumo, desplazamiento, habla, empleo y `do`.
- [x] **P3.2** Extender comprobaciones de contradicciones de alta confianza con datos percibidos: uso/venta sin posesión, operación comercial incompatible con oferta observada, destinatario no presente, empleo/actividad/horario incompatibles y referencias incorrectas. No duplicar todo el validador del engine ni usar `options` como allowlist exhaustiva.
- [x] **P3.3** Revisar conjuntamente `intent`, acción y `remember` antes de devolver la propuesta. Rechazar resultados anticipados; permitir recuerdos afectivos o afirmaciones claramente atribuidas y respaldadas como declaraciones.
- [x] **P3.4** Añadir controles positivos: compra de provisiones teniendo comida, venta legítima, explorar un destino incierto, retrasar una promesa y asumir un riesgo explicado. La barrera no debe convertir esas elecciones en un guion obligatorio.

Cierre: R1 no atraviesa la barrera como propuesta coherente en las fixtures; los controles positivos pasan. Documentar límites lingüísticos de cualquier heurística; JSON válido no cuenta como éxito semántico.

Avance 18/09: R1 auténtico y R4a rechazados, controles de compra → consumo, venta, conversación y exploración aceptados. **P3.2 parcial:** oferta/stock/monedas locales y controles existentes comprobados; falta ampliar cobertura de permisos y alternativas de empleo/actividad. P3.1/P3.3 acreditan las contradicciones explícitas y fixtures descritas, no comprensión universal de paráfrasis. Las expresiones fuera de cobertura se registran en P5/P7.

### P4. Reparaciones que conservan la decisión — implementada y verificada localmente

- [x] **P4.1** Separar error de JSON/schema, contradicción semántica, inviabilidad observable, rechazo del mundo y objetivo no logrado. Una reparación sucede antes de ejecutar; un rechazo del mundo se trata en una decisión posterior.
- [x] **P4.2** Dar a la reparación una representación acotada de la propuesta y del error que permita conservar los campos no afectados. La salida anterior es dato no confiable; no se reenvía texto truncado o instrucciones espurias como autoridad.
- [x] **P4.3** Comparar propuesta original y reparada. Una reparación de `sell: "."` conserva objetivo, producto y destino si son viables; si el contexto muestra que no lo son, permitir reconsideración explícita y distinguirla en diagnósticos, sin añadir campos al protocolo.
- [x] **P4.4** Mantener el presupuesto existente de intentos y el comportamiento de modo estricto/fallback; comprobar OpenRouter y Anthropic sin exigir que tengan una implementación interna idéntica.

Cierre: R2 tiene pruebas tanto con compra viable como inviable. No se acepta una sustitución silenciosa como reparación fiel ni se fuerza una compra imposible. Costes, intentos y motivo final quedan identificados.

Avance 18/09: original acotado, comparación de campos, reparación de schema y semántica, modo estricto y fallback comprobados en ambos adaptadores con HTTP/SDK simulados. La captura R2 cambia de producto/destino sin conservar la decisión y ahora se detecta. **Completar P4 no significa que el modelo real siempre consiga reparar:** la repetición dirigida final agota el presupuesto en R2. La clasificación es estructural y lingüística acotada, no equivalencia general de objetivos ni de cambios en subcampos anidados.

### P5. Memoria, conversación y acuerdos fieles a su fuente — parcial

- [x] **P5.1** Definir dentro de cognition una representación mínima de afirmación, fuente, emisor, tiempo conocido, certeza y condición. Reutilizar datos existentes; cualquier estructura interna debe volver a las salidas canónicas actuales y no crear otra base de memoria.
- [x] **P5.2** Contrastar recuerdos de conversación con las líneas y sus hablantes. Conservar origen al repetir un rumor; impedir que el resumen invente otro emisor o un testigo externo. Cubrir R3, IDs/nombres, ambos participantes y paráfrasis en español.
- [ ] **P5.3** Preservar las etapas de un compromiso: propuesta, acuerdo, condición pendiente, condición cumplida, obligación efectiva y pago. Exigir evidencia para cada transición; si la condición no puede verificarse, dejarla pendiente/desconocida. No crear deudas del engine a partir de texto.
- [x] **P5.4** Contrastar reflexión con el contexto de evidencia disponible y revisar todos sus campos con afirmaciones relevantes: resumen, insights, creencias, proyectos, intenciones y comunicaciones. Una intención futura es válida; una premisa de éxito inventado dentro de ella sigue siendo un problema.
- [ ] **P5.5** Evitar nuevas afirmaciones físicas sin respaldo en `remember` y resúmenes, sin borrar recuerdos históricos. Una opinión o una mentira atribuida puede permanecer como tal; repetición y confianza creciente no constituyen corroboración.

  Caso adicional de la verificación real seed 468: `gen-1789716738-gVLdUPA8ohnxIE9hVkNg`
  mezcla «Hoy he llegado al pueblo y he buscado el horno» con un pago de alojamiento
  no acreditado. La comparación léxica marca primero la llegada compuesta; se
  separación de operaciones y llegada genérica resueltas localmente en P9.7, sin
  aceptar por ello el pago. Permanecen pendientes paráfrasis generales, objetos
  traducidos y construcciones fuera de la gramática acotada. No cerrar esta tarea
  reduciendo indiscriminadamente el control.
- [x] **P5.6** Aplicar las garantías al recorrido completo de los adaptadores, reparaciones y fallbacks compatibles; añadir casos positivos de compra, entrega, deuda y pago realmente respaldados para detectar exceso de rechazo.
- [x] **P5.7** Contrastar `projects[].done` de obras conocidas con contadores de construcción suministrados. Compartir esos datos entre prompt y validador; un paso del plan o una declaración de progreso no completa la obra. Probar trabajo real y restauración de snapshot sin modificar el engine.
- [x] **P5.8** Validar que actualizaciones de deseos referencien IDs visibles y eventos personales suministrados; un deseo nuevo empieza activo. Conservar reconsideraciones subjetivas a partir de conversaciones, sin convertirlas en recibos físicos. Comprobar reparación y fallback en los adaptadores.

Cierre: R3 y R4 no se devuelven como recuerdos/reflexiones fieles en las fixtures; las versiones con evidencia suficiente sí pasan. Si falta información para decidir, el resultado expresa esa limitación en lugar de inventar certeza.

Avance 18/09: R3 auténtico, alias/IDs, español y dirección A → B comprobados. Hay representación interna de fuente/emisor/tiempo y comprobación textual de condición/certeza, pero **P5.1** sigue parcial al no modelar cada afirmación y sus transiciones de forma explícita. **P5.3** comprueba condiciones y deudas suministradas; falta resolver contratos informales con entrega acreditada sin confundirlos con préstamos del engine. **P5.4–P5.5** recorren textos anidados y rechazan resultados sin evidencia, pero no validan indicadores booleanos de cumplimiento ni toda paráfrasis; se encontraron falsos rechazos reales. **P5.6** tiene cobertura de adaptadores/fallback y una entrega real, pero falta cerrar la secuencia completa de obligación y pago y ampliar controles positivos.

Segunda iteración 18/09: **P5.6 completado** para el recorrido y controles positivos descritos: compra/consumo, deuda suministrada, entrega y transferencia real, más reparación/fallback en ambos adaptadores. Se añadieron comprobaciones de salarios, actor/objeto, frecuencia sin duplicar eventos y negaciones. Se corrigió la pérdida accidental de `desire_id` para una acción idéntica, sin sobrescribir elecciones explícitas. **P5.3 permanece pendiente:** esto no implementa un intérprete general de contratos informales ni crea deuda en el engine. [Evidencia de la segunda iteración](cognition-coherence-evidence-2026-09-18.md#segunda-iteración-rechazos-y-recorrido-completo).

Tercera iteración 18/09: **P5.1 completado** con `SourceAssertion` y un marco de fuentes reconstruido en cada llamada de reflexión, compartido por prompt y validador. Conserva texto, referencia al input, tipo de fuente, hablante explícito, tiempo conocido, categoría de certeza y condición textual no verificada. Los formatos desconocidos permanecen desconocidos; una cita dentro de una interpretación no se convierte en testimonio independiente. Decisión y diálogo reutilizan el mismo lector para extraer evidencia física. Siete pruebas nuevas y los tres escenarios de persistencia/entrega/pago comprueban este contrato. P5.3 sigue abierto: representar una condición no demuestra cuándo se cumplió ni si quedó un pago pendiente.

La imagen aportada por el usuario se incorpora como **arquitectura objetivo**, con correspondencia y límites en [arquitectura](cognition-architecture.md#correspondencia-con-la-arquitectura-objetivo-del-usuario). No sustituye la evidencia del código ni acredita por sí sola menor repetición, menos fallbacks o memoria completamente fiable.

Cuarta iteración 18/09: **P5.3 avanza, conserva estado parcial**. `semantics/commitments.ts` enlaza una gramática acotada de ofertas de pago condicionado con aceptación explícita, entrega y transferencia compatibles, referenciando las fuentes. Contrasta emisor/receptor, objeto, importe y orden temporal; duplicados no cuentan como recibos nuevos. Acuerdos competidores o varias entregas quedan ambiguos. Pronombres, condiciones compuestas y saldos informales pendientes no se resuelven por suposición. Se incluyen 15 pruebas del módulo y tres escenarios adicionales de integración real. No se crea un registro de deuda ni se declara una transferencia como liquidación de ese acuerdo. Falta la transición verificable a obligación informal vigente y su liquidación; permanece abierta la evaluación real.

### P6. Continuidad, progreso y resultados anteriores — completada en el alcance documentado

- [x] **P6.1** Revisar el historial acotado de propuestas y diferencias observadas: distinguir repetición sin información nueva de persistencia razonable, espera deliberada, viaje en curso, acciones con efectos tardíos y actividades sociales válidas.
- [x] **P6.2** Mantener pendientes revisables y reconsiderar alternativas según urgencia, costes conocidos, oportunidades, recursos, distancia conocida y personalidad. No cancelar metas automáticamente por un tick sin cambios ni por `missed`.
- [x] **P6.3** Auditar si entradas ya disponibles permiten atribuir un resultado a la propuesta anterior de forma fiable y legítima para el personaje. Usar evidencia explícita cuando exista; en caso contrario conservar “resultado desconocido”. No añadir callbacks/recibos a `Brain` ni consultar un historial global oculto.
- [x] **P6.4** Probar aislamiento entre agentes/mundos, reinicio del Brain, caducidad y límites del historial, cambios por hábitos/terceros y carreras entre percepción y aplicación. `wait` con destino pendiente conserva su semántica existente.

Cierre: la secuencia intención → propuesta → evidencia no inventa causalidad; se documenta exactamente qué resultados son observables y cuáles no. P6.3 puede cerrarse con una limitación demostrada y manejo de desconocidos; **eso no equivale a haber implementado recibos completos**.

Avance 18/09: continuidad acotada, caducidad, reinicio, aislamiento de mundos/agentes, cambios ajenos y carrera percepción → ejecución comprobados. P6.3 cierra con ausencia demostrada de recibo dedicado y conservación de desconocidos. **P6.2 sigue abierto:** se orienta a reconsiderar alternativas, pero no se ha demostrado progreso sostenido; la muestra incluye decisiones repetidas y una corrida que alcanzó el límite de respuestas.

### P7. Verificar integración y comportamiento real — evaluación ejecutada; calidad global pendiente

- [x] **P7.1** Ejecutar pruebas unitarias y de adaptadores con respuestas controladas, incluidos errores, reparaciones, fallback y falsos positivos. Cada regresión crítica debe fallar antes de su corrección y pasar después.
- [x] **P7.2** Ejecutar integración desde pruebas de cognition con el engine sin cambios: comprar → comprobar inventario → consumir → comprobar evento/estado; diálogo → recuerdo → reflexión; acuerdo condicional sin entrega y con entrega efectiva. Identificar el efecto probado en cada paso.
- [x] **P7.3** Ejecutar escenarios acotados con modelo real y sin fallback para medir al modelo; después corridas completas registrando cualquier fallback como resultado mixto. Guardar también fallos, reparaciones y respuestas rechazadas. No repetir hasta obtener solo un ejemplo favorable.
- [x] **P7.4** Comparar como mínimo tres seeds, incluida 84, con configuración registrada y escenarios equivalentes. Separar `tick 1` de `tick 60`; no atribuir a cognition diferencias causadas por cadencia, clima, pack o proveedor. La seed no vuelve determinista al LLM.
- [x] **P7.5** Registrar métricas con numerador, denominador y casos desconocidos: contradicción intención/acción, reparaciones fieles/reconsideraciones/cambios silenciosos, atribuciones erróneas, resultados inventados, condiciones perdidas, falsos rechazos, repeticiones sin progreso explicadas/no explicadas, errores técnicos, fallbacks, tokens, coste y latencia.

Cierre local: todas las fixtures críticas pasan, incluidos controles positivos, y no se introducen regresiones en contratos existentes. Cierre real: cero R1–R4 confirmados en las salidas aceptadas de la muestra predefinida, con cobertura efectiva de cada escenario; cualquier recurrencia reabre su objetivo. Los fallos detectados y reparados se cuentan por separado. Cero fallos en una muestra no garantiza perfección general.

Coste y latencia se compararán contra P1 y se documentará cualquier aumento. No se afirmará ahorro a partir de longitud de prompts ni mejora de calidad solo por aumentar consumo, empleo o acciones ejecutadas. La creación inicial del plan fue documental; las llamadas pagas posteriores corresponden a su ejecución solicitada por el usuario.

Avance 18/09: **P7.1 parcial:** suite local ampliada y comprobaciones generales ejecutadas; R1/R4a sintéticos fallaron antes de corregir, pero no se ejecutó toda la suite R2/R3/R4b contra el checkout anterior. **P7.2 parcial:** compra → consumo, entrega y carrera con engine real comprobados; falta la cadena completa diálogo → memoria persistida → reflexión → obligación/pago. **P7.3 completado como ejecución de la evaluación**, con rechazos y fallback conservados: no equivale a validar la calidad. **P7.4/P7.5** mantienen abiertos la equivalencia de corridas completas y el etiquetado independiente de todas las métricas semánticas. Los contadores del validador no son una auditoría independiente de su exactitud.

Segunda iteración 18/09: **P7.2 completado** con tres escenarios de `coherence-integration.test.ts`: promesa, entrega sin pago y entrega pagada. El engine persiste la conversación, guarda/restaura el snapshot y construye el contexto real de reflexión; el adaptador OpenRouter usa HTTP controlado, modo estricto y tres respuestas por escenario, sin reparación ni fallback. Se comprueban inventarios, monedas, fuentes y ausencia de préstamos inventados. El replay real separado obtuvo 3/5 salidas aceptadas; no se modifican retrospectivamente los resultados de las seis simulaciones anteriores. La auditoría offline solo reevalúa los campos registrados, no reemplaza P7.4/P7.5.

### P8. Cierre documentado — parcial

- [x] **P8.1** Actualizar contrato semántico, arquitectura y límites según el comportamiento implementado, sin reescribir resultados históricos como actuales.
- [x] **P8.2** Adjuntar informe final con pruebas, muestra real, métricas, fallos restantes y frontera de observabilidad. Verificar la frontera de engine/protocolo y la igualdad con los originales en inglés restaurados por la autorización de P0.4.
- [ ] **P8.3** Cerrar cada objetivo solo con evidencia o dejarlo pendiente con causa concreta. Declarar terminado el plan únicamente cuando se cumplan los criterios anteriores; una limitación aceptada debe describirse como límite, nunca como capacidad implementada.
- [x] **P8.4** Petición adicional del usuario: añadir `dialogue` para leer el habla sin recuerdos ni reflexiones. Distinguir salida aceptada de cognition y evento confirmado del mundo; comprobar texto completo, UTF-8, hablantes, ausencia de habla rechazada y aislamiento de errores del logger. [Uso y filtro](openrouter-console-logs.md#ver-solamente-lo-que-hablan-los-personajes).
- [x] **P8.5** Guardar diagnósticos de headless en `run.log` y estado en `run.json`, además de eventos y diálogo. Verificar cierre normal, fallo, interrupción, protección contra sobreescritura, UTF-8 y metadata tardía del proveedor; documentar las rutas y los límites de las corridas históricas. [Archivos y uso](openrouter-console-logs.md#archivos-guardados-por-headless).

Orden previsto: P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8. Cada fase incorpora sus pruebas al implementarse; P7 consolida integración y medición real. Si P1 revela otra causa, se ajusta el plan conservando IDs y justificando el cambio.

### P9. Regresiones de la prueba del usuario, seed 468 — completada en el alcance vigente

- [x] **P9.1** Rechazar `trade.with` que apunta a un puesto de trabajo, destinatario inventado o tienda remota; mantener compras locales y personas presentes, y preservar producto/objetivo en la reparación del destinatario.
- [x] **P9.2** Convertir alias de hablante A/B a IDs del contexto antes de devolver el diálogo al engine. Probar B primero, intervenciones consecutivas y marca de fallback; conservar contenido y outcomes sin intercambiar personajes por heurística narrativa.
- [x] **P9.3** Corregir falsos positivos de promesas y alojamiento prepagado. Informar conjuntamente los errores de schema conocidos, incluidos ID/evidencia de deseos y campos de creencias, dentro del mismo presupuesto de reparación.
- [x] **P9.4** Incorporar a headless `dialogue.jsonl`, el primer dinámico del servidor y protección ante reutilización de directorios con artefactos. Probar el comando real con mock y verificar que un intento repetido no sobrescribe eventos anteriores.
- [x] **P9.6** Corregir el falso cambio de objetivo al añadir `desire_id` previamente ausente a una acción idéntica durante la reparación. Reproducir el caso de la muestra real y proteger cambios de destino o sustitución de una asociación ya elegida. Verificación local con dos respuestas, sin fallback adicional.
- [x] **P9.7** Separar cláusulas físicas coordinadas, conservar negación/cita/condición en su alcance acotado y respaldar una llegada genérica con `agent.arrive`. Exigir evidencia del destino concreto, excluyendo el destino pendiente del recibo de movimiento. El diagnóstico de llegada + pago debe señalar el pago no acreditado. Verificar controles positivos/negativos y reparación a través del adaptador.

P2.4 también recoge la mezcla de papeles/secretos. La correspondencia entre el pagador A/B del contexto y el par usado para guardar outcomes cuando cambia el pagador requiere una prueba específica: cognition no recibe el orden del par original; cualquier solución que requiera modificar el engine queda fuera del alcance actual. Se documenta como limitación, no se intenta adivinar ese orden. P7.4/P7.5 siguen exigiendo muestra completa comparable y auditoría semántica independiente.

La revisión detallada, generaciones originales y pruebas están en [auditoría seed 468](cognition-seed468-review-2026-09-18.md).

### P10. Regresiones de la corrida de un día, seed 853 — completada en el alcance documentado

- [x] **P10.1** Corregir el falso rechazo de contratación al aplicar a `taken on` la frecuencia de `talked twice`. Reproducir con la solicitud original y mantener rechazos de contrataciones duplicadas y compras posteriores no respaldadas.
- [x] **P10.2** Rechazar el recuerdo `Rosa took the loaf` sin recibo; separar ofertas/promesas posteriores de la adquisición afirmada. Reconocer recepción respaldada por `agent.give` y toma respaldada por `agent.take`, con receptor, objeto, origen explícito y frecuencia correctos. Verificar reparación, fallback y expresiones comunes que no son transferencias.
- [x] **P10.3** Contrastar las premisas físicas reconocidas de `intent` sin bloquear objetivos futuros: caso real `Rosa gave me soup for the loaf` seguido de una compra. Solo evidencia seleccionada, identidad del propio agente y deudas suministradas; ausencia de recibo es desconocimiento. OpenRouter/Anthropic, reparación conjunta de contradicción y premisa, protección del objetivo y fallback comprobados. Alcance acotado a las operaciones/expresiones del comprobador; P5.4 sigue abierto para cobertura general.
- [x] **P10.4** Ampliar atribución y paráfrasis sin confundir portar con entregar: `Petar brought a loaf`, `He brought me a loaf like he said` y equivalencia `loaf`/`bread`. Resolver sujeto y alcance de la declaración antes de afirmar recepción, intercambio o consumo. Vinculado a P5.5; la instrucción adicional al prompt no cierra esta garantía.

La muestra usa los originales ingleses y `tick 60`: 59 eventos, cuatro compras,
tres consumos y ninguna transferencia. El adjunto no incluye el cierre de las
llamadas del proveedor; los artefactos del mundo sí completaron el día. No se
infiere un total final de tokens, coste o fallbacks de un extracto incompleto.
Se mantienen abiertos P2.4 (privacidad/biografía narrativa) y P7.4/P7.5 (evaluación
real comparable). [Auditoría, capturas y pruebas](cognition-seed853-review-2026-09-18.md).

Iteración 9: P10.3 se cierra con diez tests nuevos de decisión/integración y uno
de Anthropic. Cinco regresiones iniciales fallaron antes del cambio. La entrega
real se reconoce tras restaurar un snapshot; decir que se entregó no basta.
No se consulta memoria no seleccionada ni se añade un recibo al engine. P10.4
mantiene pendientes pronombres/paráfrasis y acuerdos compuestos: una entrega de
sopa no demuestra por sí sola la contraprestación de pan de un supuesto trueque.

Iteración 10: **P10.4 avanza y sigue abierto**. `handed`, `delivered` y `received`
se contrastan con entregas observadas, respetando dirección, objeto y origen.
Portar, tomar, comprar o hablar no se convierten en recibo de una entrega ajena.
Un comercio documentado sin mercancías respalda «comercié con X»; no respalda
mercancías reconstruidas desde inventarios. Dos regalos recíprocos no certifican
su vínculo con un trueque. Se comprueban reparación y un comercio real con
restauración de estado. Siguen pendientes la atribución de `brought`, pronombres
ambiguos, alias de objetos y formas no reconocidas de intercambio.

Estado actual tras retirar la tarea editorial por decisión del usuario:
**39 objetivos completados y 13 pendientes; ninguno diferido**. La eliminación
de una tarea no se cuenta como implementación completada.

Iteración 12: **P10.4 avanza y permanece abierto**. Se detecta la afirmación
original `He brought me a loaf like he said, even if it's a bit stale...` sin
tratar el hecho principal como cita o condición. `brought X` se distingue de
`brought me X` / `brought X to me`; la recepción exige destinatario y objeto
compatibles. Los pronombres sin referente explícito solicitan reparación, sin
adivinar identidad ni confundir el inglés `he` con el narrador. Diez tests
nuevos cubren la captura, reparación, fallback y entrega real tras restauración.
Siguen pendientes equivalencias `loaf`/`bread`, anáforas generales y atribución
de transferencias a acuerdos; no se modifica la casilla de cierre por esta
ampliación acotada.

### P11. Revisión de Monchi, tres personajes — correcciones acotadas verificadas; calidad pendiente

- [x] **P11.1** Recuperar los seis requests/outputs y cruzar la opinión con los eventos seleccionados. Confirmado: Rosa comió sopa dos veces y esa evidencia ya estaba en el request; el prepago inicial no prueba un pago activo propio.
- [x] **P11.2** Restringir IDs de deseos al contexto en ambos adaptadores y diagnosticar errores de prosa junto con el ID/esquema dentro del presupuesto vigente. Pruebas de reparación y fallback en dos respuestas; sin llamadas adicionales de diálogo.
- [x] **P11.3** Reconocer las formas probadas de llegada observada y alojamiento inicial/actual; conservar controles de sujeto, cantidad, lugar y transferencia. Añadir regresiones acotadas de contratación y `short-handed`, sin editar engine/protocolo.
- [x] **P11.4** Ejecutar una muestra real predefinida de las tres reflexiones, conservar resultados y revisar las mismas salidas offline tras los ajustes. Resultado real: 0/3 aceptadas y cero IDs de deseos inventados en seis respuestas. No se declara mejora global ni se repite la muestra buscando un resultado favorable.
- [ ] **P11.5** Resolver las frases coordinadas de llegada/cargo, finalidad de compra (`to eat`), referencia de consumo (`ate both`) y contaminación de rol en `self.summary`, con controles negativos. Ejemplos y generaciones en el [informe Monchi](cognition-monchi-review-2026-09-18.md#trabajo-que-permanece-abierto). Requiere nueva validación real posterior; complementa P5.5/P8.3.

### P12. Poncho — evidencia por llamada y correcciones acotadas

- [x] **P12.1** Recuperar 32 requests/outputs y contrastarlos con 69 eventos y 18 intervenciones. Preservar 15 respuestas problemáticas/relevantes como fixtures, separar estado reconstruido y contexto original, y documentar las once observaciones del usuario.
- [x] **P12.2** Corregir las formas probadas de prepago/llegada, monedas escritas, salario frente a precio y comidas coordinadas. Incorporar controles de cantidades, lugar, pago activo, orden `then`, `bowl of soup` y `ate both/them both` con recibos independientes. Avance parcial de P11.5, no cierre de toda paráfrasis.
- [x] **P12.3** Explicitar claves y límites de reflection desde el primer request y en su única reparación; diagnosticar prosa válida aun con schema incompleto. Normalizar solo `self:null` opcional; conservar errores originales, rechazar aliases y evitar pérdida silenciosa de campos extra. Diagnosticar `action.buy` junto con memoria cuando ambos errores ya son visibles.
- [x] **P12.4** Distinguir historia/aspiración de cargo institucional explícito y propuesta de habla de frase ejecutada. Regresión con engine real que rechaza say después de un cambio de ubicación, sin persistir el saludo anticipado. Probar logs compactos y todos los eventos; ejecutar tests/typecheck y cotejar archivos protegidos.
- [ ] **P12.5** Resolver acceso a recibos reales omitidos del contexto de decisión: sopa (evento 16) y viaje al mesón (evento 8). Hoy cognition no recibe notificación de ejecución; no se reemplazará con inferencias de inventario/monedas ni propuestas anteriores. Diseñar una ruta de evidencia dentro del alcance autorizado, conservando engine/protocol y sin almacén paralelo omnisciente.
- [ ] **P12.6** Resolver atribución pronominal entre campos (`gen-1789760274-ehVDJm69WCVH6AznvH4P`, `She said she is mayor now`), ambigüedad de cargo y referencias no locales. Validar los cambios con nueva corrida real comparable antes de afirmar menos fallbacks o cerrar P8.3/P11.5. El pase offline de un validador no certifica fidelidad de toda la respuesta.

Detalle de clasificaciones, generaciones, tests y límites: [informe Poncho](cognition-poncho-review-2026-09-18.md). Los fallbacks originales permanecen: tres de decisión y tres de reflexión. No se modifica la gaceta.

## Cobertura del adjunto: los 33 puntos

El adjunto se sintetiza aquí para que el plan no dependa de una ruta temporal. Los puntos sin datos suficientes requieren señal explícita de desconocimiento, no inventar información ni modificar el engine.

| Nº original | Requisito conservado | Fases responsables |
| --- | --- | --- |
| 1 | Estado físico y urgencia reales; hambre no implica falta de comida. | P2, P3 |
| 2 | Inventario, cantidades y posibilidades de uso antes de adquirir/consumir. | P2, P3 |
| 3 | Dinero, recursos, propiedad y autoridad efectiva para utilizarlos. | P2, P3 |
| 4 | Ubicación, presencia y oportunidades locales actuales. | P2, P3 |
| 5 | Destino/heading y motivo; tiempo restante solo si está disponible. | P2, P6 |
| 6 | Cambios desde la última decisión sin causalidad inventada. | P1, P6 |
| 7 | Propuestas anteriores separadas de resultados. | P4, P6 |
| 8 | Coherencia de intención y operación inmediata. | P3 |
| 9 | Precondiciones de use, trade, say, move, apply y do. | P3, P7 |
| 10 | Semántica exacta de comprar, vender, consumir, llegar, hablar y aplicar. | P2, P3 |
| 11 | Ofertas observadas; stock/edificio/rumor no garantizan venta/NPC. | P2, P3 |
| 12 | Personas conocidas, presentes y disponibles; sin personajes garantizados por rumor. | P2, P3, P5 |
| 13 | Procedencia y emisor de cada afirmación. | P5 |
| 14 | Certeza y verificación diferenciadas. | P2, P5 |
| 15 | Metas, deseos, miedos y prioridades dentro de la realidad percibida. | P2, P6 |
| 16 | Intenciones pendientes y recuperación tras interrupciones. | P6 |
| 17 | Plan diario; done/missed no prueban cumplimiento/cancelación. | P2, P5, P6 |
| 18 | Compromisos de conversación revisables y con continuidad. | P5, P6 |
| 19 | Condiciones de acuerdos y etapas de obligación/pago. | P5 |
| 20 | Acciones ajenas observables y posible obsolescencia de la percepción. | P1, P6, P7 |
| 21 | Hora, día, horarios y cadencia; no inventar duración de acciones. | P2, P6, P7 |
| 22 | Prioridad razonada entre necesidades, metas e interrupciones. | P3, P6 |
| 23 | Progreso del objetivo distinguido de mera actividad. | P6, P7 |
| 24 | Reconsiderar ausencia de progreso sin inferir rechazo automático. | P6 |
| 25 | Alternativas conocidas: producir, preguntar, esperar, cambiar o posponer. | P3, P6 |
| 26 | Costes conocidos de dinero, tiempo, cuerpo y oportunidad. | P2, P6 |
| 27 | Personalidad y decisiones imperfectas pero coherentes. | P3, P6, P7 |
| 28 | Saber del personaje separado del saber del sistema/jugador. | P2, P5, P6 |
| 29 | No inventar resultados en remember, conversación o reflexión. | P3, P5 |
| 30 | Reparar conservando intención cuando sea posible. | P4 |
| 31 | Distinguir fallo técnico, semántico, rechazo y objetivo no conseguido. | P1, P4, P6 |
| 32 | Resultado anterior comprobado si está disponible; límite explícito si no. | P1, P6, P7 |
| 33 | Comprobación final de coherencia antes de emitir action. | P3, P4, P7 |

## Verificaciones previstas

Comandos existentes, desde la raíz del repositorio:

```powershell
pnpm --filter @unwatched/cognition typecheck
pnpm --filter @unwatched/cognition test
pnpm --filter @unwatched/engine test
pnpm typecheck
pnpm test
git diff --check
git diff -- packages/engine packages/protocol
```

Por fase se ejecutan las comprobaciones pertinentes; las generales corresponden al cierre de integración. La creación inicial fue documental; durante la implementación se añadieron y ejecutaron las pruebas descritas en el informe de evidencia.

Existen `packages/cognition/scripts/verify-semantics.ts`, `packages/cognition/scripts/check-continuity.ts` y `apps/headless/src/soak.ts`. Se añadieron `check-coherence.ts` y `soak-coherence.ts` para reproducción dirigida y simulación real; sus comandos y límites están en el informe. Las ejecuciones nuevas guardan artefactos en directorios distintos de los históricos, sin secretos.

## Cómo se actualizará el avance

Al finalizar una tarea, en la misma entrega:

1. Cambiar únicamente su casilla a `[x]` si su criterio de aceptación está demostrado.
2. Añadir una entrada al registro con ID, fecha, archivos, comandos/resultados y enlace a evidencia.
3. Indicar proveedor simulado o real, uso de fallback, incertidumbres y dependencias pendientes.
4. Si reaparece el fallo, reabrir la casilla y registrar la regresión; conservar la evidencia anterior.

No marcar P2–P6 completadas por funcionalidades preexistentes sin volver a verificar los casos exigidos. No confundir “implementado”, “verificado localmente” y “validado en la muestra real”.

| Fecha | IDs | Estado y evidencia | Pendiente siguiente |
| --- | --- | --- | --- |
| 18/09/2026 | P0.1–P0.3 | Plan creado tras inspeccionar contratos y código actual. Alcance documental; engine y código de ejecución sin modificaciones de esta tarea. | P1: identificar la corrida y reconstruir R1–R4 con las entradas exactas. |
| 18/09/2026 | P1.1–P1.3; P2.1–P2.3 | Capturas originales recuperadas; baseline y fixtures; contexto ordenado con percepción completa e inventario de planificación. | Completar reproducción histórica y pruebas de privacidad. |
| 18/09/2026 | P3.1, P3.3–P3.4; P4.1–P4.4; P5.2 | Barreras de intención, evidencia, atribución y reparación. Regresiones auténticas y controles positivos; conservación de presupuesto de llamadas. | Reducir falsos rechazos y validar transiciones de acuerdos y proyectos. |
| 18/09/2026 | P6.1, P6.3–P6.4; P7.3; P8.1 | Límites de observabilidad comprobados; replay y matriz real registrados; contrato y arquitectura actualizados. [Resultados y pendientes](cognition-coherence-evidence-2026-09-18.md). | P7/P8 permanecen abiertos: la muestra contiene fallos, una corrida incompleta y métricas semánticas sin auditoría total. |
| 18/09/2026, iteración 2 | P5.6; P7.2 | Secuencia completa con engine real y HTTP simulado; correcciones de evidencia, negaciones, anuncio de viaje y asociación del deseo. Auditoría offline y nuevo replay conservados. | P5.3–P5.5: contratos informales, cumplimiento de proyectos, paráfrasis y contenido añadido sin fuente; P7: nueva muestra integral y auditoría independiente. |
| 18/09/2026, iteración 3 | P5.1 | Marco explícito de fuentes por llamada, siete regresiones y comprobación de procedencia después de restaurar el snapshot. Imagen objetivo contrastada con el flujo real. | P5.3: transiciones verificables del compromiso; P5.4–P5.5 y P7 mantienen sus límites. |
| 18/09/2026, iteración 4 | P8.4; avance parcial P5.3 | Campo `dialogue` en logs de conversación aceptada y eventos de habla del servidor. Trazas de oferta/aceptación/entrega/transferencia con fuentes y comprobación temporal. | P5.3: obligación vigente y liquidación informal; P5.4–P5.5 y evaluación integral siguen abiertos. |
| 18/09/2026, revisión seed 468 | P9.1–P9.4 | Regresiones con outputs y contextos originales; destinatarios de comercio, IDs de hablantes, falsos rechazos y reparación conjunta. Headless con diálogo confirmado, primer común y directorios protegidos. | P2.4: identidad/privacidad narrativa; P7: evaluación integral. |
| 18/09/2026, verificación real seed 468 | P9.6; evidencia P7 | 59 eventos, cuatro compras y cuatro consumos, cero rechazos del mundo; 28 respuestas LLM y dos fallbacks. El de decisión revela un falso drift por añadir asociación, corregido y probado después de la corrida. [Auditoría y límites](cognition-seed468-review-2026-09-18.md). | P5.5: paráfrasis y operaciones mezcladas; P2.4 y evaluación integral siguen pendientes. |
| 18/09/2026, iteración 6 | P0.4; P9.7; avance parcial P5.5 | Originales en inglés restaurados por solicitud expresa; pruebas de cláusulas, destino y reparación. [Evidencia](cognition-coherence-evidence-2026-09-18.md#iteración-6-cláusulas-y-originales-en-inglés). | P5.5 conserva gramática limitada; P2.4 y evaluación real permanecen abiertos. |
| 18/09/2026, iteración 7 | P5.7–P5.8 | Validación de `done` contra construcción y referencias de deseos contra eventos propios. Pruebas antes/después, adaptadores, fallback y obra real restaurada. | P5.4–P5.5 conservan límites para proyectos genéricos/paráfrasis; P2.4 y evaluación integral siguen abiertos. |
| 18/09/2026, iteración 8, seed 853 | P10.1–P10.2 | Generaciones originales recuperadas; falso rechazo de contratación y recepción de objeto sin evidencia corregidos. 237 tests de cognition, reparación y fallback controlados, integración con entrega real. | P10.3–P10.4 explicitan premisas físicas en intent y paráfrasis de entrega; P2.4 y evaluación integral siguen abiertos. |
| 18/09/2026, iteración 9 | P10.3 | Premisas físicas de intent contrastadas con evidencia seleccionada; reparación del caso original y fallback con presupuesto intacto. 248 tests de cognition y typecheck general correctos. | P10.4: paráfrasis, pronombres y reciprocidad del intercambio; P5.4, P2.4 y evaluación real mantienen sus límites. |
| 18/09/2026, iteración 10 | Avance parcial P10.4; alcance editorial retirado | Recepción/entrega con dirección y objeto; incertidumbre del trueque y límite de detalle del evento real. Diez tests nuevos; 258 tests de cognition correctos. | P10.4 conserva brought, pronombres y equivalencias; P5.4, P2.4 y evaluación real siguen abiertos. |
| 18/09/2026, iteración 11 | P8.5 | Persistencia de diagnósticos y estado de headless; 14 pruebas con fallos, interrupción y HTTP controlado. Soak mock de un día conservado: 55 eventos, 10 registros de diálogo y 16 frases. | P10.4, privacidad P2.4 y evaluación real siguen abiertos; esta instrumentación permite conservar las próximas muestras completas. |
| 18/09/2026, iteración 12 | Avance parcial P10.4 | Atribución de brought, alcance de like he said y concesiones, y rechazo de actores no resueltos. Captura original, reparación en dos respuestas, fallback y entrega real restaurada; 268 tests de cognition correctos. | Equivalencias de objetos, anáforas y vínculo con acuerdos; P2.4 y evaluación real permanecen abiertos. |
| 18/09/2026, iteración 13 | P1.4, P2.4, P3.2, P5.4, P6.2, P7.1, P7.4–P7.5, P8.2, P10.4 | Privacidad pública por elección del usuario; precondiciones observables; cobertura de campos de reflexión; preservación de repair; alias loaf/bread; atribución y viajes prematuros. Nueve corridas de seeds 84/85/86, auditoría manual separada del validador, replay estricto 4/5 y comparación controlada antes/después de las cinco regresiones. [Informe y límites](cognition-coherence-final-review-2026-09-18.md). | P5.3: asignación de transferencias a acuerdos informales desconocida. P5.5: negación histórica y modalidad de aceptación/rechazo. P8.3: criterio de calidad global no alcanzado; últimas correcciones comprobadas localmente/offline. |
| 18/09/2026, iteración 14 | P11.1–P11.4 | Requests/outputs originales de Monchi, consumo de sopa confirmado, esquema contextual de deseos, diagnóstico conjunto y correcciones acotadas de llegada/alojamiento/contratación. Prueba real: 0/3 reflexiones aceptadas; ajustes posteriores comprobados offline. [Informe y artefactos](cognition-monchi-review-2026-09-18.md). | P11.5 concreta nuevos casos de coordinación, finalidad, referencia y rol; P5.3/P5.5/P8.3 continúan abiertos. |
| 18/09/2026, iteración 15 | P12.1–P12.4; avance P11.5 | Auditoría Poncho, 23 regresiones nuevas, 573 tests correctos y typecheck. Prepago y hechos compuestos, schema/repair, cargo y habla propuesta. Logs de todos los eventos y JSON compacto, control mock con 68 eventos. | P12.5 recibos ausentes y P12.6 atribución/ambigüedad/evaluación real. No se afirma menos fallbacks. |

### Criterios concretos para los objetivos abiertos

- **P5.3:** con una entrega y una transferencia independientes no se puede afirmar qué contrato quedó pagado. Mantener `outstanding: unknown` hasta disponer de evidencia inequívoca, conservando engine y protocolo. Las pruebas actuales acreditan la separación de etapas, no una liquidación informal general.
- **P5.5:** resolver sin regresiones las capturas `baseline/84/19` (niega haber visto un lugar visitado) y `baseline/85/11` (posible aceptación convertida en rechazo), más controles de negación, modalidad y ausencia de evidencia. No cerrar agregando términos indiscriminadamente ni borrando recuerdos históricos.
- **P8.3:** repetir una muestra predefinida con la revisión final, cubrir realmente los escenarios faltantes y cumplir el criterio de cero R1–R4 confirmados en salidas aceptadas. Los datos de las corridas fallidas quedan inmutables. No se equipara un rechazo seguro o fallback a una respuesta válida del modelo.
- **P11.5:** resolver las capturas identificadas en Monchi con pruebas positivas/negativas y nueva evidencia real. Una revisión offline que pasa el validador no demuestra por sí sola fidelidad completa ni éxito de una simulación.

Los cierres de P5.4/P6.2/P10.4 acreditan el recorrido y los casos acotados del informe. No amplían su alcance a toda paráfrasis, progreso obligatorio de metas, resolución de cualquier pronombre ni traducción universal de objetos. P7.5 conserva explícitamente denominadores, observabilidad desconocida y rechazos cuyo diagnóstico completo no está auditado.
