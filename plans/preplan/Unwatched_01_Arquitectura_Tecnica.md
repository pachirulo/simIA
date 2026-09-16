Cómo está construido Unwatched: código, servicios, reloj de simulación, datos, APIs, persistencia, despliegue y operación.

*Base: rama principal inspeccionada, versión declarada 0.14.1. Enfoque: conceptual profundo, sin ejemplos de código.*

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Lectura en una frase</strong></p>
<p>Unwatched es una simulación persistente dirigida por un servidor autoritativo: el motor mantiene el estado del mundo y valida acciones; la IA sólo propone decisiones y redacta interpretación. El cliente web observa ese estado por API y eventos en tiempo real.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 1. Qué tipo de sistema es

Unwatched no está planteado como un videojuego cliente donde cada dispositivo calcula su propia partida. El mundo vive en un proceso de servidor que conserva un único estado compartido. Los ciudadanos siguen avanzando aunque ningún dueño tenga la web abierta, y el navegador funciona principalmente como ventana de observación, interacción con el dueño y representación visual.

La decisión arquitectónica más importante es separar autoridad física y cognición. El motor conoce lugares, inventarios, dinero, relaciones, necesidades, trabajos, leyes, edificios y tiempo. Un cerebro puede proponer una acción, pero el motor resuelve si esa acción es posible y qué consecuencia objetiva produce. Esta división reduce alucinaciones con efectos materiales y permite que distintos tipos de IA convivan con las mismas reglas.

# 2. Organización del repositorio

El proyecto es un monorepo TypeScript gestionado con pnpm y Turbo. Esa estructura no es cosmética: separa contratos, simulación, IA, persistencia y aplicaciones ejecutables para que cada capa pueda evolucionar sin duplicar las reglas del mundo.

| **Módulo**         | **Responsabilidad conceptual**                                                                                                                          |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| packages/protocol  | Contrato común: acciones, percepciones, planes, reflexiones, eventos y estructuras que pueden intercambiar motor y cerebros.                            |
| packages/engine    | Simulación autoritativa: mundo, calendario, necesidades, hábitos, economía, relaciones, memoria, construcción, leyes, reuniones, validación y registro. |
| packages/cognition | Implementaciones de “cerebro”: OpenRouter, Anthropic, mock y prompts compartidos; transforma contexto en propuestas estructuradas.                      |
| packages/store     | Persistencia intercambiable: almacenamiento local en JSON o almacenamiento duradero en Supabase/Postgres.                                               |
| packages/agent-sdk | Cliente para conectar un cerebro externo al protocolo del mundo.                                                                                        |
| apps/server        | Servidor Hono: reloj, API, WebSocket, autenticación/boarding, cerebros, billing, correo, voz, operaciones y conexiones externas.                        |
| apps/web           | Cliente Next/React: mundo PixiJS, vistas de ciudadanos, digest, cartas, Gazette, biblioteca, construcción, cuenta y backoffice visual.                  |
| apps/headless      | Simulación sin interfaz para soak tests, auditorías de autonomía, reproducibilidad y CI.                                                                |

# 3. Ciclo de ejecución del mundo

1.  El servidor arranca o recupera el estado persistido de una isla.

2.  El reloj avanza en “minutos de simulación”. En producción, el diseño declarado es un minuto simulado por minuto real; en desarrollo se puede acelerar.

3.  En cada tick el motor actualiza necesidades, movimientos de rutina, trabajo, producción, calendario, eventos y demás mecánicas deterministas.

4.  La capa de saliencia decide si un ciudadano realmente necesita pensar. Si no hay nada relevante, se ejecuta un hábito gratuito.

5.  Cuando hace falta cognición, el cerebro recibe una percepción limitada a lo que ese ciudadano conoce y propone una acción.

6.  El validador del motor acepta o rechaza la propuesta según posición, recursos, reglas y estado actual. La IA no puede saltarse esa capa.

7.  Las consecuencias se convierten en eventos del mundo, actualizan estado y alimentan vistas, recuerdos, Gazette, digest y auditoría.

8.  Al finalizar el día se realizan procesos nocturnos como reflexión, envejecimiento/compresión de memoria y sellado del registro diario.

# 4. Reloj, continuidad y mundo real

La simulación tiene dos modos temporales: tiempo acelerado para desarrollo/pruebas y tiempo real para producción. El servidor puede además vincular la isla a una coordenada geográfica real. En ese modo usa Open-Meteo para traducir condiciones meteorológicas reales a estados internos como despejado, lluvia, nieve, niebla, viento o tormenta.

La ubicación real también determina estación, zona horaria, amanecer, atardecer y horario del barco. Después de un reinicio, el servidor puede adelantar el reloj hasta la hora real sin obligar a los ciudadanos a “pensar” minuto por minuto durante el hueco. Esto permite continuidad temporal sin disparar costos de IA por tiempo que nadie observó.

# 5. Servidor, API y tiempo real

El backend usa Hono sobre Node. Cumple dos funciones simultáneas: es API de producto y host del proceso que hace avanzar el mundo. Expone datos de ciudad, ciudadano, digest, registro, cuenta y operaciones, y mantiene canales WebSocket para eventos en vivo y para cerebros externos.

El cliente no decide dónde está una casa ni cuánto dinero tiene un ciudadano. Esos datos llegan desde el servidor. Esta elección permite abrir la misma isla desde varios clientes sin divergencia, y es la base adecuada para sumar clientes iOS y Android: las apps móviles podrían consumir la misma autoridad de mundo sin portar el motor a cada teléfono.

# 6. Persistencia y registro verificable

El proyecto contempla dos persistencias. Para clonar o desarrollar sin infraestructura externa, guarda la isla en archivos JSON. Para producción, usa Supabase/Postgres; el servidor opera con credenciales de servicio y el cliente web utiliza credenciales públicas, con migraciones y controles de acceso en la base.

Además del snapshot operativo, Unwatched mantiene un registro de eventos. Al cerrar el día serializa los eventos en forma canónica, calcula SHA-256 y encadena ese hash con el del día anterior. El objetivo es que el periódico y el digest puedan contrastarse contra una historia que no se reescribe silenciosamente. No es blockchain: es un ledger encadenado y verificable dentro de la infraestructura del proyecto.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Por qué importa</strong></p>
<p>Esta capa es la que permite sostener la promesa “lo que el dueño lee ocurrió”. La IA puede interpretar o incluso equivocarse como personaje, pero la evidencia material queda separada del relato.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 7. Identidad, alta y asignación de ciudadano

El alta (“boarding”) está tratada como una operación transaccional. El usuario diseña el personaje en el navegador, pero el ciudadano no entra al mundo hasta que el servidor valida que el tipo de cerebro seleccionado está listo. Para cerebro hospedado comprueba la suscripción; para clave propia comprueba que el proveedor responde y que hay un límite de gasto; para cerebro externo prueba una conexión real al protocolo.

El sistema usa un request ID para hacer el proceso idempotente y evita crear ciudadanos duplicados por reintentos. En producción, ciudadano y configuración cognitiva se persisten juntos antes de hacer pública la admisión.

# 8. Integraciones externas

| **Servicio**           | **Uso**                                                                   |
|------------------------|---------------------------------------------------------------------------|
| OpenRouter / Anthropic | Inferencia de los cerebros hospedados o con clave propia.                 |
| Supabase               | Identidad/datos persistentes y base Postgres para producción.             |
| Stripe                 | Planes mensuales, paquetes de créditos, portal de facturación y webhooks. |
| Open-Meteo             | Clima, calendario solar y contexto temporal real sin clave.               |
| Gemini                 | Lectura de cartas por voz y generación opcional de música de ambiente.    |
| Recraft                | Dibujo vectorial opcional de edificios descritos por los ciudadanos.      |
| Resend                 | Correo de digest matinal y aviso cuando un ciudadano escribe al dueño.    |
| Telegram               | Canal opcional asociado a propietario/agente.                             |
| WebSocket propio       | Cerebros externos y streams de tiempo real.                               |

# 9. Islas federadas

La arquitectura contempla que una isla sea una instancia de servidor independiente. Dos instancias pueden enlazarse mediante un secreto compartido y un barco. Cuando un ciudadano emigra, viajan su persona, apariencia, dueño, monedas, objetos, recuerdos, opiniones e instrucciones; pierde dependencias locales como trabajo, cama, deudas e identificador.

La federación también soporta carga comercial entre islas. El diseño evita crear dinero al transferir mercadería: la isla compradora paga y la vendedora recibe. Este punto convierte la “federación” en algo más que un teletransporte de avatares y abre una arquitectura de múltiples mundos interoperables.

# 10. Despliegue y operación

La producción documentada usa DigitalOcean App Platform con dos imágenes: una para el mundo/servidor y otra para la web. Las imágenes se guardan en DigitalOcean Container Registry y el despliegue se dispara desde GitHub Actions al publicar una versión. El workflow verifica después que servidor y web exponen la misma versión y commit.

El repositorio incluye una “ops room” y métricas operativas. Hay controles administrativos para pausar el mundo, congelar la economía o retener el barco, además de telemetría de ticks y uso de modelos. Estos controles son operativos; no forman parte de la autonomía normal de los ciudadanos.

# 11. Pruebas y reproducibilidad

La aplicación headless permite correr días completos sin navegador, usando un cerebro mock o modelos reales. Esto sirve para CI, soak tests, auditorías de autonomía, simulaciones con semilla reproducible y validación de cambios en economía o comportamiento. El diseño con RNG controlado y un motor separado de los modelos permite reproducir buena parte de la física, aunque las respuestas de un proveedor de IA real no sean deterministas.

# 12. Fortalezas y límites técnicos actuales

| **Fortaleza**                           | **Límite / riesgo actual**                                                                                                                          |
|-----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| Separación fuerte entre motor y LLM     | El motor central es grande y concentra muchas mecánicas; exige disciplina para no convertirlo en un monolito difícil de evolucionar.                |
| Cliente delgado y servidor autoritativo | La disponibilidad del mundo depende de un proceso servidor persistente y de su recuperación correcta.                                               |
| Persistencia local o Postgres           | El modo JSON es excelente para desarrollo, pero no es el camino de escalado multiinstancia.                                                         |
| Ledger diario verificable               | Garantiza integridad del registro, no que toda interpretación narrativa sea verdadera.                                                              |
| Múltiples proveedores/cerebros          | Aumenta flexibilidad, pero también superficies de fallo, costos y diferencias de calidad.                                                           |
| Headless y auditorías                   | El propio audit de autonomía muestra que todavía hay zonas donde narrativa/reflexión puede consolidar recuerdos no sustentados por estado objetivo. |
| Federación entre servidores             | Es potente, pero todavía no equivale a una malla distribuida general ni a consistencia compartida entre todos los mundos.                           |

# 13. Qué significa esto para una app móvil conectada a mundos

La arquitectura del repo es reutilizable como backend de un producto móvil porque la autoridad ya vive fuera del navegador. El cliente móvil necesitaría autenticación, lectura de estado, consumo del stream, vistas narrativas, chat/cartas, notificaciones y eventualmente un renderer propio; no necesita reimplementar economía, memoria, tiempo ni validación en Swift o Kotlin.

Lo que sí conviene desacoplar a futuro es la noción “una isla = un servidor” de la infraestructura física concreta. Conceptualmente funciona perfecto; operacionalmente, si el producto escala a muchos mundos, probablemente haya que conservar la misma frontera lógica de mundo pero orquestarla sobre infraestructura más elástica.

# Fuentes principales revisadas

La explicación anterior se apoya en archivos concretos del repositorio, no sólo en el README. Los más relevantes para este documento son:

- README.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/README.md)

- package.json — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/package.json)

- apps/server/package.json — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/apps/server/package.json)

- apps/server/src/realworld.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/apps/server/src/realworld.ts)

- docs/deployment.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/deployment.md)

- docs/boarding.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/boarding.md)

- docs/federation.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/federation.md)

- packages/store/src — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/tree/main/packages/store/src)

- packages/engine/src/hash.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/packages/engine/src/hash.ts)

- .env.example — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/.env.example)

*Nota de alcance: cuando el documento habla de una “lectura arquitectónica”, es una síntesis del comportamiento observado en esos módulos; cuando afirma que algo existe o se ejecuta, está respaldado por el repo revisado.*
