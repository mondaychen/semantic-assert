---
title: HTML 提示与文案修改
description: 用语义断言替换脆弱的精确文本检查，既能接受文案修改，又能发现缺失的恢复指引。
---

# HTML 提示与文案修改 {#html-alerts-copy-changes}

<p class="page-hook">产品经理改了个文案……然后 CI 就挂了。</p>

你的提示讲的还是同一个问题、同一个恢复步骤。变的只是措辞。

```html
<!-- Before the copy edit -->
<p role="alert">We couldn't save your changes. Try again.</p>

<!-- After the copy edit -->
<p role="alert">Your changes haven't been saved. Please give it another try.</p>
```

## 改造前：把测试绑死在措辞上 {#before-couple-the-test-to-the-wording}

```ts
await expect(page.getByRole("alert")).toHaveText("We couldn't save your changes. Try again.");
```

提示告诉用户的内容完全没变，可改写后的文案还是让这条断言挂了。你可以更新期望的字符串，但下一次修改又会让它挂掉。

## 改造后：断言用户需要知道什么 {#after-assert-what-the-user-needs-to-know}

借助 [Playwright 裁判 fixture](../reference/playwright#fixture)，描述提示必须传达的两件事：

```ts
const alert = page.getByRole("alert");
await expect(alert).toBeVisible();
await judge.expectPage(
  [
    { claim: "The alert tells the user their changes were not saved" },
    { claim: "The alert asks the user to try again" },
  ],
  { region: alert },
);
```

可见性仍然交给普通的 Playwright 断言。裁判在一次请求里评估两条陈述。把捕获范围限定在 `alert` 很重要：不这么做的话，页面其他地方的恢复建议可能会替提示补上它自己缺失的信息。

## 在测试集中保留真实的回归用例 {#keep-a-real-regression-in-the-test-set}

接受不同的措辞只完成了一半工作。测试还应该拒绝丢失了用户所需信息的消息。

| 提示文本                                                       | 预期结果 | 原因                                     |
| -------------------------------------------------------------- | -------- | ---------------------------------------- |
| “We couldn't save your changes. Try again.”                    | 接受     | 说明了失败原因和恢复步骤。               |
| “Your changes haven't been saved. Please give it another try.” | 接受     | 文案修改后仍满足两项要求。               |
| “Something went wrong.”                                        | 拒绝     | 没说修改怎么样了，也没说下一步该做什么。 |

[可运行的测试](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/alert-copy.spec.ts)把每条消息渲染成本地 HTML，并特意在提示之外放了恢复建议，以说明为什么要限定捕获范围。每个页面只评估一次。

::: warning 陷阱
这些是预期结果，不是模型的保证行为。校准 provider 和阈值时，可接受的文案修改和真实的回归都要试。只见过好例子的阈值说明不了任何问题。
:::

## 运行 HTML 示例 {#run-the-html-example}

在仓库的检出目录中运行：

```sh
pnpm install
pnpm build
pnpm exec playwright install chromium
pnpm --filter semantic-assert-examples test:playwright alert-copy.spec.ts
```

默认 provider 返回预设的分数。这样不需要 API key 就能验证浏览器捕获和断言流程，但验证不了模型是否理解文本。要得到真实的判断，把 `AI_GATEWAY_API_KEY` 写进 `.env`，然后运行：

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts alert-copy.spec.ts
```

三个用例共进行三次评估，每次两条陈述，不轮询。消息不完整的用例通过捕获预期的语义断言失败而通过。

## 使用你自己应用的页面 {#use-your-application-s-page}

把 `page.setContent(...)` 换成 `page.goto(...)` 以及触发提示的操作。保留基于角色的 locator、可见性检查和陈述。

`region` 捕获最多会等待 `regionTimeoutMs`（默认 5 秒）让提示元素挂载，所以渲染晚一点本身不会让测试失败。自己用 `await expect(alert).toBeVisible()` 等待，在提示始终不出现时仍能给出更清晰的失败信息。如果提示出现后内容还在变化，就等待应用的就绪状态，或者传一个正数 `timeoutMs` 开启轮询。
