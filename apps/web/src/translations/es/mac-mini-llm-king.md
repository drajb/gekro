---
title: "El Mac Mini M4: el rey no oficial de los LLM locales"
description: "Por qué la arquitectura de memoria unificada es la única forma de ejecutar modelos de 70B parámetros sin un presupuesto de centro de datos."
publishedAt: "2026-03-01"
difficulty: "Intermediate"
topics: ["Hardware", "Apple Silicon", "LLMs"]
readingTime: 8
aiSummary: "Rohit analiza la relación coste-rendimiento de Apple Silicon para la inferencia de LLM y destaca la arquitectura de memoria unificada como una alternativa superior a las GPU dedicadas."
sourceHash: "10e81d57636f266fa23c02fc47f42c2059bbcfa19d785371f5a96379f9c832e3"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  Deja de perseguir tarjetas NVIDIA de 24GB. Para la inferencia local de LLM, la memoria de vídeo (VRAM) es la única métrica que importa, y la arquitectura de memoria unificada (UMA) de Apple es la forma más rentable de conseguir 64GB+ de ella. Este artículo explica por qué un Mac Mini M4 Pro es el corazón silencioso y de alta densidad de la capa de razonamiento de mi laboratorio.
</TLDR>

Si montas un laboratorio en un suburbio de DFW, aprendes enseguida que el consumo eléctrico y el calor son tus mayores enemigos. Pasé meses peleándome con un PC con una 3090 que sonaba como un motor a reacción y convertía mi oficina en una sauna cada vez que un agente lanzaba una tarea en segundo plano. Entonces pasé a un Mac Mini M4 Pro con 64GB de memoria unificada. Es silencioso, consume menos que una lámpara de escritorio y ejecuta modelos Llama 3-70B a velocidades utilizables. Por primera vez, el hardware se ha vuelto invisible, que es el objetivo último de cualquier laboratorio de ingeniería.

## La arquitectura

La "magia" de Apple Silicon no es la velocidad de la CPU, sino la **arquitectura de memoria unificada (UMA)**. En un PC tradicional, la RAM de la CPU y la RAM de la GPU (VRAM) están separadas. Si quieres ejecutar un modelo de 40GB, necesitas una GPU de 1,600 dólares. En un Mac, la RAM del sistema *es* la VRAM.

| Característica | PC de sobremesa (RTX 4090) | Mac Mini (M4 Pro 64GB) |
| :--- | :--- | :--- |
| **Capacidad de VRAM** | Límite duro de 24GB | Hasta 64GB (flexible) |
| **Ancho de banda de memoria** | 1,000 GB/s (GDDR6X) | 273 GB/s (unificada) |
| **Consumo eléctrico** | 450W - 600W | 20W - 50W |
| **Acústica** | Mucho ruido de ventiladores | Casi silencioso |
| **Tamaño de modelo ideal** | 8B - 34B | 8B - 70B (cuantizado) |

Aunque el PC supera al Mac en velocidad pura (tokens por segundo), el Mac gana en **tamaño por coste**. Literalmente no puedes ejecutar un modelo de 70B en una sola tarjeta NVIDIA de consumo sin una poda drástica. El Mac Mini se lo come sin problemas.

## La construcción

Configurar un Mac para un laboratorio de producción exige abandonar la mentalidad de "aplicación de escritorio" y adoptar la de un servicio sin interfaz.

### 1. La pila de inferencia

Uso **Ollama** porque tiene la mejor implementación de la **API Metal** de Apple. Delega las operaciones de tensores directamente en los núcleos de GPU del chip M4.

```bash
# Verify Metal acceleration is active in the logs
grep "Metal" ~/.ollama/logs/server.log

# You should see: "Metal device is available" and "offloading layers to GPU"
```

### 2. El puente de Python

Mis agentes hablan con el Mac Mini a través de la red local usando el `GekroLLMClient` que detallé en mi [artículo sobre soberanía de la API](/blog/es/api-sovereignty/).

```python
import ollama

def run_heavy_inference(prompt):
    # This runs on the Mac Mini, called by a Pi or my Workstation
    response = ollama.chat(
        model='llama3:70b-instruct-q4_K_M',
        messages=[{'role': 'user', 'content': prompt}]
    )
    return response['message']['content']
```

### 3. Elección de la cuantización del modelo

Para un Mac de 64GB, **Q4_K_M** es la cuantización "justa" para Llama 3-70B. Cabe cómodamente en la RAM (dejando 20GB para el sistema y otros agentes) y conserva el 99% de la inteligencia del modelo base.

## Las contrapartidas

El Mac Mini no es perfecto. El mayor "impuesto" es la **falta de CUDA**. Si haces *entrenamiento* o ajuste fino de modelos, el Mac es un pisapapeles comparado con un equipo NVIDIA. La mayoría del código de investigación nuevo se escribe primero para CUDA, y el "soporte de Metal" suele ser un añadido de última hora que llega meses después.

Siendo justo, nunca llegué a chocar con ese muro. Todo lo que ejecuto en este laboratorio es inferencia, y la inferencia en Metal ha ido bien. Lo señalo porque me afectaría el día que intentara afinar algo en Apple silicon, no porque me haya afectado alguna vez.

También tuve un problema serio de **calentamiento acumulado**. Durante un procesamiento por lotes de 4 horas de 1,000 registros de telemetría de Tesla, el ventilador interno del Mac Mini por fin se activó y la velocidad de inferencia bajó de 8 TPS a 5 TPS. Incluso la eficiencia de Apple tiene límites cuando se lleva al 100% de utilización durante horas. Acabé imprimiendo en 3D un soporte a medida con un ventilador de 120mm para mantener fría la base del chasis durante las inferencias largas.

## Hacia dónde va esto

Ahora mismo estoy estudiando **agrupar Mac Minis en clúster** mediante puentes Thunderbolt de alta velocidad. Si consigo juntar la memoria de dos M4 Pro, podré ejecutar localmente un modelo de 405B parámetros. Ese es el sueño: una "superinteligencia" privada y local en un formato que cabe en el cajón de un escritorio.
