// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { JsonValue } from "./types";

/** URL broken into the pieces a question can point at by name. */
export function describeUrl(rawUrl: string): { [key: string]: JsonValue } {
  const url = new URL(rawUrl);
  const query_params: { [key: string]: JsonValue } = {};
  url.searchParams.forEach((value, key) => {
    query_params[key] = value;
  });
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
