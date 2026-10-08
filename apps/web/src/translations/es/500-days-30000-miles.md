---
title: "500 días y 30,000 millas"
description: "Hace quinientos días apunté una Raspberry Pi a mi coche y empecé a guardar cada milla que recorría. Ha capturado 10.4 millones de puntos de datos sin perderse ni un latido que yo no provocara, y por el camino dejó de ser un registrador y se convirtió en algo a lo que puedo hacerle preguntas."
publishedAt: "2026-08-25"
difficulty: "Intermediate"
topics: ["Tesla", "Raspberry Pi", "Self-Hosting", "AI Engineering"]
readingTime: 7
aiSummary: "Una instancia autoalojada de TeslaMate que se ejecuta en Docker sobre una Raspberry Pi 5 superó las 30,000 millas registradas el 23 de agosto de 2026 a las 10:22:03 CDT, quinientos días después de que empezara la recopilación el 12 de abril de 2025. El sistema guarda 10,356,022 filas de posición y 243,380 filas de detalle de carga en una base de datos PostgreSQL de 1,598 MB, con una media de 20,712 filas por día, y ha registrado 6,921 trayectos que suman 976 horas, 10,016 kWh en 513 sesiones de carga (458 de ellas en casa) y 35 actualizaciones de software por aire. La disponibilidad de la recopilación es del 92 por ciento en todo el periodo. Consultar los datos en bruto resolvió la sospecha de un fallo del conector de pared: en 217,124 muestras de carga en casa la señal piloto se mantuvo en 48 A en 217,118 de ellas, lo que demuestra que el conector nunca redujo su potencia e identifica al propio vehículo desconectándose de la red en las noches calurosas como la causa real de las aparentes interrupciones de carga. El artículo cubre la pila, la práctica de interrogar directamente una base de datos de telemetría personal y el uso de LLM para traducir preguntas a SQL sobre datos propios."
sourceHash: "b79af0ac940ffe101ff0c51da8790d8d43f3be82337b5a58d3559be4c777f553"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  Hace quinientos días apunté una Raspberry Pi a mi coche y empecé a guardar cada milla. Desde entonces ha registrado 10.4 millones de puntos de datos en una base de datos de 1.6 GB, en una Pi que no hace nada más y a la que desde entonces no se le ha pedido otra cosa. El domingo pasado registró la milla treinta mil. Lo que no esperaba es en qué se convirtió: no en un registrador, sino en una base de datos a la que puedo hacer preguntas en lenguaje natural sobre mi propia vida, que nadie más puede responder.
</TLDR>

El domingo pasado por la mañana, a las 10:22, con el cuentakilómetros marcando 40,397.8, una Raspberry Pi de mi casa registró la milla treinta mil de mi conducción. Quinientos días de recopilación, exactos.

Nada lo señaló, porque nada se construyó para ello. Una fila aterrizó en una tabla de Postgres exactamente igual que los diez millones anteriores, que es el mayor elogio que puedo hacerle a una pieza de infraestructura.

Diez millones no es una figura retórica. La base de datos contiene **10,356,022 filas de posición** y otras 243,380 filas de detalle de carga. Eso son unas 20,700 filas nuevas al día, todos los días, durante quinientos días, desde un único nodo dedicado al que se ha dejado a su aire para hacer exactamente esto y nada más.

## Qué se está ejecutando realmente

Cuatro contenedores de Docker en una Raspberry Pi 5. TeslaMate recopila, Postgres 16 lo guarda, Grafana lo dibuja y Mosquitto publica el estado en vivo por MQTT para que el resto de la casa pueda reaccionar a la llegada del coche. Esa es toda la pila, y tiene una máquina para ella sola. Tengo varias Pi en el laboratorio, y esta está reservada solo para la recopilación, sin hacer otra cosa que mantener el registro 24/7. Nada más compite con ella por CPU, memoria o disponibilidad, lo que significa que nada más puede tumbarla.

El recopilador es más listo que un bucle de sondeo. Cuando el coche circula, muestrea cada pocos segundos: posición, velocidad, rumbo, altitud, nivel de batería, consumo de potencia, temperaturas. Cuando el coche se carga, sigue toda la sesión en lugar de registrar solo un inicio y un final. Y cuando el coche está aparcado se retira deliberadamente y lo deja dormir, porque machacar la API de un Tesla lo mantiene despierto y te cuesta autonomía durante la noche. Esa última decisión es la razón por la que el registrador nunca me ha costado autonomía.

Quinientos días de eso, completos y segundo a segundo, suman **1.6 GB**, que es menos que una sola película. Sigo esperando que el almacenamiento se convierta en un problema y sigue sin serlo.

**30,144 millas** registradas frente al cuentakilómetros, 60.3 al día. **6,921 trayectos** que cubren 976 horas, que son cuarenta días completos al volante. **10,016 kWh** en 513 sesiones de carga, **458 de ellas en casa**, que es el 89.3 por ciento y lo más útil que puedo decirle a cualquiera que dude en comprar un vehículo eléctrico. Treinta y cinco actualizaciones de software por aire capturadas, cada una con su marca de tiempo, lo que me da un registro de cambios del firmware personal más preciso que cualquier cosa que publique Tesla.

La disponibilidad de la recopilación en toda la ejecución es del **92 por ciento**. Para un ordenador de placa única sin supervisión y sin equipo de operaciones, lo acepto siempre.

Por cada cuatro dólares de electricidad que compro, unos tres mueven realmente el coche, y el resto se va en pérdidas de carga, aire acondicionado y el coche despertándose solo por la noche. El clima decide lo mal que se pone eso: los meses calurosos me cuestan un 16 por ciento más por milla que los templados, y un invierno en Texas, un 3.

## Lo que nadie te cuenta

Seguí entrando por SSH a la Pi, y casi nunca porque necesitara arreglo. Me conectaba porque quería ver llegar los datos, ver aterrizar un trayecto en la tabla mientras el coche aún estaba caliente en la entrada, comprobar que la curva de carga de la noche anterior parecía una curva de carga. Al principio lo hacía porque aún no me fiaba de ella. Más tarde lo hacía porque había empezado a entender el esquema, y entender un esquema es el punto en el que una base de datos deja de ser una caja negra y empieza a ser un lugar al que puedes ir a mirar.

Es una educación más lenta de lo que suena. Aprendes que una fila de `drives` aparece en el instante en que el coche cambia de estado, que un proceso de carga y una muestra de carga son objetos distintos con vidas distintas, que el cuentakilómetros es el único campo que nunca miente. Aprendes lo que significan tus propios datos, que no es lo mismo que tenerlos.

Nada de eso requirió IA, y quiero ser preciso con la cronología: hacía esto mucho antes de que un asistente pudiera haberme escrito las consultas. El aprendizaje fue el trabajo.

## Luego las consultas se volvieron fáciles

Lo que cambió es que dejé de escribir SQL y empecé a hacer preguntas.

Apuntar un LLM a un esquema que ya entendía convirtió una consulta de cinco minutos en una de diez segundos. No porque conozca mis datos, sino porque los conozco yo, y puedo darme cuenta de inmediato cuando la respuesta que me da no tiene sentido. Esa combinación es la útil. Quien nunca ha abierto las tablas recibe respuestas erróneas con total seguridad y no tiene forma de detectarlas. Quien conoce el esquema y ahora puede preguntar en español se salta directamente a la parte interesante.

Lo interesante es que las preguntas mejoran. Cuando consultar es caro, solo preguntas lo que ya sospechas. Cuando es barato, empiezas a preguntar cosas sobre las que no tienes hipótesis, y ahí es donde viven las sorpresas. Cómo cambia la duración media de los viajes a lo largo de las estaciones. En qué momento del día se mueve realmente el coche. Cómo es una sesión de carga en la noche más calurosa del año comparada con la más templada.

La aplicación de Tesla no puede responder nada de eso. Nunca se construyó para ello. Te muestra un resumen, y un resumen solo puede responder las preguntas que alguien anticipó cuando lo diseñó.

## La pregunta que pagó todo el proyecto

Este verano me convencí de que mi conector de pared estaba fallando.

En las noches calurosas, las sesiones de carga en la aplicación parecían detenerse y reiniciarse. El diagnóstico se imponía solo: reducción de potencia por calor, la unidad recortando corriente al calentarse, haciendo ciclar el coche de esa manera que envejece silenciosamente una batería a lo largo de los años. Cambiar un conector de pared no es barato.

Entonces recordé que no tenía por qué adivinar. Cada muestra de carga que la cosa había tomado estaba en un disco de mi casa.

La señal piloto es el conector diciéndole al coche cuántos amperios puede consumir. Reducir la potencia significa que ese número baja. En **217,124 muestras tomadas en casa, marcó 48 amperios en 217,118 de ellas.** Seis lecturas de más de doscientas mil están en cualquier otro valor, y el nivel de batería nunca cayó a mitad de sesión, cosa que habría ocurrido si al coche lo hubieran cortado de verdad.

El conector nunca había flaqueado. Alinear las sesiones con la temperatura exterior mostró lo que pasaba en realidad: en las noches más calurosas era el propio coche el que se desconectaba de la red, así que el registrador perdía de vista una sesión que seguía funcionando perfectamente.

No gasté el dinero. Esa única respuesta, a partir de datos que ya tenía, en hardware que ya tenía, cubrió el coste de todo el proyecto varias veces.

## Los próximos veinte mil

A sesenta millas al día, las cincuenta mil llegarán hacia mediados del año que viene, y al disco seguirá sin importarle.

Lo que de verdad estoy esperando es la comparación. Un verano de Texas no dice nada sobre el calor y las baterías. Dos permiten medir. Treinta mil millas es más o menos el punto en el que un registro deja de ser un registro y se convierte en una referencia, y cada mes que lo dejo funcionando las comparaciones se afinan sin ningún esfuerzo por mi parte.

La Pi ha sido la pieza de infraestructura menos exigente que poseo y, con diferencia, la más gratificante, porque se acumula. Pidió una configuración y alguna sesión ocasional de SSH, y a cambio ha construido en silencio algo que nadie puede venderme, cancelarme ni dejar fuera de mi alcance con el precio: un registro completo y consultable de cómo uso realmente mi propio coche.
