---
title: 导航后的页面一致性
description: 检查页面的文档标题、面包屑和标题是否描述的是同一件事，即使这件事的名字来自用户输入。
---

# 导航后的页面一致性 {#page-coherence-after-navigation}

<p class="page-hook">路由变了，标签页标题却没变……测试还全是绿的。</p>

用户创建了一个项目，名字随便起。你的应用跳转到新项目的页面，并根据这个名字生成标题、面包屑和页面标题。只是路由忘了更新文档标题，于是标签页上还写着“New project”。

```html
<!-- After creating "q3 launch plan" in a router that forgets the title -->
<title>New project · Acme Projects</title>
<nav aria-label="Main">
  <a href="/">Home</a>
  <a href="/projects" aria-current="page">Projects</a>
  <a href="/docs">Docs</a>
</nav>
<main>
  <nav aria-label="Breadcrumb">Projects › Q3 Launch Plan</nav>
  <h1>Q3 Launch Plan</h1>
  <p>No tasks yet. Add the first task to get started.</p>
</main>
```

## 改造前：要么预测标题，要么整页什么都不查 {#before-predict-the-title-or-check-nothing-across-the-page}

你知道用户输入了什么，但不知道应用会怎么渲染它。标题会加后缀，名字会被去掉首尾空格并转成首字母大写，面包屑还有自己的格式。要断言精确字符串，测试就得把这些全部重新实现一遍：

```ts
const name = "  q3 launch plan  ";
const rendered = name.trim().replace(/\b\w/g, (c) => c.toUpperCase());

await expect(page).toHaveTitle(`${rendered} · Acme Projects`);
await expect(page.getByRole("heading", { level: 1 })).toHaveText(rendered);
await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(
  `Projects › ${rendered}`,
);
```

现在测试复刻了应用的格式化代码，设计师一改标题格式或面包屑分隔符，它就会挂。而且这三条断言都没有说出真正重要的事：这三处彼此一致。

## 改造后：断言它们一致，并以输入为锚点 {#after-assert-the-agreement-and-anchor-it-to-the-input}

借助 [Playwright 裁判 fixture](../reference/playwright#fixture)，把主区域和用户输入的原始内容交给裁判：

```ts
const name = "  q3 launch plan  ";
await page.getByLabel("Project name").fill(name);
await page.getByRole("button", { name: "Create project" }).click();

await judge.expectPage(
  [
    {
      claim:
        "The document title, the breadcrumb, and the main heading all refer to the same project",
    },
    { claim: "The page is about the project the user named in `project_name_entered`" },
  ],
  { region: page.getByRole("main"), extraState: { project_name_entered: name } },
);
```

第一条陈述根本没有期望值。它问的是页面自身是否一致，而这恰恰是字符串检查做不到的。第二条把页面和用户的输入对应起来，把应用的去空格、大小写和后缀处理交给模型。就算设计师明天改了标题格式，两条陈述依然成立。

每条陈述只描述一种关系，所以失败时你能知道是哪个信号过时了。捕获范围限定在 `main`，请求因此保持精简。文档标题本来就包含在每次捕获的页面状态里，`extraState` 则以陈述可以引用的名字加入原始输入。

::: details 深入了解：当名字甚至不是你输入的
上面的测试知道输入是什么，因为是它自己输入的。测试不知道输入时，同样的陈述照样可用。从 fixture 预置项目，从数据库或 API 响应里读回名字，再通过 `extraState` 传进去。或者干脆去掉第二条陈述，只保留一致性检查，它不需要任何来源的期望值。
:::

## 在测试集中保留真实的回归用例 {#keep-a-real-regression-in-the-test-set}

| 创建“q3 launch plan”后的页面状态             | 预期结果 | 原因                                             |
| -------------------------------------------- | -------- | ------------------------------------------------ |
| 标题、面包屑和页面标题都显示“Q3 Launch Plan” | 接受     | 每个信号都指向用户创建的项目。                   |
| 标题格式改成了“Acme · Q3 Launch Plan”        | 接受     | 格式不同，项目相同。                             |
| 标题仍然显示“New project”                    | 拒绝     | 一致性陈述失败，输入陈述仍然通过。               |
| 页面标题显示的是另一个项目的名字             | 拒绝     | 两条陈述都失败：页面讲的不是用户输入的那个项目。 |

[可运行的测试](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/page-coherence.spec.ts)把应用渲染成本地 HTML，带一个表单和一个由点击驱动的路由。一个测试用的路由会更新所有内容。另一个测试用的路由会忘记更新标题，并检查只有一致性陈述失败，这样失败就直接指向 bug。

## 运行示例 {#run-the-example}

在仓库的检出目录中运行：

```sh
pnpm install
pnpm build
pnpm exec playwright install chromium
pnpm --filter semantic-assert-examples test:playwright page-coherence.spec.ts
```

默认 provider 返回预设的分数。要得到真实的判断，把 `AI_GATEWAY_API_KEY` 写进 `.env`，然后运行：

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts page-coherence.spec.ts
```

两个测试都只评估一次，每次在一个请求里评估两条陈述。

## 使用你自己应用的页面 {#use-your-application-s-page}

把 `page.setContent(...)` 换成 `page.goto(...)` 和你真实的表单。这样捕获的状态会包含真实的 URL，又多了一个供模型比对的信号。精确检查（比如 URL 里包含新项目的 ID）仍然放在普通的 Playwright 断言里。如果你的布局把面包屑或页面的 `<h1>` 放在 `main` 之外，就相应扩大区域。
