---
title: Provider 与配置
description: 选择 TypeSafe、Vercel AI Gateway 或假 provider，并配置阈值、超时、重试和用量估算。
---

# Provider 与配置 {#providers-configuration}

裁判和 Playwright 适配器接受任何实现了 `Provider` 接口的对象。项目自带两个 provider，另外还有一个假 provider，用来测试流程本身。

| 包                           | 作用                                                      |
| ---------------------------- | --------------------------------------------------------- |
| `semantic-assert`            | 核心裁判、设置、指标，以及可编排脚本的 `FakeProvider`     |
| `semantic-assert-typesafe`   | TypeSafe Jev provider                                     |
| `semantic-assert-ai-sdk`     | AI SDK 评估 provider，默认通过 Vercel AI Gateway 调用 Jev |
| `semantic-assert-playwright` | 页面捕获、fixture、matcher 和报告                         |

::: info 你将学到

- 什么是 Jev，以及陈述如何对应到它的问题
- 如何配置 TypeSafe 和 Vercel AI Gateway provider
- 如何为假 provider 编排脚本
- 有哪些裁判设置，以及它们的默认值从哪里来
- 为什么要先校准阈值，再信任它

:::

## TypeSafe {#typesafe}

[Jev](https://typesafe.ai) 是 TypeSafe 的第一个 [System One 模型](https://docs.typesafe.ai/concepts/system-one)。它针对给定状态回答范围很窄的问题，返回的是带类型的结果和校准过的概率，而不是生成的文本。你的陈述会变成 Jev 的 **Noul** 问题，返回该陈述成立的概率。你的分类会变成 **Choice** 问题，返回在各个命名选项上的概率分布。这个 provider 直接调用 TypeSafe 的 API：

```ts
import { typesafe } from "semantic-assert-typesafe";

const provider = typesafe({
  timeoutMs: 10_000,
  maxRetries: 0,
});
```

API key 默认读取 `TYPESAFE_API_KEY`。模型默认读取 `TYPESAFE_DEFAULT_MODEL`，没有则使用 `jev-latest`。设置 `TYPESAFE_BASE_URL` 可以指向其他端点。

这里的 `timeoutMs` 是单次尝试的超时。默认是 10 秒超时加三次重试，所以一个慢的 provider 可能会把测试卡住好一阵。像上面那样调低重试次数，或者给测试运行器留足时间。重试由适配器负责，所以不会和 SDK 的重试叠加。

要估算费用，把 `usdPerMtokInput` 或 `TYPESAFE_USD_PER_MTOK_INPUT` 设为你当前的费率。在设置之前，费用会显示为未知。

## Vercel AI Gateway {#vercel-ai-gateway}

用 AI SDK 适配器通过 [Vercel AI Gateway](https://vercel.com/ai-gateway) 调用 Jev：

```ts
import { aiSdk } from "semantic-assert-ai-sdk";

const provider = aiSdk({
  model: "typesafe-ai/jev",
  timeoutMs: 10_000,
  maxRetries: 0,
});
```

默认模型是 `typesafe-ai/jev`，默认 key 来自 `AI_GATEWAY_API_KEY`。这个 key 只能放在服务端。

它和直连 provider 有两点重要区别：

- **重试由 SDK 负责**，默认两次。`timeoutMs` 限制的是整次评估，包括重试在内。
- **没有回退。** 如果网关失败，适配器不会改用 TypeSafe 的直连端点。

::: warning 陷阱
这个适配器需要 AI SDK 的**评估**模型。聊天模型和语言模型不能替代它，即使走的是同一个网关。
:::

适配器要求 `ai >=7.0.107 <8`。评估 API 还处于实验阶段，`7.0.107` 是本仓库测试所用的版本。要估算费用，设置 `pricing: { inputUsdPerMtok, outputUsdPerMtok }`。两个费率和两个 token 计数都齐全时，才会显示估算值。

## 假 provider {#fake-provider}

编排裁判收到的分数：

```ts
import { FakeProvider } from "semantic-assert";

const provider = new FakeProvider({
  scripts: [{ claim_0: 0.95, claim_1: 0.02 }],
});
```

陈述按你传给 `expectClaims` 或 `expectPage` 的顺序从零开始编号。假 provider 返回你编排好的答案，并记录收到的每个请求，所以你可以断言本来会发送什么。它从不读取输入。用它来测试集成行为，不需要网络调用。

## 裁判设置 {#judge-settings}

`resolveJudgeSettings(overrides)` 优先使用你显式传入的覆盖值，其次是环境变量，最后是内置默认值：

| 设置             | 环境变量                          | 默认值  |
| ---------------- | --------------------------------- | ------- |
| `threshold`      | `SEMANTIC_ASSERT_THRESHOLD`       | `0.7`   |
| `timeoutMs`      | `SEMANTIC_ASSERT_TIMEOUT_MS`      | `0`     |
| `pollIntervalMs` | `SEMANTIC_ASSERT_POLL_MS`         | `1000`  |
| `maxStateChars`  | `SEMANTIC_ASSERT_MAX_STATE_CHARS` | `40000` |

**阈值**必须在 `0.5` 到 `1` 之间。单条陈述的阈值覆盖单次调用的阈值，单次调用的阈值覆盖裁判的设置。

**时间设置**同样是分层的。默认值为零，表示只评估一次。`timeoutMs` 为正数时开启轮询，`pollIntervalMs` 设置两次检查之间的间隔。单次调用的选项覆盖裁判设置。两个值都必须是有限的非负数。provider 的请求重试是另一项设置：即使只评估一次，也可以通过 `maxRetries` 重试临时性的 API 故障。

**模板**把一条陈述变成 provider 的问题。核心模板描述的是任意 JSON。Playwright 适配器提供的模板会点明捕获页面的各个字段，这对模型帮助很大。你可以替换任何模板，比如修改措辞或语言。

## 先校准，再依赖结果 {#calibrate-before-you-rely-on-the-result}

阈值是一种接受策略，不是准确性的保证。用你自己应用中已知的好例子和坏例子来检验它，更换 provider 或模型时要重新校准。不同 provider 给出的概率不在同一个尺度上。

::: warning 陷阱
在分类任务中，AI SDK 适配器把所选选项的概率作为置信度，而直连 TypeSafe provider 暴露的是它原生的置信度。在两者之间切换时，要重新检查所有置信度阈值。
:::

## 回顾 {#recap}

- Jev 是默认的裁判，可以直接通过 TypeSafe 调用，也可以通过 Vercel AI Gateway 调用。
- 两个 provider 处理重试的方式不同。设置超时时要考虑到这一点。
- `FakeProvider` 编排分数并记录请求，用于测试流程。
- 设置的解析顺序是覆盖值、环境变量、默认值。
- 在信任一次全绿的运行之前，先用你自己的数据校准阈值。
