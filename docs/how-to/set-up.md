# Set up Forma

You need a Mac with Apple silicon and Node 24 or later (from nodejs.org or a
version manager). You do not need a Java of your own: Forma runs TLC and Alloy
only with its own pinned toolchain, a Java runtime, TLC (`tla2tools`) and Alloy,
which you fetch once. The toolchain is pinned for macOS on Apple silicon only;
on any other machine fetching it refuses and names the platform.

Install Forma with npm, or run it from its checkout. Either way you end with
three commands on your path: `forma`, `forma-explorer` and `forma-toolchain`.
The npm package holds Forma's code, the contracts in `spec/`, the base and the
built explorer; the documentation, the examples and the tests are in the
checkout. Where a page names a file of Forma's, it assumes a checkout at
`~/forma`.

## With npm

1. Install Forma:

   ```bash
   npm install --global --ignore-scripts @neutral/forma
   ```

   It puts `forma`, `forma-explorer` and `forma-toolchain` on your path, and runs
   nothing at install.

2. Fetch the toolchain:

   ```bash
   forma-toolchain
   ```

3. [Check it](#check-it).

## From a checkout

You also need pnpm (`npm install -g pnpm`) and git (`xcode-select --install`
provides it).

1. Get Forma and its dependencies:

   ```bash
   cd ~
   git clone https://github.com/neutral/forma.git forma
   cd forma
   pnpm install
   ```

2. Build the explorer's page, and again whenever you update the checkout:

   ```bash
   pnpm build
   ```

3. Put the three commands on your path, as links in a folder your path holds:

   ```bash
   mkdir -p ~/bin
   ln -s ~/forma/apps/cli/src/cli.mjs ~/bin/forma
   ln -s ~/forma/apps/cli/src/setup-toolchain.mjs ~/bin/forma-toolchain
   ln -s ~/forma/apps/explorer/src/server/cli.ts ~/bin/forma-explorer
   ```

   If `~/bin` is not on your path, add `export PATH="$HOME/bin:$PATH"` to
   `~/.zshrc` and open a new terminal.

4. Fetch the toolchain:

   ```bash
   forma-toolchain
   ```

5. [Check it](#check-it).

## The toolchain

Fetching it downloads each pinned file, about 71 MB in all, checks its size and
SHA-256 against `apps/cli/src/toolchain.json`, keeps it in
`~/Library/Caches/forma/toolchain`, and unpacks the Java runtime there. It ends
with `toolchain ready in <folder>` once Java runs. Run it again at any time: a
file already there with its pinned hash is kept, one that is not is fetched
again, and the runtime is unpacked again when what is there is not exactly its
archive. Upgrading Forma keeps it.

To keep the toolchain elsewhere, set `FORMA_TOOLCHAIN` to that folder's
absolute path, for the fetch and for every `forma` command, an agent's included.

## Check it

1. Fetching the toolchain ended with `toolchain ready in <folder>`.

2. In a new, empty folder, list what is owed:

   ```bash
   mkdir ~/try-forma && cd ~/try-forma
   forma missing
   ```

   It lists one item, `intake`.

Every command takes `--project <folder>`, or works on the current folder. If a
run ever says the Java runtime is not its pinned archive, as when Finder leaves
a `.DS_Store` file in its folder, fetch the toolchain again. The
[toolchain reference](../reference/toolchain.md) says what is pinned, and how
the versions a piece of evidence names decide whether it is current here.
