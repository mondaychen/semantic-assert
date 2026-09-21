import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import ExpandableImage from "./components/ExpandableImage.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ExpandableImage", ExpandableImage);
  },
} satisfies Theme;
