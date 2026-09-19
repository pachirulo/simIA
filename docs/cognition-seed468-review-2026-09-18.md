# Revisión de la corrida del usuario: seed 468

18/09/2026. Engine/protocol fuera del alcance de edición.

## Fuentes

El usuario ejecutó `pnpm --filter @unwatched/headless soak -- --days 1 --agents 2
--brain openrouter --seed 468 --tick 60 --out out/openrouter-deepseek-YYYYMMDD`.
Ese paquete ejecuta desde `apps/headless`; sus artefactos están en
`apps/headless/out/openrouter-deepseek-YYYYMMDD`, no en el `out` de la raíz.

Se cruzó el texto pegado con `events.jsonl` (61 eventos), `summary.json` y el
periódico del día 1. Se extrajeron las 28 respuestas del log y se recuperaron por
API 12 requests/respuestas originales seleccionados, sin generar respuestas LLM
nuevas para reconstruir la evidencia. Copias locales:
`out/cognition-coherence-20260918/seed468-review/`. El fixture versionable
`packages/cognition/test/fixtures/seed468-regressions.json` conserva generaciones,
salidas, percepción y evidencia seleccionada de sus requests, más el hash del log.
Para los eventos personales seleccionados se usó el texto efectivamente suministrado
al modelo; los tiempos/actores se cruzaron con los eventos del mundo del mismo ID.

La corrida original registró **28 respuestas, 123.391 tokens de entrada y 6.383
de salida**, siete rechazos físicos de comercio y dos reflexiones que terminaron
en fallback neutral. No se presenta el contador de aceptación como calidad semántica.

## Hallazgos y correcciones

| Hallazgo comprobado | Cambio y límite |
| --- | --- |
| `trade.with` acepta `the inn's keeper`, `market stall` y `bakery.cook`; el engine los rechaza como «shop is elsewhere». También se propone `market` estando en bakery. | Cognition exige omitir `with` para el mostrador local, usar su ID exacto o una persona presente. El error señala `action.with`; una reparación de ese campo conserva el producto. No consulta inventarios privados. |
| Diálogo `gen-1789715581-uZ5WAOdOwCQwIKdmFy8e`: el request define A=Pedro y B=Inés; la respuesta empieza B/A/B/A/B. El evento 38 queda Pedro/Inés/Pedro/Inés/Pedro. | Ambos adaptadores devuelven IDs reales según el contexto; no dejan A/B para que el engine intente resolverlos o alterne por índice. Se preservan texto, orden, outcomes y marca de fallback. |
| La primera reflexión de Inés, `gen-1789715602-lQbXykRCkn8GV0szAiHI`, recibe `agreement_condition_lost` con «I promised nothing». | El comprobador busca una promesa positiva de pago en la misma cláusula y su condición correspondiente; no combina palabras de distintas frases. La frase sobre haber pagado al llegar todavía exige respaldo propio: alojamiento prepagado no prueba una transferencia del personaje. |
| La segunda reflexión, `gen-1789715617-75ajLHpSks2pjJr8evOP`, incluye compras respaldadas y «two nights paid at the inn». | Se distingue ese estado de alojamiento de «I paid…». La respuesta original pasa ahora el comprobador con la evidencia de su request. Esto no valida automáticamente toda su narrativa. |
| Pedro devuelve deseos con IDs numéricos, evidencia vacía y creencias sin campos canónicos. La reparación solo señala el primer ID; el segundo intento falla en la evidencia vacía. | Se reportan hasta 12 errores de schema conocidos juntos. El prompt aclara IDs existentes de tipo string, omisión del ID para deseos nuevos y 1–3 eventos de respaldo; se omite una actualización sin respaldo. No se inventan eventos ni se amplía el presupuesto de dos respuestas. |
| El soak no recibe el primer del mundo del servidor ni conecta los logs de habla confirmada. | Se comparte el mismo constructor dinámico y el extractor de habla; headless añade `dialogue.jsonl` y líneas `dialogue {...}`. El servidor conserva el texto de su primer anterior. |
| El directorio de una corrida de un día todavía contiene `gazette-day2.md`. | Headless rechaza un destino con `events.jsonl`, `summary.json` o `dialogue.jsonl` anteriores, sin borrarlos. La ruta de salida debe ser nueva. |

Los errores de recuerdo «Compré una manzana…» y «Bought bread…, hunger eased»
dentro de propuestas previas a ejecutar fueron rechazos correctos. No se eliminaron
esos controles. Hubo compras y consumo reales posteriores: no hay evidencia aquí
de un engine que impida comer.

## Pendientes incorporados al plan

- **P2.4, identidad y privacidad narrativa.** El modelo ya mezcla los papeles en
  su salida original: B pregunta por Pedro, pero luego habla como panadero. El
  request contiene secretos de ambos personajes. Corregir la representación de
  A/B no corrige el contenido ni demuestra aislamiento. Se requiere evaluar
  generación por turnos/contextos separados y su costo; no se intercambian frases
  automáticamente para hacerlas encajar.
- **Correspondencia de outcomes cuando paga el otro participante.** El engine
  entrega `ctx.a=payer`, pero guarda outcomes sobre el par original. Cognition no
  conoce ese orden original. Se necesita una prueba dedicada y una solución que
  respete la frontera acordada; el engine no se modificó.
- **P9.5, procedencia en el periódico.** «The horno is baking with harbor flour»
  aparece como hecho en un aviso aunque procede del diálogo. La validación de
  afirmaciones editoriales queda pendiente. Los `seal` y `scene` generados no se
  consideran por sí solos corrupción final: el engine reemplaza esos campos con
  datos propios después de recibir el periódico.
- **P5.3–P5.5/P7.** Siguen pendientes obligaciones informales, cobertura semántica
  amplia, reducción de loops y evaluación independiente. Una respuesta que supera
  estos controles acotados no queda certificada como verdadera.

## Pruebas locales

- Siete nuevas regresiones en `seed468-regressions.test.ts`, con capturas de esta
  corrida y contexto suministrado. Incluyen una conversación B/B/A persistida por
  el engine real y una reparación de reflexión con HTTP controlado.
- **214 tests de cognition y 53 del servidor pasan.** Typecheck correcto en
  cognition, servidor y headless.
- Soak real del ejecutor con Brain mock, seed 468, un día, dos agentes, tick 60:
  terminó con 53 eventos y 10 registros de habla en `dialogue.jsonl`.
- Repetir ese destino falla explícitamente; el hash del archivo de eventos no
  cambia. No se sobrescribió la prueba original del usuario.

Los artefactos mock están en
`apps/headless/out/coherence-seed468-mock-review-20260918`. Los resultados con
proveedor real se registran por separado; una sola semilla no cierra P7.4/P7.5.

## Verificación con proveedor real

Se ejecutó otra corrida de un día, dos agentes, seed 468 y tick 60, con el mismo
modelo configurado `deepseek/deepseek-v4-flash-0731`. Artefactos nuevos:
`apps/headless/out/coherence-seed468-live-review-20260918/`; consola:
`out/cognition-coherence-20260918/seed468-review/live-console.log`.

| Medida | Resultado |
| --- | ---: |
| Eventos del mundo | 59 |
| Rechazos del mundo (`action.rejected`) | 0 |
| Compras / consumos | 4 / 4 |
| Registros `dialogue.jsonl` / intervenciones habladas | 4 / 13 |
| Respuestas LLM, incluidas reparaciones | 28 |
| Tokens de entrada / salida | 144.879 / 6.055 |
| Fallbacks | 2: decisión y reflexión de Pedro |

La ausencia de rechazos de comercio en esta muestra no demuestra una mejora
general: la trayectoria del LLM varía y el contexto ahora contiene el primer
completo. El número de tokens de entrada subió; no se afirma ahorro de costo.

La reparación `gen-1789716663-O627XuVeHlIqWrfNWDIQ` de la decisión
`gen-1789716659-wQ7l8Td1L2JGOESPXYV6` conservaba exactamente `trade/market`
después de normalizar el `sell` vacío, pero añadía `desire_id: d1`. El comparador
interpretó esa adición como cambio de objetivo y activó fallback. **Se corrigió
después de la corrida**: dos regresiones locales verifican la adición a la misma
acción, el rechazo si cambia destino o asociación previa, y los dos intentos del
adaptador sin fallback. No se presenta este arreglo posterior como validado por
otra corrida real.

La primera reflexión de Pedro (`gen-1789716713-pmf7DajcmEG840UXoN6w`) afirma
haber pagado tres noches al llegar sin recibo de pago. Su reparación
(`gen-1789716738-gVLdUPA8ohnxIE9hVkNg`) mantiene ese pago en español; el control
se detiene antes en «Hoy he llegado al pueblo y he buscado el horno». Hay una
llegada real, pero la comparación léxica no separa correctamente esa paráfrasis
compuesta. **P5.5 conserva este caso**: mejorar la precisión del diagnóstico no
debe validar el pago inventado. La reflexión completa no se declara correcta.

Se mantienen también afirmaciones narrativas no acreditadas en diálogo, como
haber oído información en la plaza. P2.4 y P9.5 siguen abiertos. La generación
conjunta todavía recibe ambas personas; normalizar A/B no resuelve privacidad.

Se aclaró además el log `intento 2/1`: ahora muestra `intento 2 · HTTP 1`, porque
son contadores distintos, no una fracción del presupuesto. No cambia reintentos.
