# Third-party material

Forma's [CC0 1.0 Universal or Zero-Clause BSD licence](LICENSE) covers its
original material. It does not relicense dependencies, the engines, referenced
sources, external standards, names or marks. A reference grants no
redistribution permission.

**The toolchain.** Forma holds no copy of the engines it drives.
`forma-toolchain`, or `pnpm toolchain` in the checkout, fetches a Java runtime,
TLC and Alloy from their publishers, at the versions and hashes
`apps/cli/src/toolchain.json` pins, into `forma/toolchain` in your cache folder,
or where `FORMA_TOOLCHAIN` says. Their terms remain their own.

**The command.** `forma` runs on markdown-it and XState (MIT) and yaml (ISC),
installed from npm and not copied into this repository.

**The explorer.** Its page is built from npm packages and bundles their code:
React, react-dom, React Router, React Flow (`@xyflow/react`), XState,
`@xstate/react`, Zod and markdown-it (MIT); React Aria Components (Apache-2.0);
elkjs (EPL-2.0 or GPL-3.0-or-later); and what those packages depend on. The
built page is not kept in this repository. A snapshot that `forma-explorer
export` writes holds that bundled code, so whoever shares a snapshot shares it
under those packages' terms.

**The package.** The npm package `@neutral/forma` carries its runtime
dependencies inside it: markdown-it and what it depends on, XState, yaml and
Zod, each with the metadata and notice files npm packs for it.
`dependency-inventory.json` in the package lists each one with its version and
declared licence. The package's explorer page is the built page described above.

`pnpm-lock.yaml` names every package and version installed. It is no
rights-clearance or licence-compatibility claim.
