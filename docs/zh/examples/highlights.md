---
title: 高亮段落
description: 检查高亮的是相关段落、划掉的是过时的指引，而不只是找到一个带样式的元素。
---

# 高亮段落 {#highlighted-passages}

<p class="page-hook">高亮是加上了……可位置不对。</p>

你的文档查看器会高亮一段被引用的政策，并把过时的指引划掉。即使装饰落在了无关的文字上，样式检查也照样通过。

## 改造前：检查装饰是否存在 {#before-check-that-decoration-exists}

```ts
const policy = page.getByRole("article", { name: "Return policy" });

await expect(policy.locator("mark")).toHaveCount(1);
await expect(policy.locator("s")).toHaveCount(1);
```

如果高亮的是标题，而当前的退货政策被误划掉了，这两条断言都会通过。它们验证的是标记存在，而不是标记作用在哪条信息上。

## 改造后：把样式和内容联系起来 {#after-connect-the-styling-to-the-content}

借助 [Playwright judge fixture](../reference/playwright#fixture)，打开 `visualHints`，并描述哪段文字应该带哪种样式：

```ts
const policy = page.getByRole("article", { name: "Return policy" });
await policy.waitFor({ state: "visible" });

await judge.expectPage(
  [
    { claim: "The passage about the return window has a highlighted background" },
    { claim: "The instruction to request returns by phone is struck through" },
    { claim: "The return window passage is struck through", expected: false },
  ],
  {
    region: policy,
    visualHints: { dataAttributes: ["data-highlight-kind"] },
  },
);
```

这些陈述描述的是下面这份文档：

```html
<article aria-label="Return policy">
  <h1>Return policy</h1>
  <p>
    <mark data-highlight-kind="citation">Unopened items can be returned within 30 days.</mark>
  </p>
  <p><s>Returns must be requested by phone.</s> Start your return from your account.</p>
</article>
```

`visualHints` 会加入关于背景、强调、删除线以及你指定的 data 属性的文本观察，这样模型就能把样式和段落的含义联系起来。仅靠无障碍快照描述不了这些。

## 换了样式，含义不变 {#preserve-the-meaning-across-restyling}

| 改动                                                        | 预期结果                         |
| ----------------------------------------------------------- | -------------------------------- |
| 把退货期限的高亮从黄色改成蓝色。                            | 接受：陈述不要求特定颜色。       |
| 把过时的指引改写成“Call us to arrange a return”，仍然划掉。 | 接受：标记的仍是同一条过时指引。 |
| 高亮标题，而不是退货期限那段。                              | 拒绝：要求的段落没有被高亮。     |
| 划掉当前的退货期限。                                        | 拒绝：否定陈述抓住了这个矛盾。   |

::: warning 陷阱
视觉提示是文本观察，不是截图分析。它们无法确认像素级的布局、颜色对比度或精确的 CSS 值。如果需求就是某个精确的样式，在语义断言旁边保留一条普通的 `toHaveCSS` 或 `toHaveClass` 断言。
:::

## 运行现有的文档测试 {#run-the-existing-document-test}

先[设置好仓库里的示例](https://github.com/mondaychen/semantic-assert/blob/main/examples/README.md)，然后运行：

```sh
pnpm --filter semantic-assert-examples test:playwright visual-matchers.spec.ts
```

这个[可运行的测试](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/visual-matchers.spec.ts)用等价的 `toSatisfyAll` matcher 检查这份文档。它默认的 provider 返回脚本化的分数。想要真实的判断，在 `.env` 中配置 `AI_GATEWAY_API_KEY` 后运行：

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts visual-matchers.spec.ts
```

可运行的测试只覆盖样式正确的文档。表格里给了你额外的校准用例。
