// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { JsonValue } from "./types";

/**
 * URL broken into the pieces a question can point at by name. A query key
 * that repeats (`?tag=a&tag=b`) is reported as a list of its values.
 */
export function describeUrl(rawUrl: string): { [key: string]: JsonValue } {
  const url = new URL(rawUrl);
  const query_params: { [key: string]: JsonValue } = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query_params[key] = values.length === 1 ? values[0]! : values;
  }
  return {
    url: rawUrl,
    pathname: url.pathname,
    path_segments: url.pathname.split("/").filter(Boolean),
    query_params,
  };
}

/** Cut a text field to `maxChars`, marking the cut so the model knows. */
export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}\n# [truncated after ${maxChars} characters]`,
    truncated: true,
  };
}
