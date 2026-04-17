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
I transformed one of my three Raspberry Pi 5 (16GB + M.2 256GB) nodes into a financially air-gapped orchestration shell that runs fully capable, daily-use AI personal assistants. By utilizing a split-brain architecture where a Master Control Program (MCP) supervises multi-purpose OpenClaw workers, the system can autonomously handle everything from Telegram interfaces to business tool integrations. This approach enforces strict cost-governance over highly capable agents without artificially limiting their abilities, proving that you don't need to choose between advanced AI assistance and predictable API billing.
</TLDR>

I isolated one of my three Raspberry Pi 5 (16GB + M.2 256GB) nodes to act as a financially air-gapped AI orchestrator governed by a Master Control Program (MCP). The goal wasn't just to cut costs—it was to build a truly capable, multi-purpose AI assistant system I could use daily without watching my "Pro" tier API billing completely vaporize from constant state-maintenance.

The workers in this system aren't narrow, single-purpose daemons. They are fully functional personal assistants actively monitoring systems, executing autonomous background tasks, interfacing with personal productivity tools, and answering queries via Telegram. However, running these highly capable assistants requires a safeguard. The solution was an aggressive routing strategy: utilizing a central MCP to oversee the environment while running the actual assistants as dockerized background processes through an aggregator with strict account-level spend caps. The Pi is no longer a general-purpose home lab—every other container was purged to make it a dedicated, networked OpenClaw shell.

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

First, I needed a clean slate. I executed a total purge of existing infrastructure to ensure no phantom containers chewed up memory or conflicted with my routing layers. Then, I established the isolated network (`claw_net`). The workers need outbound internet for the Telegram API and OpenRouter, but isolating them on their own bridge network guarantees they have no inbound access and cannot see each other's traffic.

```bash
# Purge all non-essential containers and images
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker system prune -a --volumes -f

# Create the dedicated network for the swarm
docker network create --driver bridge claw_net
```

I restructured the filesystem in `/opt/openclaw` to reflect the hierarchy, giving the MCP absolute visibility over the workers' configuration files.

```bash
mkdir -p /opt/openclaw/{mcp,workers/worker-01,workers/worker-02}
```

Next, I configured the isolated workers. I locked their authentication to OpenRouter and enforced a hard monthly spend limit directly at the account level. This contains cost overruns on the backend—if a loop happens, the maximum damage is explicitly capped, saving me from a surprise $500 monthly bill. In practice, running these fully capable, daily-use AI assistants costs me realistically between $8 and $15 per month. Rather than imposing arbitrary capability ceilings, I tuned their `maxOutputTokens` and `maxHistoryTurns` as deliberate performance calibration parameters. These values are matched specifically to the nature of each worker's role—optimizing context windows for fast responses versus complex actions—ensuring they remain fully functional without wasting computational overhead.

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

I launched the workers attached to the isolated network. By mounting their respective configuration directories directly into the containers, the MCP can later step in, read these configs via the Docker socket, and dynamically rewrite them if a worker begins to misbehave.

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

Finally, the Master Control Program. The MCP requires Google AI credentials, but to prevent unnecessary token burn, I implemented the `manifest.ai` routing skill. I mounted the Docker socket and the root `/opt/openclaw/workers` directory into its container so it could supervise the sub-processes natively. The MCP is the only container with the keys to the kingdom.

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

Before I implemented the routing logic, I actually had Worker 01 silently fail. It couldn't parse a malformed JSON payload from Telegram and just hung there, quietly chewing up memory resources on the Pi while the API timed out repeatedly. I didn't catch it for two days. That silence, and the cascading failure it risked, is what drove me to build the MCP in the first place.

The system currently relies on me manually asking the MCP to check on the workers, which is a half-measure. The architectural logical conclusion—and my next project in the lab—is establishing a continuous heartbeat monitor. By piping the workers' health checks into a local lightweight vector store on the Pi, the MCP will be able to autonomously query historical crash data and proactively adjust the workers' DeepSeek temperature or token caps *before* a failure cascades.

This experiment proved that you don't need massive, monolithic cloud infrastructure to run complex AI systems. By forcing the architecture into the physical limits of a single Raspberry Pi 5 and the financial limit of an $8–$15 monthly spend cap, the result wasn't a compromised or constrained sandbox. Those constraints actually shaped a more disciplined, highly capable orchestration system. Today, these aren't just narrow scripts; they are genuinely effective, daily-use AI personal assistants that actively manage my workflows. The lab is finally running smart, the assistants are fully unleashed, and my billing page is finally boring.
