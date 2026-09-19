# Revisión de la corrida de un día, seed 853

18/09/2026. Iteración 8 del plan de coherencia. Se revisan agentes, decisiones y
memoria. La gaceta permanece fuera del trabajo activo por indicación del usuario.

## Muestra y fuentes

- Comando del usuario: `pnpm --filter @unwatched/headless soak -- --days 1 --agents 2 --brain openrouter --seed 853 --tick 60 --out out/openrouter-deepseek-hola`.
- Modelo registrado: `deepseek/deepseek-v4-flash-0731`; personas originales en
  inglés, Rosa Vidal y Petar Ilić. No es la misma configuración de Inés/Pedro.
- Log adjunto: `C:/Users/cleka/.codex/attachments/f20df958-23f2-4fc8-a80c-83e0d1d0b227/pasted-text.txt`.
- Artefactos completos del mundo: `apps/headless/out/openrouter-deepseek-hola/`.
  Hay 59 eventos, cuatro compras, tres consumos, una contratación, tres
  conversaciones y dos frases sueltas. No hay eventos `action.rejected`,
  `agent.give` ni `agent.take`. Esto acredita esas operaciones, no la verdad del diálogo.
- El adjunto termina al comenzar la reflexión de Petar. No permite calcular el
  total final de llamadas, tokens, coste o fallbacks de la corrida. El resumen
  local acredita finalización en 243.414 ms; no contiene el balance del proveedor.
- Cinco generaciones históricas de conversación/reflexión se recuperaron por
  lectura de OpenRouter, todas con HTTP 200. No se generaron nuevas respuestas
  facturadas. Capturas y script: `out/cognition-coherence-20260918/seed853-review/`
  y `out/cognition-coherence-20260918/review-seed853.mts`.
- Fixture versionable: `packages/cognition/test/fixtures/seed853-regressions.json`.
  Guarda outputs y evidencia seleccionada extraídos de las solicitudes originales,
  IDs de generación y SHA-256 del adjunto/eventos. El resto del contexto de test
  se construye de forma controlada; no se presenta como snapshot original completo.

## Hallazgos y cambios

### Contratación válida rechazada por mezclar cláusulas — corregido

`gen-1789719552-zFn7ZshL6CFKSRZB97Zj` contiene:

> I got taken on as help at the inn, which suits me, and I talked with Petar Ilić twice

La solicitud incluye el evento 14: `Rosa Vidal was taken on as help at the inn.`
El validador no separaba `talked` y aplicaba `twice` a la contratación. La
regresión reproduce ese rechazo antes de corregirlo. Ahora cada cláusula
reconocida conserva su frecuencia: hablar dos veces no exige dos contrataciones.
Una contratación afirmada dos veces sigue necesitando dos recibos distintos;
una compra sin respaldo después de la contratación sigue siendo rechazada.

Esto corrige el diagnóstico falso, **no certifica toda la reflexión**: también
contiene afirmaciones de entrega y opiniones derivadas aún no verificadas.

### Recuerdo de recepción sin transferencia — corregido para `took`

`gen-1789719490-4ehPcHvgpAy1JjpRBuai`, conversación del evento 51, guarda:

> Rosa took the loaf, offered soup, promised not to spread the mainland flour business.

No hay recibos de entrega/toma en la evidencia personal suministrada ni en los
eventos de la corrida. La frase de Petar «I brought the loaf» acredita que lo dijo;
no demuestra recepción por Rosa, intercambio ni consumo. El control anterior
dejaba pasar el recuerdo. Se añade el reconocimiento acotado de `took` como
adquisición y se separan ofertas/promesas posteriores: `promised` al final de la
frase ya no convierte retroactivamente la recepción afirmada en una condición.

Una toma observada puede apoyarse en `agent.take` o en `agent.give` dirigido al
receptor. La proyección de este último conserva el ID, fuente, emisor y receptor:
no crea eventos ni implica robo. Se contrastan objeto, procedencia explícita y
repeticiones. Palabras, citas, interpretaciones e intentos rechazados no sirven
como recibos. Actividades/expresiones comunes como `took a shift`, `took a walk`
o `took the initiative` quedan fuera de esta comprobación física.

La reparación puede conservar todas las intervenciones y cambiar el recuerdo
por una oferta pendiente con atribución. Si insiste en el recuerdo inválido, se
mantiene el presupuesto de dos respuestas y se entrega fallback marcado y seguro.
El prompt explica explícitamente que decir que se trajo un objeto no ejecuta un
intercambio. No se elimina la posibilidad de mentir en lo que se dice.

### Otros rechazos de la muestra

La compra de harina no ofrecida por el molino, la propuesta de hablar con intención
inmediata de comprar, el recuerdo de una compra antes de ejecutarla y `use soup`
acompañado por intención de comprar recibieron rechazos coherentes con sus campos.
La referencia a un deseo inexistente en la primera reflexión de Rosa también
requiere corrección. No se desactivan esos controles para reducir fallbacks.

## Límites que quedan en el plan

- **P10.3 / P5.4:** Petar expresa `Rosa gave me soup for the loaf` dentro de `intent`.
  La comprobación actual compara intención y acción; no contrasta generalmente
  cada premisa física de la intención con evidencia. El recuerdo previo pudo
  influir, pero el log por sí solo no demuestra la causa interna del modelo.
- **P10.4 / P5.5:** `Petar brought a loaf` y `He brought me a loaf like he said`
  siguen sin resolverse de forma general. Traer/portar no equivale necesariamente
  a entregar. Falta resolver sujetos/pronombres, objetos equivalentes como
  `loaf`/`bread` y atribución de cláusulas mixtas sin inventar recibos. La
  instrucción adicional al prompt no cierra esta garantía.
- `took` usa una gramática acotada con exclusiones de actividades; otras expresiones
  ambiguas pueden requerir reparación. No es un analizador universal del lenguaje.
- **P2.4:** siguen apareciendo biografía, secreto y estado físico declarado
  entremezclados. La existencia de diálogo falso no prueba por sí sola una fuga;
  falta la prueba de aislamiento narrativo entre interlocutores.
- **P7.4/P7.5:** falta una evaluación real posterior y comparable. Una corrida
  antigua reevaluada y un adaptador simulado no miden la mejora futura del LLM.

## Verificación

- Las tres regresiones iniciales de seed 853 fallaron antes y pasan después:
  contratación, recepción sin evidencia y reparación efectiva del diálogo.
- Se agregan controles positivos/negativos de receptor, procedencia, objeto,
  repetición, fuentes, condiciones, expresiones ambiguas y fallback. Ocho tests
  nuevos en total, además de ampliar seis escenarios existentes de integración.
- Integración existente con engine real: diálogo, snapshot/restauración, entrega
  opcional y reflexión. Ahora verifica que `I took the bread from Pedro` solo
  se respalda tras la entrega; la dirección inversa se rechaza. No se modifica
  el engine para obtener el resultado.
- **237 tests de cognition correctos, en 18 archivos.** Typecheck general correcto
  en ocho paquetes. Se conservan los contratos y el límite de llamadas.
- UTF-8, `git diff --check` y comparación de hashes del engine/protocolo y de
  ambos originales ingleses registrados en la verificación de la iteración 8.

No se reescriben eventos o memorias históricas ni se afirma que los fallbacks de
esta corrida ya hayan disminuido. Los cambios se aplican a llamadas futuras.

## Seguimiento, iteración 9

P10.3 incorpora la comprobación acotada de premisas físicas en `intent`. Se
recuperó también `gen-1789719507-5Fr2fYOy2ceIM3UXoSib` y su percepción original.
El caso de la entrega de sopa sin respaldo se reproduce conservando el output
original; una variante identificada como contrafactual cambia solo `use` por
`trade` para aislar la premisa. Ambos controles se combinan en el diagnóstico
cuando fallan juntos, sin ampliar el presupuesto de reparación.

La verificación de esta continuación suma 248 tests de cognition y typecheck
correcto en ocho paquetes. Incluye entrega real/restauración, ambos adaptadores,
fallback y ausencia de acceso a memoria no seleccionada. Los límites de P10.4
siguen abiertos: portar/entregar, equivalencias, pronombres y reciprocidad del
supuesto trueque. [Registro de evidencia](cognition-coherence-evidence-2026-09-18.md#iteración-9-premisas-físicas-dentro-de-intent).
