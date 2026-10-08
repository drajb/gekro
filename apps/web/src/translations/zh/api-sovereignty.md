---
title: "API 主权：为凌晨 2 点的故障而构建"
description: "为什么通用的 API 封装是一种隐患，以及如何构建有韧性的多提供商回退链。"
publishedAt: "2026-03-15"
difficulty: "Advanced"
topics: ["APIs", "Architecture", "Python"]
readingTime: 8
aiSummary: "Rohit 实现了一个多提供商的 LLM 客户端，在云端 API 中断时自动回退到本地 Ollama 实例，以确保系统韧性。"
sourceHash: "c88de751c68b7f5aca29936c99b6b067a8c0af73c9dd0ed1f57ccb55cb827bb3"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  把单个 AI 提供商硬编码进代码，是架构层面的疏忽。我构建了一个统一的 LLM 客户端，优先使用 Together AI，但在云端宕机时会自动切换到本地 Ollama 实例。本文拆解 GekroLLMClient 模式，它让我的实验室无需人工干预就能 24/7 运行。
</TLDR>

达拉斯，凌晨 2 点。一个例行的 cron 任务触发一个智能体去总结我的服务器日志。Together AI 的 API 返回了 503。在标准配置下，流水线会挂掉，一条通知把我吵醒，我得为一个不受我控制的依赖损失一个小时的睡眠。而在我的实验室里，这种故障是无形的。系统检测到超时，捕获异常，把请求重新路由到我某台 Raspberry Pi 上运行的 Llama 3 实例。韧性不是一个功能，而是主权的必要条件。

## 架构

核心理念很简单：**云端提供算力，本地提供韧性，回退由设计保证。**我用云服务商来做重型推理，但确保每个请求都有一条本地的逃生通道。我不把本地模型和云端模型看作不同的物种，它们只是同一网络里不同的计算节点。

| 特性 | 云端 (Together AI / Anthropic) | 本地 (Pi/Mac 上的 Ollama) |
| :--- | :--- | :--- |
| **延迟** | 500ms - 2s（取决于网络） | 50ms - 5s（取决于硬件） |
| **成本** | 按 token 计费 ($$$) | 0 美元（只有电费） |
| **可靠性** | “在线率”（可能中断） | 100%（可在物理隔离环境中运行） |
| **隐私** | 个人信息有风险 | 绝对零泄露 |

我的架构使用**通用推理层**。应用逻辑永远不知道自己是在跟数据中心里的庞大集群通话，还是在跟我客厅里的一组 ARM 核心通话。

## 搭建

实现需要一个统一的接口。我用 Python 的 `abc` 模块来强制执行严格的契约。无论提供商是 Together AI（使用兼容 OpenAI 的规范）还是 Ollama，调用方代码处理的都是同样的对象。

### GekroLLMClient

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

### 验证这条链

在亲眼看到我的代码失败之前，我不会信任它。这套 pytest 测试通过毒化 API 密钥来模拟网络中断，并验证回退逻辑。

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

### WSL2 说明

如果你在 Windows 上运行，当 Ollama 运行在宿主机上时，请确保把 `OLLAMA_HOST` 设置为 `http://172.x.x.x:11434`（你的 Windows IP）；如果它在 WSL2 实例里，则直接用 `localhost`。我更喜欢把 Ollama 跑在 Windows 宿主机上，以便直接利用 GPU，同时把开发环境留在 Ubuntu 里。

## 取舍

说实话：回退逻辑会增加延迟。一次失败的云端调用加上 3 次重试，在本地模型开始思考之前就要花约 7 秒。对于实时聊天，这就是“坏掉”的界面。但对于运行 Gekro 日志解析器、自动化研究和代码索引器的后台智能体来说，7 秒的延迟总比整个系统崩溃要好。

还有一个**质量悬崖**。Together AI 上的 Llama 3-70B 和 Pi 上量化过的 Llama 3-8B，本质上是不同的大脑。调用方代码看到的是同一个接口，但本地模型的回答更短、更不细腻，也更容易漏掉边缘情况。对于结构化提取或摘要，这个差距还可以接受。对于复杂推理，本地回退只是创可贴，不是良药。设计你的智能体时，要让它们能容忍回退期间的输出质量下降，而不仅仅是速度下降。

最大的隐性成本是**上下文管理**。如果我在云端使用 128k 上下文的模型，而在本地回退到 8k 的模型，那么提示词太长时，本地模型就会产生幻觉或崩溃。我是吃了苦头才学会这一点的：我的夜间摘要智能体试图把一个 50k token 的日志文件喂给本地的 Llama 3-8B，结果 OOM killer 在推理中途终止了进程。回退时你必须大刀阔斧地截断。

## 接下来

这个客户端是迈向**共识架构**的第一步。我不想只指望某一个模型答对，而是希望我的客户端同时轮询三个模型（Together、Groq 和本地），再用一个“裁判”模型来挑选最佳答案。在线率只是底线。目标是通过比较不同大脑如何看待同一个问题，让实验室变得更聪明。
