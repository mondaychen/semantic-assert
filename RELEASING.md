# Publishing packages

The repository root and examples workspace are private. Only the four packages under `packages/` are
published. The first published version is `0.2.0`; subsequent releases are
tracked independently with Changesets.

## First release

- Confirm the npm names are available to the publishing account. They currently
  use `semantic-assert`, `semantic-assert-typesafe`, `semantic-assert-ai-sdk`, and `semantic-assert-playwright`.
- Add the actual public repository URL, homepage, and issue tracker to the package
  manifests once the remote exists. No placeholder owner is embedded in this repo.
- Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm check:packages`, and
  the browser smoke test described in the README.
- Authenticate to npm and run `pnpm release` when ready to publish.

The source is licensed under the Apache License, Version 2.0.

## Subsequent releases

1. Run `pnpm changeset` and select only the packages affected by your change.
2. Commit the resulting changeset with the implementation.
3. Run `pnpm version:packages` to apply versions and generate changelogs. Review
   dependency range updates, then run `pnpm install` and commit the release changes.
4. Run `pnpm release` from a clean checkout after review. It verifies the repository
   and packed consumers before Changesets publishes unpublished package versions.

Use pnpm for manual packing or publishing. It rewrites `workspace:^` dependencies
to ordinary semver ranges in the tarball. The TypeSafe, AI SDK, and Playwright packages
depend on the separately published core; each tarball contains only its own build,
README, changelog, manifest, and license. `prepack` rebuilds the selected package. Build the
workspace first if packing an adapter directly from a clean checkout.

To inspect one package without publishing:

```sh
pnpm build
pnpm --filter semantic-assert-playwright pack --pack-destination ../../artifacts
```
