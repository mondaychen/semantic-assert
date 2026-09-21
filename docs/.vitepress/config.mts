import { defineConfig } from "vitepress";

export default defineConfig({
  title: "semantic-assert",
  description:
    "Test what your app means. Semantic assertions for JSON, generated responses, and Playwright pages.",
  lang: "en-US",
  base: "/semantic-assert/",
  // Contributor notes, not site pages.
  srcExclude: ["STYLE.md", "CLAUDE.md"],
  appearance: false,
  lastUpdated: false,
  sitemap: { hostname: "https://mengdi.dev/semantic-assert/" },
  head: [
    ["meta", { name: "theme-color", content: "#42b983" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/semantic-assert/logo.svg" }],
  ],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Examples", link: "/examples/html-alerts" },
      { text: "GitHub", link: "https://github.com/mondaychen/semantic-assert" },
    ],
    sidebar: [
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
    ],
    outline: { level: [2, 3], label: "On this page" },
    editLink: {
      pattern: "https://github.com/mondaychen/semantic-assert/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    docFooter: { prev: "Previous", next: "Next" },
  },
});
