# Explore a project

The explorer, `forma-explorer`, is a separate app that reads a Forma project:
your brief as you wrote it, with what its examination says beside each section
([presentation.md §explorer](../../spec/presentation.md#explorer)). It reads
the account Forma computes, and changes nothing in the project.

1. Start it, naming your project:

   ```bash
   forma-explorer serve --project ~/orders
   ```

   Open the complete URL it prints, including its fragment: the fragment is
   the credential for its data reads. It listens on `127.0.0.1` only. A first
   start on a project computes its page, which takes some seconds; a later
   start on unchanged inputs is immediate. Stop it with Control-C. To choose a
   port, add `--port 4317`.

2. Read the document. The notes beside each section hold what is first met
   there: what must hold, what is assumed, what the text left open or left
   out, and what the examination found. A numbered red triangle is a revision:
   a ruling that the design is at fault. The title block lists every revision.

3. Open an underlined name. It opens in place, and names inside it open
   further. A claim shows its standing, its bounds, each check and its
   assumptions. A scenario shows its steps and its path on the lifecycle, which
   you can step through. The page has words of its own for the record's: a
   scenario is a journey, an assumption a premise, an open question a choice,
   and a check a question with its evidence.

4. Use the lists at the end to find any claim or assumption, the models, and
   what the examination cannot tell you.

5. Switch **standing** in the title block. *As recorded* judges each run by the
   versions it names, as the diff does. *Here* judges by this machine's
   versions. When the project changes while you read, the title block offers
   the new page.

6. Press `?` for what the marks, lines and words mean.

7. To share a snapshot, export to a new or empty folder outside the project:

   ```bash
   forma-explorer export --project ~/orders ~/orders-reading
   ```

   Open `~/orders-reading/index.html` directly. It needs no server or network.
   It holds both standings as the exporting machine computed them, with the
   time and versions.

8. To read the graph the explorer reads, as JSON:

   ```bash
   forma --project ~/orders explore --json
   ```

The explorer makes no decision and does not list the missing work: decisions
are made with `forma show` and `forma decide`, and what is owed is listed by
`forma missing`. The app's commands are in
[project.md §explore](../../spec/project.md#explore), and the graph's format in
[account.md §explorer-graph](../../spec/account.md#explorer-graph).
