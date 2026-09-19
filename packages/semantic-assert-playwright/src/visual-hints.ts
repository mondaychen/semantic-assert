// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

/**
 * Visual hints: named, non-numeric descriptions of how text elements look,
 * derived from computed styles relative to their surroundings. The aria
 * snapshot carries semantic state (`[selected]`, `[pressed]`) but nothing
 * about a highlighted background, bold or dimmed text. This layer adds that as
 * words, because models judge "yellow background" far better than
 * `rgb(255, 235, 59)`, and relative to the parent, because "differs from its
 * surroundings" is what highlighted means across themes.
 */

import type { JsonValue } from "semantic-assert";

export interface VisualHintsOptions {
  /**
   * Data attributes to report as hints, e.g. ["data-state", "data-highlight-kind"].
   * Reported as `attribute=value`.
   */
  dataAttributes?: string[];
  /** Maximum number of hinted elements to report. Default 200. */
  maxEntries?: number;
  /** Maximum characters of an element's own text to report. Default 160. */
  maxTextChars?: number;
}

export interface VisualHint {
  // Index signature keeps hints assignable to the JsonValue state.
  [key: string]: JsonValue;
  /** The element's own text, trimmed and capped. */
  text: string;
  /** Tag name plus role when present, e.g. "span" or "button[role=tab]". */
  element: string;
  /** Named observations such as "highlighted background (light blue)" or "bold". */
  hints: string[];
}

/**
 * Runs inside the browser via `locator.evaluate`, so it must be
 * self-contained: no imports, no references to module scope.
 */
export function collectVisualHints(root: Element, options: VisualHintsOptions): VisualHint[] {
  const maxEntries = options.maxEntries ?? 200;
  const maxTextChars = options.maxTextChars ?? 160;
  const dataAttributes = options.dataAttributes ?? [];
  const view = root.ownerDocument.defaultView;
  if (!view) return [];

  type Rgba = { r: number; g: number; b: number; a: number };

  function parseColor(value: string): Rgba | null {
    const m = value.match(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/,
    );
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] === undefined ? 1 : Number(m[4]),
    };
  }

  /** Composite `top` over `bottom` (both opaque or not). */
  function over(top: Rgba, bottom: Rgba): Rgba {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
  }

  /** Human colour name: hue bucket plus light/dark, or a grey. */
  function colorName(c: Rgba): string {
    const r = c.r / 255;
    const g = c.g / 255;
    const b = c.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (s < 0.12)
      return l > 0.93
        ? "white"
        : l > 0.7
          ? "light grey"
          : l > 0.35
            ? "grey"
            : l > 0.08
              ? "dark grey"
              : "black";
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    const hue =
      h < 15 || h >= 345
        ? "red"
        : h < 45
          ? "orange"
          : h < 70
            ? "yellow"
            : h < 160
              ? "green"
              : h < 200
                ? "cyan"
                : h < 260
                  ? "blue"
                  : h < 300
                    ? "purple"
                    : "pink";
    return l > 0.85 ? `light ${hue}` : l < 0.3 ? `dark ${hue}` : hue;
  }

  function isVisible(el: Element, style: CSSStyleDeclaration): boolean {
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function ownText(el: Element): string {
    let text = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) text += n.textContent ?? "";
    });
    return text.replace(/\s+/g, " ").trim();
  }

  /** Nearest ancestor background that is not fully transparent, composited. */
  function effectiveBackground(el: Element | null): Rgba {
    let acc: Rgba = { r: 0, g: 0, b: 0, a: 0 };
    const layers: Rgba[] = [];
    for (let node = el; node; node = node.parentElement) {
      const bg = parseColor(view!.getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a >= 1) break;
      }
    }
    // Composite from the bottom (outermost) up.
    acc = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i]!, acc);
    return acc;
  }

  function distance(a: Rgba, b: Rgba): number {
    return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
  }

  const controls = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "OPTION"]);
  const results: VisualHint[] = [];
  const elements = [root, ...Array.from(root.querySelectorAll("*"))];

  for (const el of elements) {
    if (results.length >= maxEntries) break;
    const text = ownText(el);
    if (!text) continue;
    const style = view.getComputedStyle(el);
    if (!isVisible(el, style)) continue;
    const parent = el.parentElement;
    const parentStyle = parent ? view.getComputedStyle(parent) : null;
    const hints: string[] = [];

    // Background that differs from the surroundings, for non-control elements.
    const ownBg = parseColor(style.backgroundColor);
    if (ownBg && ownBg.a > 0 && !controls.has(el.tagName)) {
      const surroundings = effectiveBackground(parent);
      const composed = over(ownBg, surroundings);
      if (distance(composed, surroundings) > 12) {
        hints.push(`highlighted background (${colorName(composed)})`);
      }
    }

    // Text weight, style and decoration relative to the parent.
    const weight = Number(style.fontWeight) || (style.fontWeight === "bold" ? 700 : 400);
    const parentWeight = parentStyle ? Number(parentStyle.fontWeight) || 400 : 400;
    if (weight >= 600 && parentWeight < 600) hints.push("bold");
    if (style.fontStyle === "italic" && parentStyle?.fontStyle !== "italic") hints.push("italic");
    const deco = style.textDecorationLine || "";
    if (deco.includes("line-through")) hints.push("struck through");
    if (deco.includes("underline") && el.tagName !== "A") hints.push("underlined");

    // Dimmed relative to the parent.
    const opacity = Number(style.opacity);
    if (
      Number.isFinite(opacity) &&
      opacity < 0.7 &&
      (!parentStyle || Number(parentStyle.opacity) >= 0.7)
    ) {
      hints.push("dimmed");
    }

    // Text colour that departs from the parent's, ignoring transparent text.
    const color = parseColor(style.color);
    const parentColor = parentStyle ? parseColor(parentStyle.color) : null;
    if (
      color &&
      color.a > 0.5 &&
      parentColor &&
      parentColor.a > 0.5 &&
      distance(color, parentColor) > 90
    ) {
      const name = colorName(color);
      if (!name.includes("grey") && name !== "black" && name !== "white")
        hints.push(`${name} text`);
    }

    for (const attr of dataAttributes) {
      const value = el.getAttribute(attr);
      if (value !== null) hints.push(value === "" ? attr : `${attr}=${value}`);
    }

    if (hints.length === 0) continue;
    const role = el.getAttribute("role");
    results.push({
      text: text.length > maxTextChars ? `${text.slice(0, maxTextChars)}…` : text,
      element: role ? `${el.tagName.toLowerCase()}[role=${role}]` : el.tagName.toLowerCase(),
      hints,
    });
  }

  return results;
}
