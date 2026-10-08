---
title: "你好，Ollama：本地推理是你的架构保险"
description: "在 Raspberry Pi 上运行 LLM 不只是一种爱好，而是一套保障系统韧性的回退策略。"
publishedAt: "2026-03-22"
difficulty: "Intermediate"
topics: ["Local LLM", "Python", "Raspberry Pi"]
readingTime: 6
aiSummary: "Rohit 演示了如何在 Raspberry Pi 集群上部署 Ollama，作为云端 AI 服务的高可用回退。"
sourceHash: "914e896bfce7457217ec0d2f9bc0e930421b4940dcd69ba204e8dec43071fcd7"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  隐私是本地 LLM 的营销卖点，而韧性才是工程上的现实。我用 Together AI 处理重活，但我的 Raspberry Pi 集群通过 Ollama 运行量化的 Llama 3 模型，作为零成本的回退。本文介绍真正能在 ARM 硬件上运行、又不会把主板烧熔的具体模型和量化级别。
</TLDR>

有一次深夜构建时我的网络断了，而我的 Raspberry Pi 上仍有一个本地 Llama 3 实例在回答问题，那一刻我意识到，我们已经到了一个转折点。对于基础的推理任务，我们不再依赖与价值数十亿美元的数据中心保持持续连接。在 **Gekro Lab**，Ollama 就是那份架构保险单，它让我的智能体在某个提供商宕机时继续工作。

我最初并不是出于什么高尚的理由。起因是好奇和成本。我想让一些东西持续运行，好让我不断学习，而我想用的模型都被锁在一笔我不想承诺的开销后面。一台只花电费、安静运转的 Pi 把这两件事都解决了。慢，是的。但仍在工作。

## 架构

我的配置不是单台机器，而是一条分布式推理链。我优先使用 **Together AI** 处理高复杂度的云端推理，但实验室的“神经系统”是由一个运行 Ollama 的三节点 Raspberry Pi 5 集群（每台 16GB）来支撑的。

| 模型 | 大小 | 量化级别 | 内存占用 | 每秒 token 数 (Pi 5 16GB) | 最佳用途 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Llama-3-8B** | 4.7GB | Q4_K_M | ~5.2GB | 4-6 t/s | 通用推理 |
| **Phi-3-Mini** | 2.3GB | Q4_0 | ~2.8GB | 12-15 t/s | 快速分类 |
| **Mistral-7B** | 4.1GB | Q4_0 | ~4.5GB | 3-4 t/s | 工具使用 / 函数调用 |

顺序比硬件更重要。OpenRouter 上的免费模型排第一，Pi 位居中间，付费的 OpenRouter 是最后手段。中间这个位置并非摆设。当免费层不可用时（这种情况出现得足够频繁，让人不得不注意），回答问题的就是 Pi。在那些替代方案是付费的日子里，它确实让我得以继续工作。

走到这一步经历了几轮试错。我不停地换模型，想找到合适的那个，而每次的教训都一样：大模型太慢时，解决办法是更少的参数和更重的量化，而不是更多的耐心。

在 ARM64 架构上，内存带宽是瓶颈。每个节点有 16GB，我有余地运行比网上常见的 8GB Pi 配置更大的模型。我发现 **4 位量化（Q4）**是最佳平衡点：再低，模型会失去“常识”；再高，则是在没有明显质量提升的情况下挤占系统开销。

## 搭建

在 Linux 上（包括 WSL2 和 Raspberry Pi OS）安装 Ollama 只需一行命令，但真正的工程在于你如何封装它。

### 1. 无界面安装

我的 Pi 集群是无界面运行的。没有 GUI，只有 SSH 和一个 systemd 服务。

```bash
# Install Ollama on Linux/Pi
curl -fsSL https://ollama.com/install.sh | sh

# Serve Ollama on all network interfaces (required for cluster access)
sudo systemctl edit ollama.service
```
把这个环境变量加入服务文件，以允许来自你主工作站的外部调用：
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
```

### 2. 抽象层的样板代码

不要在你的实验里直接使用原始的 Ollama API。使用一个具备回退意识的客户端。这是我在整个实验室里使用的逻辑的简化版。

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

### 板子会告诉你它在工作

你能听到一台 Pi 在思考。我的会发热，风扇会转起来，坐在它旁边我不用看终端，就能知道它正处于某个提示词的处理中。在这个规模下，热降频不是规格表上一行抽象的文字，而是你桌上的一种噪音。先规划风道，再考虑其他一切。

### WSL2 说明

如果你在 Windows 的 WSL2 里测试，Ollama 现在有原生的 Windows 安装程序，可以利用你的 NVIDIA GPU。运行 Windows 应用，然后在 WSL2 里设置 `OLLAMA_HOST=172.x.x.x`（你的 Windows 以太网适配器 IP），就能从 Linux 环境使用那块 GPU 的算力。

## 取舍

Raspberry Pi 不是 H100。如果你试图在 Pi 上运行 Llama 3-70B 模型，它不只是慢，OOM killer 还会终止这个进程。如果你在便宜的 SD 卡上启用了交换空间，光是频繁换页就可能损坏你的文件系统。

我遇到的最大故障是**过热降频**。在一次繁重的批处理任务中，Pi 5 的温度达到了 85°C，推理速度降到每秒 0.5 个 token。在实验室环境里，主动散热（感谢 Argon ONE 机箱）对本地 LLM 来说不是可选项，而是必须的。

另外，别指望云端级别的“创造力”。本地量化模型擅长提取、摘要和基础逻辑，但在细微差别或高层战略规划上表现糟糕。

## 接下来

我目前在试验**并发优先的路由**：用全部三个 Pi 节点并行处理推理请求，而不是把单个模型拆分到它们之上。目标是一个真正的“主权大脑”，它不只是充当回退，而是作为云端模型在本地的对等体，能够同时处理多个正在推理的智能体。
