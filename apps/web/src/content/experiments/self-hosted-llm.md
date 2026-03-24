---
title: "Self-Hosted LLM Lab"
description: "Running Llama 3 on a local Raspberry Pi cluster with Ollama and Cloudflare Tunnels."
summary: "Running Llama 3 on a local Raspberry Pi cluster with Ollama and Cloudflare Tunnels. This experiment explores the limits of edge compute for decentralized intelligence."
aiSummary: "Deployed a distributed Llama 3 instance across a 4-node Raspberry Pi 5 cluster using Ollama. Used Cloudflare Tunnels for secure remote CLI access to the private intelligence layer."
status: "completed"
startDate: "2026-03-20"
stack:
  - "Raspberry Pi"
  - "Ollama"
  - "Docker"
topics:
  - "Self-Hosted"
  - "Edge Compute"
githubUrl: "https://github.com/drajb/llm-edge-cluster"
difficulty: "Intermediate"
---

## What I Was Trying to Solve

Building AI shouldn't require a $10,000 GPU or a $20/month subscription to a closed API. I wanted to see if I could build a "Poor Man's Supercomputer"—a cluster of low-cost ARM devices that could run a competent language model for basic lab assistance.

---

## Architecture

The cluster consists of four Raspberry Pi 5s (8GB) networked via a high-speed switch, with Docker Swarm managing the container distribution.

```
[RPi 5 #1] \
[RPi 5 #2] -- [Switch] -> [Cloudflare Tunnel] -> [Remote CLI]
[RPi 5 #3] /
[RPi 5 #4] /
```

---

## The Build

### Step 1: Headless Setup

I started by flashing Ubuntu Server across all nodes and configuring static IPs. The goal was a "plug and play" cluster where I could just add nodes to scale the context window.

```bash
# Standardizing the environment
curl -fsSL https://ollama.com/install.sh | sh
```

### Step 2: The Latency Bottleneck

Running a 7B model on a single Pi is possible but slow (approx 2-3 tokens/sec). By distributing the load, I aimed for higher throughput, though the interconnect speed (Gigabit Ethernet) became the new bottleneck.

---

## Results

| Metric | Single Node | 4-Node Cluster |
|---|---|---|
| Llama 3 (8B) | 2.5 TPS | 2.8 TPS* |

*Note: The performance gain was marginal due to memory bandwidth limits on ARM, but the **reliability** and **concurrency** (handling multiple requests) improved significantly.*
