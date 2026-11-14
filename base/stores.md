# Stores: what isolation lets happen, and copies

An operation the brief calls "one transaction" is one step of the design only
for the interleavings its store's isolation prevents, and names do not say
which: "repeatable read" is snapshot isolation in one store, a level that
loses updates in another and a locking level in a third, and Oracle's
"serializable" is snapshot isolation. Model the anomalies a store permits,
never its level's name.

## The anomalies

Each is the smallest interleaving of two transactions T1 and T2 over records
x and y that shows it.

| Anomaly | The smallest interleaving | What it costs |
| --- | --- | --- |
| dirty read | T1 writes x. T2 reads x and acts on it. T1 rolls back. | a decision on a value that never existed: a copy shown as lent by a loan that was rolled back |
| read skew | T1 reads x. T2 writes x and y and commits. T1 reads y. | a check across two records passes or fails on a state that never existed: a transfer seen on one side only |
| lost update | T1 and T2 read x. T1 writes x from what it read and commits. T2 does the same. T1's write is gone. | a count wrong by one write: one seat left counted twice |
| write skew | T1 and T2 each read x and y. T1 writes x and T2 writes y, each on the strength of what it read. Both commit. | a rule over two records broken with no record wrong alone: both of two staff on duty sign off, each having seen the other still on |
| phantom | T1 searches for records meeting a condition and finds none. T2 inserts one and commits. T1 inserts its own. | two records where the rule allows one: two bookings of one seat at one time |
| duplicate write | T1 commits an effect. The reply is lost or the request is delivered again. T1' commits the same effect. | the effect happens twice: lent twice, mailed twice |

A phantom is write skew over a condition. A lock on each record found does not
cover a record not yet inserted; whether a search's locks cover the gaps
depends on the store, isolation, index and search (InnoDB gap or next-key
locks at repeatable read, SQL Server key-range locks at serializable). The
"phantom read" PostgreSQL and Oracle say their snapshot levels exclude is a
search run twice returning other rows, not this. No isolation prevents a
duplicate write; only an idempotency mechanism does.

## Reading the isolation table

The table in the forms contract §store-premises binds; read its cells there, not
here. A row lists isolation names and the anomalies a store of those names
permits, and prevents the rest: that is what the premise
`store:<part>/<row>` asserts, with the falsifier an observed prevented
anomaly. A doubtful measurement counts as permitted. `unknown` permits every
anomaly.

A store whose isolation the brief does not name is `unknown`, also when the
brief names only the product or says "default settings". Do not infer the
level. Report the vendor's documented default, so the developer can name the
level the store really runs at: a session, a transaction or a database option
can change a default.

| Name | What the vendor documents |
| --- | --- |
| `read uncommitted` | MySQL InnoDB: plain reads may see an earlier or uncommitted version of a row. SQL Server: statements can read rows other transactions changed and have not committed. PostgreSQL accepts the name and behaves as read committed. Azure Synapse Analytics runs at read uncommitted by default. |
| `read committed` | For a read committed store with no row of its own. MySQL InnoDB: each consistent read, even within one transaction, takes a fresh snapshot. CockroachDB: read committed exists only when `sql.txn.read_committed_isolation.enabled` is true; otherwise every transaction runs at serializable whatever it asks. |
| `postgres read committed` | PostgreSQL's default. A statement sees the state committed when it began, and its own transaction's earlier writes. An `UPDATE`, `DELETE` or locking read that meets a target row a concurrent transaction changed waits for it, then evaluates its `WHERE` again on the new version of that row only. Such a command can see the concurrent change on its target rows and not on other rows. |
| `oracle read committed` | Oracle's default. Each query sees only data committed before the query began. Oracle's own example shows a committed update lost to a later one. |
| `sql server read committed` | SQL Server's default. With `READ_COMMITTED_SNAPSHOT` off, the default on SQL Server, reads take shared locks released by granularity: a row lock before the next row is read, a page lock when the next page is read, a table lock when the statement ends. With it on, the default on Azure SQL Database, each statement reads a snapshot as of its start. Both are this one name. |
| `snapshot isolation` | For a snapshot store with no row of its own: reads see the committed state as of the transaction's start, and of two concurrent writers of one record the first to commit wins. |
| `postgres repeatable read` | A snapshot as of the first statement other than transaction control. A transaction that updates, deletes or locks a row changed by one committed since is rolled back with "could not serialize access due to concurrent update". |
| `oracle serializable` | A transaction sees changes committed when it began, and its own. An update or delete of a row changed and committed since fails with ORA-08177; the application may then commit the work done so far, run other statements, or roll back. Oracle has no level named repeatable read. |
| `sql server snapshot` | Needs the database option `ALLOW_SNAPSHOT_ISOLATION`. Reads see committed data as of the transaction's start; a transaction that commits a change to a row changed since it began is rolled back with an error (3960). |
| `mysql repeatable read` | InnoDB's default. Plain reads read the snapshot set by the transaction's first read. Locking reads, `UPDATE` and `DELETE` use the latest state and lock what they touch. |
| `sql server repeatable read` | Shared locks on everything read are held until the transaction ends, so no other transaction changes those rows; others can insert rows that match its searches. |
| `serializable` | For a serializable store with no row of its own. Serializability imposes no real-time order: a transaction that completed before another began need not be visible to it. |
| `postgres serializable` | Applications must be ready to retry transactions that fail with serialization failures. |
| `sql server serializable` | Range locks on the keys each search matches, held until the transaction ends, so no other transaction inserts or changes a matching row. |
| `mysql serializable` | Repeatable read, and with autocommit off every plain read becomes a locking read in share mode. |
| `cockroachdb serializable` | CockroachDB's default. Transactions can fail with code `40001`, "restart transaction", which the application must handle; CockroachDB retries some single statements itself. |
| `unknown` | The brief does not name the isolation. |

## How a model lets a permitted anomaly happen

An anomaly needs room for another transaction between two reads (read
skew), between a read and the write it decides (lost update, write skew,
phantom), or between a write and its commit (dirty read). Make that room with
more than one action, or with a step that reads an older state. Let happen
exactly the anomalies the row permits: fewer, and a claim stands on a better
store than the premise carried; more, and the developer rules on surprises
the premise excludes. Put `store:<row>` in the Rests on of each claim that
depends on it.

The restatement writes the operation as a start, which reads, and a
completion of the same actor, which applies every write in one step. Keep
what the start read as the transaction's own state, tell transactions apart
by a parameter, and bound at least two at once. The model never splits an
action the restatement wrote as one; report such a grain as too coarse.

| Isolation family | Reads | The completion | Lets show |
| --- | --- | --- | --- |
| read committed (`read committed` and the three vendor rows) | each step reads the latest committed state, with the transaction's own writes, so the start and the completion may see two states | writes what the start decided, whatever was committed since. An `UPDATE … WHERE` protects only its target records: PostgreSQL rechecks the condition on a changed target, while a condition over other records, or a subquery, is read as of the statement's start, possibly before a commit that lands while it waits. For those records the statement is a read and a later write | read skew, lost update, write skew, phantom |
| read uncommitted | as read committed, and also other transactions' tentative writes | the start writes tentative versions owned by their transaction and held apart from the committed state; no other transaction writes a record while another's tentative version stands, since a writer keeps its exclusive lock until it completes; the completion commits them or discards them | dirty read, and all of the above |
| `mysql repeatable read` | every plain read at the snapshot fixed by the first read; a locking read is the mechanism below, not this row | writes on the latest committed state, as read committed does, with no check of what changed since the snapshot | lost update, write skew, phantom |
| snapshot isolation (`snapshot isolation`, `postgres repeatable read`, `oracle serializable`, `sql server snapshot`) | every read at the snapshot fixed by the first read, with the transaction's own writes | a write of a record committed by another since the snapshot fails. PostgreSQL and SQL Server roll the whole transaction back; under `oracle serializable` only the statement fails, and the completion does what the brief says the application then does | write skew, phantom |
| `sql server repeatable read` | each step reads the latest committed state, and every record read stays under a shared lock until the completion | a writer of a record another unfinished transaction holds a shared lock on waits. Of two that wait on each other, the model lets either be ended, writing nothing. Records not yet read, and inserts that match a search, are not covered | phantom; read skew only over what the locks do not cover |
| `unknown` | as read uncommitted | as read uncommitted | every anomaly |

Under snapshot isolation take all reads at the start. Under read committed
put two reads whose agreement matters in different steps. A phantom needs a
step that reads the set of records meeting a condition.

The `sql server repeatable read` recipe follows Microsoft's documented
locks, which prevent read skew over records a transaction has read; the
contract's row permits it, counting a doubtful cell as permitted. A claim
examined on the recipe rests on those locks as well as on `store:<row>`: it
needs a premise of class `atomicity` saying what cannot fall between a
transaction's reads and its completion, falsified by an observed write to a
record another unfinished transaction had read. The premise is the
restatement's ([restate.md](restate.md)); a model whose restatement lacks it
names it in its report. The same holds wherever something other than
isolation makes a read and a write one step.

A failed completion changes nothing in the store, or under Oracle only what
the statement would have written. What the actor then does is the brief's,
or an open reading. A retry until success that nothing else observes is a
failure step changing only the actor's state, which a liveness claim sees, so
let it repeat. A failure a person sees, or a retry other steps can precede,
is a case of the completion, and the retry is the start again.

At a serializable isolation the transaction is one action that may fail as
above. Serializability promises no real-time order: where word of a commit
reaches a party outside the store that then reads, any stronger promise is
the brief's, or a premise.

The store can instead be an append-only log of operations, each with its
transaction, record, value and an identifier per effect, from which a step
may read an earlier point: reading x at an earlier point and writing x on
the latest is a lost update in one action, and a duplicate is two entries
with one identifier. Read committed reads each statement as of its own start,
each no earlier than the last; snapshot isolation fixes one point at the
first read and fails a write whose record changed after it. No read is from
before the design's transaction begins. Where the model has that moment as a
step, such as the request arriving, it limits the points; where it has not,
let a read go back to the log's earliest point, and state any later limit in
the report with its reason. What the actor has since heard from elsewhere
moves no point forward. The log's length is a bound the developer carries,
and every earlier point a step may read multiplies the states, so use the log
when a claim is about history or the trace must show which read fed which
write.

## What makes an operation one step below serializable

Prices and faults: [mechanisms.md](mechanisms.md).

| Mechanism | One step against | Not against |
| --- | --- | --- |
| a locking read (`SELECT … FOR UPDATE`) | every writer or locker of the rows it read | a matching insert, unless its locks cover gaps; model the coverage the store documents and name it in the premise |
| an atomic conditional update (`UPDATE … SET n = n - 1 WHERE n > 0`) | writers of the record it updates | a condition over other records, or a subquery; at a snapshot level the update fails instead |
| a unique constraint | another insert of the same key, at any isolation | |
| a version column: the write fails when the record moved on | writers of the record it read | write skew over two records |
| an advisory lock | the actors that take it | every other actor |
| materialising the conflict: a record stands for a condition (a row per seat and time) | a phantom, now a conflict on that record | |

## Copies: replicas and caches

A replica or a cache returns an older commit. Each of these comes with lag
unless the design asks for the guarantee that excludes it.

| Phenomenon | What happens | Excluded by |
| --- | --- | --- |
| stale read | a copy returns a value a committed write already replaced | a read the store and its interface promise linearizable. Reading the primary is not that by itself, since a transaction there can read an older snapshot, and waiting for a copy to hold one known write excludes only what is older. Name the read mode, the snapshot rule and the catch-up condition |
| backward read | a later read returns an earlier state than an earlier read | monotonic reads |
| a read that misses one's own write | an actor writes, then reads a copy that lacks the write | read-your-writes |
| an answer before its question | a copy shows a write before the write it depended on | consistent prefix; causal consistency |
| a concurrent write lost | two copies each accept a write, and last-write-wins keeps one | a single leader per key; versions with a merge |

PostgreSQL's hot standby lags its primary: one query run on both at nearly
the same moment can return different results. A stale read does harm where
an actor decides on it; which copy it reads then is an open reading, and a
guarantee the design relies on is a premise. A stale value only shown to a
person is a person acting on an old page ([world.md](world.md)).

A copy's read returns any committed version its guarantee allows: under
none, any earlier one; under monotonic reads, none older than the actor's
last read; under read-your-writes, none older than its own last write. The
versions kept need a bound, as the log's length does. A cache fill is a read
then a write, and a change with its invalidation can fall between them,
leaving the old value until it expires.

## Faults and explanations

Every anomaly a claim forbids gives a ready fault: take away the mechanism
that holds it off, in the one action that uses it. Drop the lock, the
update's condition, the search or unique constraint, or the store's refusal
of a conflicting commit; deliver once more; read a copy. A fault adds no
step, so a lock dropped from a read and write fused in one operator breaks
nothing: report the grain as too coarse. A fault another mechanism still
covers, as a unique constraint behind a lock, is not caught: choose one the
claim really rests on, or say why none breaks it.

Name a surprise a store is behind by its anomaly, in the developer's nouns:
"two loans of the last copy, each read it as on the shelf" is a lost update.
A step that does what the store row prevents, such as a snapshot read that
sees a later commit, is the first wrong step; if none does, the store is not
where the story goes wrong, and the rest of the trace is read as
[explain.md](explain.md) says. A finding's repair is a mechanism above or a
stronger isolation. Two surprises of one anomaly on one mechanism are one.

## Sources

- Berenson and others, "A Critique of ANSI SQL Isolation Levels",
  https://arxiv.org/abs/cs/0701157
- MySQL 8.4, "17.7.2.1 Transaction Isolation Levels",
  https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html
- Microsoft, "SET TRANSACTION ISOLATION LEVEL (Transact-SQL)",
  https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql
- Microsoft, "Snapshot Isolation in SQL Server",
  https://learn.microsoft.com/en-us/dotnet/framework/data/adonet/sql/snapshot-isolation-in-sql-server
- PostgreSQL, "13.2. Transaction Isolation",
  https://www.postgresql.org/docs/current/transaction-iso.html
- PostgreSQL, "26.4. Hot Standby",
  https://www.postgresql.org/docs/current/hot-standby.html
- Oracle Database 19c, "Data Concurrency and Consistency",
  https://docs.oracle.com/en/database/oracle/oracle-database/19/cncpt/data-concurrency-and-consistency.html
- CockroachDB, "Transactions",
  https://docs.cockroachlabs.com/docs/stable/transactions
- Jepsen, "Serializability", https://jepsen.io/consistency/models/serializable
- Kleppmann, "Hermitage: Testing the 'I' in ACID",
  https://github.com/ept/hermitage
