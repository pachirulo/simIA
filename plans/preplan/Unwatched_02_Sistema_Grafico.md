Cómo se construye y sincroniza la representación del mundo: renderer, mapa, personajes, interiores, clima, luz, sonido y superficies narrativas.

*Base: rama principal inspeccionada, versión declarada 0.14.1. Enfoque: conceptual profundo, sin ejemplos de código.*

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Lectura en una frase</strong></p>
<p>El mundo principal de Unwatched es 2D y está renderizado con PixiJS; no es un escenario 3D tradicional. La posición y estado vienen del servidor, mientras el cliente compone terreno, edificios, ciudadanos, efectos y UI en capas. Three.js existe como dependencia, pero no es el renderer central del mundo inspeccionado.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 1. Filosofía visual

El repo intenta que la representación visual sea una consecuencia del mundo y no una maqueta fija. El servidor entrega tamaño del mapa, lugares, posición, distrito, tipo, sprite, propietario, stock y obras en curso. El cliente usa esos datos para dibujar lo que existe en ese momento. Si una persona construye un local, la visualización puede incorporarlo sin que el mapa base haya sido recompilado.

El README lo resume como “drawn in code”: edificios, vegetación, agua y personajes se construyen mediante funciones y una paleta coherente. Esto favorece escalado, variaciones de estado y consistencia estilística por encima del detalle de un pipeline 3D pesado.

# 2. Stack visual actual

| **Capa**                     | **Tecnología / función**                                                                                                             |
|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Aplicación y UI              | Next.js 16 + React 19.                                                                                                               |
| Renderer del mundo           | PixiJS 8: canvas/WebGL para escena, contenedores, gráficos, texto y composición.                                                     |
| Animación de UI/transiciones | GSAP.                                                                                                                                |
| Efectos visuales             | Pixi filters y módulos propios para iluminación, agua, clima, nubes y partículas.                                                    |
| Rigging experimental         | Spine Pixi runtime en dependencias de desarrollo e investigación específica de rigs.                                                 |
| 3D                           | Three.js está instalado, pero la vista principal World analizada usa PixiJS; no conviene describir Unwatched como un juego Three.js. |
| Assets generados             | SVG para edificios descritos, más recursos de audio/arte opcionales.                                                                 |

# 3. Mapa como representación del estado del servidor

El mapa no se define sólo en el frontend. El pack de mundo declara coordenadas y conexiones entre lugares, y el servidor entrega una vista pública que el cliente dibuja. Esto crea una separación clara: el motor sabe que existe “la panadería” y dónde está; el renderer decide cómo se ve y cómo se anima.

La escena usa unidades de mapa y construye paisaje por distrito. Sobre las ubicaciones canónicas agrega elementos ambientales —árboles, rocas, muros, bancos, faroles, barriles, redes, cultivos— para que el territorio se lea como un lugar y no como un grafo de nodos.

# 4. Modos de cámara y niveles de lectura

La vista World contempla tres modos explícitos: street, map y cinema. Eso ya representa tres intenciones de cámara diferentes: seguir la vida cercana, obtener visión general y enfocar automáticamente momentos relevantes. La cámara mantiene posición, zoom, seguimiento de un ciudadano y control manual.

| **Modo** | **Lectura conceptual**                                                                                                               |
|----------|--------------------------------------------------------------------------------------------------------------------------------------|
| Street   | Escala cercana orientada a seguir ciudadanos, conversaciones, actividad de edificios y vida cotidiana.                               |
| Map      | Escala panorámica para entender distribución, densidad y movimiento del conjunto.                                                    |
| Cinema   | Cámara dirigida por acontecimientos: concentra atención en el último momento relevante, reuniones, fuego u otras escenas destacadas. |

Además hay minimapa y selección de lugares/personas. Esta arquitectura es relevante para tu idea de múltiples capas de mundo: el repo ya distingue escalas de observación y también dispone de componentes de interiores, aunque no sea un sistema 3D de entrar físicamente a cada habitación.

# 5. Interiores

La vista principal importa componentes específicos de interior y una capa BuildingInterior. Eso muestra que el producto no se limita a “avatar moviéndose por puntos exteriores”: puede abrir una representación del interior y ubicar personas dentro del espacio. Conceptualmente, el exterior sigue siendo la autoridad topológica y el interior es otra presentación del mismo lugar.

Para un clon que quiera hacer casa → habitación → objeto, este patrón es mejor que intentar construir desde el primer día un único mundo continuo sin niveles de detalle. Podés mantener un lugar canónico en el motor y ofrecer distintas vistas del mismo estado.

# 6. Edificios y mundo modificable

Los edificios tienen identidad de motor y representación visual. Una construcción puede estar en etapas, terminar y convertirse en un lugar funcional. Cuando un constructor describe cómo quiere que se vea una obra, el sistema puede producir un dibujo vectorial asociado a un hash estable; el cliente recupera ese SVG y lo integra en la escena.

Esto es importante porque hace que la creatividad del agente tenga una salida visible sin darle permiso de inventar la física: el agente expresa intención estética, pero el motor sigue decidiendo si el edificio puede construirse, qué cuesta, cuánto trabajo requiere y cuándo existe.

# 7. Personajes

Los ciudadanos se representan como rigs con partes y poses, no como un sprite estático único. La vista gestiona caminar, correr, dormir, sentarse, hablar, mirar hacia interlocutores y reacciones temporales a eventos. El estado visual también puede reflejar debilidad, envejecimiento, herramientas del oficio, objetos recientemente recogidos y ropa de invierno.

El repo contiene una investigación reciente sobre migrar/mejorar rigs con Spine. La conclusión del propio documento es conservadora: Spine + PixiJS es una dirección válida, pero cambiar de runtime no soluciona arte mal preparado. La calidad depende de un master coherente, coordenadas de articulaciones, pesos y validación de poses. El candidato experimental todavía no reemplaza la representación principal.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Estado real del rig</strong></p>
<p>Hay trabajo experimental serio sobre Spine, pero el documento de investigación declara explícitamente que el candidato todavía no es el personaje principal. No conviene tratar esa rama como pipeline de producción cerrado.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 8. Movimiento y huella en el terreno

La visualización no sólo interpola una coordenada a otra: mantiene locomoción, dirección de marcha y seguimiento de trayectos. También hay una capa de footfall/wear que permite que los caminos se aclaren según dónde camina la gente. Es un detalle visual, pero refuerza la tesis del producto: la historia del mundo deja marcas visibles.

# 9. Luz, hora, estación y clima

La escena combina reloj, estación y estado meteorológico con módulos de cielo, nubes, agua, iluminación y filtros. Amanecer y atardecer se conectan al calendario real cuando el mundo usa Open-Meteo. Sombras, temperatura de luz, lluvia, nieve y otros efectos se superponen a la misma geometría base.

El renderer, por lo tanto, no necesita que la IA describa “está lloviendo” para cambiar la escena: recibe un hecho del mundo y lo traduce visualmente. Ese patrón es exactamente el que conviene mantener para cualquier engine de eventos: evento objetivo primero, representación después.

# 10. Vida ambiental y sonido

El frontend tiene módulos dedicados a vida costera, animales, partículas y ambiente sonoro. El README documenta gaviotas, gato, gallinas, murciélagos, luciérnagas, humo, faro, mar, viento, lluvia en techos, remos, campanas y música. No todos estos elementos son agentes sociales: muchos son ambientación reactiva, que es mucho más barata que simular un “cerebro” para cada cosa visible.

El audio utiliza una mezcla de loops y disparos contextuales. Su valor conceptual es que el estado del mundo también gobierna el paisaje sonoro: clima, hora y eventos activan otra capa sensorial sin cambiar la lógica de simulación.

# 11. UI HTML sobre canvas

Etiquetas, burbujas, controles y paneles no están todos dibujados dentro de Pixi. La vista combina canvas para el mundo con HTML/React superpuesto para texto e interacción. Esto evita degradar legibilidad y accesibilidad por intentar convertir toda la aplicación en un HUD de juego.

Esa mezcla es especialmente útil para móvil: mapa y personajes pueden vivir en una superficie gráfica, mientras digest, chat, cartas, perfil, historial y billing siguen siendo UI nativa o declarativa normal.

# 12. Superficies narrativas fuera del mapa

La identidad visual del producto no termina en el mapa. El repositorio incluye rutas dedicadas a digest, Gazette, biblioteca, construcción/replay, evolución, perfil del agente y otras pantallas. El mapa muestra “qué está pasando”; estas superficies convierten los eventos en algo que el dueño puede leer a otro ritmo.

Esto explica por qué el README declara que “el digest es el producto”. El renderer del pueblo es una capa de presencia; la retención diaria depende de que los hechos puedan condensarse en una historia legible incluso cuando el usuario no estuvo conectado.

# 13. Sincronización gráfica con eventos

La vista inicial carga un snapshot del pueblo y luego mantiene WebSocket/polling para actualizar agentes y eventos. El frontend traduce eventos a cambios de pose, burbujas, escenas y posiciones; no recalcula las consecuencias. Esta arquitectura hace posible que un móvil, una web y una pantalla pública observen el mismo mundo con renders diferentes.

# 14. Qué es reutilizable y qué habría que rehacer para iOS/Android

| **Reutilizable casi directo**                          | **Probablemente específico de cada cliente**                             |
|--------------------------------------------------------|--------------------------------------------------------------------------|
| Modelo de mapa, posiciones, eventos y estados públicos | Renderer PixiJS si se opta por UI totalmente nativa.                     |
| Assets SVG y reglas visuales de edificios              | Sistema de cámara/touch adaptado al dispositivo.                         |
| Concepto street/map/cinema e interiores                | Gestos, navegación, accesibilidad y rendimiento móvil.                   |
| Estado de poses, clima, estación y escenas             | Pipeline de animación si se migra a Three.js/Metal/SceneKit/otro engine. |
| Narrativa visual y jerarquía de información            | Push notifications, widgets y presentación fuera de la app.              |

Si el objetivo nuevo es un mundo 3D en Three.js, eso sería una reimplementación de la capa de presentación, no una simple “activación” de algo que Unwatched ya haga. La buena noticia es que motor y protocolo están suficientemente separados para que esa sustitución sea viable sin tirar la simulación.

# Fuentes principales revisadas

La explicación anterior se apoya en archivos concretos del repositorio, no sólo en el README. Los más relevantes para este documento son:

- apps/web/package.json — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/apps/web/package.json)

- apps/web/components/World.tsx — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/apps/web/components/World.tsx)

- docs/character-rig-research-2026-09-13.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/character-rig-research-2026-09-13.md)
