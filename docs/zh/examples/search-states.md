---
title: 加载中与空状态
description: 区分有用的空搜索状态与加载中或失败状态，而不是把零行结果当作成功。
---

# 加载中与空状态 {#loading-vs-empty-states}

<p class="page-hook">零条结果……还是其实还没加载完？</p>

新账号还没有任何项目。你的测试检查结果是否为零行，结果在搜索还没加载完时就通过了。搜索出错之后，同一条断言也照样通过。

## 改造前：从空容器推断含义 {#before-infer-meaning-from-an-empty-container}

```ts
const results = page.getByRole("main", { name: "Search results" });
await expect(results.getByRole("listitem")).toHaveCount(0);
```

零行是一个精确的事实。但它不能告诉你搜索已经完成，也不能告诉你用户知道下一步该做什么。

## 改造后：给状态命名，再问现在是哪一个 {#after-name-the-states-and-ask-which-one-this-is}

使用 [Playwright judge fixture](../reference/playwright#fixture) 提供的 `classifyPage`对捕获的区域进行分类。这个场景期望的是空状态：

```ts
const result = await judge.classifyPage(
  "What is the search results state?",
  {
    loading: "The search is in progress.",
    results: "The page lists matching projects.",
    empty: "No projects match and the page suggests what to do next.",
    error: "The search failed with an error.",
  },
  {
    region: page.getByRole("main", { name: "Search results" }),
    settled: ["results", "empty"],
    timeoutMs: 10_000,
  },
);

expect(result.choice).toBe("empty");
expect(result.confidence).toBeGreaterThanOrEqual(0.8);
```

设置正数的 `timeoutMs` 后，只要答案不在 `settled` 之内，裁判就会重新捕获页面，所以`loading` 会让它继续轮询。一旦落到某个稳定状态，就由你的断言来判断这个状态是不是本测试想要的。

::: warning 陷阱
超时后，`classifyPage` 会返回最后一次的答案，即使这个答案是 `loading` 或 `error`。单独调用分类器永远不会让测试失败。保留显式的 choice 和 confidence 检查。
:::

## 行数相同，结果不同 {#same-row-count-different-outcomes}

| 页面内容                                               | 本测试的预期结果                 |
| ------------------------------------------------------ | -------------------------------- |
| “正在搜索项目……”                                       | 继续轮询；如果一直不稳定则失败。 |
| “没有找到项目。换个关键词试试，或创建你的第一个项目。” | 接受：这是有用的空状态。         |
| “暂时没有匹配项。修改搜索词后再试一次。”               | 接受：文案变了也没关系。         |
| “无法搜索你的项目。请重试。”                           | 拒绝：如果错误一直存在。         |
| 一个匹配项目的列表                                     | 拒绝：这个场景期望的是空账号。   |

choice 的置信度取决于 provider。用已知状态检验你的阈值，包括空白区域和渲染到一半的页面。含义模糊的内容可能被分错类。

## 运行现有的搜索测试 {#run-the-existing-search-test}

先[设置好仓库里的示例](https://github.com/mondaychen/semantic-assert/blob/main/examples/README.md)，然后运行：

```sh
pnpm --filter semantic-assert-examples test:playwright classification.spec.ts
```

这个[可运行的测试](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/classification.spec.ts)会让本地 HTML 从加载中切换到带引导的空状态，默认的假 provider 会按脚本返回这些答案。想要真实的判断，在 `.env` 中配置 `AI_GATEWAY_API_KEY` 后运行：

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts classification.spec.ts
```

::: tip 什么时候不该用分类
轮询可能会向 provider 发出多次请求。如果你的应用暴露了可靠的状态字段或精确的空状态标记，对它做一条普通断言更便宜，效果也一样好。需要在文案不断变化的情况下理解渲染出来的消息时，再用分类。
:::
