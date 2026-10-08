---
title: "Aislar financieramente un enjambre de IA en una Raspberry Pi"
description: "Cómo convertí una Pi 5 en un orquestador local con un enrutador MCP y redes aisladas de trabajadores OpenClaw para recortar los costes de API."
publishedAt: "2026-03-27"
difficulty: "Advanced"
topics: ["Architecture", "Raspberry Pi", "OpenClaw", "Docker"]
readingTime: 6
aiSummary: "Un desglose detallado de la conversión de una Raspberry Pi 5 de 16GB en una red Docker aislada gobernada por un Programa de Control Maestro. Destaca el uso de un enrutador manifest.ai para derivar tareas a trabajadores DeepSeek V3 de OpenRouter, más económicos."
sourceHash: "52b8730bd6ee9d4f19a2fc7e28cef3803c9687ba6ab39691b6f7ef4b37f084a4"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
Transformé uno de mis tres nodos Raspberry Pi 5 (16GB + M.2 256GB) en un armazón de orquestación aislado financieramente que ejecuta asistentes personales de IA plenamente capaces y de uso diario. Gracias a una arquitectura de cerebro dividido en la que un Programa de Control Maestro (MCP) supervisa a trabajadores OpenClaw polivalentes, el sistema puede encargarse de forma autónoma de todo, desde las interfaces de Telegram hasta las integraciones con herramientas de negocio. Este enfoque impone un control estricto de costes sobre agentes muy capaces sin limitar artificialmente sus habilidades, y demuestra que no hay que elegir entre una asistencia de IA avanzada y una facturación de API predecible.
</TLDR>

Aislé uno de mis tres nodos Raspberry Pi 5 (16GB + M.2 256GB) para que actuara como orquestador de IA aislado financieramente y gobernado por un Programa de Control Maestro (MCP). El objetivo era construir un sistema de asistentes de IA capaz y polivalente que pudiera usar a diario sin ver cómo mi facturación de API del nivel "Pro" se evaporaba por completo por el mantenimiento constante del estado.

Los trabajadores de este sistema no son daemons limitados a un solo propósito. Son asistentes personales totalmente funcionales que vigilan sistemas de forma activa, ejecutan tareas autónomas en segundo plano, se conectan con herramientas de productividad personal y responden consultas a través de Telegram. Sin embargo, ejecutar estos asistentes tan capaces exige una salvaguarda. La solución fue una estrategia de enrutamiento agresiva: usar un MCP central para supervisar el entorno mientras los asistentes reales se ejecutan como procesos dockerizados en segundo plano a través de un agregador con topes de gasto estrictos a nivel de cuenta. La Pi ya no es un laboratorio doméstico de propósito general: purgué todos los demás contenedores para convertirla en un armazón OpenClaw dedicado y conectado en red.

## La arquitectura

El sistema funciona con una arquitectura escalonada de cerebro dividido. En la raíz está el MCP. En lugar de fijar un único modelo caro, el MCP usa una habilidad `manifest.ai` como enrutador integrado. Evalúa de forma dinámica la complejidad de la tarea administrativa y decide qué modelo de Gemini invocar, con el modo automático nativo de Gemini como valor por defecto para una eficiencia de base.

Por debajo, completamente aislados en una red puente de Docker dedicada (`claw_net`), hay dos trabajadores específicos para tareas. Los trabajadores hacen el trabajo pesado a través de una conexión prepago con OpenRouter. El MCP vigila sus logs, reescribe sus configuraciones si fallan y reinicia sus contenedores.

| Capa | Instancia | Proveedor/Modelo | Función y capacidades | Estructura de costes |
| --- | --- | --- | --- | --- |
| Supervisor | MCP (raíz) | Google AI (enrutador `manifest.ai` / Gemini Auto) | Enrutamiento dinámico, modifica configuraciones, controla el daemon de Docker. | Variable / Optimizado |
| Subproceso | Worker 01 | OpenRouter (DeepSeek V3) | Análisis rápido de datos, interfaz de Telegram. | 0.14 $ / 1M de tokens |
| Subproceso | Worker 02 | OpenRouter (DeepSeek V3) | Acciones complejas de API, interfaz de Telegram. | 0.14 $ / 1M de tokens |

## La construcción

La transición exigió borrar la Pi 5 para eliminar los conflictos de puertos y la sobrecarga de CPU. El hardware es ahora exclusivamente un host de OpenClaw.

Primero necesitaba partir de cero. Ejecuté una purga total de la infraestructura existente para asegurarme de que ningún contenedor fantasma se comiera la memoria ni entrara en conflicto con mis capas de enrutamiento. Después establecí la red aislada (`claw_net`). Los trabajadores necesitan acceso saliente a internet para la API de Telegram y OpenRouter, pero aislarlos en su propia red puente garantiza que no tengan acceso entrante y que no puedan ver el tráfico de los demás.

```bash
# Purge all non-essential containers and images
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker system prune -a --volumes -f

# Create the dedicated network for the swarm
docker network create --driver bridge claw_net
```

Reestructuré el sistema de archivos en `/opt/openclaw` para reflejar la jerarquía, dando al MCP visibilidad absoluta sobre los archivos de configuración de los trabajadores.

```bash
mkdir -p /opt/openclaw/{mcp,workers/worker-01,workers/worker-02}
```

A continuación configuré los trabajadores aislados. Fijé su autenticación a OpenRouter e impuse un límite de gasto mensual estricto directamente a nivel de cuenta. Esto contiene los excesos de coste en el servidor: si se produce un bucle, el daño máximo queda explícitamente acotado, lo que me libra de una factura mensual sorpresa de 500 dólares. En la práctica, ejecutar estos asistentes de IA de uso diario y totalmente capaces me cuesta de forma realista entre 8 y 15 dólares al mes. En lugar de imponer techos arbitrarios de capacidad, ajusté `maxOutputTokens` y `maxHistoryTurns` como parámetros deliberados de calibración del rendimiento. Estos valores se adaptan específicamente a la naturaleza del papel de cada trabajador, optimizando las ventanas de contexto para respuestas rápidas frente a acciones complejas, y garantizan que sigan siendo plenamente funcionales sin desperdiciar sobrecarga computacional.

```bash
# Configure Worker 01
cd /opt/openclaw/workers/worker-01
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_API_KEY" --non-interactive
openclaw config set agents.defaults.model.primary "openrouter/deepseek/deepseek-chat"
openclaw config set agents.defaults.maxOutputTokens 250
openclaw config set agents.defaults.maxHistoryTurns 5

# Configure Worker 02
cd /opt/openclaw/workers/worker-02
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_API_KEY" --non-interactive
openclaw config set agents.defaults.model.primary "openrouter/deepseek/deepseek-chat"
openclaw config set agents.defaults.maxOutputTokens 600
openclaw config set agents.defaults.maxHistoryTurns 8
```

Lancé los trabajadores conectados a la red aislada. Al montar sus respectivos directorios de configuración directamente en los contenedores, el MCP puede intervenir más tarde, leer esas configuraciones a través del socket de Docker y reescribirlas de forma dinámica si un trabajador empieza a portarse mal.

```bash
docker run -d --name worker-01 \
  --network claw_net \
  -v /opt/openclaw/workers/worker-01:/app/config \
  openclaw/core:latest

docker run -d --name worker-02 \
  --network claw_net \
  -v /opt/openclaw/workers/worker-02:/app/config \
  openclaw/core:latest
```

Por último, el Programa de Control Maestro. El MCP necesita credenciales de Google AI, pero para evitar un gasto innecesario de tokens implementé la habilidad de enrutamiento `manifest.ai`. Monté el socket de Docker y el directorio raíz `/opt/openclaw/workers` en su contenedor para que pudiera supervisar los subprocesos de forma nativa. El MCP es el único contenedor con las llaves del reino.

```bash
cd /opt/openclaw/mcp
openclaw onboard --auth-choice oauth --token-provider google --non-interactive

# Inject the manifest.ai router skill and set dynamic defaults
openclaw skill add manifest.ai/router
openclaw config set agents.defaults.model.primary "google/gemini-auto"
openclaw config set routing.strategy "manifest-dynamic"

docker run -d --name mcp \
  --network claw_net \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/openclaw/workers:/supervised_workers \
  -v /opt/openclaw/mcp:/app/config \
  openclaw/core:latest
```

## Las contrapartidas

Montar `/var/run/docker.sock` en un contenedor gobernado por un LLM es un riesgo de seguridad catastrófico en un entorno de producción. Si el MCP sufre un ataque de inyección de prompt, tiene control a nivel de root sobre el daemon de Docker de la Pi. Acepté ese riesgo porque la Pi 5 está físicamente aislada y dedicada en exclusiva a este experimento, pero no es un patrón para un despliegue empresarial.

Además, el enrutador `manifest.ai` es inteligente, pero no infalible. Cuando Worker 02 lanzó un enorme volcado de pila por una carga útil de API mal formada, el enrutador lo identificó correctamente como una "tarea de depuración compleja" y subió la ejecución a un modelo de razonamiento pesado en lugar de usar una variante Flash más ligera. El MCP consumió 40,000 tokens leyendo el log de errores antes de proponer una corrección. Reescribió con éxito el esquema de salida de Worker 02 y reinició el contenedor, pero esa única acción de depuración echó por tierra los ahorros del modo automático y costó más que toda la semana operativa de Worker 02 en DeepSeek.

## Lo que aprendí

Antes de implementar la lógica de enrutamiento, Worker 01 llegó a fallar en silencio. No pudo analizar una carga JSON mal formada de Telegram y se quedó colgado, devorando discretamente los recursos de memoria de la Pi mientras la API agotaba el tiempo de espera una y otra vez. No me di cuenta durante dos días. Ese silencio, y el fallo en cascada que ponía en riesgo, es lo que me llevó a construir el MCP en primer lugar.

Actualmente el sistema depende de que yo le pida manualmente al MCP que compruebe cómo van los trabajadores, lo cual es una medida a medias. La conclusión lógica de la arquitectura, y mi próximo proyecto en el laboratorio, es establecer un monitor de latido continuo. Al canalizar las comprobaciones de salud de los trabajadores hacia un almacén vectorial local y ligero en la Pi, el MCP podrá consultar de forma autónoma los datos históricos de caídas y ajustar de manera proactiva la temperatura de DeepSeek o los topes de tokens de los trabajadores *antes* de que un fallo se propague en cascada.

Este experimento demostró que no hace falta una infraestructura en la nube masiva y monolítica para ejecutar sistemas de IA complejos. Al forzar la arquitectura a los límites físicos de una sola Raspberry Pi 5 y al límite financiero de un tope de gasto mensual de 8–15 dólares, el resultado no fue un entorno de pruebas comprometido o limitado. Esas restricciones dieron forma a un sistema de orquestación más disciplinado y muy capaz. Hoy no son meros scripts limitados; son asistentes personales de IA realmente eficaces, de uso diario, que gestionan activamente mis flujos de trabajo. El laboratorio por fin funciona con inteligencia, los asistentes están plenamente liberados y mi página de facturación por fin es aburrida.
