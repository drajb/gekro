---
title: "AI 写代码如天才，做架构似金鱼"
description: "为什么一次生成的 AI 概念验证在规模化时会崩塌，以及为什么受约束的架构模板，是干净的代码库与生产环境定时炸弹之间唯一的屏障。"
publishedAt: "2026-03-28"
difficulty: "Intermediate"
topics: ["AI Engineering", "Architecture", "Productivity"]
readingTime: 5
aiSummary: "AI 编码工具是无状态的引擎，缺少架构约束就会不断退化。本文详述了防止连锁不一致把一个能跑的 POC 变成无法修复的生产代码库的模板与知识库策略。"
sourceHash: "83f8dd1a268736a94ef519833ac6c8e84a5443aa96e19c1f392d140a5ecbad1f"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  “一次生成整个应用”的说法，偶尔也许能搞定一个周末的概念验证，但要把这个 POC 打磨成最终产品，是一个需要真实时间的残酷过程。偶尔写代码的人会欣然接受输出，完全没有意识到这些没有上下文的代码正在悄悄腐蚀可部署的资产。扎实的工程基础，是在不引入致命不一致的前提下扩展 AI 的唯一办法。
</TLDR>

在演示看起来惊艳的两周之后，这个构建已经无法修复。不是某一处坏了，而是到处都坏了，而且坏得相互矛盾。这就是一次生成式扩展实际的样子。非开发者和偶尔写代码的人站在屋顶上大喊，说 AI 能在几秒内造出整个应用。他们看着一个用一次性提示词拼出来、光鲜且能运行的概念验证，就认定它基本做完了，完全无视了把一个产品打磨到最终状态所需的、真实而磨人的结构性时间。

最后我确实把它救回来了。不是靠打补丁。我保留了学到的东西，扔掉了结构，在一个智能体必须先读完才允许写任何东西的记忆层上重新搭建。整个绕路花了大约三周。考虑到它教给我的东西，这很便宜。

![前景是一个被精心打磨的未来感应用全息图，但拉开幕布后却是一场运营灾难：胶带、缠绕的电线，以及一条随机按按钮的小金鱼。](/images/blog/ai_goldfish_facade.png)

## 架构

Claude、GPT5、Gemini 3 这样的 AI 模型都是无状态的预测引擎。一个复杂项目只有在底层知识库坚如磐石时才撑得住。如果地基薄弱，随着时间推移不断需要改动，产品构建就必然开始引入缺陷和不一致。

如果你指望凭一个提示词一次生成整个应用，或者指望每个原始提示词之后都出现神奇结果，你就会陷入无休止的循环，一边修复一个问题，一边暗中在别处制造新的问题。规划并综合研究来绘制系统蓝图，再配合一系列受约束的、有针对性的提示词，从根本上说是构建经得起考验的代码库的最佳策略。这正是严格的知识库至关重要的原因。

这正是那条分界线：优秀的软件工程师会立刻发现 AI 引入的结构性不一致，而偶尔写代码的人可能完全无忧无虑，浑然不觉自己正合并进一团相互冲突的状态逻辑所造成的灾难性烂摊子。

| 阶段 | 未固定 / 原始提示 | 受约束的架构 / 模板 |
|---|---|---|
| POC | 快。看起来很棒。 | 快。结构设置令人不适。 |
| Sprint 2 | AI 幻想出新的 UI 组件。 | AI 被严格限制在 `@repo/ui` 内。 |
| 生产 | 不一致让构建崩溃。 | 受约束的架构可以安全扩展。 |

```text
# Example: What a strong, constrained knowledge base looks like
/antigravity-base
├── apps
│   ├── web        (Astro 4 + Tailwind v4)
│   └── studio     (Sanity CMS)
├── packages
│   ├── ui         (Strict design tokens - AI CANNOT hallucinate)
│   ├── config     (Shared ESLint/TS - strict boundaries)
│   └── core       (Business logic boundaries)
├── knowledge      (Deep context and architectural decisions)
│   └── routing-rules.md
└── turbo.json     (Build constraints)
```

## 搭建

我构建 gekro.com 时，并没有从一个空白提示词和对“一次成功”的天真期望开始。我从一个严格的架构结构开始。随着时间推移，我打造了自己的“Antigravity”模板，它们高度可复用，能帮我严格约束 AI，快速启动任何复杂项目。每一个严肃项目的起点，都应该是基于你当前和长远愿景的、扎根很深的基础。开发者必须开始把自己的知识库模板化，以此强制施加约束。

```bash
# Initializing the environment from the core template
# Replace with your own base template repo
git clone https://github.com/your-org/your-base my-new-project
cd my-new-project
pnpm install

# Enforcing strict boundaries before AI touches anything
pnpm turbo run typecheck lint
```

如果我需要 Claude 生成一个新功能，它必须在我现有模板的严格定义之内运行。这就是我放进智能体系统提示词里的那段确切的配置，用来阻止它失控、引入会破坏一切的不一致。

```typescript
// Conceptual representation - actual rules live in your workspace system prompt / .cursorrules
// packages/config/base-agent-rules.ts
export const AgentConstraints = {
  allowAny: false,
  styling: "Tailwind v4 utility classes exclusively",
  state: "No local state for global data - use centralized store",
  components: "Astro islands for interactivity only",
  imports: "Use alias @repo/ui, never relative paths",
  knowledge: "Always refer to /knowledge/routing-rules.md before creating new endpoints"
} as const;
```

这能确保 AI 不是在猜测状态是怎么构成的。它会读取约束，针对任何具体主题交叉引用有针对性的知识库以获取更深的上下文，然后像做手术一样精确地执行改动。

始终把你的规则指向一个专门的知识库，会带来两个非常关键的好处：它让智能体只专注于当前任务，同时保住你模型的上下文上限，因为智能体不必为了弄明白某一种实现模式，就把整个代码库拖进内存。

忽视这项纪律的代价是切肤之痛。下面就是一个幻想出来的组件和一个受约束的组件之间的确切差别：

```typescript
// What AI hallucinates without constraints:
import { Button } from '../../components/ui/Button'  
import { Card } from '../../../shared/Card'
import { theme } from './localTheme'  // invented, doesn't exist

// What AI generates with a constrained template:
import { Button, Card } from '@repo/ui'
import { tokens } from '@repo/config/tokens'
```

这一个差异不用一个字的解释，就说明了全部论点。

除了结构性的样板之外，在仓库根部引入“边做边记录”的工作流、决策日志和问题追踪器，也会大有帮助。通过创建一份智能体行动前会查阅的、活的、可读的上下文，你能主动防止 AI 为了同一个问题反复兜圈子。你本质上是在自己的文件系统里搭建了专属的本地 MCP（Model Context Protocol）服务器。对一个健康的仓库来说，严格的文件组织、直接注入智能体规则的上下文，加上一份强有力的 README，是不可妥协的。

比如，明确规定智能体必须把逻辑路由到哪里，就能保证架构合规：

```text
# Agent Prompt: Organization Enforcement
"Generate the new 'Analytics' feature. Follow the established file organization:
- Place all UI components strictly in `packages/ui/src/analytics/`
- Place all business state logic in `packages/core/stores/analytics.ts`
- Do NOT generate local component state. Review the `/knowledge/routing-rules.md` file first and automatically enforce these routing rules."
```

在为复杂项目写下第一行应用代码之前，我的标准流程是先启动一篇关于该主题的深度研究文章。我把这份架构研究综合起来，然后开始勾勒我的提示词策略，并把研究成果作为 Markdown 文件保存在一个独立的产物文件夹里。一套规划周全、研究充分、引用明确产物的提示词策略，要比事后应对一次生成的失败、兜圈子去修复它们好得多。

此外，以这种方式构建还能带来巨大的成本控制。这种策略在你已经采用多供应商配置时效果最好，而抽象层让这件事变得轻而易举。你的蓝图和结构综合应当由可用的最强前沿模型来生成，比如 Gemini Pro 或 Claude Opus。一旦严格的架构边界划定，就让更快更便宜的模型，比如 Flash，去执行这份已成文的蓝图。局部代码生成完成后，让更高档的模型审查拉取请求，以确保与基础模板严格一致。长期来看，这能省下大量资金。

最后，始终要求智能体为每个新功能生成测试套件。确保相关指令明确写在工作区规则或 README 中，让每个重要的提示词周期都必须测试，而不是事后才想起来。

```text
# Agent Prompt: Test Suite Mandate
"Whenever you create or modify a component, you MUST simultaneously generate/update the exact corresponding `vitest` suite in the `packages/core/tests/` directory to cover the failure cases. Do not ask for permission, just include the test in the PR."
```

## 取舍

矛盾完全存在于搭建模板的前期成本，与原始提示词那种具有欺骗性的速度之间。维护可复用的模板要占用周末的时间，而我更愿意把这些时间用来做功能。此外，当底层框架发布新的大版本时，模板会从根本上失效。之后每一次基于它的 AI 生成，都需要大量手动引导，直到地基被修补好。

还有第二个取舍我没有解决，我也不确定是否有人解决了。记忆依然是薄弱环节。即使有好的记忆层、合理的技能配置和多个相互协调的智能体，大型项目仍然会悄悄漏掉一些熟悉它的人绝不会漏掉的东西。于是你得重复自己的话。这是这套工作流里我觉得真正恼人的部分，再多的模板也无法修复它。

## 接下来

有必要说一说我当初错在哪里。我过去认为 AI 代码生成只是容易出错：它自信地写，却不理解，再多的上下文也救不了它。对我形成这个看法时所用的那些模型来说，这是一种公允的判断。对当前的模型来说，这不再公允。它们已经进步很多，可以比我曾经允许的更大程度地信任，但严格与你交给它们的上下文成正比，而这正是本文的全部论点。

我们正在从让模型写代码，转向让模型遵守架构。把 AI 约束在个人模板之内，是把它当作可靠的工程伙伴，而不是一个慢慢摧毁你生产代码库的混乱实体的前提。
