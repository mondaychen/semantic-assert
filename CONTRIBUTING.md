# Contributing

Install Node.js 22+ and the pnpm version pinned in `package.json`, then run
`pnpm install`. Use `pnpm format` to format changes and `pnpm check` before
submitting them. Changes to package exports or build configuration should also
pass `pnpm check:packages`.

Keep the core independent of model vendors and browser frameworks. Provider
implementations and framework adapters belong in separate packages. Unit tests
use deterministic providers or mock HTTP responses and must not require secrets.

For a user-facing change, run `pnpm changeset` to describe the change and select
the affected packages and version bumps. See [RELEASING.md](RELEASING.md).
