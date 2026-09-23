---
title: Playwright
description: 配置 Playwright 的 judge fixture，限定页面捕获范围，脱敏敏感数据，并附上断言证据。
---

# Playwright {#playwright}

适配器捕获的是屏幕阅读器能看到的内容：可访问性快照、URL 和标题。你的陈述会基于这些文本来判断，而不是原始 HTML 或截图。这样判断结果始终锚定在用户真正能分辨的信息上。

::: info 你将学到

- 如何在测试中加入 `judge` fixture
- 为什么裁判只评估一次，以及何时该等待或轮询
- 如何把捕获范围限定到一个区域
- 如何使用 `expect` matcher
- 如何在数据离开浏览器之前脱敏
- 如何测试视觉样式并读懂证据报告

:::

## 安装 {#install}

```sh
pnpm add -D @playwright/test semantic-assert semantic-assert-playwright semantic-assert-typesafe
pnpm exec playwright install chromium
export TYPESAFE_API_KEY="your-api-key"
```

适配器需要 `@playwright/test >=1.50.0` 和 Node.js 22 或更高版本。

## Fixture {#fixture}

在 `fixtures.ts` 中用 judge fixture 扩展 Playwright 的 `test`：

```ts
import { test as base } from "@playwright/test";
import {
  judgeFixtures,
  type JudgeFixtures,
  type JudgeFixtureOptions,
} from "semantic-assert-playwright";
import { typesafe } from "semantic-assert-typesafe";

export const test = base.extend<JudgeFixtures & JudgeFixtureOptions>({
  ...judgeFixtures,
  judgeProvider: [typesafe({ timeoutMs: 10_000, maxRetries: 0 }), { option: true }],
});

test.use({ judgeOptions: { threshold: 0.8 } });
export { expect } from "@playwright/test";
```

::: warning 陷阱
provider 对象应该放在构建 `test` 的地方，如上所示。不要把它放进 Playwright 配置的 `use` 块。这个块会被序列化后传给 worker，provider 实例经不起这一趟传输。`judgeOptions` 是纯数据，放哪儿都行。
:::

然后像使用其他 fixture 一样使用 `judge`，这里写在 `alert.spec.ts` 中：

```ts
import { test, expect } from "./fixtures";

test("an alert explains how to recover", async ({ page, judge }) => {
  await page.setContent(`
    <p role="alert">Your changes haven't been saved. Please give it another try.</p>
  `);

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await judge.expectPageTo("The alert asks the user to try again", {
    region: alert,
  });
});
```

用 `pnpm exec playwright test` 运行。在真实测试中，把 `page.setContent` 换成页面导航和交互。

## 先等待，再只评估一次 {#wait-first-then-judge-once}

语义断言默认只评估一次（`timeoutMs: 0`）。让 Playwright 负责等待，然后再向模型询问含义：

```ts
const alert = page.getByRole("alert");
await alert.waitFor({ state: "visible" });
await judge.expectPageTo("The alert explains how to recover", { region: alert });
```

`await expect(alert).toBeVisible()` 一行代码就能完成等待并断言可见性。如果元素比最终内容先出现，还要等待你的应用进入就绪状态。

### 区域会自己等待 {#regions-wait-on-their-own}

`region` 捕获会等待其元素挂载，最长 `regionTimeoutMs`。默认是 5 秒，与 Playwright 的 `expect` 超时相同。这段等待发生在浏览器里，不会向模型发送任何内容，所以它和 `timeoutMs` 是分开的。你可以按单次调用设置，也可以在 `judgeOptions` 中为整个测试套件设置。始终没有出现的区域会以 `RegionNotFoundError` 失败。

### 主动开启轮询 {#opt-into-polling}

如果你希望裁判持续检查某些内容，把 `timeoutMs` 设为正数：

```ts
await judge.expectPageTo("The export is ready to download", {
  region: page.getByRole("status"),
  timeoutMs: 5_000,
  pollIntervalMs: 1_000,
});
```

裁判会在两次评估之间重新捕获区域，陈述一旦通过就停止。provider 的请求超时和重试需要单独配置。

## 限定捕获范围 {#scope-the-capture}

传入 `region` locator 或 CSS 选择器，只捕获相关内容：

```ts
await judge.expectPageTo("The message confirms that the purchase succeeded", {
  region: page.getByRole("region", { name: "Order confirmation" }),
});
```

限定范围有两个作用。它减少发送给模型的文本，也能防止页面上无关的内容替区域补上它本身缺失的信息。

用 `expectPage` 把多条陈述合并到一次请求中，用 `expectPageNotTo` 断言单条否定陈述。两者都支持单次调用的阈值、轮询选项和 `regionTimeoutMs`。

## Matcher 语法 {#matcher-syntax}

如果你更想直接对 locator 做断言，创建一个能感知裁判的 `expect`：

```ts
import { createJudgeExpect } from "semantic-assert-playwright";
import { typesafe } from "semantic-assert-typesafe";

const expect = createJudgeExpect({ provider: typesafe() });

await expect(page.getByRole("alert")).toSatisfy("The alert explains how to recover");

await expect(page.getByTestId("agent-panel")).toSatisfyAll([
  "The panel contains a reply to the customer's question",
  { claim: "The reply promises a refund", expected: false },
]);
```

和 Playwright 内置的 locator matcher 一样，它们会等待 locator 挂载，最长 `regionTimeoutMs`，然后只评估一次。

::: warning 陷阱
这些 matcher 不接受 `.not`。一条陈述没达到阈值，并不能证明相反的情况成立。要为否定陈述要求证据，请改用 `{ claim, expected: false }`。
:::

## 脱敏敏感数据 {#redact-sensitive-data}

你捕获的所有内容都会发送给配置的 provider。用 `redact` 钩子在请求发出之前修改状态：

```ts
await judge.expectPageTo("The error gives the user a recovery step", {
  region: page.getByRole("alert"),
  redact: (state) => ({
    ...state,
    aria_snapshot: state.aria_snapshot.replaceAll("alex@example.test", "[email redacted]"),
  }),
});
```

这个例子从快照中移除了一个已知的邮箱地址。如果你的捕获内容带有敏感信息，也要检查 URL、标题、链接、视觉提示和额外状态。

## 视觉提示 {#visual-hints}

可访问性快照不包含任何样式信息。对于涉及高亮、粗体、删除线或文字颜色的陈述，开启 `visualHints`：

```ts
await judge.expectPageTo("A passage has a highlighted background", {
  region: page.locator(".document"),
  visualHints: { dataAttributes: ["data-highlight-kind"] },
});
```

提示是从页面收集来的文本观察结果，不是截图分析。它们默认关闭，因为会多花一次评估和额外的 token。要精确检查样式，继续用 `toHaveCSS` 或 `toHaveClass`。

## 证据与报告 {#evidence-and-reporting}

fixture 会把判断证据附到 Playwright 的报告中，陈述失败时还会附上捕获的状态。在 `playwright.config.ts` 中加入用量报告器，汇总整次运行的开销：

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    [
      "semantic-assert-playwright/reporter",
      { outputFile: "test-results/semantic-assert-metrics.json" },
    ],
  ],
});
```

报告会列出调用次数、token、provider 等待时间，配置好 provider 费率后还会列出预估费用。这些设置见 [provider](./providers)。

## 回顾 {#recap}

- 把 `judgeFixtures` 加到你的 `test` 中，并在构建 `test` 的地方提供 provider。
- 让 Playwright 负责等待，然后只评估一次。区域会自己等待，最长 `regionTimeoutMs`。
- 用 `region` 限定捕获范围。既省 token，又让模型不被无关内容误导。
- matcher 像内置 matcher 一样自动等待，并且不接受 `.not`。
- 请求前先脱敏，只在涉及样式的陈述中开启 `visualHints`，加上报告器就能看到一次运行花了多少。
