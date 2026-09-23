---
title: 生成的客服回复
description: 测试客服机器人做出的承诺，而不是维护一份禁用词列表。
---

# 生成的客服回复 {#generated-support-replies}

<p class="page-hook">机器人刚承诺了退款？CI 怎么还通过了……</p>

你的客服机器人不能在人工审核之前承诺退款。每条生成的回复措辞都不一样，这要怎么测？

## 改造前：维护禁用词 {#before-maintain-forbidden-words}

```ts
import assert from "node:assert/strict";

const reply = "We'll put the money back on your card.";
assert.doesNotMatch(reply, /refund/i); // Passes. The promise slips through.
```

模式加得越多，问题就反过来了：“I can't promise a refund until we've reviewed your case”也会被同一条检查判为失败。

## 改造后：断言规则本身 {#after-assert-the-rule}

配置好[核心裁判](../getting-started)后，把规则写成一条否定陈述：

```ts
await judge.expectClaims(
  async () => ({ reply }),
  [{ claim: "The reply promises the customer a refund", expected: false }],
);
```

由模型判断回复是否做出了承诺，包括“money back”这类换个说法的表达。陈述说明了你的要求，而不用穷举每一种说法。

::: warning 陷阱
`expected: false` 要求的是陈述为假的证据。这和一条肯定陈述失败不是一回事。如果你需要确认某个承诺不存在，就直接这么写。
:::

## 在一次请求中检查整个响应 {#check-the-whole-response-in-one-request}

精确的事实交给普通断言，再把所有基于语义的检查合并成一次调用：

```ts
import assert from "node:assert/strict";

// Replace this sample with the response returned by your API or agent.
const response = {
  status: 200,
  orderId: "ORDER-1042",
  customerMessage: "My parcel arrived damaged. What should I do?",
  reply:
    "I'm sorry your parcel arrived damaged. Please send a photo of the damage so our support team can review the next steps.",
};

assert.equal(response.status, 200);
assert.equal(response.orderId, "ORDER-1042");

await judge.expectClaims(
  async () => response,
  [
    { claim: "The reply acknowledges the customer's damaged parcel empathetically" },
    { claim: "The reply gives the customer a concrete next step" },
    { claim: "The reply promises a refund", expected: false, threshold: 0.9 },
  ],
);
```

三条陈述共用一次捕获的状态和一次 provider 请求。退款那条陈述设置了更严格的阈值，因为它最要紧。响应是固定的，所以裁判只评估一次，而不是对同样的内容反复重试。

## 运行示例 {#run-the-example}

在仓库的检出目录中，安装并构建各个包：

```sh
pnpm install
pnpm build
pnpm --filter semantic-assert-examples exec node --test dist/core/generated-response.test.js
```

默认的假 provider 返回预设的分数。要用真实模型评估内容，把 `AI_GATEWAY_API_KEY` 写进 `.env`，然后运行：

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env --test examples/dist/core/generated-response.test.js
```

阅读[完整测试](https://github.com/mondaychen/semantic-assert/blob/main/examples/core/generated-response.test.ts)，了解用量指标和共享的 provider 配置。模型的判断是概率性的，所以要同时用允许的回复和被禁止的承诺作为例子来校准。
