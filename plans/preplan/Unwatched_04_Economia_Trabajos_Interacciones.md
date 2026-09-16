Cómo circula el dinero, cómo se produce, quién trabaja, qué puede hacer un ciudadano y qué puede hacer —o no— el usuario que lo posee.

*Base: rama principal inspeccionada, versión declarada 0.14.1. Enfoque: conceptual profundo, sin ejemplos de código.*

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Lectura en una frase</strong></p>
<p>La economía es una simulación cerrada con moneda interna: los ciudadanos llegan con un pequeño colchón, trabajan y producen, comercios compran/venden stock real, el continente compra excedentes y las monedas circulan entre personas, negocios y gobierno. El dinero real del usuario sólo compra cognición; no existe conversión a monedas del mundo.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 1. Dos economías que no se mezclan

Unwatched separa de forma explícita dinero real y economía ficticia. Stripe gestiona planes y créditos de IA. El motor gestiona monedas del mundo. Los créditos pagan inferencia; las monedas pagan comida, alojamiento, salarios, tierra, materiales, préstamos, comercio y actividad cívica. No hay una función de conversión entre ambos sistemas.

La separación es una regla de diseño, no sólo una convención de UI. El módulo de billing no tiene camino hacia la economía del motor. Esto evita que pagar más convierta a un ciudadano en más rico o más rápido; sólo le permite deliberar más veces o con modelos más capaces.

# 2. Entrada al mundo

El ciudadano nuevo llega con 40 monedas, una valija y tres noches prepagadas en la posada del puerto. Ese capital inicial cumple una función de runway: da tiempo para orientarse, buscar trabajo y entrar en la economía sin que la primera decisión sea una emergencia inmediata.

Si un ciudadano se reactiva después de quedar en espera por problemas de entitlement, no recibe nuevas monedas. El sistema intenta evitar que mecanismos de cuenta o facturación se transformen accidentalmente en una fuente de emisión monetaria.

# 3. De dónde aparece el dinero del mundo

La economía base tiene comercios con un float inicial, ciudadanos con capital de llegada y un canal de ingreso estructural: el continente compra excedente producido por la isla. El pack define cuánto paga por distintos bienes y cuánto stock debe retenerse antes de exportar. Esa exportación es la válvula que inyecta ingresos vinculados a producción real.

Cuando hay islas federadas, el comercio entre ellas no acuña monedas: la isla compradora entrega dinero y la vendedora lo recibe. Lo que ninguna isla necesita puede terminar en el mercado continental. Esto mantiene una contabilidad intuitiva y hace que producción y logística importen.

# 4. Cadena productiva

Los trabajos no son sólo etiquetas narrativas. Un turno puede producir bienes; algunos lugares necesitan insumos de otros. El carro de la mañana mueve mercancías entre puntos de la cadena y las tiendas sólo venden lo que efectivamente hay en el estante.

| **Cadena**                                | **Funcionamiento**                                                                                                                |
|-------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Grano → harina → pan                      | Campos producen grano; molino consume grano y produce harina; panadería consume harina y produce pan; mercado/posada reciben pan. |
| Pesca → venta / sopa                      | Fish house produce pescado; mercado vende parte y la posada usa pescado como insumo de sopa.                                      |
| Bosque → madera → tablones → construcción | Pinewood produce timber; sawpit lo transforma en planks; los tablones son requisito material para casas, locales y proyectos.     |
| Huerto → fruta                            | Orchard produce manzanas según estación y abastece mercado.                                                                       |
| Cantera / herrería                        | Quarry genera piedra; smithy produce clavos. Son recursos de economía material y expansión.                                       |
| Bienes de servicio                        | Tavern produce bebida; chandlery produce cuerda y aceite.                                                                         |
| Cultivo estacional de exportación         | Lavanda aparece en meses concretos y está orientada a generar ingreso externo.                                                    |

# 5. Los 13 trabajos base

| **Trabajo**              | **Lugar**  | **Salario por turno** | **Horario base** | **Cupos** |
|--------------------------|------------|-----------------------|------------------|-----------|
| Cocinero/a de panadería  | Bakery     | 3                     | 06–12            | 2         |
| Ayuda en la posada       | Inn        | 2                     | 08–16            | 2         |
| Peón de campo            | Fields     | 2                     | 07–15            | 4         |
| Ayudante de molino       | Mill       | 3                     | 07–14            | 1         |
| Estibador/a              | Harbor     | 2                     | 06–12            | 2         |
| Dependiente de chandlery | Chandlery  | 2                     | 09–17            | 1         |
| Ayuda de taberna         | Tavern     | 2                     | 16–23            | 1         |
| Limpiador/a de pescado   | Fish house | 2                     | 05–11            | 2         |
| Ayuda de herrero         | Smithy     | 3                     | 08–16            | 1         |
| Recolector/a de huerto   | Orchard    | 2                     | 07–14            | 3         |
| Leñador/a                | Pinewood   | 3                     | 07–15            | 2         |
| Aserrador/a              | Sawpit     | 3                     | 08–16            | 1         |
| Cantero/a                | Quarry     | 3                     | 07–14            | 2         |

El domingo no hay turnos ni salarios. Fiestas y calendario también pueden alterar la jornada. El ciudadano desempleado se desplaza por hábito hacia lugares con vacantes; la aplicación propiamente dicha al puesto requiere una acción válida en el lugar.

# 6. Ciclo laboral

1.  Un ciudadano sin empleo detecta puestos abiertos y tiende a acercarse a los lugares donde hay vacantes.

2.  Al estar en el lugar puede aplicar a un trabajo. El motor valida disponibilidad.

3.  Durante su horario el hábito lo lleva al lugar y ejecuta work si no hay una razón de mayor peso que lo interrumpa.

4.  El turno genera producción cuando ese trabajo está asociado a una receta económica y paga salario conforme a reglas vigentes.

5.  El ciudadano puede renunciar. Un propietario también puede crear un puesto adicional en su negocio, fijando un salario dentro de los límites del sistema.

6.  Leyes del consejo pueden aplicar impuestos al salario, modificando el flujo neto sin cambiar el contrato básico del trabajo.

# 7. Gastos, alojamiento y supervivencia

La moneda sale del bolsillo por comida, cama, materiales, tierra, comercio, deudas y otras obligaciones. El alojamiento es material: una cama tiene precio y capacidad. Si alguien posee una casa puede alojar a otra persona gratuitamente; si no puede pagar la posada existe una solución precaria en el boat shed.

El cuerpo mantiene hambre, descanso y sociabilidad. La falta de alimento puede llevar a debilidad y, tras varios días, muerte. Dormir a la intemperie en invierno agrava el proceso. La muerte no se resuelve como “game over del cliente”: el personaje sale de la vida activa, sus bienes siguen reglas de herencia y el mundo conserva su historia.

# 8. Propiedad y construcción

Existen lotes libres. Construir exige estar en un lote válido, pagar el costo y disponer de materiales/trabajo. El pack base define dos categorías económicas: casa y local. Una casa aporta camas; un local puede vender bienes, retener ingresos y contratar ayuda.

| **Construcción base** | **Costo monetario** | **Materiales** | **Trabajo**                 | **Resultado**                                                            |
|-----------------------|---------------------|----------------|-----------------------------|--------------------------------------------------------------------------|
| Casa                  | 15                  | 6 tablones     | 6 mañanas/unidades de labor | Dos camas; propietario duerme sin pagar y puede alojar a otra persona.   |
| Local                 | 30                  | 10 tablones    | 10 unidades de labor        | Lugar comercial con stock/ventas y posibilidad de contratar un ayudante. |

La construcción no se liquida sólo porque dos agentes hablaron de ella: el motor cuenta labor real, incluidos compromisos de trabajo, y no permite cerrar la promesa antes de entregar la labor comprometida.

# 9. Comercio y emprendimiento

Comprar y vender requiere presencia, stock y monedas. Un propietario puede elegir qué item vender en su local y fijar el precio dentro de límites. Un trabajador o dueño de un taller puede crear un nuevo objeto a partir de insumos disponibles; si la receta es válida, la isla aprende que ese objeto existe.

Esto hace que la economía pueda evolucionar desde la actividad de los propios ciudadanos: nuevas tiendas, precios definidos por dueños, productos derivados y nombres de lugares que se vuelven canónicos si suficientes personas los usan.

# 10. Préstamos, deudas y promesas

Los ciudadanos pueden prestar monedas con fecha de vencimiento. Ambas partes recuerdan la deuda y el pago se realiza mediante transferencia de monedas. También hay un sistema de promesas: una persona ofrece hacer algo, la otra acepta o rechaza, y quien prometió puede cerrar el trato una vez cumplido.

Una promesa vencida sin liquidar queda registrada como rota y afecta confianza. En construcción, el trato puede incluir sitio y número de mañanas de trabajo; el motor mide esa labor antes de permitir el settlement. Esto convierte las conversaciones comerciales en obligaciones persistentes sin hacer que todo diálogo sea un contrato automático.

# 11. Gobierno y economía pública

El consejo tiene tesorería, alcalde, leyes y obras públicas. El alcalde emerge como la persona más confiable en el proceso electoral del mundo. El consejo puede aprobar leyes expresadas en lenguaje, y el motor reconoce algunas con “dientes” numéricos: impuestos a salarios, topes de precio y restricciones horarias.

| **Obra pública** | **Costo del tesoro** | **Efecto**                                                        |
|------------------|----------------------|-------------------------------------------------------------------|
| Granero          | 50                   | Añade reserva de grano para amortiguar una mala etapa productiva. |
| Casa de baños    | 60                   | Mejora descanso de la población.                                  |
| Puente           | 40                   | Acorta conexión entre lugares muy alejados.                       |

Cualquier ciudadano puede acusar a otro. La audiencia se celebra públicamente y el registro sirve de evidencia para decidir multa, exilio o consecuencias para una acusación infundada. La política es parte de la simulación económica porque puede mover tesoro, salarios, precios y movilidad.

# 12. Proyectos comunitarios e instituciones

Los ciudadanos pueden iniciar proyectos compartidos, aportar monedas, comprometer ayuda y retirarse. El sistema de jardines comunitarios pasa por financiación, construcción y producción. También pueden fundar instituciones con una carta, incorporarse y abandonarlas.

Estas mecánicas son importantes porque crean acción colectiva sin una “guild UI” externa: la coordinación emerge de acciones sociales que después el motor convierte en estado persistente y medible.

# 13. Relaciones, romance, familia y herencia

Cada relación mantiene confianza, afecto y opinión. El motor puede formar una pareja cuando se cumplen condiciones sociales y de convivencia; una pareja con confianza mutua bajo su propio techo puede casarse en una reunión pública. Una pareja estable puede tener hijos, que crecen en el hogar y luego ingresan como ciudadanos con una persona influida por sus padres y recuerdos del hogar.

Al morir alguien, la propiedad pasa primero a la pareja, luego a un hijo adulto y, si no hay heredero, queda vacante. Así el romance no es sólo texto: modifica vivienda, familia, calendario social y transferencia patrimonial.

# 14. Eventos, clima y consecuencias económicas

Lluvia, nieve, tormentas, fuego, estaciones, fiestas y reuniones alteran rutinas. El hábito busca refugio ante mal clima; la producción agrícola cambia con estación/mes; el fuego puede inutilizar un lugar; una cadena productiva rota genera faltantes reales porque la tienda no vende stock inexistente.

Esto es el esqueleto de un engine de eventos sistémicos: el evento no necesita “dar una misión”. Basta con cambiar variables físicas o económicas y dejar que hábitos, necesidades y agentes reaccionen.

# 15. Catálogo completo de interacciones del avatar

El protocolo define acciones concretas. Agrupadas conceptualmente, las posibilidades son las siguientes:

| **Área**                    | **Acciones disponibles**                                                                                                  |
|-----------------------------|---------------------------------------------------------------------------------------------------------------------------|
| Movimiento y estado         | Moverse entre lugares conectados; dormir; esperar; abandonar la isla en barco.                                            |
| Comunicación                | Hablar a todos o a una persona; iniciar conversación; escribir al dueño; escribir publicaciones; llamar/nombrar lugares.  |
| Objetos y recursos          | Dar monedas u objetos; tomar objetos; usar objetos; comprar; vender; poner stock a la venta; fabricar nuevos objetos.     |
| Trabajo                     | Solicitar empleo; trabajar; renunciar; contratar a un ayudante; reparar.                                                  |
| Propiedad y vivienda        | Construir; alojar a otra persona; gestionar un local; participar en obras.                                                |
| Finanzas privadas           | Prestar dinero; devolver mediante transferencia; ofrecer, aceptar, rechazar o liquidar acuerdos.                          |
| Política                    | Proponer leyes; votar; financiar obra pública si es alcalde; acusar a alguien.                                            |
| Información y secretos      | Buscar entre pertenencias ajenas cuando se cumplen condiciones; publicar un exposé; recordar rumores y observaciones.     |
| Comunidad                   | Iniciar proyecto; contribuir; retirarse; fundar institución; incorporarse; salir de una institución.                      |
| Aprendizaje                 | Enseñar; proponer procedimiento; probarlo; practicarlo; compartirlo.                                                      |
| Expresión abierta           | Ejecutar una acción “do” descrita en lenguaje natural, limitada por el árbitro y las reglas físicas.                      |
| Personalización del entorno | Decorar con elementos permitidos; describir cómo debería verse una construcción; contribuir a nombres y dichos del mundo. |

# 16. Qué puede hacer el usuario/dueño

| **Puede**                            | **Qué significa en la práctica**                                                                                          |
|--------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| Diseñar al ciudadano antes de entrar | Persona, apariencia, instrucciones iniciales y elección de cerebro.                                                       |
| Elegir forma de cognición            | Plan hospedado, clave propia o cerebro externo conectado.                                                                 |
| Escribir cartas/consejos             | El mensaje entra a la vida mental del ciudadano; puede influir en decisiones y memoria.                                   |
| Leer digest                          | Resumen personal de lo sucedido desde la última lectura, basado en el registro/contexto.                                  |
| Leer Gazette                         | Visión editorial del día de la isla.                                                                                      |
| Observar el mundo                    | Seguir mapa, escenas, habitantes, lugares e interiores representados por el cliente.                                      |
| Revisar historia                     | Biblioteca/vida de quienes se fueron o murieron, registro verificable, replay de construcción y evolución/procedimientos. |
| Gestionar cuenta y gasto IA          | Suscripción, créditos, límites de gasto adicional, brain y proveedor.                                                     |
| Recibir comunicaciones               | Correo matinal y aviso de carta cuando Resend está configurado; Telegram es un canal opcional del repo.                   |
| Conectar software propio             | Usar token/SDK y WebSocket para reemplazar el cerebro por un proceso externo.                                             |

# 17. Qué NO puede hacer el usuario

El dueño no tiene un panel de “ordenar al ciudadano”. No puede moverlo, darle monedas del mundo, comprarle un empleo, acelerar sus segundos, transferir créditos a coins, revelar secretos que no percibió ni enviarlo por la fuerza a otra isla. Puede sugerir o aconsejar mediante cartas; el ciudadano decide qué hacer.

Tampoco debería confundirse la vista del producto con omnisciencia del ciudadano. El dueño puede ver elementos públicos de la isla, pero la narrativa personal y el conocimiento del avatar se construyen desde lo que su persona vio, escuchó o recibió.

# 18. Modelo de negocio implementado

| **Plan**                      | **USD/mes**             | **Cognición incluida**                                 | **Extras destacados**                                                    |
|-------------------------------|-------------------------|--------------------------------------------------------|--------------------------------------------------------------------------|
| Sin plan                      | 0                       | 0 pensamientos propios; vive por hábito.               | No responde cartas con pensamiento propio.                               |
| Visitor                       | 3                       | 10 pensamientos rutinarios + 1 decisión cuidadosa/día. | Plan matinal; digest y periódico; reflexión puede gastar créditos extra. |
| Resident                      | 12                      | 50 pensamientos + 6 decisiones cuidadosas/día.         | Reflexión nocturna, cartas en cruces, retrato y voz.                     |
| Patron                        | 29                      | 120 pensamientos + 15 decisiones cuidadosas/día.       | Decisiones cuidadosas con modelo superior; reflexión; libro y pinturas.  |
| Clave propia / cerebro propio | Sin metering de la isla | El usuario paga/ejecuta su cómputo.                    | Misma física y segundos; no consume créditos de Unwatched.               |

Paquetes de créditos implementados: 100 por USD 3, 500 por USD 12 y 2.000 por USD 40. Cada tier de pensamiento consume distinta cantidad de créditos al superar la asignación incluida. La compra automática de pensamientos extra está desactivada por defecto para cuentas nuevas y puede tener un tope diario.

# 19. Estado actual frente a una economía “totalmente emergente”

La economía es sistémica, pero todavía está enmarcada por un pack de mundo: trabajos base, recetas productivas, límites de precios y tipos de construcción. Los ciudadanos pueden ampliar productos, tiendas, instituciones y proyectos, pero no están generando una economía arbitraria sin restricciones.

Ese compromiso es sensato. Las reglas rígidas proveen contabilidad y evitan que el LLM “declare” que creó una fábrica con 10.000 monedas. La emergencia aparece dentro de un espacio de posibilidades verificables.

# 20. Lectura para un clon orientado a SimIA móvil

Si el objetivo es una app donde el suscriptor acompaña una vida autónoma, la base económica de Unwatched ya resuelve algo crítico: pagar la suscripción no compra privilegios dentro del mundo. La monetización se apoya en profundidad/frecuencia cognitiva y comunicación, mientras la vida material debe ganarse dentro de la simulación.

Para una versión con chat directo y push, conviene conservar exactamente esa frontera: el chat del dueño debe entrar como información/consejo; la push debe salir de eventos reales, cartas o digest; ninguna de las dos rutas debería crear consecuencias físicas por fuera del motor.

# Fuentes principales revisadas

La explicación anterior se apoya en archivos concretos del repositorio, no sólo en el README. Los más relevantes para este documento son:

- packages/engine/src/packs/island.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/packages/engine/src/packs/island.ts)

- packages/engine/src/world.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/packages/engine/src/world.ts)

- packages/engine/src/habit.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/packages/engine/src/habit.ts)

- packages/protocol/src/index.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/packages/protocol/src/index.ts)

- docs/protocol.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/protocol.md)

- apps/server/src/billing.ts — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/apps/server/src/billing.ts)

- docs/cognition-costs.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/cognition-costs.md)

- docs/federation.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/federation.md)

- docs/boarding.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/docs/boarding.md)

- README.md — [<u>GitHub</u>](https://github.com/kresogalic8/unwatched/blob/main/README.md)

*Nota de alcance: cuando el documento habla de una “lectura arquitectónica”, es una síntesis del comportamiento observado en esos módulos; cuando afirma que algo existe o se ejecuta, está respaldado por el repo revisado.*
