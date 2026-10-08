---
title: "为 Raspberry Pi AI 集群实施财务气隙隔离"
description: "我如何用 MCP 路由器和相互隔离的 OpenClaw 工作节点网络，把一台 Pi 5 变成本地编排器，以大幅削减 API 成本。"
publishedAt: "2026-03-27"
difficulty: "Advanced"
topics: ["Architecture", "Raspberry Pi", "OpenClaw", "Docker"]
readingTime: 6
aiSummary: "详细拆解如何把 16GB 的 Raspberry Pi 5 改造成由主控程序管理的隔离 Docker 网络，重点介绍使用 manifest.ai 路由器把任务分流给性价比高的 OpenRouter DeepSeek V3 工作节点。"
sourceHash: "52b8730bd6ee9d4f19a2fc7e28cef3803c9687ba6ab39691b6f7ef4b37f084a4"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
我把三台 Raspberry Pi 5（16GB + M.2 256GB）节点中的一台改造成了财务气隙隔离的编排外壳，运行功能完备、每天都在用的 AI 个人助理。在分脑架构下，由主控程序（MCP）监督多用途的 OpenClaw 工作节点，系统可以自主处理从 Telegram 界面到商业工具集成的一切。这种做法对能力很强的智能体实施严格的成本治理，却不人为限制它们的能力，证明你不必在先进的 AI 辅助和可预测的 API 账单之间二选一。
</TLDR>

我把三台 Raspberry Pi 5（16GB + M.2 256GB）节点中的一台隔离出来，让它充当由主控程序（MCP）管理的、财务气隙隔离的 AI 编排器。目标是搭建一套能力强、多用途、我每天都能用的 AI 助理系统，又不至于因为持续的状态维护而让我的“Pro”档 API 账单彻底蒸发。

这套系统里的工作节点不是狭窄的单一用途守护进程。它们是功能完备的个人助理：主动监控系统，执行自主的后台任务，对接个人效率工具，并通过 Telegram 回答问题。不过，运行这些能力很强的助理需要一道保险。解决办法是一套激进的路由策略：用一个中央 MCP 来监督整个环境，而真正的助理则作为 Docker 化的后台进程，通过一个设有严格账户级支出上限的聚合器运行。Pi 不再是通用的家庭实验室：其他所有容器都被清除了，只为把它变成一个专用的、联网的 OpenClaw 外壳。

## 架构

系统运行在分脑、分层的架构上。根部是 MCP。MCP 没有写死某个昂贵的模型，而是把一个 `manifest.ai` 技能当作内置路由器。它会动态评估管理任务的复杂度，决定调用哪个 Gemini 模型，并默认使用 Gemini 原生的自动模式来获得基础效率。

在它之下，完全隔离在专用的 Docker 桥接网络（`claw_net`）上，坐着两个各管一类任务的工作节点。工作节点通过预付费的 OpenRouter 连接承担繁重工作。MCP 监控它们的日志，在它们失败时改写它们的配置，并重启它们的容器。

| 层级 | 实例 | 提供商/模型 | 角色与能力 | 成本结构 |
| --- | --- | --- | --- | --- |
| 监督者 | MCP（根） | Google AI（`manifest.ai` 路由器 / Gemini Auto） | 动态路由，修改配置，控制 Docker 守护进程。 | 可变 / 已优化 |
| 子进程 | Worker 01 | OpenRouter (DeepSeek V3) | 快速数据解析，Telegram 界面。 | $0.14 / 1M 个 token |
| 子进程 | Worker 02 | OpenRouter (DeepSeek V3) | 复杂的 API 操作，Telegram 界面。 | $0.14 / 1M 个 token |

## 搭建

这次转型需要清空 Pi 5，以消除端口冲突和 CPU 开销。这块硬件现在只做 OpenClaw 主机。

首先，我需要一张白纸。我对现有基础设施做了一次彻底清理，确保没有幽灵容器吃掉内存，或者与我的路由层冲突。然后我建立了隔离网络（`claw_net`）。工作节点需要出站互联网访问 Telegram API 和 OpenRouter，但把它们隔离在各自的桥接网络上，可以保证它们没有入站访问，也看不到彼此的流量。

```bash
# Purge all non-essential containers and images
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker system prune -a --volumes -f

# Create the dedicated network for the swarm
docker network create --driver bridge claw_net
```

我在 `/opt/openclaw` 里重新组织了文件系统来反映这种层级关系，让 MCP 对工作节点的配置文件拥有完全的可见性。

```bash
mkdir -p /opt/openclaw/{mcp,workers/worker-01,workers/worker-02}
```

接着，我配置了隔离的工作节点。我把它们的认证锁定到 OpenRouter，并直接在账户层面强制设置了每月的硬性支出上限。这样可以在后端遏制成本超支：即使发生循环，最大损失也被明确封顶，让我免于一张 500 美元的意外月账单。实际上，运行这些功能完备、每天都在用的 AI 助理，我每月大约花 8 到 15 美元。我没有强加随意的能力上限，而是把它们的 `maxOutputTokens` 和 `maxHistoryTurns` 调成经过深思熟虑的性能校准参数。这些数值专门匹配每个工作节点角色的性质，在快速响应和复杂操作之间优化上下文窗口，确保它们保持完整功能，又不浪费计算开销。

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

我把工作节点接入隔离网络后启动了它们。把各自的配置目录直接挂载进容器后，如果某个工作节点开始异常，MCP 之后就可以介入，通过 Docker 套接字读取这些配置，并动态改写它们。

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

最后是主控程序。MCP 需要 Google AI 凭据，但为了避免不必要的 token 消耗，我实现了 `manifest.ai` 路由技能。我把 Docker 套接字和根目录 `/opt/openclaw/workers` 挂载进它的容器，让它能原生监督这些子进程。MCP 是唯一握有王国钥匙的容器。

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

## 取舍

把 `/var/run/docker.sock` 挂载进一个由 LLM 驱动的容器，在生产环境里是灾难性的安全风险。如果 MCP 遭到提示词注入攻击，它就拥有对 Pi 上 Docker 守护进程的 root 级控制。我接受了这个风险，因为这台 Pi 5 在物理上是隔离的，并且只用于这个实验，但这不是适用于企业部署的模式。

此外，`manifest.ai` 路由器很聪明，但并非万无一失。当 Worker 02 因为格式错误的 API 负载抛出一大堆栈跟踪时，路由器正确地把它识别为“复杂的调试任务”，并把执行提升到一个重型推理模型，而不是用更轻的 Flash 变体。MCP 读取错误日志耗费了 40,000 个 token，然后才提出修复方案。它成功改写了 Worker 02 的输出模式并重启了容器，但这一次调试操作绕过了自动模式的节省，花费超过了 Worker 02 在 DeepSeek 上整个运营周的费用。

## 我学到了什么

在我实现路由逻辑之前，Worker 01 其实曾经悄无声息地失败过。它无法解析 Telegram 发来的格式错误的 JSON 负载，就那样卡住了，在 API 反复超时的同时，悄悄吃掉 Pi 上的内存资源。我两天都没发现。那种沉默，以及它可能引发的连锁故障，正是我当初构建 MCP 的原因。

目前系统依赖我手动让 MCP 去检查工作节点，这只是个折中办法。这套架构在逻辑上的下一步，也是我在实验室里的下一个项目，是建立持续的心跳监控。把工作节点的健康检查输送进 Pi 上的一个本地轻量向量库，MCP 就能自主查询历史崩溃数据，并在故障连锁发生*之前*，主动调整工作节点的 DeepSeek 温度或 token 上限。

这个实验证明，运行复杂的 AI 系统并不需要庞大、单体的云基础设施。把架构压进单台 Raspberry Pi 5 的物理极限和每月 8–15 美元支出上限的财务极限之内，结果并不是一个被妥协或被束缚的沙盒。这些约束反而塑造出一套更有纪律、能力很强的编排系统。今天，它们不只是狭窄的脚本，而是真正有效、每天都在用的 AI 个人助理，主动管理着我的工作流。实验室终于聪明地运转起来，助理们完全放开了手脚，而我的账单页面终于变得无聊。
