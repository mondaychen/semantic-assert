---
title: 用 playwright-bdd 编写 BDD 场景
description: 用 playwright-bdd 把 Gherkin 步骤变成语义陈述，让 feature 文件陈述需求，步骤定义不再比对字符串。
---

# 用 playwright-bdd 编写 BDD 场景 {#bdd-scenarios-with-playwright-bdd}

<p class="page-hook">Gherkin 写得跟产品文档一样……可步骤里还是在比对字符串。</p>

行为驱动开发承诺过，场景要写到产品经理能看懂、能签字确认。结果步骤定义一来，想让步骤通过，唯一的办法就是把精确的文案写进去。

## 改造前：文案写在 feature 文件里 {#before-the-copy-lives-in-the-feature-file}

```gherkin
Scenario: A failed save is explained
  Given the editor failed to save the user's changes
  Then I should see the message "We couldn't save your changes. Try again."
```

```ts
Then("I should see the message {string}", async ({ page }, text: string) => {
  await expect(page.getByRole("alert")).toHaveText(text);
});
```

现在产品经理改一次文案，就得改一次 feature 文件。场景完全没说明这个提示是干什么用的，而且 “I should see” 描述的是实现，不是行为。这个场景读起来像一张截图，而不是一条需求。

## 改造后：步骤就是陈述 {#after-the-step-is-the-claim}

用 judge fixture 扩展 playwright-bdd 的 `test`，方式和扩展 Playwright 的一样：

```ts
// steps/fixtures.ts
import { createBdd, test as base } from "playwright-bdd";
import {
  judgeFixtures,
  type JudgeFixtures,
  type JudgeFixtureOptions,
} from "semantic-assert-playwright";
import { typesafe } from "semantic-assert-typesafe";

export const test = base.extend<JudgeFixtures & JudgeFixtureOptions>({
  ...judgeFixtures,
  judgeProvider: [typesafe(), { option: true }],
});

export const { Given, When, Then } = createBdd(test);
```

然后按需求的写法来写场景，让一个步骤定义把每一行 `Then the alert ...` 都变成一条陈述：

```gherkin
Scenario: A failed save tells the user what happened and what to do
  Given the editor failed to save the user's changes
  Then the alert tells the user their changes were not saved
  And the alert tells the user how to recover
```

```ts
// steps/alert.steps.ts
Then(/^the alert (.+)$/, async ({ page, judge }, requirement: string) => {
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await judge.expectPageTo(`The alert ${requirement}`, { region: alert });
});
```

Gherkin 文本就是陈述。新需求就是 feature 文件里的一行新内容，不需要新的步骤定义，改文案则两边都不用动。可见性仍然交给普通的 Playwright 断言，捕获范围限定在提示上，这样页面其他地方的帮助文字就没法替提示补上它缺失的信息。

::: tip 一个步骤，任意条陈述
整个技巧就在这个正则步骤上。产品经理能写出的每一句 `Then the alert ...`，都会变成一条语义断言，不需要额外代码。前缀要具体，这里是 “the alert”，这样模型知道陈述针对的是什么，步骤也能把捕获范围限定到它上面。
:::

## 把真实的回归用例留在 feature 文件里 {#keep-a-real-regression-in-the-feature-file}

Gherkin 让校准集成为规格的一部分。对于不能通过的场景，使用 playwright-bdd 的 `@fail` 标签：

```gherkin
Scenario: A reworded alert still meets the requirement
  Given the editor shows the alert "Your changes haven't been saved. Please give it another try."
  Then the alert tells the user their changes were not saved
  And the alert tells the user how to recover

@fail
Scenario: A vague alert does not meet the requirement
  Given the editor shows the alert "Something went wrong."
  Then the alert tells the user how to recover
```

| 场景                                          | 预期结果                  | 原因                                 |
| --------------------------------------------- | ------------------------- | ------------------------------------ |
| A failed save tells the user what happened... | 通过                      | 原始文案满足两条陈述。               |
| A reworded alert still meets the requirement  | 通过                      | 措辞不同，信息相同。                 |
| A vague alert does not meet the requirement   | 失败，符合 `@fail` 的预期 | 没有任何内容告诉用户下一步该做什么。 |

::: warning 陷阱
`@fail` 的意思是“这个场景预期会失败”。如果有人改好了含糊的文案却没删掉标签，运行会因为相反的原因变红。这正是目的所在：标签记录了一次有意的拒绝，Playwright 会让你对它负责。
:::

## 运行示例 {#run-the-example}

在仓库的检出目录中运行：

```sh
pnpm install
pnpm build
pnpm exec playwright install chromium
pnpm --filter semantic-assert-examples test:bdd
```

`test:bdd` 会先运行 `bddgen`，从 feature 文件生成 spec，再用专门的 Playwright 配置运行它们。默认 provider 是一个根据提示文案返回结果的假 provider，所以三个场景不需要 API key 就能得到确定的结果。它并不理解文本。要获得真实的判断，把 `AI_GATEWAY_API_KEY` 写进 `.env`，然后运行：

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env examples/node_modules/playwright-bdd/dist/cli/index.js -c examples/playwright-bdd.config.ts
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright-bdd.config.ts
```

每个 `Then` 步骤是一次评估、一条陈述，所以三个场景共发出五个请求。用量报告器按 Feature 分组，测试套件里场景很多时，你会需要这种分组。

[feature 文件](https://github.com/mondaychen/semantic-assert/blob/main/examples/bdd/features/saving-changes.feature)、[步骤定义](https://github.com/mondaychen/semantic-assert/blob/main/examples/bdd/steps/alert.steps.ts)和 [fixture](https://github.com/mondaychen/semantic-assert/blob/main/examples/bdd/steps/fixtures.ts) 都在仓库中。

## 在你的测试套件中使用 {#use-it-in-your-suite}

保留现有的 `Given` 和 `When` 步骤。它们负责驱动应用，这一点不变。把引用文案的 `Then` 步骤换成陈述需求的步骤，并给每个步骤一个点明主语的正则：`the alert`、`the confirmation`、`the reply`。如果一个场景里有多行 `Then` 针对同一个区域，而你想只发一次请求而不是每行一次，就把相关的陈述合并到一次 `expectPage` 调用中。
