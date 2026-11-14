# The toolchain

TLC and Alloy run only with pinned files, each checked against its SHA-256
before it runs ([evidence.md §toolchain](../../spec/evidence.md#toolchain)). The
pins are in `apps/cli/src/toolchain.json`.

| Engine | Runs with |
| --- | --- |
| TLC | `tla2tools` 1.7.4 (TLC 2.19), on the Java runtime |
| Alloy | Alloy 6.2.0, on the Java runtime |
| the Java runtime | Temurin 21.0.13+9 JRE, checked as its archive and as unpacked from it |
| the lifecycle engine | Forma's own code, on a Node within `apps/cli/package.json`'s `engines` (24 or later), with the XState version `apps/cli/package.json` pins |

The pinned files are for macOS on Apple silicon (`darwin`, `arm64`); no other
platform has a pinned Java runtime.

## Where it lives

`forma-toolchain` fetches the pinned files into `forma/toolchain` in your cache
folder, `~/Library/Caches` on macOS, and unpacks the runtime there. Neither a
checkout nor an installed package holds it, so upgrading Forma keeps it. To keep
it elsewhere, set `FORMA_TOOLCHAIN` to an absolute path; every command reads the
same variable. An engine whose files are missing, or do not match their pins,
runs nothing: `forma run` names it with the reason, and `forma-toolchain`
repairs it.

## Versions in the evidence

Every evidence file names the versions of its engine, its runtime, XState for
the lifecycle engine, and Forma, with a hash of Forma's source files. An
installed Forma and the checkout of the same release share that hash. A machine
with other versions, or another build of Forma, finds that evidence not current,
and runs it again. A run owed only by a change of version spends nothing; where
the new build composes a question's generated files differently, it spends a
run. A build of Forma never rewrites evidence a later version of Forma wrote
([evidence.md §versions](../../spec/evidence.md#versions)).
