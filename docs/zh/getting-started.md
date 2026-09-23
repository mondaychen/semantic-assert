---
title: 快速开始
description: 用 TypeSafe、Vercel AI Gateway，或者无需 API key 的脚本化 provider，运行你的第一条语义断言。
---

# 快速开始 {#quick-start}

你将针对一个 JSON 响应写下第一条语义断言。核心裁判不关心你用哪个测试运行器，甚至不关心你用不用。要测试 HTML，之后接着看 [Playwright 配置](./reference/playwright#install)。

::: info 你将学到

- 如何安装核心包和一个 provider
- 如何对一个 JSON 值断言一条自然语言陈述
- 如何切换到 Vercel AI Gateway
- 如何在没有 API key 的情况下跑通整个流程

:::

## 安装 {#install}

使用 Node.js 22 或更高版本：

```sh
pnpm add semantic-assert semantic-assert-typesafe
export TYPESAFE_API_KEY="your-api-key"
```

`semantic-assert-typesafe` 包负责和 [Jev](https://typesafe.ai) 通信，它是 TypeSafe 的 System One 模型。Jev 不生成文本，而是针对是非题和选择题返回带类型的答案和校准过的概率，所以你可以直接拿它的概率和阈值比较。去 TypeSafe 申请一个 API key，或者直接跳到[不用 API key 试试流程](#try-the-flow-without-an-api-key)。

## 写下第一条断言 {#make-your-first-assertion}

用一个 provider 和一个阈值创建裁判，然后把捕获函数和一条陈述交给它。保存为 `check.mjs`：

```js
import { Judge, resolveJudgeSettings } from "semantic-assert";
import { typesafe } from "semantic-assert-typesafe";

const judge = new Judge({
  provider: typesafe(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});

await judge.expectClaims(
  async () => ({ message: "Your changes have been saved." }),
  [{ claim: "The message confirms success" }],
);

console.log("Semantic assertion passed.");
```

运行它：

```sh
node check.mjs
```

捕获函数返回要评判的状态。裁判把这个状态和你的陈述放在一个请求里发给 provider，当陈述成立的概率至少为 `0.8` 时正常返回。否则它会抛出 `SemanticAssertionError`，列出每条陈述及其概率。

::: tip 把 key 放在 `.env` 文件里
provider 不会自己加载 `.env`。运行 `node --env-file=.env check.mjs`，并把 key 放在你的测试或服务器环境里。
:::

### 为什么只评估一次？ {#why-does-it-evaluate-only-once}

裁判默认只评估一次（`timeoutMs: 0`）。拿同一个问题就同一个回复再问一遍模型，会多花一次请求，却得不到任何新证据。只有当你捕获的状态在两次检查之间确实会变化，并且你希望裁判重新捕获再试一次时，才设置一个正数超时。

## 使用 Vercel AI Gateway {#use-vercel-ai-gateway}

安装适配器及其 AI SDK peer 依赖：

```sh
pnpm add semantic-assert semantic-assert-ai-sdk ai@7.0.107
export AI_GATEWAY_API_KEY="your-api-key"
```

在上面的例子里换掉 provider：

```ts
import { aiSdk } from "semantic-assert-ai-sdk";

const judge = new Judge({
  provider: aiSdk(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});
```

这个适配器默认使用 `typesafe-ai/jev`，所以你用的仍然是 Jev，只是经由[Vercel AI Gateway](https://vercel.com/ai-gateway) 路由。超时、重试和成本设置参见 [provider](./reference/providers)。

## 不用 API key 试试流程 {#try-the-flow-without-an-api-key}

你只需要核心包：

```sh
pnpm add semantic-assert
```

用 `FakeProvider` 编排裁判收到的分数：

```ts
import { FakeProvider, Judge, resolveJudgeSettings } from "semantic-assert";

const judge = new Judge({
  provider: new FakeProvider({ scripts: [{ claim_0: 0.95 }] }),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});

await judge.expectClaims(
  async () => ({ message: "Your changes have been saved." }),
  [{ claim: "The message confirms success" }],
);
```

::: warning 陷阱
`FakeProvider` 返回的是你编排好的分数。它能走通断言流程，但从来不读内容。假断言通过，并不说明陈述为真。要检查真实文本的含义，请使用真实的 provider。
:::

## 回顾 {#recap}

- 裁判就是一个 provider 加一组设置。对没有单独设置阈值的陈述，阈值就是它们的及格线。
- `expectClaims` 接收一个捕获函数和一组陈述，在一个请求里发出，有陈述没过就抛错。
- 默认只评估一次。轮询需要通过正数 `timeoutMs` 主动开启。
- `FakeProvider` 编排分数，用于测试流程本身。

## 下一步 {#next-steps}

- [HTML 提示与文案修改](./examples/html-alerts)：产品经理改了措辞之后，测试面向用户的消息。
- [生成的客服回复](./examples/generated-replies)：测试关键词检查发现不了的承诺。
- [核心断言](./reference/core)：批量发送陈述、轮询变化中的状态，并排查失败。
