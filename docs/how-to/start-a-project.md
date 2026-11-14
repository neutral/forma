# Start a project

1. Make a folder for the project, outside Forma's checkout, and put it under git:

   ```bash
   mkdir ~/orders && cd ~/orders && git init
   ```

2. Write your brief in `design/brief/`, as Markdown, in your own terms: what the
   system is for, its parts, what must always hold, what must never happen, and
   what you have not decided. Every heading of any level starts a passage that
   runs to the next heading, unless it sits inside a list or a quote; text
   before a file's first heading is the file's opening passage
   ([design.md §passages](../../spec/design.md#passages)). So give each concern
   its own heading. Every passage must be covered, a title heading followed
   directly by another heading included: an agent cites it, or files it as an
   omission.

   Only `.md` files are read. Any other file under `design/brief/`, a PDF or an
   image, is no part of the brief and is ignored, so put what it says into
   Markdown ([design.md §brief](../../spec/design.md#brief)).

   A document you did not write, such as a vendor's API page, goes in
   `design/brief/sources/` with front matter naming its `title`, `author`,
   `date` and `origin`:

   ```markdown
   ---
   title: "Payments API reference"
   author: "Example Payments Ltd"
   date: "2026-03"
   origin: "https://example.com/docs/api, saved by the developer"
   ---
   ```

   Each is a string: quote it, since YAML reads a bare `2026` as a number. The
   date is `YYYY-MM-DD`, `YYYY-MM`, `YYYY` or `unknown`. A source without all
   four cannot be cited, and its passages must still be covered, by omissions.

3. Make the intake: the situation, the allowance, and what is out of scope and
   why. For example:

   ```bash
   forma decide intake --situation "design new" \
     --answers 300 --runs 1500 \
     --tlc-seconds 300 --tlc-megabytes 2048 \
     --alloy-seconds 300 --alloy-megabytes 2048 --lifecycle-seconds 60 \
     --words "Storage failures and network byte delivery are out of scope: the brief examines the design." \
     --by "Your Name"
   ```

   - **Give every row of the allowance.** A row left out is 0, and an engine
     allowed no time, or for TLC and Alloy no memory, runs nothing: its runs wait
     for the item `allow` until you allow more.
   - **The situation** is one of six ([settings](../reference/settings.md)). It
     is recorded in the intake decision for whoever reads the project; nothing
     Forma computes or gives to agents reads it.
   - **The words** say what is out of scope and why. They too are recorded with
     the intake. No packet holds them, though an agent reading `forma account`
     sees the decisions in force, so a scope an agent must respect belongs in the
     brief.
   - **The settings** `--cadence` and `--inbox-cap` change only how
     `forma missing` and `forma account` group and show what waits for you;
     leave them out for the defaults, `span` and `7`.

   Given any of its options, the intake asks nothing, and every option it needs
   must be given. At a terminal you may leave them all out and answer what it
   asks. Run anywhere else, as from a script or by an agent, a decision must
   declare its session with `--provider`, `--model` and `--session`.

4. See what is owed:

   ```bash
   forma missing
   ```

   The first items are restatement work for an agent: one `passage:` item for
   each passage nothing covers yet, named by its address,
   `passage:design/brief/<file>.md#<slug>`. The slug is the heading's text with
   its inline markup dropped, lowercased, every character but letters, digits,
   spaces, hyphens and underscores removed, and each space made a hyphen; a
   heading repeated in one file takes `-1`, `-2` and so on. So `## Late
   payments` is `#late-payments`, and `## Retry (v2)` is `#retry-v2`. An opening
   passage's address is the file's path alone. Next:
   [run agents on the missing work](run-agents.md).

Commit the project as you go. Forma never commits; `forma diff` compares with
your commits.
