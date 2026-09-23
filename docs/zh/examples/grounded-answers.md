---
title: 基于政策的回答
description: 抓住那些重复了正确关键词、却与所给政策相矛盾的生成回答。
---

# 基于政策的回答 {#answers-grounded-in-a-policy}

<p class="page-hook">回答里确实写了“30 天”……可建议还是错的。</p>

一位顾客问能不能退已经拆封的耳机。你的政策允许 30 天内退货，但前提是耳机未拆封。生成的回答可以准确引用退货期限，却仍然把退货资格说错。

## 改造前：检查回答是否提到了政策 {#before-check-that-the-answer-mentions-the-policy}

```ts
import assert from "node:assert/strict";

const policy =
  "Headphones can be returned within 30 days only if unopened. Opened headphones are not eligible for returns.";
const question = "I opened my headphones 10 days after buying them. Can I return them?";
const answer = "Yes, you can return your opened headphones within 30 days.";

assert.match(answer, /30 days/i); // Passes, despite contradicting the policy.
```

关键词检查分辨不出回答有没有正确地应用规则。精确的预期答案则有相反的问题：一个正确的改写也会失败。

## 改造后：把来源、问题和回答一起交给裁判 {#after-give-the-judge-the-source-the-question-and-the-answer}

用配置好的[核心裁判](../getting-started)把三者一起捕获，让模型评估它们之间的关系：

```ts
await judge.expectClaims(
  async () => ({ policy, question, answer }),
  [
    { claim: "The answer correctly applies the supplied policy to the customer's situation" },
    { claim: "The answer directly answers whether the customer can return the opened headphones" },
    {
      claim: "The answer invents an exception not present in the supplied policy",
      expected: false,
    },
  ],
  { threshold: 0.8 },
);
```

对上面那个回答，预期结果是断言失败。好的回答应该解释：耳机一旦拆封就不能退了，即使还在 30 天期限内。

## 抓住看似合理却没有依据的建议 {#catch-plausible-but-unsupported-advice}

| 生成的回答                                                                                       | 预期结果 | 原因                           |
| ------------------------------------------------------------------------------------------------ | -------- | ------------------------------ |
| “Because you've opened the headphones, this policy doesn't allow a return, even within 30 days.” | 接受     | 把条件应用到了顾客的情况上。   |
| “The 30-day return window covers unopened headphones only. Your opened pair isn't eligible.”     | 接受     | 正确的改写。                   |
| “Yes, you can return your opened headphones within 30 days.”                                     | 拒绝     | 忽略了未拆封这个条件。         |
| “Opened headphones are returnable if you pay a restocking fee.”                                  | 拒绝     | 编造了一个例外。               |
| “Our return window is 30 days.”                                                                  | 拒绝     | 没有回答顾客能不能退货的问题。 |

用这些预期结果来校准真实的 provider。假 provider 的脚本化分数无法告诉你任何关于回答本身的信息。

## 在检索或 agent 测试中使用 {#use-it-in-a-retrieval-or-agent-test}

把 `policy` 换成模型拿到的来源文本，把 `question` 换成测试顾客的请求，把 `answer` 换成生成的回复。

::: warning 陷阱
把来源放在捕获的状态里。如果只捕获回答，裁判就没有可以对照的东西，“correctly applies the policy”就成了瞎猜。
:::

这里检查的是回答与所给来源是否一致，而不是来源本身是否最新、是否符合事实，也不能证明检索找到了所有相关文档。检索覆盖率和精确的文档 ID 要单独测试。

同样的模式也适用于生成的摘要：把来源和摘要一起捕获，然后断言那些必须保留下来的事实。精确的价格、日期、数量以及其他确定性的值，交给代码去检查。
