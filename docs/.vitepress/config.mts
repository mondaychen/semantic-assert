import { defineConfig, type DefaultTheme } from "vitepress";

const editLinkPattern = "https://github.com/mondaychen/semantic-assert/edit/main/docs/:path";
const github = "https://github.com/mondaychen/semantic-assert";

const enSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: "Start here",
    items: [
      { text: "Introduction", link: "/" },
      { text: "Quick start", link: "/getting-started" },
    ],
  },
  {
    text: "Examples",
    items: [
      { text: "HTML alerts & copy changes", link: "/examples/html-alerts" },
      { text: "Page coherence after navigation", link: "/examples/page-coherence" },
      { text: "BDD scenarios with playwright-bdd", link: "/examples/bdd" },
      { text: "Generated support replies", link: "/examples/generated-replies" },
      { text: "Checkout confirmations", link: "/examples/checkout" },
      { text: "Loading vs. empty states", link: "/examples/search-states" },
      { text: "Highlighted passages", link: "/examples/highlights" },
      { text: "Answers grounded in a policy", link: "/examples/grounded-answers" },
    ],
  },
  {
    text: "Reference",
    items: [
      { text: "Core assertions", link: "/reference/core" },
      { text: "Playwright", link: "/reference/playwright" },
      { text: "Providers & configuration", link: "/reference/providers" },
    ],
  },
];

const zhSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: "从这里开始",
    items: [
      { text: "简介", link: "/zh/" },
      { text: "快速开始", link: "/zh/getting-started" },
    ],
  },
  {
    text: "示例",
    items: [
      { text: "HTML 提示与文案修改", link: "/zh/examples/html-alerts" },
      { text: "导航后的页面一致性", link: "/zh/examples/page-coherence" },
      { text: "用 playwright-bdd 编写 BDD 场景", link: "/zh/examples/bdd" },
      { text: "生成的客服回复", link: "/zh/examples/generated-replies" },
      { text: "结账确认", link: "/zh/examples/checkout" },
      { text: "加载中与空状态", link: "/zh/examples/search-states" },
      { text: "高亮段落", link: "/zh/examples/highlights" },
      { text: "基于政策的回答", link: "/zh/examples/grounded-answers" },
    ],
  },
  {
    text: "参考",
    items: [
      { text: "核心断言", link: "/zh/reference/core" },
      { text: "Playwright", link: "/zh/reference/playwright" },
      { text: "Provider 与配置", link: "/zh/reference/providers" },
    ],
  },
];

export default defineConfig({
  title: "semantic-assert",
  base: "/",
  // Contributor notes, not site pages.
  srcExclude: ["STYLE.md", "CLAUDE.md"],
  appearance: false,
  lastUpdated: false,
  sitemap: { hostname: "https://semantic-assert.js.org/" },
  head: [
    ["meta", { name: "theme-color", content: "#42b983" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
  ],
  themeConfig: {
    logo: "/logo.svg",
  },
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      description:
        "Test what your app means. Semantic assertions for JSON, generated responses, and Playwright pages.",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/getting-started" },
          { text: "Examples", link: "/examples/html-alerts" },
          { text: "GitHub", link: github },
        ],
        sidebar: enSidebar,
        outline: { level: [2, 3], label: "On this page" },
        editLink: { pattern: editLinkPattern, text: "Edit this page on GitHub" },
        docFooter: { prev: "Previous", next: "Next" },
      },
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      description: "需求怎么写，测试就怎么写。为 JSON、生成的回复和 Playwright 页面提供语义断言。",
      themeConfig: {
        nav: [
          { text: "指南", link: "/zh/getting-started" },
          { text: "示例", link: "/zh/examples/html-alerts" },
          { text: "GitHub", link: github },
        ],
        sidebar: zhSidebar,
        outline: { level: [2, 3], label: "本页内容" },
        editLink: { pattern: editLinkPattern, text: "在 GitHub 上编辑此页" },
        docFooter: { prev: "上一页", next: "下一页" },
        langMenuLabel: "切换语言",
        returnToTopLabel: "回到顶部",
        sidebarMenuLabel: "菜单",
        notFound: {
          title: "页面未找到",
          quote: "这个页面不存在，或者已经移走了。",
          linkLabel: "返回首页",
          linkText: "返回首页",
        },
      },
    },
  },
});
