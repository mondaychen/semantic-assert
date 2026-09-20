import { defineConfig } from "vitepress";

export default defineConfig({
  title: "semantic-assert",
  description:
    "Test what your app means. Semantic assertions for JSON, generated responses, and Playwright pages.",
  lang: "en-US",
  base: "/semantic-assert/",
  appearance: false,
  lastUpdated: false,
  sitemap: { hostname: "https://mengdi.dev/semantic-assert/" },
  head: [["meta", { name: "theme-color", content: "#42b983" }]],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Examples", link: "/examples/html-alerts" },
      { text: "GitHub ↗", link: "https://github.com/mondaychen/semantic-assert" },
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
        text: "Before & after",
        items: [
          { text: "HTML alerts & copy changes", link: "/examples/html-alerts" },
          { text: "Generated support replies", link: "/examples/generated-replies" },
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
