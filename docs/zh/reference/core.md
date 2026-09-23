---
title: 核心断言
description: 捕获 JSON、批量发送陈述、配置阈值与轮询，并排查语义断言的失败。
---

# 核心断言 {#core-assertions}

`semantic-assert` 包就是裁判本身。它对浏览器、测试运行器和模型厂商一无所知，也没有任何运行时依赖。你给它一个能回答问题的 provider，它负责阈值、轮询和指标。

::: info 你将学到

- 如何创建裁判并对 JSON 断言陈述
- 否定陈述和单条陈述阈值如何工作
- 如何写出模型容易评判的陈述
- 何时以及如何轮询变化中的状态
- 如何把状态归类到命名选项
- 失败时你能拿到哪些信息

:::

## 创建裁判 {#create-a-judge}

把一个 provider 和一组设置配在一起：

```ts
import { Judge, resolveJudgeSettings } from "semantic-assert";
import { typesafe } from "semantic-assert-typesafe";

const judge = new Judge({
  provider: typesafe(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});
```

`resolveJudgeSettings` 会把你的覆盖项叠加在环境变量和内置默认值之上。完整列表见[Provider 与配置](./providers#judge-settings)。

## 断言陈述 {#assert-claims}

调用 `expectClaims`，传入一个返回待评判状态的函数，以及一组关于该状态的陈述：

```ts
await judge.expectClaims(
  async () => ({ message: "The file is too large. Choose a smaller file and try again." }),
  [
    { claim: "The message explains why the upload failed" },
    { claim: "The message tells the user how to recover" },
  ],
);
```

同一次调用里的所有陈述共享同一份捕获的状态和同一个 provider 请求，所以把相关陈述放在一起，花费和只问一条一样。所有陈述都通过时调用正常返回，否则抛出 `SemanticAssertionError`。

默认情况下只评估一次（`timeoutMs: 0`）。正数超时会开启重复捕获和评估，直到所有陈述通过或时间耗尽。

### 否定陈述 {#negative-claims}

当陈述描述的是一件绝不能成立的事，设置 `expected: false`：

```ts
{ claim: "The reply promises a refund", expected: false, threshold: 0.9 }
```

阈值为 `0.9` 时，肯定陈述需要概率至少为 `0.9`。否定陈述需要概率至多为 `1 - 0.9`，也就是 `0.1`。

::: warning 陷阱
肯定陈述得分低，并不能有力地证明它的反面。如果你需要模型确认某样东西不存在，就把它写成否定陈述，而不是把一条失败的肯定陈述反过来解读。
:::

### 写出模型能评判的陈述 {#write-claims-the-model-can-judge}

- **点明主语。** “提示框请用户重试”胜过“它请用户重试”。
- **一条陈述只写一个条件。** 陈述失败时，你能准确知道缺的是哪种行为。
- **把上下文放进状态。** 如果陈述提到了客户的问题，就把问题和回复一起捕获。
- **精确事实交给代码。** 字符串、ID、数量和算术属于普通断言。

## 轮询变化中的状态 {#poll-changing-state}

在回调里捕获状态，让每次轮询看到的都是当前状态，并设置一个正数 `timeoutMs`：

```ts
await judge.expectClaims(
  async () => {
    const response = await fetch("http://localhost:3000/jobs/1042");
    return response.json();
  },
  [{ claim: "The export completed and a download is available" }],
  { timeoutMs: 10_000, pollIntervalMs: 500 },
);
```

裁判会重新捕获并重新评估，直到所有陈述通过或到达截止时间。每次轮询是一次 provider 请求。

当状态还无法捕获时，在回调里抛出 `NotReadyError`。开启轮询时，裁判会等一会儿再试。在默认的零超时下，这个错误会直接抛给你，不会调用模型。

::: details 深入了解：捕获上下文
你的回调会收到一个上下文对象。轮询期间，它的 `pollingDeadline` 是轮询停止时的 epoch 时间。需要等待自身目标的捕获（比如 locator）可以用它给等待设上限，保证不会比断言本身撑得更久。Playwright 适配器就用它来控制区域等待。
:::

::: warning 陷阱
`timeoutMs` 限制的是轮询，不是单个 provider 请求。已经发出的请求会按 provider 自己的超时和重试设置完成，所以它可能在轮询截止时间之后才结束。配置好 provider 的请求超时和重试次数，并给测试运行器留出足够的时间容纳两者。
:::

## 对状态分类 {#classify-state}

当问题是“它是这几种中的哪一种？”而不是“这是真的吗？”时，使用 `classify`：

```ts
const result = await judge.classify(
  async () => ({ message: "No projects yet. Create your first project." }),
  "Which state does the message describe?",
  {
    loading: "Projects are still loading.",
    empty: "There are no projects and the user can create one.",
    listed: "Existing projects are listed.",
  },
  { settled: ["empty", "listed"] },
);
```

`classify` 默认只评估一次，返回选中的选项及其置信度。设置正数 `timeoutMs` 时，`settled` 列出能结束轮询的选项：答案是 `loading` 时裁判会继续重新捕获，一旦看到 `empty` 或 `listed` 就停下。

::: warning 陷阱
`classify` 自己从不让测试失败。在默认的零超时下，即使第一个答案还没稳定，它也会直接返回；开启轮询时，超时后它返回最后一个答案。务必自己断言 `result.choice` 以及任何置信度要求。
:::

## 失败证据与用量 {#failure-evidence-and-usage}

陈述没通过时，`SemanticAssertionError.results` 会列出每条陈述的期望、概率、阈值以及通过与否。创建裁判时传入一个 `hooks.attach` 函数，就能把这些证据收进你的测试报告。Playwright fixture 已经帮你接好了。

随时读取用量：

```ts
console.log(judge.metrics.totals);
```

指标包括调用次数、问题数、输入和输出 token，以及等待 provider 花费的时间。成本是根据你在 provider 上配置的费率估算的，在你设置费率之前一直是未知。

## 回顾 {#recap}

- `expectClaims` 把关于同一份捕获状态的陈述合并进一个请求，有陈述没过就抛错。
- 否定陈述需要 `expected: false`，失败的肯定陈述不等于否定陈述。
- 轮询需要通过正数 `timeoutMs` 主动开启。还没有可评判的内容时，抛出 `NotReadyError`。
- `classify` 只返回答案，对不对由你判断。
- 失败会带上每条陈述的结果，指标记录每次评判的花费。

关于 provider 接口，以及返回原始答案、不带验收策略的 `evaluate`，请参见[源码参考](https://github.com/mondaychen/semantic-assert/tree/main/packages/semantic-assert)。
