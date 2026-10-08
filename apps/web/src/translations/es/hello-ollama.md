---
title: "Hola, Ollama: la inferencia local es tu seguro de arquitectura"
description: "Ejecutar LLM en una Raspberry Pi no es solo un pasatiempo; es una estrategia de respaldo para la resiliencia del sistema."
publishedAt: "2026-03-22"
difficulty: "Intermediate"
topics: ["Local LLM", "Python", "Raspberry Pi"]
readingTime: 6
aiSummary: "Rohit muestra cómo desplegar Ollama en un clúster de Raspberry Pi para que sirva como respaldo de alta disponibilidad de los servicios de IA en la nube."
sourceHash: "914e896bfce7457217ec0d2f9bc0e930421b4940dcd69ba204e8dec43071fcd7"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  La privacidad es el argumento de marketing de los LLM locales, pero la resiliencia es la realidad de ingeniería. Uso Together AI para el trabajo pesado, pero mi clúster de Raspberry Pi ejecuta modelos Llama 3 cuantizados con Ollama como respaldo de coste cero. Este artículo cubre los modelos y los niveles de cuantización concretos que de verdad funcionan en hardware ARM sin fundir la placa.
</TLDR>

La primera vez que se cayó mi internet durante una sesión de compilación a altas horas de la noche y aun así tenía una instancia local de Llama 3 respondiendo preguntas desde mi Raspberry Pi, me di cuenta de que habíamos llegado a un punto de inflexión. Ya no dependemos de una conexión permanente con un centro de datos de miles de millones de dólares para tareas básicas de razonamiento. En el **Gekro Lab**, Ollama es la póliza de seguro de la arquitectura que mantiene a mis agentes trabajando durante una caída de un proveedor.

No empecé por ahí por motivos nobles. Fue por curiosidad y por coste. Quería tener cosas funcionando constantemente para seguir aprendiendo, y el acceso a los modelos que quería estaba bloqueado detrás de un gasto al que no quería comprometerme. Una Pi que trabaja en silencio por el precio de la electricidad resuelve las dos cosas. Más lenta, sí. Pero funcionando.

## La arquitectura

Mi configuración no es una sola máquina; es una cadena de inferencia distribuida. Doy prioridad a **Together AI** para el razonamiento complejo en la nube, pero el "sistema nervioso" del laboratorio se apoya en un clúster de tres nodos Raspberry Pi 5 (16GB cada uno) que ejecuta Ollama.

| Modelo | Tamaño | Nivel de cuantización | Uso de RAM | Tokens/s (Pi 5 16GB) | Mejor caso de uso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Llama-3-8B** | 4.7GB | Q4_K_M | ~5.2GB | 4-6 t/s | Razonamiento general |
| **Phi-3-Mini** | 2.3GB | Q4_0 | ~2.8GB | 12-15 t/s | Clasificación rápida |
| **Mistral-7B** | 4.1GB | Q4_0 | ~4.5GB | 3-4 t/s | Uso de herramientas / llamada a funciones |

El orden importa más que el hardware. Los modelos gratuitos de OpenRouter van primero, la Pi se sitúa en medio y OpenRouter de pago es el último recurso. Esa posición intermedia no es decorativa. Cuando el nivel gratuito no está disponible, algo que ocurre con la frecuencia suficiente para notarlo, es la Pi la que responde. Me ha mantenido trabajando de verdad en días en que la alternativa era pagar.

Llegar ahí requirió varias rondas de prueba y error. Cambié de modelo una y otra vez buscando el que encajara, y la lección fue siempre la misma: cuando el modelo grande era demasiado lento, la solución era menos parámetros y una cuantización más fuerte, no más paciencia.

En la arquitectura ARM64, el ancho de banda de memoria es el cuello de botella. Con 16GB por nodo, tengo margen para ejecutar modelos más grandes que las típicas Pi de 8GB que se ven por internet. He comprobado que la **cuantización de 4 bits (Q4)** es el punto óptimo: con menos, el modelo pierde su "sentido común"; con más, recortas la memoria del sistema sin ganancias de calidad significativas.

## La construcción

Instalar Ollama en Linux (incluidos WSL2 y Raspberry Pi OS) es una sola línea, pero la verdadera ingeniería está en cómo lo envuelves.

### 1. La instalación sin interfaz

Ejecuto mi clúster de Pi sin interfaz gráfica. Solo SSH y un servicio de systemd.

```bash
# Install Ollama on Linux/Pi
curl -fsSL https://ollama.com/install.sh | sh

# Serve Ollama on all network interfaces (required for cluster access)
sudo systemctl edit ollama.service
```
Añade esta variable de entorno al archivo del servicio para permitir llamadas externas desde tu estación de trabajo principal:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
```

### 2. El código repetitivo de la abstracción

No uses la API sin procesar de Ollama directamente en tus experimentos. Usa un cliente que contemple el respaldo. Esta es una versión simplificada de la lógica que uso en todo el laboratorio.

```python
import ollama
import logging

class LocalBrain:
    def __init__(self, model="llama3:8b"):
        self.model = model
        self.logger = logging.getLogger("GekroLocal")

    def inference(self, prompt: str) -> str:
        try:
            self.logger.info(f"Running local inference on {self.model}...")
            response = ollama.chat(model=self.model, messages=[
                {'role': 'user', 'content': prompt},
            ])
            return response['message']['content']
        except Exception as e:
            self.logger.error(f"Local inference failed: {e}")
            return "ERROR: Brain Offline"

# Running a quantized test on the Pi
if __name__ == "__main__":
    brain = LocalBrain(model="phi3:mini")
    print(brain.inference("What is the current state of the Raspberry Pi cluster?"))
```

### La placa te dice que está funcionando

Se puede oír pensar a una Pi. La mía se calentaba, el ventilador arrancaba y, sentado a su lado, podía saber que estaba a mitad de un prompt sin mirar la terminal. A esta escala, el throttling térmico no es una línea abstracta en una hoja de especificaciones: es un ruido en tu escritorio. Planifica el flujo de aire antes que cualquier otra cosa.

### Nota sobre WSL2

Si lo pruebas en WSL2 sobre Windows, Ollama ya tiene un instalador nativo para Windows que aprovecha tu GPU NVIDIA. Ejecuta la aplicación de Windows y luego establece `OLLAMA_HOST=172.x.x.x` (la IP del adaptador Ethernet de tu Windows) dentro de WSL2 para acceder a esa potencia de GPU desde tu entorno Linux.

## Las contrapartidas

La Raspberry Pi no es una H100. Si intentas ejecutar un modelo Llama 3-70B en una Pi, no solo será lento; el OOM killer terminará el proceso. Si tienes el swap activado en una tarjeta SD barata, el propio vaivén puede corromper tu sistema de archivos.

El mayor fallo que tuve fue el **throttling por calor**. Durante un trabajo pesado de procesamiento por lotes, la temperatura de la Pi 5 llegó a 85°C y la velocidad de inferencia cayó a 0.5 tokens por segundo. En un laboratorio, la refrigeración activa (un saludo a la caja Argon ONE) no es opcional para los LLM locales; es obligatoria.

Además, no esperes "creatividad" al nivel de la nube. Los modelos locales cuantizados son excelentes para la extracción, el resumen y la lógica básica. Son malos para los matices o la planificación estratégica de alto nivel.

## Hacia dónde va esto

Ahora mismo experimento con el **enrutamiento con concurrencia primero**: usar los tres nodos Pi para atender peticiones de inferencia en paralelo en lugar de repartir un único modelo entre ellos. El objetivo es un auténtico "cerebro soberano" que no se limite a actuar como respaldo, sino como un par local de los modelos en la nube, capaz de atender a varios agentes razonando a la vez.
