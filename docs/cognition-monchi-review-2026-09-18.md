# Revisión de Monchi: tres personajes y reflexión

Fecha: 18/09/2026. Iteración 14. Implementación limitada a cognition, pruebas,
diagnóstico y documentación. Engine, protocolo y gaceta sin cambios en esta
iteración. Se conserva la elección de excluir datos privados del diálogo sin
añadir llamadas.

## Evidencia y correcciones al diagnóstico inicial

Se identificó `apps/headless/out/openrouter-deepseek-Monchi`: seed 42, un día,
tres agentes, tick de 60 minutos, 77 eventos, 38 respuestas del proveedor.
`run.json` registra estado completed y coste reportado de USD 0.022907404964.
Las tres reflexiones terminaron en fallback. Se recuperaron los requests y
outputs originales de sus seis generaciones, además de consultar los eventos.

| Observación | Resultado comprobado |
| --- | --- |
| Rosa dice que comió sopa dos veces | Correcto: eventos `35` y `64`, ambos `agent.eat`, actor Rosa. Los dos ya estaban en `desireEvidence` del request original. No dependen de encontrar una propuesta LLM `use soup`: también actúa la conducta existente del engine. |
| Llegada y alojamiento no llegaban a la reflexión | El recuerdo inicial etiquetado como observación estaba seleccionado; también había eventos de llegada y estado de alojamiento. La falta general de contexto no explica estos casos. |
| El alojamiento prepagado debería poder recordarse | Sí, diferenciando tres noches iniciales de las restantes: Rosa tenía una; Petar e Ivana, dos. |
| Los rechazos de pago son falsos | Las seis salidas originales afirman un pago activo, como `paid for three nights` o `paid for a room`. No hay recibo de ese pago. El prepago inicial no demuestra quién transfirió dinero. Se mantienen esos rechazos. |
| Los IDs de deseos consumen la reparación | Confirmado en el primer intento de Rosa e Ivana. No había deseos persistentes; el modelo inventó identificadores. |

Generaciones originales, primera respuesta y reparación:

- Rosa: `gen-1789756898-tqDyYj305sqFkY1yIxsO`, `gen-1789756948-OFEMGEIiT6IvdmNJ4dux`.
- Petar: `gen-1789756971-qFTDMqskvg1ROB5bDfMm`, `gen-1789756979-5eJeQpkIqWDEQ0D0xtWl`.
- Ivana: `gen-1789756987-lywYJPOekHC7Z7ek4XSZ`, `gen-1789756996-pjViXX60gvz3NSy1fQLF`.

## Cambios implementados

- `schema/reflection.ts`: deriva el esquema de salida de `Reflection`, restringiendo
  los IDs a los deseos suministrados. Sin deseos existentes, el campo `id` no se
  admite y el estado inicial es `active`. Los IDs desconocidos se rechazan, no se
  eliminan silenciosamente. OpenRouter y Anthropic utilizan este esquema;
  el contrato canónico de protocolo permanece intacto.
- `context/reflect.ts`: instrucciones explícitas sobre IDs nuevos, consumo
  respaldado por eventos y diferencia entre alojamiento y transferencia.
- `semantics/lifecycle.ts` y proveedor OpenRouter: una reparación recibe hasta
  seis diagnósticos semánticos de distintos campos, conservando el primer código
  y ruta. Si falla el esquema contextual pero la salida es una reflexión canónica,
  también se comprueba su prosa para informar ambos problemas. Esa comprobación
  es diagnóstica: no acepta el esquema inválido. Sigue habiendo dos intentos de
  respuesta como máximo, con la política de transporte preexistente.
- `semantics/evidence.ts`: reconoce la llegada expresada como `on the island`
  y proyecta la observación inicial exacta a una llegada en primera persona,
  conservando equipaje, cantidad, tiempo y procedencia. No crea eventos ni suma
  observaciones a un contador de llegadas. Una interpretación o cita del mismo
  texto no sirve como recibo; tampoco demuestra una visita al molino.
- `semantics/lodging.ts`: sustituye la aceptación incondicional de `nights paid`
  por comparación con el alojamiento actual o la observación inicial seleccionada,
  según la formulación temporal. Comprueba cantidad, lugar y sujeto. Reconoce las
  formas acotadas de pasado y estado pasivo probadas; no certifica cualquier
  paráfrasis del alojamiento ni resuelve toda referencia temporal.
- Regresiones adicionales de la prueba real: `short-handed` deja de confundirse
  con una entrega; `Got hired` reconoce el sujeto personal implícito, comprobando
  también el lugar de contratación cuando se nombra. `Just arrived` conserva la
  exigencia de evidencia de llegada.

## Verificación y resultado real

Se añadieron 27 pruebas: textos/evidencia auténticos de las seis reflexiones,
controles positivos y negativos, esquema contextual, reparación conjunta y
fallback en dos respuestas. El fixture une IDs ya seleccionados con el registro
de eventos para recuperar tiempo/actores; no añade eventos ausentes del request.
El resto de `AgentState` se reconstruye para las pruebas, por lo que no se presenta
como restauración exacta del mundo.

Verificación final: **550 pruebas correctas** en el monorepo, incluidas **318 de
cognition**; `pnpm typecheck` correcto en los ocho paquetes y `git diff --check`
sin errores. Turbo reutilizó tres suites y cinco chequeos de tipos sin cambios.
Los logs quedan en `tests-final.log`, `typecheck-final.log` y
`diff-check-final.log` dentro del directorio de evidencia de esta revisión.
La única diferencia previa en engine sigue siendo `island.ts`, cuya huella
coincide con el original inglés autorizado; `personas.ts` también coincide.

La comprobación offline anterior a la prueba real conserva rechazados los seis
pagos originales. Tres controles positivos de llegada sustentada solo por la
observación inicial pasan de rechazados a aceptados.

Se ejecutó una única muestra real predefinida de las tres reflexiones contra
`deepseek/deepseek-v4-flash-0731`, con los mensajes capturados y las nuevas
instrucciones añadidas, la misma evidencia seleccionada y un máximo de una
reparación por reflexión. No fue una nueva simulación completa. El contexto del
validador se reconstruyó como en las pruebas. El enrutamiento del proveedor no
estuvo fijado, por lo que no se atribuyen ahorros causales de coste.

| Personaje | Respuestas | Tokens entrada / salida | Coste reportado USD | Aceptada durante la prueba |
| --- | ---: | ---: | ---: | --- |
| Rosa | 2 | 12.383 / 1.948 | 0.0013211403 | No |
| Petar | 2 | 8.946 / 1.197 | 0.0014419900 | No |
| Ivana | 2 | 12.572 / 1.255 | 0.0071882800 | No |
| Total | 6 | 33.901 / 4.400 | 0.0099514103 | 0/3 |

En las seis respuestas nuevas no hubo IDs de deseos inventados. Sin embargo,
persistieron falsos rechazos de formulaciones de llegada/alojamiento y pagos
activos sin respaldo. No se acredita una reducción global de fallback.

Tras esa muestra se corrigieron los casos acotados descritos arriba y se
comprobaron offline las mismas seis respuestas, sin nuevas llamadas pagadas:
la primera de Petar pasa el validador final; las otras cinco conservan problemas.
**Ese resultado offline no convierte la prueba real en 1/3 aceptadas.** Tampoco
equivale a auditoría completa de cada afirmación histórica de Petar.

## Trabajo que permanece abierto

P11.5 añade reproducciones concretas a P5.5/P8.3:

- Rosa, `gen-1789759507-GOHJL5l14ZqCuii8ZMLK`, `self.summary`: la llegada se
  mezcla con `and by noon the council made me mayor`. Hay que separar las
  afirmaciones y contrastar cada una, conservando actor, lugar y tiempo.
- Rosa, `gen-1789759535-X6Car608Yl0Y9LHOV3Us`: `I bought soup twice to eat`
  mezcla compra respaldada y finalidad; no afirma consumo. No debe exigirse un
  recibo cuyo objeto literal incluya `to eat`.
- Petar, `gen-1789759570-eyG2pqvLRnfsZIE4ERv8`: `ate both` necesita resolver
  una referencia local sin usar compras como prueba de consumo.
- Ivana mantiene pagos activos sin recibo en ambos intentos nuevos. Su primer
  `self.summary` también arrastra el rol de alcaldesa de la persona de fondo,
  mientras el mundo tiene a Rosa como alcaldesa. Falta un control acotado de rol
  efectivo frente a aspiración/biografía; no basta que la frase esté en `self`.

Estos puntos requieren controles negativos de frases coordinadas, deseos futuros,
rumores y actores distintos. No se amplían las listas de palabras para hacer
pasar una respuesta completa. P5.3 continúa abierto por la asignación desconocida
de pagos a acuerdos informales; el resultado de esta muestra tampoco cierra P8.3.

## Archivos y reproducción

- Corrida del usuario: `apps/headless/out/openrouter-deepseek-Monchi/`.
  `run.log` contiene diagnósticos; `events.jsonl`, hechos del mundo;
  `dialogue.jsonl`, únicamente registros de habla; `run.json`, estado/configuración.
- Capturas originales, snapshot previo de cognition, diagnósticos completos y
  resultados: `packages/cognition/out/monchi-review-20260918/`.
- Evidencia versionable: `packages/cognition/test/fixtures/monchi-reflections.json`
  y `packages/cognition/test/monchi-reflections.test.ts`.
- Comparación offline: `offline-validation.json`; prueba real inmutable:
  `live-replay.json` y `live-replay.log`; revisión offline posterior:
  `live-recheck.json`.

```powershell
pnpm --filter @unwatched/cognition test
pnpm typecheck
pnpm test
git diff --check
```

`packages/cognition/scripts/replay-monchi-reflections.ts` requiere las capturas
locales. Por defecto compara validadores offline; `--live` efectúa las tres
reflexiones pagadas; `--recheck` revisa las respuestas reales ya guardadas.
Rechaza sobrescribir resultados previos. No imprime credenciales.
