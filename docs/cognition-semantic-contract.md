# Contrato semántico de cognición — 17/09/2026

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
JSON/schema, truncado y semántica. La reparación semántica añade sólo el motivo y
la aclaración de que nada fue ejecutado; **no reenvía la respuesta inválida**.
No hay un segundo modelo juez ni un bucle de reparación ilimitado. Cada respuesta
se contabiliza en los callbacks existentes. Se registra código y campo del error.

Si ambos intentos fallan, se conserva la política `allowFallback`: en modo estricto
se lanza el error existente, sin entregar una respuesta sintética. Si se permite
fallback, la decisión MockBrain pasa por la misma barrera; si también falla,
devuelve `wait` marcado como fallback y memoria vacía. `wait` conserva exactamente
su significado en el engine, incluido continuar un desplazamiento pendiente.

Anthropic directo usa los mismos builders y validaciones para decisión, plan y
reflexión; decisión tiene una reparación semántica. Plan/reflexión conservan su
fallback existente. Otros métodos de ese adaptador no se migran en este cambio.
OpenRouter aplica la comprobación general de repetición también a otras operaciones;
no cambia la estructura de las conversaciones.

## Verificación y medidas

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

- Son heurísticas acotadas, sobre todo inglés/español; no un verificador universal
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
- Quedan posibles evaluaciones multisemilla y por proveedor, una representación
  estructurada de procedencia de recuerdos y descripciones de campos del schema
  de transporte. Ninguna se introduce sin medir primero calidad y costo; cambiar
  almacenamiento o contratos del engine queda fuera de este trabajo.
