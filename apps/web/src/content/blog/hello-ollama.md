---
title: "Hello, Ollama: Your first local LLM call in 5 lines of code"
publishedAt: "2026-03-24"
description: "Running Llama 3 locally is now as easy as a single command. Here is how to talk to it with Python."
topics: ["Local LLM", "Python"]
readingTime: 4
---

Welcome to the ultimate frontier of the lab: **Private, local AI**. 

The first time you run a Large Language Model on your own hardware, with the internet disconnected, it feels like magic. 

This is the final piece of the **gekro lab** puzzle: **Local Inference with Ollama.**

---

## TL;DR

> [!NOTE]
> Stop paying for tokens. **Ollama** is a lightweight tool that lets you run models like Llama-3, Mistral, and Phi-3 locally on your Mac, Linux, or Windows machine. Total privacy. Zero cost. Infinite experimentation.

---

## Why Local? (The Rationale)

For a long time, AI was something that happened "out there"—in a data center owned by a giant corporation. Local inference changes the power dynamic of the lab.

1.  **Data Sovereignty**: If you are building an agent to organize your taxes or write your journal, you shouldn't have to send that text to a cloud provider. Local AI means your data never leaves your RAM.
> Stop being a product for Big Tech. **Ollama** allows you to run powerful LLMs (Llama-3, Mistral, Phi-3) directly on your own hardware. It's fast, it's free, and most importantly, it's private. If your data never leaves your room, it can never be leaked.

---


## Why Ollama? (The Rationale)

There are many ways to run local models, but Ollama is the only one that feels like it was built for the modern engineer.

1.  **Zero-Configuration**: It handles the model weights, the quantization, and the API serving in a single package. You don't need a PhD in machine learning to get started. 
2.  **The API-First Design**: Ollama doesn't just give you a chat window; it gives you a local API endpoint on port `11434`. This is what allows our "Body" (Astro) to talk to our "Brain" (Python) without ever touching the internet.
3.  **Privacy as a Default**: When I'm working on sensitive lab projects, I don't want my prompts used for "training data." With Ollama, the "training" stops at my firewall.


---


## 01. The Setup: One Command to Rule Them All

Whether you are on Mac, Linux, or Windows (WSL2), the setup is trivial.

### My Architect's Advice:
Don't just download the app. Use the terminal. It gives you more control over the service life-cycle.

```bash
# On Mac/Linux
curl -fsSL https://ollama.com/install.sh | sh
```


---


## 02. The First Run: Llama-3

Once installed, you can pull your first model.

### The Logic:
I always start with **Llama-3 (8B)**. It is the perfect balance of speed and intelligence for a local lab. It’s small enough to run on a 16GB Mac Mini but smart enough to handle complex coding tasks.

```bash
ollama run llama3
```


---


## 03. The Mission: Python Integration

The real power of Ollama is using it inside your agents.

### The Example:
I use the `ollama` Python library to trigger my local brain. It’s consistent, fast, and remarkably stable.

```python
import ollama

response = ollama.chat(model='llama3', messages=[
  {'role': 'user', 'content': 'Why is local AI better?'},
])
print(response['message']['content'])
```


---


## Conclusion: What I Learned

When I first ran a model locally and saw it respond without an internet connection, it felt like magic. It felt like I finally **owned** the technology I was using.

**What I learned:** Local AI is about **Digital Sovereignty**. It’s about knowing that even if every cloud provider disappeared tomorrow, your lab would still be smart. It’s about building systems that are resilient, private, and truly yours.

**This concludes our Lab Onboarding series.** You now have the machine, the architecture, and the intelligence to build the future. 

What will you build first?

