# Contrato semántico de cognición — 17/09/2026

> Current language contract: English only. Spanish grammar branches have been removed. See [English-only review](english-only-review-2026-09-18.md). Older dated reports and raw captures remain historical evidence.

Actualización del 18/09/2026: [plan y casillas de avance](cognition-coherence-plan-2026-09-18.md) y [capturas, implementación y evaluación](cognition-coherence-evidence-2026-09-18.md). Las mediciones de las secciones históricas siguientes no acreditan esta actualización.

La [revisión consolidada](cognition-coherence-final-review-2026-09-18.md) registra nueve corridas y los límites abiertos. Por elección expresa del usuario, diálogo usa contexto público sin biografías, secretos ni estado privado de ninguno de los personajes, conservando el presupuesto de llamadas. Solo nombres, temperamento, entorno público y habla seleccionada compartida; fallback con saludos y recuerdos vacíos. Decisión, planificación y reflexión conservan sus entradas personales correspondientes.

La comprobación de comercio exige `buy` cuando una elección directa nombra un producto observado; no se reimplementa la selección por defecto del engine. `semantics/preconditions.ts` valida contradicciones observables de empleo, regalos, reparaciones, propiedad y financiación. `semantics/attribution.ts` contrasta recuerdos posteriores con hablantes explícitos; fuentes insuficientes permanecen desconocidas. Se corrigen las expresiones de viaje y los falsos diagnósticos documentados en la revisión. Son reglas acotadas; no certifican toda negación, modalidad o paráfrasis.

## Alcance

Cambios exclusivos en `packages/cognition`, tests, script de verificación y documentación.
Sin cambios en engine, protocol, generación de Perception, simulación, salience,
ejecución de acciones, economía, persistencia/selección de memorias ni flujo de conversaciones.
No modifica reglas del mundo ni los schemas canónicos. Conserva la compactación de
schema y la política de caché de la auditoría de tokens anterior.

## Causas encontradas

- `options` enumera tipos soportados; no certifica sus precondiciones. Ni siquiera
  es exhaustivo: `offer/accept/refuse/settle` están en Action pero no en ActionKind.
- La sintaxis JSON no explica por sí sola la semántica de `work`, `call`, `trade`,
  `do` o la diferencia entre registrar un procedimiento y ejecutarlo.
- Planes, deseos y proyectos empujaban al progreso sin suficiente prioridad del
  cuerpo actual. El prompt de planificación omitía `agent.needs`, aunque ya estaba
  disponible en su contexto.
- Zod admite strings formalmente correctos que contienen bucles, instrucciones en
  lugar de items o especulación sobre las opciones. Antes no había una barrera semántica.
- El engine guarda `proposal.remember` antes de ejecutar la acción. Un recuerdo
  falso no necesita que la acción tenga éxito para incorporarse a la memoria.
  Se protege la salida del LLM, sin cambiar esa persistencia.
- Anthropic directo tenía una ruta de prompting distinta de OpenRouter; podía
  eludir las mejoras de los builders compartidos.

## Contrato de entrada

Se conserva el orden: reglas globales estables → persona estable → mecánicas
pertinentes → percepción dinámica completa. Los hechos actuales y la física
prevalecen sobre planes, recuerdos, deseos y personalidad. Los datos ausentes son
desconocidos. Una propuesta, prueba aislada, plan o relato no acredita ejecución.

El hambre urgente y el agotamiento normalmente preceden a actividades opcionales.
La guía pide examinar inventario, mostrador y monedas, sin introducir un catálogo
oculto de alimentos. Una decisión arriesgada consciente sigue permitida: debe
reconocer la necesidad urgente en `intent`. No se impone una acción única por personaje.

Las mecánicas locales aclaran:

- Trabajo salarial: empleo asignado, lugar y horario del turno; no domingo.
  `apply` solicita empleo. Construcción y huerta tienen otras precondiciones y
  no se presentan como salarios garantizados.
- `trade.buy/sell` son items; `with` identifica contraparte/lugar. Omitir `with`
  compra en el mostrador actual. Comprar agrega inventario; comer requiere `use` después.
- `call` nombra un lugar, no invoca una operación.
- `do` expresa un acto local sin representación específica, no una secuencia de
  desplazamiento, compra y consumo ni una vía para saltar precondiciones.
- `propose_skill` registra un procedimiento reutilizable cuando resulte útil;
  sus pasos contienen referencias concretas y no ejecutan nada al registrarse.
- `remember` es opcional: significado personal duradero, no reglas, especulación
  técnica ni éxito supuesto. Se mantienen las etiquetas de procedencia de `recent`.

Planificación recibe las necesidades ya disponibles y trata los pasos como
intenciones revisables. Reflexión refuerza que creencias repetidas y pasos del
plan alcanzados no demuestran que una operación física ocurrió.

## Barrera de salida

`semantics/quality.ts`, `decision.ts` y `lifecycle.ts` son funciones puras. No leen
el estado oculto ni modifican percepción o memoria. Después del schema canónico:

| Comprobación | Resultado |
| --- | --- |
| Bucles de palabras/caracteres, incluso anidados | Rechazar y pedir texto significativo |
| `work` contradice empleo/domingo/turno/debilidad explícitos | Pedir reconsiderar con las precondiciones percibidas |
| `use` o venta de un item no transportado | Explicar la separación adquisición/consumo/venta |
| Item o paso contiene una instrucción obvia, placeholder o puntuación sin nombre | Pedir nombre/ID concreto |
| `call.name` contiene un nombre de acción sin intención de nombrar un lugar | Pedir la operación en `action.kind` |
| `do` comienza una operación física representada | Pedir una sola acción concreta |
| Actividad opcional urgente sin reconocer el riesgo | Pedir reconsiderar o explicar la decisión personal |
| Recuerdo sobre opciones/schema/engine o etiqueta técnica aislada | Pedir omitirlo o expresar significado personal |
| Recuerdo afirma un resultado físico sin observación que respalde la misma afirmación | Pedir significado fundamentado o `remember: []` |
| Lugar de plan no presente en los lugares suministrados | Pedir un lugar suministrado o null |
| Reflexión almacena inferencias explícitas del sistema | Pedir contenido personal |

El chequeo de referencias no es una allowlist de items: acepta nombres desconocidos,
Unicode y productos nuevos. Los nombres observados prevalecen sobre la heurística
léxica. Los pasos futuros de una skill no necesitan poder ejecutarse hoy.

OpenRouter comparte el presupuesto existente de dos intentos entre errores de
JSON/schema, truncado y semántica. La reparación semántica añade el motivo y
la aclaración de que nada fue ejecutado. Desde el 18/09 también incorpora una
copia acotada de acción, intención y deseo, etiquetada como datos no confiables,
sin copiar recuerdos ni razonamiento del proveedor. Se comparan campos antes
y después: corrección fiel, reconsideración explícita o sustitución silenciosa.
Una compra inviable puede reconsiderarse; no se fuerza su ejecución.
No hay un segundo modelo juez ni un bucle de reparación ilimitado. Cada respuesta
se contabiliza en los callbacks existentes. Se registra código y campo del error.

Si ambos intentos fallan, se conserva la política `allowFallback`: en modo estricto
se lanza el error existente, sin entregar una respuesta sintética. Si se permite
fallback, la decisión MockBrain pasa por la misma barrera; si también falla,
devuelve `wait` marcado como fallback y memoria vacía. `wait` conserva exactamente
su significado en el engine, incluido continuar un desplazamiento pendiente.

Anthropic directo usa los mismos builders y validaciones para decisión, plan,
conversación y reflexión; decisión tiene una reparación semántica. Plan/reflexión
y conversación conservan su presupuesto de llamadas y política de fallback.
Los fallbacks de conversación/reflexión también se comprueban y se marcan como sintéticos.
OpenRouter aplica la comprobación general de repetición también a otras operaciones;
no cambia la estructura de las conversaciones.

## Verificación y medidas

### Comprobaciones incorporadas el 18/09/2026

`semantics/intent.ts` contrasta decisiones explícitas con la operación inmediata;
permite comprar para consumir después. `semantics/repair.ts` conserva la propuesta
que se intenta reparar. `semantics/evidence.ts` distingue registros personales de
eventos, observaciones y declaraciones. `semantics/dialogue.ts` contrasta hablante,
recuerdo y dirección del rumor: el campo canónico `outcome.rumor` representa A → B.
La reflexión contrasta sus campos de texto con evidencia personal y deudas suministradas.

Estas barreras son heurísticas acotadas en inglés. No demuestran equivalencia
general de paráfrasis, cumplimiento de todo contrato informal ni verdad de una
declaración. Una fuente incompleta puede exigir omitir una afirmación verdadera;
una expresión no reconocida puede escapar. Los indicadores `done` de proyectos no
se verifican semánticamente en esta entrega. No hay recibos nuevos ni memoria paralela.
El `trade` sin operación explícita conserva el default existente del engine.

En la segunda iteración del 18/09, los resultados reconocidos se descomponen por
operación, objetos, importes y frecuencia mínima. Los eventos se identifican por
ID para no contar dos veces el mismo recibo. Se reconoce el vocabulario real de
salarios, contratación y llegada; cobrar no prueba haber pagado, y observar que
otra persona entregó algo no prueba una entrega propia. Las negaciones contraídas
y el acto de anunciar un viaje tienen controles positivos específicos.
En una reparación de memoria con acción idéntica, un `desire_id` omitido se
conserva antes de validar; nunca se restaura si la asociación fue el campo
rechazado, la acción cambió o el modelo suministró una asociación explícita.

Los resultados originales R1–R4 y la muestra nueva, incluidos rechazos y fallbacks,
se informan por separado en el documento de evidencia. Las cifras siguientes
corresponden a la evaluación histórica del 17/09.

```powershell
pnpm --filter @unwatched/cognition test
pnpm --filter @unwatched/cognition typecheck
pnpm --filter @unwatched/engine test
```

Tests de regresión: hambre con recursos, agotamiento, empleo/domingo/turno,
excepciones de construcción, skills con instrucciones, nombres nuevos válidos,
`do`, memorias falsas o técnicas, repeticiones, reparación acotada, fallback,
inmutabilidad y estabilidad del prefijo. Incluyen SDK Anthropic simulado y HTTP
OpenRouter simulado. Resultado final: **95 tests de cognition correctos**, typecheck
de cognition correcto y **96 tests de engine correctos**, sin editar sus archivos.

Comparación local con el tokenizer conservado en `out/token-audit/tokenizer` sobre
las mismas 25 percepciones de la auditoría anterior: **+155 tokens por decisión**
en reglas compartidas + user, de 2.061,4 a 2.216,4 tokens medios en esos bloques.
No incluye persona, schema, envoltorios ni procesamiento del proveedor, que no
cambiaron en esta fase. Ninguna de esas 25 percepciones tenía urgencia: el aviso
urgente agrega texto sólo cuando corresponde. Es una comparación del contenido,
no una cifra facturada. Captura local: `out/cognition-semantics/token-texts.json`.

Script opt-in para escenarios reales, sin ticks ni ejecución ni guardar recuerdos:

```powershell
pnpm exec tsx packages/cognition/scripts/verify-semantics.ts --live out/semantic-check
# Un caso puntual:
pnpm exec tsx packages/cognition/scripts/verify-semantics.ts --live out/semantic-check-one starving_counter
```

Usa `.env`, routing y modelo configurados, sin fallback sintético. Hasta dos
respuestas por escenario; los errores de transporte no se repiten de forma incierta.
Guarda contexto, resultado, uso y logs localmente. Sus expectativas de conducta
son deliberadamente más estrictas que el contrato general y pueden fallar ante
una alternativa legítima. No es un test determinista ni prueba equivalencia del mundo.

Pruebas reales con `deepseek/deepseek-v4-flash-0731`:

- En la primera tanda hubo compra de pan, descanso y rechazo práctico del trabajo
  dominical; también un timeout y confusión de `call` con invocar `propose_skill`.
  Se añadió una regresión y una aclaración general para `call`.
- En la segunda tanda (`out/cognition-semantics/live-final`), 4/6 expectativas
  simples pasaron, pero **no equivale a 4 respuestas completamente satisfactorias**:
  hubo recuerdos triviales y habla sin destinatario. Fallaron la compra (campos
  de trade mal usados) y la expectativa de proponer skill (eligió moverse al lugar
  actual). Esos artefactos se conservan, sin ocultar las respuestas deficientes.
- Tras incorporar detección de items de puntuación/venta no transportada y etiquetas
  de memoria, el caso de hambre se repitió una vez de forma acotada
  (`out/cognition-semantics/live-trade-repair`). El primer output fue rechazado por
  `reference_not_name`; la reparación devolvió `trade.buy: soup`, `coins: 2`,
  `remember: []`. **2 respuestas, 3.795 tokens de entrada, 104 de salida,
  1.929 cacheados, USD 0,00022289 reportados**. No se ejecutó ni se afirmó consumirla.
- Los proveedores OpenInference/DeepInfra reportaron ~1.809–1.929 tokens por
  respuesta en estas pruebas; Sail Research ~5.225–5.239. La asociación se observa
  en los logs, pero no demuestra qué transformación interna produce la diferencia.
  No se alteró el routing para favorecer la medición. La caché tuvo hits reales.

No se repitió el soak completo en esta fase semántica; el benchmark histórico de
tokens está en su propio documento. Estas pruebas miden contratos y decisiones
aisladas, no trayectorias de un día ni equivalencia conductual entre ejecuciones.

## Límites y riesgos

Revisión seed 468 (18/09): `trade.with` admite omisión/ID exacto del lugar actual
para el mostrador local o referencia a una persona presente; los puestos de
trabajo y tenderos inventados no son destinatarios. Los adaptadores convierten
hablantes A/B a los IDs suministrados antes de devolver conversaciones, sin
reescribir sus frases ni outcomes. Una promesa positiva de pago se contrasta por
cláusula; «I promised nothing» no se combina con monedas mencionadas en otra frase.
«Two nights paid» describe alojamiento prepagado; «I paid» exige evidencia de pago.
OpenRouter informa hasta 12 errores de schema juntos manteniendo dos respuestas
máximas. Añadir `desire_id` antes ausente a una acción idéntica no constituye
cambio de objetivo; sustituir una asociación existente sigue sujeto al control
de reparación. Esto no certifica que la nueva asociación sea semánticamente correcta.

Iteración 6: el comprobador separa cláusulas coordinadas reconocibles y conserva
la condición o procedencia declarada de la frase. Una negación con sujeto explícito
no oculta una compra afirmada en otra cláusula; las listas de objetos siguen
exigiendo cada objeto. La puntuación dentro de citas delimitadas no convierte su
contenido en experiencia propia. `agent.arrive` respalda llegar al pueblo/isla;
un destino concreto requiere su propio recibo. En `agent.move`, el texto posterior
a `on the way to` es destino pendiente y no cuenta como llegada. Son reglas
acotadas, no traducción general ni un analizador completo de discurso indirecto.

Iteración 7: `context/reflection-updates.ts` proyecta los contadores de construcción
de proyectos seleccionados, deseos visibles y eventos personales de la reflexión.
El prompt y `semantics/reflection-updates.ts` comparten esa proyección. Un `done:true`
incompatible con el trabajo requerido recibe `project_completion_unverified`;
no se usa `AgentState.projects[].done` ni una descripción como recibo de obra.
La garantía se limita a proyectos con construcción identificable por el título
suministrado: los objetivos personales genéricos siguen siendo subjetivos.

IDs de deseos desconocidos, referencias a eventos ausentes/ajenos y cambios de
estado de deseos que todavía no existen generan errores de reparación concretos.
Una conversación puede motivar una reconsideración; citarla no acredita entrega,
pago ni construcción. Se conservan el límite de respuestas y los fallbacks de
cada adaptador. El engine ya rechazaba/ignoraba estas operaciones incompatibles;
este control permite corregirlas antes de devolver la reflexión.

En la iteración 9, `intentPremiseIssue` recibe propuesta, percepción y nombre
propio opcional; devuelve `intent_unverified_premise` en `intent` o `null`.
Reutiliza el lector de fuentes y el comprobador físico, con `Perception.recent`
y las deudas percibidas. El nombre solo resuelve primera persona; no se consultan
memorias ocultas, inventario ajeno ni eventos globales. Ambos proveedores pasan
esa identidad ya incluida en su contexto. Por ejemplo, «Rosa gave me soup» necesita
una observación de entrega a este agente; una conversación o interpretación no basta.

Futuros, pasivas de propósito, condiciones, negaciones y declaraciones atribuidas
reconocibles no se interpretan como resultados consumados. `because`/`so` separan
premisas y consecuencias; una meta futura no oculta automáticamente una compra
pasada en otra cláusula. Si también contradice la acción, el diagnóstico
informa ambos problemas para permitir corregirlos dentro de dos respuestas.
Reparar la premisa conserva la acción y el objetivo, salvo reconsideración
explicada. El fallback pasa por el mismo control. Esto sigue siendo una gramática
acotada: no certifica trueques completos, todas las paráfrasis ni causalidad.

Iteración 10: el comprobador compartido reconoce `handed`/`delivered` como
afirmaciones de transferencia y `received` como recepción. Proyecta una entrega
observada hacia el receptor, conservando fuente, ID y origen para contrastar el
texto. La operación interna `receipt` existe solo durante esa comprobación: no
es un evento, acción ni memoria nueva del engine. Una toma o compra no demuestra
por sí sola recepción desde la persona indicada; el contenido de una cita tampoco.
Se conservan objeto, cantidad reconocible, frecuencia y destinatario. `loaf` no
se transforma automáticamente en `bread` y una entrega no acredita consumo.

`traded`/`exchanged`/`swapped` requieren evidencia de comercio compatible. El evento
actual entre personas solo dice quién comerció con quién, por lo que permite una
afirmación genérica pero deja desconocidos los bienes intercambiados. Las compras
locales y dos regalos recíprocos no se combinan para inventar ese detalle o enlace.
Una entrega afirmada «in exchange for» recibe `exchange_unverified` si solo hay
recibos de regalos; su reparación conserva las entregas por separado y la relación
como desconocida. La forma abreviada `for the/a/an ...` se trata así solo cuando
un recibo de regalo suministrado identifica el supuesto bien de contraprestación:
`for the journey` no se interpreta automáticamente como trueque.

La iteración 12 distingue `brought X` (portar/traer) de `brought me X` y
`brought X to me` (entrega al narrador). Traer un objeto requiere observación
compatible; una entrega no acredita un viaje o transporte concreto. La forma
con destinatario admite la proyección de un recibo `agent.give` que conserva
actor, receptor, objeto, ID y fuente. Habla, inventario actual y observaciones
de portar no acreditan esa entrega. `carrying` es una etiqueta interna del
comprobador; no añade eventos ni estado al engine.

Los finales `like he said` / `as promised` no convierten el hecho precedente
en una cita o hipótesis. Una concesión posterior delimitada por coma
(`even if ...`) tampoco elimina esa afirmación. Las citas, condiciones y
atribuciones explícitas siguen conservando su alcance. Comprobar la entrega
física no certifica por sí solo cumplimiento de un acuerdo o contraprestación.

Los actores pronominales no resueltos (`he`, `she`, `they`, etc.) requieren
reparación con un nombre explícito: no se sustituyen por el narrador ni por el
actor de un recibo conveniente. El comprobador no realiza resolución general de anáforas.

Estos controles son acotados. Comunicación, apoyo y algunas expresiones comunes
se excluyen del control de inventario; eso no certifica su veracidad. Equivalencias
como `loaf`/`bread`, otras construcciones y enlaces entre acuerdos/transferencias
continúan pendientes. Se prefiere describir las observaciones disponibles y
calificar lo desconocido, sin declarar falso lo que no está documentado.

En la iteración 8, `talked`, `offered` y `promised` delimitan
  cláusulas: hablar dos veces no exige contratar dos veces, y una promesa posterior
  no justifica una recepción anterior. `took` con objeto se contrasta contra una
  toma o entrega al receptor correcto; la proyección de `agent.give` conserva ID,
  emisor y fuente, y no implica robo. Actividades/expresiones comunes se excluyen.
  No resuelve toda paráfrasis de portar/entregar; las premisas físicas de `intent`
  se incorporaron con el alcance acotado descrito en la iteración 9;
  véase [la revisión seed 853](cognition-seed853-review-2026-09-18.md).

- Son heurísticas acotadas, en inglés; no un verificador universal
  del significado. Una frase truncada arbitraria o una inferencia implícita puede
  escapar. Las validaciones del engine siguen siendo autoridad de ejecución.
- Reconocer hambre en intent no prueba que el riesgo sea razonable. Se preserva
  deliberadamente ese espacio de personalidad; no se instala una política de
  supervivencia determinista.
- El respaldo de recuerdos físicos es conservador: paráfrasis/traducciones pueden
  pedir reparación aunque el evento sea real. Recuerdos afectivos y creencias
  explícitas siguen permitidos. No borra memorias incorrectas ya persistidas.
- Las reparaciones suman latencia y tokens sólo cuando fallan los controles. Un
  modelo que insiste en usar mal el contrato puede agotar ambos intentos.
- La representación interna de procedencia se incorporó el 18/09 en
  `semantics/sources.ts`: afirmación, referencia, tipo de fuente, hablante explícito,
  tiempo conocido, certeza y condición no verificada. El prompt de reflexión y su
  validador comparten el marco construido a partir del contexto suministrado.
  Decisión y diálogo reutilizan el lector de fuentes para evidencia física. Las
  salidas canónicas y el almacenamiento del engine no cambian.
- Las etiquetas de certeza describen procedencia, no probabilidades de verdad.
  Habla e intentos rechazados no son recibos físicos; citas dentro de una
  interpretación conservan ese carácter. Los nombres y tiempos no disponibles
  permanecen desconocidos. El texto completo se conserva incluso cuando no se
  reconoce su formato o contiene hablantes/citas anidadas no extraíbles.
- La extracción reconoce las etiquetas actuales del engine y sus transcripciones
  explícitas `Nombre: “frase”`, con nombres suministrados. No resuelve pronombres,
  autores de cartas, discurso indirecto ni toda condición natural. `unverified`
  no prueba incumplimiento: el enlace causal entre condición, entrega y obligación
  informal sigue pendiente. Los tests locales no acreditan una mejora de calidad
  o costo en el proveedor real; falta una nueva evaluación integral.

## Reflexión contextual, iteración 14

`schema/reflection.ts` restringe los IDs de deseos a los suministrados en la
llamada; un deseo nuevo omite `id`. Sin deseos existentes, no se admite ese campo
y el estado debe ser `active`. Esta restricción es interna de cognition: no
modifica `Reflection`, el engine ni el número de intentos de los adaptadores.
Los errores canónicos y semánticos detectables se comunican juntos a la única
reparación de OpenRouter, con hasta seis diagnósticos semánticos; no es un listado
exhaustivo de todos los errores posibles de una frase.

La reflexión contrasta el alojamiento con `agent.home` y la observación inicial
seleccionada. `nights paid` deja de aceptarse incondicionalmente: cantidad, lugar,
sujeto y estado inicial/actual deben concordar. Un estado prepagado no acredita
que el personaje haya realizado una transferencia. La proyección de la llegada
inicial conserva procedencia y tiempo sin crear un evento ni una segunda llegada.

La gramática sigue siendo acotada. Coordinación de cláusulas, finalidad y
referencias como `ate both` conservan casos pendientes. La prueba real de Monchi
no demostró menos fallbacks; véanse [resultados y límites](cognition-monchi-review-2026-09-18.md).
