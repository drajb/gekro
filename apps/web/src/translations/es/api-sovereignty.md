---
title: "Soberanía de la API: construir para el fallo de las 2 de la madrugada"
description: "Por qué los envoltorios genéricos de API son un riesgo y cómo construir una cadena de respaldo resiliente con varios proveedores."
publishedAt: "2026-03-15"
difficulty: "Advanced"
topics: ["APIs", "Architecture", "Python"]
readingTime: 8
aiSummary: "Rohit implementa un cliente de LLM multiproveedor con respaldo automático a instancias locales de Ollama para garantizar la resiliencia del sistema durante las caídas de las API en la nube."
sourceHash: "c88de751c68b7f5aca29936c99b6b067a8c0af73c9dd0ed1f57ccb55cb827bb3"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  Fijar en el código un único proveedor de IA es negligencia arquitectónica. Construí un cliente de LLM unificado que da prioridad a Together AI, pero conmuta automáticamente a instancias locales de Ollama cuando la nube se apaga. Este artículo desglosa el patrón GekroLLMClient que mantiene mi laboratorio funcionando 24/7 sin intervención manual.
</TLDR>

Son las 2 de la madrugada en Dallas. Una tarea cron rutinaria lanza un agente para resumir los logs de mi servidor. La API de Together AI devuelve un 503. En una configuración estándar, la canalización muere, una notificación me despierta y pierdo una hora de sueño arreglando una dependencia que no controlo. En mi laboratorio, ese fallo es invisible. El sistema detecta el tiempo de espera agotado, captura la excepción y redirige la petición a una instancia de Llama 3 que corre en una de mis Raspberry Pi. La resiliencia no es una característica; es un requisito para la soberanía.

## La arquitectura

La filosofía central es simple: **la nube para la potencia, lo local para la resiliencia, el respaldo por diseño.** Uso proveedores en la nube para la inferencia pesada, pero me aseguro de que cada petición tenga una vía de escape local. No trato los modelos locales y los de la nube como especies distintas; son solo nodos de cómputo diferentes dentro de la misma red.

| Característica | Nube (Together AI / Anthropic) | Local (Ollama en Pi/Mac) |
| :--- | :--- | :--- |
| **Latencia** | 500ms - 2s (depende de la red) | 50ms - 5s (depende del hardware) |
| **Coste** | Por token ($$$) | 0 $ (solo electricidad) |
| **Fiabilidad** | "Disponibilidad" (sujeta a caídas) | 100% (apto para entornos aislados) |
| **Privacidad** | Datos personales en riesgo | Cero fugas absoluto |

Mi arquitectura usa una **capa de inferencia universal**. La lógica de la aplicación nunca sabe si está hablando con un enorme clúster de un centro de datos o con un conjunto de núcleos ARM de mi salón.

## La construcción

La implementación requiere una interfaz unificada. Uso el módulo `abc` de Python para imponer un contrato estricto. Tanto si el proveedor es Together AI (con la especificación compatible con OpenAI) como si es Ollama, el código que llama maneja los mismos objetos.

### El GekroLLMClient

```python
import os
import time
import logging
from typing import List, Dict, Optional
from openai import OpenAI
import ollama

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GekroLab")

class GekroLLMClient:
    def __init__(self):
        self.cloud_client = OpenAI(
            api_key=os.getenv("TOGETHER_API_KEY"),
            base_url="https://api.together.xyz/v1",
        )
        self.local_url = os.getenv("OLLAMA_HOST", "http://localhost:11434")

    def chat(self, messages: List[Dict], model_cloud: str = "meta-llama/Llama-3-70b-chat-hf", 
             model_local: str = "llama3:8b", retries: int = 3) -> str:
        
        # Phase 1: Try Cloud (Together AI)
        for attempt in range(retries):
            try:
                logger.info(f"Attempting cloud inference (Attempt {attempt + 1})")
                response = self.cloud_client.chat.completions.create(
                    model=model_cloud,
                    messages=messages,
                    timeout=10.0
                )
                return response.choices[0].message.content
            except Exception as e:
                wait = 2 ** attempt
                logger.warning(f"Cloud failure: {e}. Retrying in {wait}s...")
                time.sleep(wait)

        # Phase 2: Automatic Fallback to Local (Ollama)
        logger.error("All cloud attempts failed. Falling back to local inference.")
        try:
            response = ollama.chat(
                model=model_local,
                messages=messages
            )
            return response['message']['content']
        except Exception as e:
            return f"CRITICAL SYSTEM FAILURE: All providers exhausted. Error: {str(e)}"

# Usage in the Gekro Lab environment
if __name__ == "__main__":
    client = GekroLLMClient()
    prompt = [{"role": "user", "content": "Analyze the thermal logs for the Tesla charging cycle."}]
    print(client.chat(prompt))
```

### Verificar la cadena

No confío en mi código hasta que lo he visto fallar. Esta batería de pruebas de pytest simula una caída de red envenenando la clave de API y verifica la lógica de respaldo.

```python
import pytest
from unittest.mock import patch, MagicMock
from gekro_client import GekroLLMClient

def test_fallback_logic():
    client = GekroLLMClient()
    
    # Mocking the cloud client to always fail
    client.cloud_client.chat.completions.create = MagicMock(side_effect=Exception("API Down"))
    
    # Mocking ollama to succeed
    with patch('ollama.chat') as mock_ollama:
        mock_ollama.return_value = {'message': {'content': 'Local Fallback Success'}}
        
        response = client.chat([{"role": "user", "content": "test"}])
        
        assert response == "Local Fallback Success"
        assert mock_ollama.called
```

### Nota sobre WSL2

Si lo ejecutas en Windows, asegúrate de que tu `OLLAMA_HOST` esté configurado como `http://172.x.x.x:11434` (tu IP de Windows) si Ollama se ejecuta en el host, o simplemente `localhost` si está dentro de la instancia de WSL2. Prefiero ejecutar Ollama en el host de Windows para aprovechar la GPU directamente y mantener mi entorno de desarrollo en Ubuntu.

## Las contrapartidas

Seamos sinceros: la lógica de respaldo añade latencia. Una llamada fallida a la nube más 3 reintentos tarda unos 7 segundos antes de que el modelo local siquiera empiece a pensar. Para un chat en tiempo real, eso es una interfaz "rota". Pero para los agentes en segundo plano que ejecutan analizadores de logs de Gekro, investigación automatizada e indexadores de código, 7 segundos de latencia son mejores que una caída total del sistema.

También existe un **precipicio de calidad**. Un Llama 3-70B en Together AI y un Llama 3-8B cuantizado en una Pi son cerebros fundamentalmente distintos. El código que llama ve la misma interfaz, pero las respuestas del modelo local son más cortas, menos matizadas y más propensas a pasar por alto casos límite. Para la extracción estructurada o el resumen, la diferencia es manejable. Para el razonamiento complejo, el respaldo local es una venda, no una cura. Diseña tus agentes para tolerar una salida degradada durante el respaldo, y no solo una velocidad degradada.

El mayor coste oculto es la **gestión del contexto**. Si uso en la nube un modelo con contexto de 128k y conmuto a uno de 8k en local, el modelo local alucinará o se caerá si el prompt es demasiado largo. Lo aprendí por las malas cuando mi agente de resumen nocturno intentó pasarle a un Llama 3-8B local un archivo de log de 50k tokens y el OOM killer terminó el proceso a mitad de la inferencia. Hay que truncar de forma agresiva durante el respaldo.

## Hacia dónde va esto

Este cliente es el primer paso hacia una **arquitectura de consenso**. En lugar de confiar en que un modelo acierte, quiero que mi cliente consulte tres modelos a la vez (Together, Groq y local) y use un modelo "árbitro" para elegir la mejor respuesta. La disponibilidad es el suelo. El objetivo es hacer el laboratorio más inteligente comparando cómo ven distintos cerebros el mismo problema.
