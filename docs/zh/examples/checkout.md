---
title: 结账确认
description: 不只是找一句感谢语，而是检查结账页面是否确认了购买并说明了接下来会发生什么。
---

# 结账确认 {#checkout-confirmations}

<p class="page-hook">页面上写着“Thanks”……可订单到底下成功了没有？</p>

你的结账测试点击按钮，然后找到一句感谢语。即使页面从没确认购买成功，也没告诉顾客接下来会怎样，它照样通过。

## 改造前：找一个让人安心的词 {#before-look-for-a-reassuring-word}

```ts
await page.getByRole("button", { name: "Place order" }).click();
const confirmation = page.getByRole("region", { name: "Order confirmation" });

await expect(confirmation).toContainText(/thanks|thank you/i);
```

“Thanks for your patience. We're still trying to process your payment”能通过这条检查。“Order confirmed. We'll email you when it ships”反而通不过。

## 改造后：检查顾客下一步要做的决定 {#after-check-the-customer-s-next-decision}

借助 [Playwright 裁判 fixture](../reference/playwright#fixture)，把精确的标识符留在普通断言里，再描述确认信息必须告诉顾客什么：

```ts
await page.getByRole("button", { name: "Place order" }).click();
const confirmation = page.getByRole("region", { name: "Order confirmation" });

await expect(confirmation).toBeVisible();
await expect(confirmation).toContainText("#1042");
await judge.expectPage(
  [
    { claim: "The purchase was successful" },
    { claim: "The customer is told how they will hear about shipping" },
    { claim: "The customer needs to retry payment", expected: false, threshold: 0.9 },
  ],
  { region: confirmation },
);
```

这些陈述问的是：顾客掌握的信息是否足够让他停止尝试付款，安心等待发货通知。Playwright 先等待确认信息可见并包含订单号，然后裁判在一次请求里评估三条陈述。如果之后消息还在变化，就等待应用的就绪状态，或者传一个正数 `timeoutMs` 开启轮询。

## 措辞可以变，要求不变。 {#wording-can-change-the-requirement-stays}

| 确认文本                                                                         | 预期结果           | 原因                           |
| -------------------------------------------------------------------------------- | ------------------ | ------------------------------ |
| “Thanks! Order #1042 is confirmed. We'll email you when it ships.”               | 接受               | 确认了成功，并说明了发货通知。 |
| “You're all set. Order #1042 is placed. Watch your inbox for a dispatch notice.” | 接受               | 措辞不同，信息相同。           |
| “Thanks for your patience. Payment for order #1042 is still processing.”         | 若一直如此，则拒绝 | 没有确认购买成功。             |
| “Order #1042 confirmed.”                                                         | 拒绝               | 没说顾客会怎样收到发货通知。   |

::: warning 陷阱
模型判断的是页面上写了什么。它无法证明款项确实扣了，或者邮件确实发了。如果这些效果也是测试的一部分，就通过应用的 API 或测试替身来验证。
:::

## 运行现有的结账测试 {#run-the-existing-checkout-test}

[配置好仓库示例](https://github.com/mondaychen/semantic-assert/blob/main/examples/README.md)后运行：

```sh
pnpm --filter semantic-assert-examples test:playwright checkout.spec.ts --grep "checkout confirms"
```

[可运行的测试](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/checkout.spec.ts)默认使用本地 HTML 和预设分数的 provider。要评估真实文本，在 `.env` 中设置 `AI_GATEWAY_API_KEY`，然后运行：

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts checkout.spec.ts --grep "checkout confirms"
```

可运行的测试覆盖的是结账成功的情况。把上面的表格当作你的校准集，选择阈值时再加入你自己的不完整和自相矛盾的确认信息。
