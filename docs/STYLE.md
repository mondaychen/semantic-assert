# Documentation style

This note covers every page under `docs/` and the root `README.md`. The voice
borrows from two sources: Tailwind's docs for how a section is built, and React's
docs for how a page talks to the reader. When a rule here conflicts with a page,
fix the page.

## Voice

- **Talk to one reader as "you".** Use contractions ("you'll", "doesn't", "it's"). Write the way you'd explain the library to a teammate at their desk.
- **Say what to do, then why.** Prefer the imperative: "Pass a `region` to scope the capture." Not: "A region may be passed to scope the capture."
- **Don't hedge.** Cut "simply", "just", "basically", "note that", "it should be noted", "in order to". State the fact.
- **Present tense, active voice.** "The judge recaptures the page" rather than "the page is recaptured by the judge".
- **Short sentences.** One idea each. Start a new sentence instead of chaining clauses with semicolons.
- **No em-dashes.** Use a comma, a colon, or a new sentence.
- **Name the subject of a claim in prose too.** "The alert asks the user to try again" beats "it asks to try again".

## How a section is built

Follow Tailwind's rhythm: one sentence, the code, one short paragraph.

1. **Lead with one imperative sentence** that names the option or API and what it does, ending in a colon.
2. **Show the code.** Keep snippets complete enough to paste. Use realistic values, not `foo`.
3. **Explain in one or two paragraphs.** What the reader just saw, what it costs, and what it does not do.

````md
## Scope the capture

Pass a `region` locator or CSS selector to capture only the relevant content:

```ts
await judge.expectPageTo("The message confirms that the purchase succeeded", {
  region: page.getByRole("region", { name: "Order confirmation" }),
});
```

Scoping does two jobs. It shrinks the text sent to the model, and it stops
unrelated page content from filling in information the region itself is missing.
````

Headings describe a task or ask the question the section answers: "Wait first,
then judge once", "Who's the judge?", "Why does it evaluate only once?". Avoid
noun-pile headings like "Region configuration".

## How a page is built

Borrow React's page furniture.

**Guide and reference pages** (`getting-started.md`, `reference/*.md`):

- Open with one or two sentences on what the page is for.
- Add a `::: info You will learn` block with three to six bullets, each starting with "How to", "When to", "Why", or "What".
- End with a `## Recap` list of four to six bullets, one fact each.

**Example pages** (`examples/*.md`) follow a fixed shape:

1. An `h1` that states the problem the way a developer would say it out loud. "Your PM changed the copy. Why is CI red?" Keep it under ten words when you can.
2. One or two sentences framing the problem, optionally with the HTML or data in question.
3. `## Before: ...` with the brittle assertion and one paragraph on how it fails.
4. `## After: ...` with the semantic assertion and one paragraph on what changed.
5. A table of intended outcomes with an Accept or Reject column. Include at least one Reject row; a calibration set that only has good examples is useless.
6. `## Run the ...` with the fake-provider command first, then the live command.
7. `## Use your application's page` or an equivalent "adapt this" section.

## Callouts

VitePress custom containers, used sparingly. One or two per page is normal, four is a lot.

| Container                        | Use it for                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `::: warning Pitfall`            | Something that looks right and isn't. Provider objects in `use`, `.not` on matchers, reading a failed positive claim as a negative. |
| `::: tip <short title>`          | A shortcut or a "when not to" that saves the reader time.                                                                           |
| `::: details Deep dive: <topic>` | Detail most readers can skip. Collapsed by default.                                                                                 |
| `::: info You will learn`        | Only at the top of guide and reference pages.                                                                                       |

Give every callout a title. Write the body as one short paragraph.

## Code and commands

- Fence every command, snippet, and error message. Keep them out of prose.
- Name a file, function, or option in prose only when the reader has to go there. At most one per sentence.
- Use `sh` for shell blocks and `ts` for TypeScript, even in `.mjs` examples where the code is plain JavaScript, unless the extension matters to the point.
- Prettier formats the Markdown. Run `pnpm format` before committing and don't fight the table alignment.

## Facts that must stay accurate

Several pages repeat the same facts. Keep them consistent, and update every page when one changes.

- Assertions evaluate once by default (`timeoutMs: 0`). Polling is opt-in with a positive `timeoutMs`.
- A Playwright `region` waits up to `regionTimeoutMs` (default 5 s) for its element to attach. That wait is browser-side and sends nothing to the model.
- `classify` and `classifyPage` never fail a test on their own. The caller asserts the choice.
- `expected: false` asks for evidence of the negative. A failed positive claim is not the same thing.
- The default judge is Jev, TypeSafe's first System One model. It returns typed answers and calibrated probabilities rather than generated text. Link to `https://typesafe.ai` and `https://docs.typesafe.ai/concepts/system-one`.
- Model judgments are probabilistic. Every page that shows a passing assertion should say, somewhere, to calibrate on the reader's own good and bad examples.

## The README

GitHub renders no callouts, so the root `README.md` uses the Tailwind side of this
guide only: pitch, code sample first, a "why" section, a "what you get" list, then
packages, install, development, releases, license. Keep the development details
complete. That section is for contributors, not marketing.

## Checklist before you publish

- [ ] Every section leads with a sentence, then code, then explanation.
- [ ] Headings name a task or ask a question.
- [ ] Guide and reference pages have "You will learn" and "Recap".
- [ ] Example pages have a Reject row and a fake-provider run command.
- [ ] No em-dashes, no hedging words, contractions where a person would use them.
- [ ] `pnpm format` and `pnpm docs:build` both pass. The build fails on dead links, so a green build means the anchors resolve.
