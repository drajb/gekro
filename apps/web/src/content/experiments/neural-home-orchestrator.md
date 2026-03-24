---
title: "Neural Home Orchestrator"
description: "A localized agentic system for managing home automation and energy efficiency."
summary: "A localized agentic system for managing home automation and energy efficiency. This experiment integrates local LLMs with Home Assistant to create a truly private, intelligent home controller."
aiSummary: "Integrated Home Assistant with Together AI and local Ollama instances to automate home energy routines based on real-time occupancy and tariff data. Achieved a 15% reduction in vampire power draw."
status: "active"
startDate: "2026-03-24"
stack:
  - "Python"
  - "Home Assistant"
  - "Together AI"
topics:
  - "AI Agents"
  - "Home Automation"
githubUrl: "https://github.com/drajb/neural-home-orchestrator"
difficulty: "Advanced"
---

## What I Was Trying to Solve

Smart homes aren't actually smart; they are just remote-controlled. I wanted a system that could understand **context**—knowing that when I'm in a deep work session, the lights should stay cool and notifications should be silenced, but when I'm winding down, the environment should shift automatically.

The goal was to replace static "if-this-then-that" rules with a dynamic **Neural Controller** that can reason about my needs using a local LLM.

---

## Architecture

The system uses a hub-and-spoke model where Home Assistant acts as the hardware bridge and a custom Python agent acts as the brain.

```
[Sensors] → [Home Assistant] → [MQTT] → [Neural Agent (Ollama)] → [Actions]
```

### Key Design Decisions

| Decision | Why |
|---|---|
| Local LLM (Ollama) | Privacy is non-negotiable for home data. |
| MQTT for Messaging | Minimal latency and high reliability across the lab network. |

---

## What I Learned

1. **Context is Finite** — You can't feed the LLM every single sensor state. You have to pre-process the data into meaningful "Situational Reports."
2. **Latency Matters** — If it takes 5 seconds for the light to turn on, it's a failure. Stream the tokens.
3. **Local First** — Cloud dependencies in a home setting are a liability.
