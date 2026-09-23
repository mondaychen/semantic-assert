---
title: 简介
description: 用自然语言写下陈述，让模型当裁判，断言生成的回复和 HTML 页面的含义。
---

# 测试产品的思路，而不是具体实现。 {#test-what-your-app-means}

<ExpandableImage
  src="/comic-exact-match.webp"
  alt="一幅题为“精确匹配”的四格漫画。一位开发者写了个测试，检查提示框的精确文本，心想只要有人动文案，它马上就会挂。两周后，产品经理把错误信息改得更友好了，测试果然失败。开发者把新字符串粘了进去。又过了一周，产品经理把文案改了回来，问测试是不是又挂了。开发者说没有，他们找到了更好的测试方法，屏幕上是一条通过的断言：提示框告诉用户如何恢复。"
/>

**semantic-assert**（意为“语义化的断言”）让你直接断言需求本身。照着产品文档的说法写下陈述，交给一个充当裁判的模型，让你的测试不再依赖 HTML 标签和其中的文字。靠着最新的 Jev 模型，这个过程飞快、可靠，而且便宜得像是免费的。

```ts
const alert = page.getByRole("alert");
await alert.waitFor({ state: "visible" });
await judge.expectPageTo("The alert explains how to recover from the error", {
  region: alert,
});
```

这是 [Playwright fixture](./reference/playwright#fixture) 的写法。对于 API 响应和其他 JSON，使用与框架无关的[核心裁判](./reference/core)。

## 从你多半遇到过的问题开始 {#start-with-a-problem-you-ve-probably-hit}

<div class="example-links">
  <a href="./examples/html-alerts.html">
    <strong>产品经理改了个文案……然后 CI 就挂了。 →</strong>
    <span>文案怎么改，都要确认提示框说明了失败原因和恢复步骤。</span>
  </a>
  <a href="./examples/generated-replies.html">
    <strong>机器人刚承诺了退款？CI 怎么还通过了…… →</strong>
    <span>即使回复里从没出现“退款”二字，也能抓住不该做的承诺。</span>
  </a>
  <a href="./examples/page-coherence.html">
    <strong>路由变了，标签页标题却没变……测试还全是绿的。 →</strong>
    <span>确认标题、面包屑和页面标题彼此一致，即使页面名称来自用户随手输入的内容。</span>
  </a>
</div>

或者看看这些：

- [零条结果……还是其实还没加载完？](./examples/search-states) 零行数据可能意味着没有结果、请求还在路上，或者出错了。
- [高亮是加上了……可位置不对。](./examples/highlights) 样式是有了，却挂在了错误的文字上。
- [回答里确实写了“30 天”……可建议还是错的。](./examples/grounded-answers) 关键词对了，结论错了。

## 工作原理 {#how-it-works}

每条语义断言都遵循同样的三步：

1. **捕获状态。** 从你的应用返回 JSON，或者让 Playwright 适配器给页面拍个快照。
2. **写下陈述。** 描述用户应该能从这个状态中看出什么。相关的陈述放在同一个请求里发送。
3. **断言结果。** 裁判把返回的概率和你的阈值比较，某条陈述没过线，测试就失败。

### 谁来当裁判？ {#who-s-the-judge}

默认是 [Jev](https://typesafe.ai)，TypeSafe 的第一个[System One 模型](https://docs.typesafe.ai/concepts/system-one)。Jev 不生成文本。你给它状态和一个是非题或选择题，它返回一个带类型的答案，并且提供可靠的信心值（我们用这个值和阈值比较，来判断测试是否通过）。任何 `Provider` 实现都可以替代它，参见 [provider](./reference/providers)。

## 语义断言适合用在哪里 {#where-semantic-assertions-fit}

| 用语义断言检查                 | 用普通断言检查             |
| ------------------------------ | -------------------------- |
| 错误信息是否给出了具体恢复步骤 | 提示框是否可见             |
| 回复是否承诺了退款             | 精确的订单 ID 和状态码     |
| 回复是否回答了客户的问题       | 数量、总额和算术           |
| 高亮段落是否支持某个陈述       | 精确的 CSS 值和 class 名称 |

::: warning 模型的判断是概率性的
你可以在自己的应用里测试一遍，再决定具体针对不同场景用什么样的阈值。
:::

## 开始使用 {#get-started}

跟着[快速开始](./getting-started)跑通一个检查，然后为 HTML 和浏览器测试加上[Playwright 适配器](./reference/playwright)。
