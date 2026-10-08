---
title: "本地 AI 的 Token 经济学"
description: "为什么每一个持续运行 AI 工作负载的团队，从单人家庭实验室到 50,000 用户的企业，拥有推理层都比租用它回本更快。"
publishedAt: "2026-05-07"
difficulty: "Intermediate"
topics: ["AI Engineering", "Architecture"]
readingTime: 9
aiSummary: "Rohit 认为，在任何规模上，拥有推理层都能自己回本，从单人家庭实验室一直到 50,000 用户的企业。他拆解了为什么云 API 成本会随采用率线性增长，而自有硬件的成本则趋于平稳；为什么从零预训练一个模型是一个价值数百万美元的陷阱，前沿实验室之外没有人需要掉进去；以及参数高效微调如何把定制成本压缩到单块消费级 GPU 上的几百美元。"
sourceHash: "d22f61ad2a9ed7d3dd100ecab206e8e814c2660378463d0ba555f25a8aa6af4e"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  云端 LLM API 是按原型阶段定价的。把同样的工作负载以生产规模跑在上面，账单大约是自有硬件成本的两到三倍，而且这条曲线是分形的，所以一个靠 Anthropic 额度烧着现金流的五人创业公司，面对的是和一家 50,000 用户的企业同样的曲线。大多数团队从来没有补上这道差距，原因是他们把“拥有自己的模型”和“从零训练一个模型”混为一谈。后者是一个价值数百万美元的陷阱。真正的答案是花几百美元，在单块 GPU 上微调一个开源模型。
</TLDR>

这是每一家大型云服务商都希望我别写的文章。这笔账并不隐蔽：它以平实的语言公布在他们自己的定价页面上，写在他们自己的文档里，写在任何人都能下载的行业研究中。他们只是希望没人去读，因为每一家算过这笔账并搭起自己推理层的公司，都是在 API 租金上花得更少的公司。在每一种规模上答案都一样，五人创业公司、五万用户的企业，或曲线上两者之间的任何位置：拥有自己推理层的团队，回本的倍数远超租用的团队。

![本地 AI 的 Token 经济学：Gekro Labs 机房里，一名工程师手持一个 token 卡带，站在写着“云服务商：按 token 付费”的牌子前](/images/blog/token-economics.png)

## 架构

每百万 token 的价格看起来是平的。其实不是。输出是输入的三到十倍。推理模型把思维链 token 埋在那份输出账单里。每次请求都要为系统提示词和附带的任何 RAG 上下文再付一次钱。这些在定价页面上一样都没有拆开列出。但它们全都会落到发票上。

Enterprise Strategy Group 在 2025 年与 Dell Technologies 一起做了这个比较，对一个带 RAG 的 70B 参数 Llama 3 部署，在四年窗口内、三种架构上建模：本地部署的 Dell AI Factory、云 IaaS，以及纯 API 消费。在高利用率这一端，账是这样算的：

| 架构 | 每用户每月成本 | 扩展形态 |
|---|---|---|
| API 服务（GPT-4o 级） | $12.19 | 随流量线性增长；永不趋平 |
| 带 RAG 的本地 70B | $3.00 – $4.28 | 硬件上架后趋于平稳 |

在 10,000 用户时，四年窗口内本地部署**便宜 52%**。在 50,000 用户时，**便宜 62%**。差距随采用率扩大，这恰好与大多数采购假设相反。如果你想用自己的工作负载算同样的账，本站有两个配套工具：[LLM 成本计算器](/apps/llm-cost-calculator)按你具体的 token 量，计算任意云模型与任意本地硬件方案之间的盈亏平衡月份；[超大规模云厂商定价对比](/apps/hyperscaler-comparison)用每周核实的价格，在同一个模型上追踪 Bedrock、Azure Foundry 和 Vertex。

先忘掉绝对数字，看曲线。API 支出随流量线性增长，永不趋平。自有硬件的支出以硬件生命周期为上限。采用率这个变量决定了你是挖了一条护城河，还是签了一份税单。Dell 的数字是企业规模的，但曲线是分形的：一个五人创业公司在从原型走向生产的过程中，看着每月的 Anthropic 或 OpenAI 账单一路爬升，也在这同一条线上，只是乘数更小。这笔数学不在乎你的人头数；它在乎的是，你持续的 token 量能否让自有硬件忙到足以摊销成本。

还有第二个维度，在美元对比里根本看不到。云推理会把每一条提示词，包括系统上下文、检索到的文档、智能体的中间状态，跨过网络边界送到第三方。这会引出合规范围、知识产权泄露风险、围绕上下文窗口路线图和速率限制的厂商锁定、服务商在凌晨 3 点发生区域性故障时的集中风险，以及即使在提供同一模型的超大规模云厂商之间也存在的价格差异。我把它叫作*推理主权*。这和五年前技术领导层谈数据主权时是同一场对话，只是在技术栈里低了一层。

在这一点上，我从 CTO 那里得到的反对意见是合理的：*“可是 Bedrock、Vertex 和 OpenAI 都提供微调。我为什么还需要自己的 GPU？”*因为云托管的微调，是多了几个步骤的租赁。训练数据依然离开你的边界。适配器权重依然放在别人的基础设施上。推理依然按别人的单次请求价格、依照别人的路线图运行。你是在依赖之上加了定制，而不是消除了依赖。本地实验室是唯一一种让你的模型、你的数据和你的推理循环同时属于你自己的架构。

## 搭建

大多数团队从不迈出这一步，是因为他们把*拥有你的模型*和*从零训练你的模型*混为一谈。这是两个完全不同的问题，成本相差四到六个数量级。

### 不要预训练

斯坦福 2025 年的 AI Index 给前沿模型背后的训练算力标了价：GPT-4 约 **$78 million**，Llama 3.1 405B 为 **$170 million**，Gemini Ultra 为 **$191 million**。这些是摊销后的云租赁美元，只算原始算力：没有数据工程，没有 MLOps，也没有那些能让上千块 GPU 的集群跑起来而不变砖的人的薪水。即使在曲线的小端，从零训练一个 7B 模型也要 $50K–$500K 和数万 GPU 小时。70B 则要 $1.2M–$6M，以及一个专用的 256 块 H200 的集群连续运行数周。

别这么做。前沿实验室预算之外，没有人需要这么做。

### 做 PEFT

真正的打法是在现有开放权重基座之上做**参数高效微调**（Parameter-Efficient Fine-Tuning）。Llama 3、Mistral、Qwen、Phi：英语已经很流利，语法正确，了解世界。你在上面叠加的是你的领域：你的分类体系、你的格式、你的决策逻辑、你的语气。这在参数空间里只是一个微小的调整，现代技术正是直接利用了这一点。

| 方法 | 更新的参数 | VRAM（7B 基座） | 算力成本 |
|---|---|---|---|
| 全参数微调 | 100%（~7B） | 80GB+ 多 GPU | $10K – $35K |
| LoRA | 1 – 10% | 16 – 40GB | $500 – $3,000 |
| QLoRA（4 位） | < 1% | 8 – 10GB | $50 – $500 |

VRAM 那一列的数字是 7B 模型的基准值。要弄清楚某个特定模型在某种特定量化下是否真能装进某块特定 GPU，[GPU VRAM 计算器](/apps/gpu-vram-calculator)会把它拆开算：模型权重加上 KV 缓存再加激活值，对照一张精选的表，涵盖消费级 GPU、数据中心卡、Apple Silicon 和 Pi 加速器。做任何硬件决定之前都值得跑一遍。

LoRA 完全冻结基座权重，把小的可训练低秩分解矩阵注入特定的注意力层：你更新的是参数总量大约 1% 量级的东西。QLoRA 更进一步，把冻结的基座量化到 4 位，内存占用缩小到足以让 7B 微调放进单块消费级 GPU。一次认真的 QLoRA 适配训练只要几百美元，一夜就能跑完。脚本的样子，也就是 Gekro 实验室下个季度针对一个精选数据集计划做的事，大致如下：

```python
# gekro_qlora_train.py - Llama 3 8B + QLoRA via Unsloth + TRL
# Target: single consumer GPU (Mac Mini Metal or RTX 4090 class)
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/llama-3-8b-bnb-4bit",
    max_seq_length=4096,
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,                                # LoRA rank
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_alpha=16,
    lora_dropout=0.0,
    use_gradient_checkpointing="unsloth",
)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    # Expected JSONL shape per record:
    # {"messages": [{"role": "user", "content": "..."},
    #               {"role": "assistant", "content": "..."}]}
    train_dataset=load_curated_dataset(),    # your domain corpus
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=3,
        learning_rate=2e-4,
        optim="adamw_8bit",
        output_dir="./checkpoints",
    ),
)
trainer.train()
```

一个文件。一块 GPU。一夜的运行。输出是一个小小的适配器权重文件，推理时加载在冻结的基座之上，用 Ollama 或 vLLM 来提供服务，方式与服务基座模型完全一样。

### 硬件层级：实验室随团队规模扩大，而不是随公司营收

| 层级 | 预算 | 硬件 | 能运行什么 |
|---|---|---|---|
| **原型验证** | $899 – $3,500 | 单块消费级 GPU（RTX 4070 / 4090） | 为一名工程师提供 40+ tok/s 的量化 7B–8B |
| **微调** | $7,500 – $14,000 | 双 / 四路 RTX 5090 或 RTX 6000 Ada、Threadripper、128–256GB RAM | 基于 7B–13B 基座的 LoRA / QLoRA 任务，每次运行数小时 |
| **生产镜像** | $75,000 – $250,000+ | NVIDIA L40S / H100 / H200、NVLink、100GbE | 连续批处理、多租户服务、MLOps 验证 |

做重度 AI 工作流的个人工程师属于第 1 层。持续运行智能体工作负载的团队属于第 2 层。为数千用户提供服务的组织属于第 3 层。同一套架构，三个乘数。在每一层，回本的算术都比批准它的采购周期更快：第 1 层是几个月，第 2 层是几周，一旦微调后的适配器开始承接真实流量；第 3 层则是在持续规模下，相对于同等 API 支出的很多倍。

2026 年，推理服务栈已经收敛，这是故事里被报道得最少的一部分。vLLM 在吞吐量上胜出：它的 PagedAttention 算法像操作系统给虚拟内存分页那样切分 KV 缓存，在同一硬件上，用 vLLM 提供服务和用朴素方式提供服务之间的差别，就是一块空闲 GPU 与一块跑满 GPU 的差别。Ollama 在桌面和边缘的开发者体验上胜出。TensorRT-LLM 适用于你已经绑定 NVIDIA 并想榨干每一个周期的地方。实验跟踪由 MLflow 或 Weights & Biases 负责，因为 LLM 微调是非确定性的，可复现性正是研究演示与生产系统之间的差别。

你不再需要 Anthropic 或 OpenAI 的基础设施团队，才能大规模运行生产推理。那些公司花了数年才搭起来的技术栈，现在就是一条 `pip install` 加一个配置文件。这在 2026 年是新鲜事，也是这篇文章里的账能在每一层都成立的全部原因。我已经记录过[把 Pi 上的 Ollama 作为架构保险的模式](/blog/zh/hello-ollama/)，以及[把云端和本地提供者抽象在同一个接口之后的 GekroLLMClient](/blog/zh/api-sovereignty/)；这两者都可以直接从家庭实验室扩展到企业层级。

## 取舍

拥有推理层不是免费的，假装免费正是实验室最后沦为镇纸的原因。有四种失败模式值得点名。

**利用率不足会杀死曲线。**盈亏平衡的论证取决于持续的吞吐量。搭一台第 3 层的服务器却只用 8% 的利用率去跑，你就造出了一块非常昂贵的镇纸。云 API 对忽高忽低的小流量工作确实更便宜：那是它们最合适的形态，你应该继续这样用。做任何硬件决定之前，先问：我要内部化的工作负载，每天稳定的 token 量是多少，大到足以让硬件保持忙碌吗？如果诚实的答案是否，就让那个工作负载留在 API 上。本地硬件靠跑满来挣自己的饭钱。

**质量悬崖是真实存在的。**一个针对狭窄、定义清晰任务微调的 8B，可以在该任务上匹敌甚至超过前沿 API，这正是微调的全部意义。但一旦工作负载滑向开放式推理或跨领域知识，小模型就会掉下悬崖。我亲身体会过。我的 Mac Mini 能轻松运行量化的 70B，回答完全可以用来做摘要、分类和代码审查。它们也明显不如 Claude 或 Gemini Pro 对同一提示词返回的内容细腻：更短、更字面，更容易漏掉问题的二阶含义。路由决策就是架构，它就放在客户端封装里：

```python
# Hybrid routing - local for narrow tasks, cloud for long-tail reasoning
NARROW = {"classify", "extract", "summarize", "format", "tag"}
REASONING = {"design", "plan", "synthesize", "debug-novel"}

def route(task_class: str, prompt: str) -> str:
    if task_class in NARROW:
        return local_finetuned_8b.run(prompt)
    if task_class in REASONING:
        return cloud_frontier.run(prompt)
    return cloud_frontier.run(prompt)        # default: don't guess
```

狭窄、高流量、对延迟敏感的工作走本地。本地模型应付不了的长尾推理走云端前沿。这是 [API 主权模式](/blog/zh/api-sovereignty/)的核心：实验室并不取代云，它先吃掉那些可预测的工作负载。本地层处理的每一个 token，都是云账单不会向你收费的 token。你留在云上的每一个 token，实际上都是你在补贴服务商下一轮训练算力的 token。

**护城河是数据集，不是 GPU。**算力很便宜。一次花 $300 GPU 时间的 QLoRA 运行，可能建立在一项让团队花了 $60,000 专家工时的标注工作之上，而在一次认真的 DPO 或 RLHF 运行里，人工标注与算力之比通常是二十到三十倍，向人倾斜。这不是反对微调的论据。它的意思是，如果你的组织无法用书面写清自己的分类体系，无法就你所在领域什么是*正确*的输出达成一致，无法拿出领域专家来审阅标注，那你现在还没有微调问题，你有的是知识管理问题。先解决那个。算力是容易的那一半。当你开始整理训练样本的格式时，要预料到各框架之间的格式摩擦：OpenAI 的聊天格式、Alpaca、ShareGPT 和 Unsloth/Llama，都希望同样的数据稍微换一种形状。我做了[微调数据集格式化工具](/apps/finetuning-formatter)来处理转换，并标出那些会造成训练悄悄失败的缺失轮次错误。

**硬件更新换代很残酷。这是特性，不是缺陷。**会计把服务器按五年或六年折旧。AI 芯片不配合。新一代 GPU 大约每年一代，效率大幅提升，这意味着 2024 年初采购的 H100，到 2026 年底已经落后两代架构。对要求最高的层级，规划 24–36 个月的更新周期，并采用价值层叠的模式，把旧芯片下沉到较轻的工作负载：第 1–2 年做前沿训练，第 3–4 年做实时推理，之后做批量分析。积极更新换代的灵活性本身就是一项战略资产。云的三年预留实例承诺给不了你这一点，你的财务团队即将签下的长期 API 合同也给不了。

## 接下来

这篇文章一部分是综合，一部分是我自己的路线图。我今天在一台 Mac Mini 和一个 Pi 集群上运行本地推理，由 [GekroLLMClient](/blog/zh/api-sovereignty/) 按工作负载类别在云端和本地之间路由。我还没做、也是实验室下个季度的工作所围绕的，是在自己的硬件上针对一个精选数据集端到端跑一次 QLoRA，配上能把一次性微调变成可复现流水线的评估循环和 MLOps 纪律。还有第二个优化面，是我所在地特有的：德州的电网对训练任务应该什么时候运行有自己的看法，而这一点只有在你先拥有硬件之后才会打开。

这些都不是秘密。给你开月度发票的云服务商早就知道。他们赌的是你的工程团队忙着发布功能，没空算这笔账。你还是算一算。
