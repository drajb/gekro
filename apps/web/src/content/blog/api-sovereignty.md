---
title: "API Sovereignty: Building for the 2 AM Failure"
description: "Why generic API wrappers are a liability and how to build a resilient, multi-provider fallback chain."
publishedAt: "2026-03-15"
difficulty: "Advanced"
topics: ["APIs", "Architecture", "Python"]
readingTime: 8
aiSummary: "Rohit implements a multi-provider LLM client with automatic fallback to local Ollama instances to ensure system resilience during cloud API outages."
---

<TLDR>
  Hardcoding a single AI provider is architectural negligence. I built a unified LLM client that prioritizes Together AI but fails over to local Ollama instances automatically when the cloud goes dark. This post breaks down the GekroLLMClient pattern that keeps my lab running 24/7 without manual intervention.
</TLDR>

It’s 2 AM in Dallas. A routine cron job triggers an agent to summarize my server logs. OpenAI’s API returns a 503. In a standard setup, the pipeline dies, a notification wakes me up, and I lose an hour of sleep fixing a dependency I don't control. In my lab, that failure is invisible. The system detects the timeout, catches the exception, and reroutes the request to a Llama 3 instance running on a Raspberry Pi in my closet. Resilience isn't a feature; it's a requirement for sovereignty.

## The Architecture

The core philosophy is simple: **Local by default, Cloud by necessity, Fallback by design.** I don't treat local and cloud models as different species; they are just different compute nodes in the same network.

| Feature | Cloud (Together AI / Anthropic) | Local (Ollama on Pi/Mac) |
| :--- | :--- | :--- |
| **Latency** | 500ms - 2s (Network dependent) | 50ms - 5s (Hardware dependent) |
| **Cost** | Per-token ($$$) | $0 (Electricity only) |
| **Reliability** | "Up-time" (Subject to outages) | 100% (Air-gapped capable) |
| **Privacy** | PII at risk | Absolute zero-leak |

My architecture uses a **Universal Inference Layer**. The application logic never knows if it's talking to a massive cluster in a data center or a set of ARM cores in my living room.

## The Build

The implementation requires a unified interface. I use Python's `abc` module to enforce a strict contract. Whether the provider is Together AI (using the OpenAI-compatible spec) or Ollama, the calling code handles the same objects.

### The GekroLLMClient

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

### Verifying the Chain
I don't trust my code until I've seen it fail. This pytest suite simulates a network outage by poisoning the API key and verifies the fallback logic.

```python
import pytest
from unittest.mock import patch, MagicMock
from your_module import GekroLLMClient

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

### WSL2 Note
If you're running this on Windows, ensure your `OLLAMA_HOST` is set to `http://172.x.x.x:11434` (your Windows IP) if Ollama is running on the host, or simply `localhost` if it's inside the WSL2 instance. I prefer running Ollama on the Windows host to utilize the GPU directly while keeping my dev environment in Ubuntu.

## The Tradeoffs

Let's be honest: fallback logic adds latency. A failed cloud call plus 3 retries takes about 7 seconds before the local model even starts thinking. For real-time chat, that’s a "broken" UI. But for the background agents that run Gekro—log parsers, automated research, and code indexers—7 seconds of latency is better than a total system crash.

The biggest hidden cost is **Context Management**. If I'm using a 128k context model in the cloud and fall back to an 8k model locally, the local model will hallucinate or crash if the prompt is too long. I learned this the hard way when my nightly summary agent tried to feed a local Llama 3-8B a 50k token log file and the Pi cluster just went into a kernel panic. You have to truncate aggressively during fallback.

## Where This Goes

This client is the first step toward a **Consensus Architecture**. Instead of one model being right, I want my client to poll three models simultaneously (Together, Groq, and Local) and use an "Adjudicator" model to pick the best answer. The goal isn't just to make the lab stay up—it's to make it smarter by comparing how different brains see the same problem.
