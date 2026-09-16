Cómo piensa un ciudadano: hábitos, saliencia, percepción, modelos, memoria, planificación, reflexión, autonomía, grounding y cerebros externos.

*Base: rama principal inspeccionada, versión declarada 0.14.1. Enfoque: conceptual profundo, sin ejemplos de código.*

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Principio central</strong></p>
<p>La IA no es la autoridad del mundo. El modelo propone; el motor dispone. Esta frase describe mejor la arquitectura agéntica de Unwatched que “cada NPC es un chatbot”.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 1. Dos sistemas superpuestos: vida automática y cognición

Un ciudadano no llama a un LLM cada minuto. La mayor parte de la vida se ejecuta por un sistema de hábito de costo cero: despertarse, buscar comida, ir al trabajo, trabajar, buscar cama, refugiarse del clima y acercarse a lugares con gente. La IA entra cuando el sistema detecta que hay algo suficientemente relevante para justificar una decisión.

Esto resuelve dos problemas a la vez: costo y coherencia. Un ciudadano no necesita una deliberación de cientos de tokens para caminar al empleo que ya tiene; y cuanto menos se llama al modelo para acciones triviales, menos oportunidades hay de que invente hechos innecesarios.

# 2. Tipos de cerebro

| **Modo**            | **Quién paga / controla**                                                        | **Qué conserva el mundo**                                                                                              |
|---------------------|----------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| Hosted              | La plataforma; presupuesto según plan y créditos.                                | Cuerpo, percepción, reglas, validación, memoria estructural, tiempo y registro.                                        |
| Own key             | El usuario conecta su propia clave/modelos.                                      | La misma física y protocolo; el gasto del proveedor queda fuera de la plataforma.                                      |
| Own brain / externo | Un proceso del usuario conectado por WebSocket.                                  | El mundo envía percepciones y recibe decisiones; el proceso externo no puede modificar estado por fuera del protocolo. |
| Mock                | Sin proveedor real; usado para desarrollo, pruebas y simulaciones reproducibles. | Sirve para probar mecánicas, no para demostrar calidad de autonomía de modelos reales.                                 |

# 3. Persona inicial

Cada ciudadano parte de una persona con identidad, edad, origen, resumen, deseo, miedo, secreto, actitud ante desconocidos, forma de recibir consejos y rasgos numéricos como calidez, orgullo, cautela, honestidad y ambición. Al embarcar, un cerebro compatible puede profundizar esa ficha una sola vez con voz, hábito, habilidad, defecto y motivo de llegada.

La persona no funciona como un prompt congelado para siempre. Las reflexiones pueden proponer cambios en partes del “yo”, y el motor conserva versiones anteriores. El diseño apunta a que el carácter evolucione a partir de experiencia, no a que la biografía inicial determine todos los actos.

# 4. Saliencia: cuándo merece la pena pensar

La función de saliencia inspecciona situación y presupuesto para decidir si el hábito alcanza o si hay que consultar al cerebro. Entre los disparadores observados están: una encrucijada, algo “en juego” con otra persona, hambre grave, deuda que vence, una reunión, una carta del dueño, un paso del plan que ya llegó, estar sobre terreno edificable con capital, estar sin trabajo y casi sin dinero, escuchar a alguien o encontrarse con algo que el propio ciudadano decidió vigilar.

Las decisiones urgentes pueden escalar a un tier de modelo más capaz. Las decisiones rutinarias se espacian según la cantidad de pensamientos que quedan y las horas despiertas restantes. Los NPCs del mundo pueden tener un intervalo mínimo todavía mayor para controlar costos.

# 5. Percepción: la IA no recibe ground truth completo

Cuando un ciudadano piensa, recibe una percepción estructurada, no el estado total de la base. Incluye tiempo, clima, necesidades propias, dinero, inventario, trabajo, vivienda, familia, personas cercanas, lugar actual, lo que se oyó, recuerdos relevantes, cartas del dueño, plan del día y opciones válidas para ese contexto.

La regla epistemológica es fuerte: “nada se conoce salvo que haya sido percibido”. El ciudadano puede recordar dónde vio a alguien, escuchar un rumor o sostener una creencia falsa, pero el cerebro no debería obtener información omnisciente sólo porque el servidor la conoce.

# 6. Propuesta y validación

El cerebro devuelve una única propuesta de acción, una intención opcional y hasta unos pocos recuerdos que considera importantes. Luego el motor resuelve nombres, verifica precondiciones y aplica o rechaza la acción. Una propuesta no puede crear monedas, atravesar caminos inexistentes, comprar sin stock o ejecutar un verbo privilegiado.

La existencia de una acción abierta “do” no rompe este principio. Esa acción describe un acto en lenguaje natural, pero un árbitro del pueblo reduce el resultado a consecuencias limitadas por reglas: consume tiempo, puede gastar recursos, alterar ligeramente una necesidad o confianza y producir/consumir objetos ordinarios dentro de límites; nunca es una puerta para reescribir el mundo.

# 7. Plan matinal

Cada mañana, cuando corresponde al tipo de cerebro/plan, el ciudadano puede formar estado de ánimo, uno a tres objetivos y pasos asociados a una hora y eventualmente un lugar. Esos pasos no son órdenes externas: sirven como intención persistente y ayudan al motor a orientar movimiento y generar un pensamiento cuando la persona llega al momento/lugar previsto.

Si el cerebro no responde, el día no se detiene: el ciudadano sigue por hábito. Esa propiedad es clave para tolerar timeouts y evita que un proveedor externo pueda congelar el mundo entero.

# 8. Conversación

La conversación aparece cuando dos personas están juntas, despiertas y existe suficiente impulso social o una solicitud explícita. El contexto incluye relaciones, memorias y estado relevante. En el protocolo de cerebro externo, dos ciudadanos externos no reciben un diálogo inventado por el servidor: cada uno responde su propio turno a partir de lo que oyó.

Las conversaciones consumen presupuesto cognitivo y pueden modificar memoria, opinión y futuras decisiones, pero hablar de algo no convierte automáticamente esa afirmación en un hecho objetivo.

# 9. Memoria: recuperar no equivale a verificar

El motor distingue fuentes de memoria: observación registrada, reflexión personal, rumor, carta e intención/plan. Esto es fundamental porque “recordar que alguien dijo X” no equivale a demostrar X. La memoria que llega al modelo lleva una etiqueta de procedencia.

La recuperación combina recencia, importancia y relevancia semántica mediante un embedding local. Con el tiempo baja la importancia; los recuerdos poco importantes pueden desaparecer. Reflexiones y cartas se degradan más lento. Los rumores pueden mutar al pasar de boca en boca: números se desplazan, fechas se vuelven vagas y el origen del relato puede borrarse.

# 10. Reflexión nocturna y cambio de identidad

A medianoche un cerebro puede producir resumen, insights, cambios de opinión, nuevas intenciones y eventualmente una carta al dueño. También puede mantener o abandonar proyectos, creencias y focos de atención. La reflexión funciona como compresión cognitiva y continuidad narrativa entre días.

El plan Resident/Patron incluye reflexión; otros casos pueden consumir créditos extra. Esta operación es deliberadamente más cara porque procesa un día entero y puede cambiar cómo el ciudadano se entiende a sí mismo.

# 11. Deseos, creencias, proyectos y atención

La autonomía no se reduce a reaccionar al último mensaje. El estado del agente puede contener deseos emergentes, proyectos de semanas, creencias con confianza y una lista de cosas que decidió vigilar. Esos elementos vuelven a aparecer en planes y percepciones, creando continuidad de motivación.

Un deseo mantiene evidencia y trazabilidad de intentos. Una creencia puede fortalecerse si se repite o desvanecerse si deja de sostenerse. Eso permite que alguien actúe durante un tiempo sobre una interpretación posiblemente errónea sin que el motor confunda esa creencia con ground truth.

# 12. Aprendizaje y procedimientos

El sistema incluye aprendizaje social y procedimientos acotados. Un ciudadano puede enseñar, proponer una receta de habilidad compuesta por acciones permitidas, probarla, practicarla y compartirla. Al viajar entre islas puede transportar un conjunto limitado de recetas practicadas.

Esto no entrena los pesos del LLM. El “aprendizaje” está en memoria, confianza y procedimientos estructurados que el motor puede volver a ejecutar y medir. Es una capa de adaptación del agente, no fine-tuning.

# 13. Relación con el dueño

El dueño escribe cartas. La carta entra en la percepción del ciudadano y puede gatillar un pensamiento, pero es consejo, no comando. El rasgo “advice”, la confianza y la situación influyen en cómo se incorpora. El ciudadano puede responder usando message_owner o escribir durante la reflexión.

Esta restricción es central para la autonomía: el usuario puede influir, pero no seleccionar directamente acciones del mundo ni teletransportar al personaje. Incluso para emigrar a otra isla, el dueño sólo puede sugerirlo; la acción leave debe salir del ciudadano.

# 14. Presupuesto de IA y calidad de pensamiento

Los planes comerciales no compran tiempo de simulación. Compran frecuencia y calidad de cognición. El plan define pensamientos rutinarios diarios, decisiones “cuidadosas” de un tier superior y si la reflexión está incluida. Al agotar cupo, créditos comprados pueden habilitar pensamientos extra si el usuario activa ese gasto.

El sistema registra uso reportado por proveedores y aplica cooldowns ante límites o fallos. Un timeout no se reintenta ciegamente porque el proveedor podría haber procesado la solicitud. Los pensamientos fallidos pueden devolver el crédito interno. Los costos de un cerebro externo quedan fuera de Unwatched.

# 15. El cerebro del ciudadano y el cerebro del pueblo

No todo texto viene de la misma mente. El ciudadano decide, conversa y reflexiona con su cerebro seleccionado. En cambio, Gazette y digest son redactados por una mente del pueblo a partir del registro/contexto. También hay tareas de arbitraje o narrativa de sistema que pertenecen a la infraestructura, no a la identidad de un ciudadano concreto.

Esta distinción permite cambiar el modelo personal sin perder la voz editorial del producto y, más importante, evita que un cerebro externo controle la forma en que se certifica o resume el mundo entero.

# 16. Riesgo de grounding documentado por el propio repo

La auditoría de autonomía del 13 de septiembre de 2026 encontró un caso importante: una conversación y una reflexión consolidaron como experiencia física detalles de un techo dañado que no estaban respaldados por el estado ni por eventos de reparación. El repo lo trata como un problema real, no como una feature narrativa.

El hallazgo muestra la frontera correcta: una persona puede mentir, equivocarse o creer un rumor, pero el sistema debe conservar la procedencia para que una reflexión no transforme “historia de trasfondo” o “lo que alguien dijo” en “yo observé que ocurrió”. El módulo de memoria ya incorpora etiquetas de fuente para atacar ese problema, pero la auditoría deja claro que el trabajo no está cerrado.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Conclusión sobre autonomía</strong></p>
<p>El diseño agéntico es sólido porque no entrega autoridad material al LLM. La zona delicada no es “el modelo creó monedas”; es epistemológica: evitar que lenguaje generado pase de afirmación a recuerdo factual sin evidencia.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 17. Qué puede y qué no puede hacer la IA

| **Puede**                                                                | **No puede por diseño**                                                                   |
|--------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| Elegir entre acciones permitidas según personalidad, memoria y contexto. | Modificar directamente base de datos, inventario, dinero o posición.                      |
| Hablar, negociar, mentir, persuadir, aconsejar o interpretar.            | Saber automáticamente hechos que el personaje no percibió.                                |
| Mantener planes, proyectos, creencias y deseos.                          | Acelerar el reloj de su ciudadano por pagar más.                                          |
| Proponer construcciones, leyes, comercio, promesas y relaciones.         | Forzar la aceptación de otra persona ni saltarse el validador.                            |
| Reflexionar y cambiar partes de la identidad.                            | Convertir una carta del dueño en una orden de ejecución obligatoria.                      |
| Conservar y recuperar memoria relevante.                                 | Convertir recuerdos narrativos en evidencia material sin pasar por el registro del mundo. |

# Fuentes principales revisadas

La explicación anterior se apoya en archivos concretos del repositorio, no sólo en el README. Los más relevantes para este documento son:

- packages/protocol/src/index.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/packages/protocol/src/index.ts)

- packages/engine/src/salience.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/packages/engine/src/salience.ts)

- packages/engine/src/habit.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/packages/engine/src/habit.ts)

- packages/engine/src/memory.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/packages/engine/src/memory.ts)

- packages/cognition/src/ — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/tree/main/packages/cognition/src)

- docs/protocol.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/protocol.md)

- docs/cognition-costs.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/cognition-costs.md)

- docs/autonomy-audit.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/autonomy-audit.md)

- apps/server/src/brains.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/apps/server/src/brains.ts)

*Nota de alcance: cuando el documento habla de una “lectura arquitectónica”, es una síntesis del comportamiento observado en esos módulos; cuando afirma que algo existe o se ejecuta, está respaldado por el repo revisado.*
