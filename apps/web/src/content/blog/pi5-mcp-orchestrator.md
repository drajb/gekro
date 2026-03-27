---
title: "Financially Air-Gapping A Raspberry Pi AI Swarm"
description: "How I turned a Pi 5 into a localized orchestrator using an MCP router and isolated OpenClaw worker networks to slash API costs."
publishedAt: "2026-03-27"
difficulty: "Advanced"
topics: ["Architecture", "Raspberry Pi", "OpenClaw", "Docker"]
readingTime: 6
aiSummary: "A detailed teardown of converting a Raspberry Pi 5 16GB into an isolated Docker network governed by a Master Control Program. Highlights using a manifest.ai router to triage tasks to cost-effective OpenRouter DeepSeek V3 workers."
---

<TLDR>
Running automated LLM agents directly on "Pro" tier APIs is a financial death wish because constant state-maintenance across large contexts vaporizes budgets. I re-architected my home lab by dedicating one of my three Raspberry Pi 5 (16GB + M.2 256GB) nodes as a financially air-gapped OpenClaw shell. By using a split-brain architecture where a central Master Control Program (MCP) routes tasks to isolated, prepaid DeepSeek workers, I retained high-reasoning admin control while drastically reducing background execution costs.
</TLDR>

I isolated one of my three Raspberry Pi 5 (16GB + M.2 256GB) nodes to act as a financially air-gapped AI orchestrator governed by a Master Control Program (MCP). Running automated LLM agents directly on a "Pro" tier API is a financial death wish; I watched my billing vaporize because my OpenClaw instances were sending full conversation histories back and forth just to maintain state. I needed a way to keep high-reasoning capabilities available for system administration while aggressively routing my autonomous, dockerized background processes through a prepaid aggregator. The Pi is no longer a general-purpose home lab—every other container was purged to make it a dedicated, networked OpenClaw shell.

## The Architecture

The system operates on a split-brain, tiered architecture. At the root sits the MCP. Instead of hardcoding a single expensive model, the MCP utilizes a `manifest.ai` skill as a built-in router. It dynamically evaluates the complexity of the administrative task and decides which Gemini model to invoke, defaulting to Gemini's native auto mode for baseline efficiency. 

Beneath it, completely isolated on a dedicated Docker bridge network (`claw_net`), sit two task-specific workers. The workers do the heavy lifting via a prepaid OpenRouter connection. The MCP monitors their logs, rewrites their configurations if they fail, and restarts their containers.

| Layer | Instance | Provider/Model | Role & Capabilities | Cost Structure |
| --- | --- | --- | --- | --- |
| Supervisor | MCP (Root) | Google AI (`manifest.ai` Router / Gemini Auto) | Dynamic routing, alters configs, controls Docker daemon. | Variable / Optimized |
| Sub-process | Worker 01 | OpenRouter (DeepSeek V3) | Fast data parsing, Telegram interface. | $0.14 / 1M Tokens |
| Sub-process | Worker 02 | OpenRouter (DeepSeek V3) | Complex API actions, Telegram interface. | $0.14 / 1M Tokens |

## The Build

The transition required wiping the Pi 5 to eliminate port conflicts and CPU overhead. The hardware is now exclusively an OpenClaw host. 

First, I executed a total purge of existing infrastructure and established the isolated network. The workers need outbound internet for the Telegram API and OpenRouter, but no inbound access.

```bash
# Purge all non-essential containers and images
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker system prune -a --volumes -f

# Create the dedicated network for the swarm
docker network create --driver bridge claw_net
```

I restructured the filesystem in `/opt/openclaw` to reflect the hierarchy, giving the MCP absolute visibility over the workers.

```bash
mkdir -p /opt/openclaw/{mcp,workers/worker-01,workers/worker-02}
```

Next, I configured the isolated workers. I locked their authentication to a prepaid $10 OpenRouter key to physically prevent cost overruns, and severely capped their token outputs to stop runaway Telegram context loops.

```bash
# Configure Worker 01
cd /opt/openclaw/workers/worker-01
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_PREPAID_KEY" --non-interactive
openclaw config set agents.defaults.model.primary "openrouter/deepseek/deepseek-chat"
openclaw config set agents.defaults.maxOutputTokens 250
openclaw config set agents.defaults.maxHistoryTurns 5

# Configure Worker 02
cd /opt/openclaw/workers/worker-02
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_PREPAID_KEY" --non-interactive
openclaw config set agents.defaults.model.primary "openrouter/deepseek/deepseek-chat"
openclaw config set agents.defaults.maxOutputTokens 600
openclaw config set agents.defaults.maxHistoryTurns 8
```

I launched the workers attached to the isolated network.

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

Finally, the Master Control Program. The MCP requires Google AI credentials, but to prevent unnecessary token burn, I implemented the `manifest.ai` routing skill. I mounted the Docker socket and the root `/opt/openclaw/workers` directory into its container so it could supervise the sub-processes.

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

## The Tradeoffs

Mounting `/var/run/docker.sock` into an LLM-driven container is a catastrophic security risk in a production environment. If the MCP suffers a prompt injection attack, it has root-level control over the Pi's Docker daemon. I accepted this risk because the Pi 5 is physically isolated and dedicated solely to this experiment, but it is not a pattern for enterprise deployment.

Additionally, the `manifest.ai` router is smart, but it's not foolproof. When Worker 02 threw a massive stack trace due to a malformed API payload, the router correctly identified it as a "complex debugging task" and bumped the execution up to a heavy reasoning model instead of using a lighter Flash variant. The MCP ingested 40,000 tokens reading the error log before proposing a fix. It successfully rewrote Worker 02's output schema and restarted the container, but that single debugging action bypassed the auto mode savings and cost more than Worker 02's entire operational week on DeepSeek.

## What I Learned

The system currently relies on me asking the MCP to check on the workers. The architectural logical conclusion is establishing a continuous heartbeat monitor. By piping the workers' health checks into a local lightweight vector store on the Pi, the MCP can autonomously query historical crash data and proactively adjust the workers' DeepSeek temperature or token caps before a failure cascades, creating a truly self-healing swarm.
