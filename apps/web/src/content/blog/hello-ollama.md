---
title: "Hello, Ollama: Local Inference is Your Architectural Insurance"
description: "Running LLMs on a Raspberry Pi isn't just a hobby; it's a fallback strategy for system resilience."
publishedAt: "2026-03-24"
difficulty: "Intermediate"
topics: ["Local LLM", "Python", "Raspberry Pi"]
readingTime: 6
aiSummary: "Rohit demonstrates how to deploy Ollama on a Raspberry Pi cluster to serve as a high-availability fallback for cloud-based AI services."
---

<TLDR>
  Privacy is the marketing angle for local LLMs, but resilience is the engineering reality. I use Together AI for heavy lifting, but my Raspberry Pi cluster runs quantized Llama 3 models through Ollama as a zero-cost fallback. This post covers the specific models and quant levels that actually run on ARM hardware without melting the board.
</TLDR>

The first time I disconnected my Tesla from the home Wi-Fi and still had a local Llama 3 instance answering questions from my Raspberry Pi, I realized we had hit a tipping point. We are no longer dependent on a persistent connection to a multi-billion dollar data center for basic reasoning tasks. In the **Gekro Lab**, Ollama isn't just a toy—it's the architectural insurance policy that ensures my agents never go "braindead" during a provider outage.

## The Architecture

My setup isn't a single machine; it's a distributed inference chain. I prioritize **Together AI (Minimax M2.5)** for high-complexity reasoning, but the "Nervous System" of the lab is anchored by a Raspberry Pi 5 (8GB) running Ollama.

| Model | Size | Quant Level | RAM Usage | Tokens/Sec (Pi 5) | Best Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Llama-3-8B** | 4.7GB | Q4_K_M | ~5.2GB | 3-4 t/s | General reasoning |
| **Phi-3-Mini** | 2.3GB | Q4_0 | ~2.8GB | 12-15 t/s | Fast classification |
| **Mistral-7B** | 4.1GB | Q4_0 | ~4.5GB | 2-3 t/s | Tool use/Function calling |

On ARM64 architecture, memory bandwidth is the bottleneck. I've found that **4-bit quantization (Q4)** is the sweet spot: any lower and the model loses its "common sense," any higher and the Raspberry Pi spends more time swapping memory than generating text.

## The Build

Setting up Ollama on Linux (including WSL2 and Raspberry Pi OS) is a single-liner, but the real engineering happens in how you wrap it.

### 1. The Headless Install
I run my Pi cluster headless. No GUI, just SSH and a systemd service.

```bash
# Install Ollama on Linux/Pi
curl -fsSL https://ollama.com/install.sh | sh

# Serve Ollama on all network interfaces (required for cluster access)
sudo systemctl edit ollama.service
```
Add this environment variable to the service file to allow external calls from your main workstation:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
```

### 2. The Abstraction Boilerplate
Don't use the raw Ollama API directly in your experiments. Use a fallback-aware client. This is a simplified version of the logic I use across the entire lab.

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

### WSL2 Note
If you're testing this in WSL2 on Windows, Ollama now has a native Windows installer that leverages your NVIDIA GPU. Run the Windows app, then set `OLLAMA_HOST=172.x.x.x` (your Windows Ethernet adapter IP) inside WSL2 to access that GPU power from your Linux environment.

## The Tradeoffs

The Raspberry Pi is not an H100. If you try to run a Llama 3-70B model, it won't just be slow; it will kill the process and likely corrupt your filesystem if you have swap enabled on a cheap SD card. 

The biggest failure I hit was **Heat Throttling**. During a heavy batch-processing job, the Pi 5's temperature hit 85°C and the inference speed dropped to 0.5 tokens per second. In a lab environment, active cooling (shoutout to the Argon ONE case) isn't optional for local LLMs; it's mandatory. 

Also, don't expect cloud-level "creativity." Local quantized models are great for extraction, summarization, and basic logic. They are terrible for nuance or high-level strategic planning.

## Where This Goes

I'm currently experimenting with **Distributed Ollama**—splitting a single model across three Raspberry Pis to see if I can run a 13B parameter model at usable speeds. The goal is a truly "Sovereign Brain" that doesn't just act as a fallback, but as a local peer to the cloud models.
