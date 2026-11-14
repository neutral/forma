# Mechanisms: what designs use against each failure, and what each costs

A mechanism is something a team could build that prevents one thing, at a
price. Use this catalogue to recognise the mechanisms a brief states, to
repair a design after a real finding, and to plant a fault. A mechanism
enters a model only where an action states it or a repair names it, never so
that a claim holds ([model.md](model.md)).

Each entry says what it is, in the words `repair.md` and a fault's Mechanism
field use; the shapes of [shapes.md](shapes.md) it prevents; what it needs,
as what would show each premise false; its price; how it fails by its own
rule; and the fault that removes it, with the claim that catches it.

## Three rules for every entry

**A mechanism that needs a step of its own cannot enter by a model repair
alone.** A model's actions are the restatement's, one row each, on either
engine. A sender, a reconciler, a completer, a clock that ends a hold, a
compensation or a retry is never a new operator, a new Alloy fact, or a step
hidden in an existing operator. If the brief describes it and the
restatement left it out, that is `abstraction too coarse`; if the brief does
not, it is a real finding whose target is the brief. Say which.

**A mechanism held only by a step being indivisible cannot be faulted.** A
fault replaces one action and cannot split a step (the engines contract
§slot-forms). Where a claim rests on a lock, a transaction or a conditional
write, model it as a condition the operator checks: an earlier read kept in
the actor's view, a lock held or free, a version compared. Dropping it is the
fault. Where that costs too much, say the claim is true by how the model is
built ([slot.md](slot.md)).

**A fault is one of six kinds.** Drop a guard conjunct, duplicate an event,
skip a step, reorder, widen a set, remove a frame condition. It changes one
action, never a misbehaviour, so a duplicate is written in the action that
sends or applies. Skip a step leaves a variable explicitly unchanged; remove
a frame condition lets one change that should not, within its range. A fault
outside the model's types trips TLC's type invariant first and does not
count. A fault is caught only when the model can produce what the mechanism
stops: for a dedupe, a repeat by any route the request passes.

## The catalogue

### An idempotency key with a durable record

- **What it is.** Each request carries a key its sender chose, and the
  receiver stores key, result and effect in one transaction, so a repeat
  returns the stored result and does nothing again.
- **Prevents.** Retry that is not idempotent; one actor submitting twice.
- **Needs.** A retry reuses its key, and two uses at once are arbitrated by
  a unique constraint or a lock on the key: false if one key has two effects.
- **Price.** A key marked in progress strands every retry after a stop
  midway unless an expiry or a completer frees it. A repeat after the key is
  removed acts again: Stripe may remove keys 24 hours old.
- **Fails by.** The record committed after the call out, kept in memory, or
  looked up and stored in two transactions. A key built from changing data.
- **Fault.** Drop the test that the key is unclaimed. Caught by "charged at
  most once for one order". With no arbitration the lookup and the commit
  are two steps, and the race they leave is a finding.

### A unique constraint

- **What it is.** The store refuses a second record with the same value in a
  field that must be unique, however close together the writes come.
- **Prevents.** A race where free means no record with the key, such as one
  seat on one showing; a retry that creates a record; a migration's merge.
- **Needs.** Every creating path writes to that store and table, and the
  store counts as equal what people do: false on case, or on empty values,
  which PostgreSQL lets repeat by default.
- **Price.** The second writer fails on every retry, and its journey must end
  where the developer named. Every rule that is not a key stays open.
- **Fails by.** The wrong fields, such as the seat without the showing.
  Uniqueness within one shard. A cancelled record keeping its key.
- **Fault.** Drop the test, which refuses exactly what the store refuses.
  Caught by "a seat is sold at most once per showing".

### A conditional write on a version

- **What it is.** A writer reads a record with its version, and the store
  applies the change only if the version is still the one read.
- **Prevents.** Lost update; a race by compare-and-set; expiry racing a
  completion; time of check to time of use on one record. Never write skew.
- **Needs.** The store compares and writes in one step, and every writer
  writes on condition: false if two writes are accepted on one version.
- **Price.** The loser rereads, merges or gives up, and under contention can
  lose every time: its finishing needs fairness or a limit on contention.
- **Fails by.** A path that skips the version. The compare done by the
  application after a separate read. A value used as its own version.
- **Fault.** Drop the comparison, or skip advancing the version. Caught by "a
  confirmed change is never lost". The read and the write are two steps.

### A lock for each key

- **What it is.** An actor takes a key's lock before reading and changing
  what belongs to it, and no other actor acts on the key until it lets go.
- **Prevents.** Store anomaly, a race, and time of check to time of use, for
  what the lock covers only.
- **Needs.** Every actor that touches the key takes the lock: false if one
  writes without it, as PostgreSQL's advisory locks allow.
- **Price.** A crashed holder strands every waiter unless the lock ends with
  its session or has a lease, and opposite orders deadlock. Check waiters'
  liveness claims with the holder's crash unstruck.
- **Fails by.** A record lock for a rule over a set. Release before the write
  is stored. A session lock a rollback keeps. Lock and data in two stores.
- **Fault.** Drop the test that the actor holds the lock. Model take, act and
  release as steps: only that form shows a stranded lock and can be faulted.

### A lease with expiry

- **What it is.** A lock or a right that ends by itself after a set time
  unless renewed, so a holder that stops does not hold it forever.
- **Prevents.** The stranded lock of a crashed or silent holder; with a hold
  that expires, the timer hole for holds.
- **Needs.** Clocks with a bounded drift: false on a jump past the margin.
  Never that the holder stops at expiry: it can pause after checking.
- **Price.** A paused holder acts while a new one holds the lease, and work
  longer than the lease is cut off. Others getting it rests on fairness.
- **Fails by.** The holder checks expiry, then acts. A fast granter clock or
  a slow holder clock. A lost lease renewed.
- **Fault.** Skip the lapse. Caught by "a waiting worker eventually gets the
  job". The holder acts on its own belief, so let it act after expiry.

### A fencing token

- **What it is.** Each grant of a lock or lease carries a number larger than
  every earlier one, and the resource refuses a write numbered lower than
  the highest it has accepted.
- **Prevents.** A lease held past expiry; a writer back after failover.
- **Needs.** The resource checks every write, and numbers grow across the
  granter's restarts: false if two grants share a number.
- **Price.** A resource that cannot check, such as a payment provider, stays
  open, and the old holder's refused work must be finished or undone.
- **Fails by.** The number in memory, reset on restart. An equal number from
  another holder accepted. A path that skips the check.
- **Fault.** Drop the comparison. Caught by the claim the resource protects.
  The resource compares with what it last accepted, not the granter's
  counter, so an old holder writes until the new holder's first write.

### One transaction at a named isolation

- **What it is.** An action's reads and writes run in one transaction at an
  isolation the store names: all or none, interleaved only as it permits.
- **Prevents.** The anomalies its isolation excludes ([stores.md](stores.md));
  half-applied changes in one store. Nothing across stores or copies.
- **Needs.** The action is one transaction: false if one write shows alone.
- **Price.** At an isolation that refuses conflicts a transaction fails and is
  retried from the start, perhaps repeatedly. A rollback undoes no call out.
- **Fails by.** A call out inside it. Check and write in two transactions. An
  isolation assumed from a name vendors implement differently.
- **Fault.** Skip one of its writes, caught by the claim the writes agree.
  Below serializable it is a start and a completion, two actions.

### A read that locks for update

- **What it is.** An action reads the records it will change under a lock
  that makes other locking reads and writes of them wait for its end.
- **Prevents.** Lost update and time of check to time of use on the records
  read. A check for absence only where the store locks the range searched.
- **Needs.** Every writer locks, since a plain read does not wait. For
  absence, what the lock covers: MySQL locks ranges at repeatable read and
  only records found at read committed. False if a matching insert commits.
- **Price.** Waiters, and a holder that calls out blocks all behind it.
  Deadlocks abort one, whose retry must finish.
- **Fails by.** A search that finds nothing, so nothing is locked. The write
  in another transaction. An earlier unlocked read.
- **Fault.** Drop the test that no other actor holds the records, with the
  lock modelled as a condition. Caught by the claim the records protect.

### A single writer

- **What it is.** All changes to one key or store go through one process,
  which takes requests one at a time and itself reads, checks and writes.
- **Prevents.** Store anomaly; a race. A writer that applies values callers
  computed from their own reads prevents neither.
- **Needs.** One writer at a time, across failover: false if two write in one
  term. The queue before it may drop unless drop is struck.
- **Price.** Callers wait for a reply that can be lost after the writer
  acted, and writes stop while it is down.
- **Fails by.** A path past it: a script, a backfill. Failover with no fence.
- **Fault.** Widen the actions that write the state. Caught by the claim the
  state protects. A request carries what its sender computed, so a stale
  request stays possible.

### Storing before acknowledging: an inbox

- **What it is.** A receiver stores each message with its sender's
  identifier before acknowledging, skips an identifier it holds, and records
  each done in the transaction of its effect.
- **Prevents.** Work lost at a crash; webhooks twice, but only with all three
  parts: the identifier refused, one worker per message, done with effect.
- **Needs.** The sender redelivers under one identifier: false if two
  deliveries carry two. Stripe can send two events for one occurrence.
- **Price.** A message that always fails is stranded without a dead letter.
  Work trails acceptance, order is not restored, and an effect at another
  party leaves a window between the call and the record.
- **Fails by.** Acknowledging before the commit. Done and effect in two
  transactions. A dedupe on a field that differs per delivery.
- **Fault.** Skip the store before the acknowledgement, caught by "every paid
  order is fulfilled" with the receiver's stop; or drop the not-yet-done
  test, caught by "fulfilled at most once".

### Storing with the change and sending after: an outbox

- **What it is.** An action stores the message it must send with its change,
  in one transaction, and a separate sender delivers it and marks it sent.
- **Prevents.** Split commit between our store and others; a change whose
  message is never sent; a message for a change rolled back.
- **Needs.** The sender keeps running, and the receiver takes the message in
  the end: false if one outlives the developer's limit unsent.
- **Price.** A refused message blocks those behind it when order is kept.
  The receiver learns later, so only a following claim can hold, and with
  fail forever only "delivered, or a person told".
- **Fails by.** The message in its own transaction. Marked before it is sent.
- **Fault.** Skip storing the message. Caught by "the warehouse hears of every
  paid order". Sending and marking are always separate steps: a stop between
  them gives the duplicate the receiver's inbox must absorb.

### Applying only what is newer

- **What it is.** Each change carries a number from its source that grows per
  thing, and the receiver applies it only above the last it applied.
- **Prevents.** Webhooks out of order; an old copy written over a newer one.
- **Needs.** Numbers grow in the order of changes, across restarts: false if
  a later change is numbered lower. Stripe's timestamps are not for order.
- **Price.** It fits replacements only: an addition dropped as old is lost. A
  change that never arrives goes unnoticed.
- **Fails by.** The last number in memory, or one for the whole stream.
- **Fault.** Drop the comparison, with reorder unstruck. Caught by "an order
  never returns to an earlier payment state", never by "shows the latest
  state at every instant", which an ordinary delay breaks.

### A guard on the lifecycle

- **What it is.** In each phase of a thing, an action that must not happen
  there is refused.
- **Prevents.** Lifecycle hole; expiry racing a completion; permission or
  ownership lost through a transition.
- **Needs.** Phase checked and changed in one step, on every path: false if
  a script no action names moves the thing.
- **Price.** A refusal can leave someone no way forward, such as a
  cancellation refused after shipping; check every journey through the cell.
- **Fails by.** A check on an outdated copy. A second path writing the phase.
- **Fault.** An overlay turning the refusal into a move, or a dropped phase
  test. Caught by the forbidden move. "Never in two phases at once" is true
  by construction within one lifecycle and catches nothing.

### A hold that expires: a reservation in two steps

- **What it is.** A resource is held for a short time and counted as taken,
  then confirmed by its holder or released when the hold ends.
- **Prevents.** A race; an abandoned flow; a split commit, as a tentative step.
- **Needs.** The hold ends: false if one is never released. Fairness gives an
  end, not a time.
- **Price.** At the end confirm and release are both possible, and the
  developer says which wins. A payment after release has nothing held.
- **Fails by.** Release only by a tick that can be lost. A release not
  conditional on the phase.
- **Fault.** Drop the release's unconfirmed test, caught by "a paid seat is
  never released"; or skip the release, caught by the liveness claim.

### A compensation

- **What it is.** When a later step of a flow fails, actions undo the earlier
  steps' effects in the business's terms, latest first.
- **Prevents.** After the fact only: half-applied saga; abandoned flow.
- **Needs.** Each compensation can be done in the end: false if one is
  refused, such as a refund outside its window.
- **Price.** Others see the partial state, and an undo is a new effect: a
  sent message stays sent. Claims the partial state breaks stay broken.
- **Fails by.** Run twice, not repeatable. Run before the step's outcome is
  known, so the step lands after its undo.
- **Fault.** Skip one compensation. Caught by "every step done, or every step
  done undone". Let an effect arrive after its compensation.

### A reconciliation job that detects and repairs

- **What it is.** A job compares, on a schedule, two records that must agree,
  and repairs or reports each difference.
- **Prevents.** After the fact only: split commit, half-applied saga, lost
  work, abandoned flow, migration loss.
- **Needs.** It keeps running and reads each side where it is authoritative:
  false if it repairs from a stale copy.
- **Price.** A window of a period at least. Fairness allows any finite delay,
  so a deadline needs a stated end-to-end time.
- **Fails by.** A cached copy. Repairing work in flight. A sample.
- **Fault.** Skip one kind of difference. Caught by the claim that follows.

### A timeout with retry and backoff

- **What it is.** A caller with no answer in a set time asks again, waiting
  longer each time, with randomness, up to a limit.
- **Prevents.** Drop, delay and silence at a request seam, as progress
  failures. Without the callee's key it causes duplicates.
- **Needs.** The callee answers in the end: false on an outage longer than
  the retries.
- **Price.** After a timeout the caller cannot know whether the try acted.
  With fail forever only "done, or a person told" holds. Three tries at each
  of five layers give 243 times the load.
- **Fails by.** A retry with a new key. A timeout below normal latency.
- **Fault.** Skip the retry. Caught by the liveness claim, drop unstruck.

### A dead letter with a person told

- **What it is.** A message failed a set number of times is moved aside and a
  named person is told and decides.
- **Prevents.** A message that always fails and blocks the rest.
- **Needs.** The person acts in time: false if a letter is left unhandled.
- **Price.** Later messages overtake it, even in an SQS FIFO queue. The claim
  becomes "processed, or a person told", the developer's to write.
- **Fails by.** Telling nobody. Resending with no idempotency.
- **Fault.** Skip telling the person. Caught by that weaker claim.

### A recovery point after a stop

- **What it is.** An action of several steps records, as each commits, which
  step it reached, so after a stop it resumes there.
- **Prevents.** Our own services stopping between two steps; abandoned flow.
- **Needs.** Each step commits with its point, and something resumes: false
  if a point passes a step whose effect is missing.
- **Price.** A call out is made again on resume. An action whose client never
  returns is stranded unless a completer resumes or a reaper undoes it.
- **Fails by.** The point committed after the call out, or before its step.
- **Fault.** Record the point before the effect. Caught by a claim that needs
  the effect, never "charged at most once", which zero charges satisfy. A
  stop loses what the actor held, and the resume reads only the stored
  point; a step not taken is a delay ([restate.md](restate.md)).

### A signature check on an incoming event

- **What it is.** A receiver accepts an event only with a valid signature
  from a shared secret and a recent timestamp.
- **Prevents.** A forged event, and one resent outside the tolerance. No
  shape and no misbehaviour names forgery; a resend inside is a duplicate.
- **Needs.** Only the two hold the secret: false if an accepted event was
  never sent. The check reads the exact bytes sent.
- **Price.** Valid events lost to skew or a rewritten body. With Stripe a
  tolerance of zero turns the recency check off.
- **Fails by.** Checking a parsed body. One endpoint that does not check.
- **Fault.** Drop the test. Caught only where the restatement has an actor
  sending unsigned requests; without one, forgery rests on an omission.

### Reading from the primary after a write

- **What it is.** An actor that wrote reads back in a mode sure to include
  its own write.
- **Prevents.** A stale read of its own write only: not monotonic reads, not
  others' writes ([stores.md](stores.md)).
- **Needs.** The mode gives the named guarantee: false if a read misses it.
- **Price.** Others' reads and failover stay open; DynamoDB has no strong
  read on a global secondary index, and charges twice for one.
- **Fails by.** One path reading a copy: an index, a search, a cache.
- **Fault.** Widen the read to any copy. Caught by the decision's claim. It
  returns any version at least the actor's write, never the newest only.

### Invalidating or bypassing a cache

- **What it is.** A write removes the cached copy, and a decision that
  matters reads the store.
- **Prevents.** A stale or backward read through a cache.
- **Needs.** No reader puts an old value back: false if the cache is older
  than the store after removal.
- **Price.** A reader that missed before and fills after restores the old
  value; Facebook closes that with a token voided on removal.
- **Fails by.** Removal before the write. A lost removal.
- **Fault.** Skip the removal. Caught by the claim of a decision made on the
  cache. Filling is a read of the store, then a write of the cache.

### A coordinator for a commit across services

- **What it is.** A coordinator asks all to prepare, records its decision,
  and tells all to commit only when all prepared.
- **Prevents.** Split commit across services.
- **Needs.** Prepared participants follow the recorded decision; the
  coordinator recovers. False if one gives up after preparing.
- **Price.** A participant in doubt holds its locks, and one coordinator can
  block. Payment providers offer no prepare: a hold or a compensation fits.
- **Fails by.** A refusal ignored. A decision sent before it is recorded.
- **Fault.** Drop the all-prepared test. Caught by the validity claim, "commit
  only when all prepared", one of three with agreement ("none commits while
  another aborts") and progress. "Every side committed or none, at every
  instant" is no claim: the moment between two commits breaks it.

### A deadline checked when it is used

- **What it is.** A deadline is stored with its thing, and every dependent
  action compares it with the time it acts.
- **Prevents.** Deadline or timer hole; time of check to time of use on time.
- **Needs.** Clocks agree within a margin: false if one is off by more.
- **Price.** The thing stays counted as taken past its end until a sweep.
- **Fails by.** Another clock. Checking at read, acting later.
- **Fault.** Drop the comparison. Caught by "nothing confirmed after its end".

### Access checked at use from the current grants

- **What it is.** Every action on a protected thing asks, in its own step,
  whether the actor's current grants allow it.
- **Prevents.** Permission gained or lost through a transition.
- **Needs.** Every path checks current grants: false if an action is allowed
  after its grant went.
- **Price.** Actions past their check when a grant goes stay open.
- **Fails by.** Grants held in a token. One path that does not ask.
- **Fault.** Drop one action's check. Caught by "nobody reads a document they
  hold no grant for".

### A tenant on every record and every query

- **What it is.** Every record holds its tenant, and the store returns only
  the acting tenant's records.
- **Prevents.** Tenancy leak.
- **Needs.** The store enforces it for every role an action uses: false if a
  record shows in another tenant's result. In PostgreSQL superusers, bypass
  roles and unforced table owners see every row.
- **Price.** Copies keyed without the tenant, such as a search index, stay
  open. Shared jobs act as each tenant in turn or are exempt, and leak there.
- **Fails by.** A bypassing role. The tenant taken from the request.
- **Fault.** Widen one action's result. Caught by the structure claim.

### A rule over many records checked where every path writes

- **What it is.** Every action that could break a rule over a set checks the
  whole set and writes in one serializable step.
- **Prevents.** Ownership hole; a global rule broken; write skew.
- **Needs.** Every changing action checks: false if two that checked break it.
- **Price.** A new feature that does not check; the last owner cannot leave.
- **Fails by.** A check at an isolation that permits write skew.
- **Fault.** Drop the check in one action. Caught by "every group has an
  owner". On a store that permits write skew the check and the write stay
  two steps unless the brief names what makes them one.

### A migration checked one to one before the old records go

- **What it is.** Old records stay until a check shows each has exactly one
  new record and no new one stands for two.
- **Prevents.** Migration that loses or merges records.
- **Needs.** Every write during it reaches the new records.
- **Price.** A pause or writing both; storage for both.
- **Fails by.** A check by counts, where a loss and a duplicate cancel.
- **Fault.** Widen the mapping. Caught by the structure claim.

## Shapes and the mechanisms that answer them

| Shape | Mechanisms |
| --- | --- |
| double charge or booking from a race | unique constraint; conditional write; lock for each key; single writer; hold that expires; one transaction at serializable; idempotency key, for one actor twice |
| lifecycle hole | guard on the lifecycle |
| permission gained or lost through a transition | access checked at use; guard on the lifecycle |
| tenancy leak | tenant on every record |
| retry that is not idempotent | idempotency key; unique constraint |
| webhooks out of order or twice | applying only what is newer; inbox |
| half-applied saga | compensation; outbox; recovery point; reconciliation job |
| split commit across services | coordinator; outbox; hold that expires; reconciliation job |
| a global rule broken three components away | rule over many records; one transaction at serializable |
| expiry racing a completion | guard on the lifecycle; conditional write; deadline checked at use |
| deadline or timer hole | deadline checked at use; hold that expires; lease |
| time of check to time of use | fencing token; conditional write; read that locks; access checked at use |
| exactly-once mechanism defect | every entry's "Fails by" |
| work lost at a crash | inbox; outbox; recovery point |
| abandoned flow | recovery point; hold that expires; compensation; reconciliation job |
| store anomaly | one transaction; read that locks; conditional write; lock for each key; single writer |
| stale or backward read | reading from the primary; cache invalidation; conditional write; applying only what is newer |
| ownership hole | rule over many records; guard on the lifecycle |
| migration that loses or merges records | migration checked one to one; unique constraint; reconciliation job |
| our own services stop too | recovery point; one transaction |

## Choosing the smallest mechanism

Of the mechanisms that prevent a real finding, choose in this order.

1. **Inside the actions the restatement has**, so a model repair can add it.
   Say so when only one needing an action of its own fits.
2. **Whose price the design already pays**: a key already sent to a provider
   stored as ours too, a check put in a transaction already serializable.
3. **With the fewest new premises**, since each weakens its claim. Prefer
   one anyone can observe over one on timing: safety that rests on timing
   breaks when a process pauses.
4. **Preventing before detecting**, unless the developer accepted the window.

Name it in `repair.md` by its "What it is" sentence, in the brief's nouns,
and give the fault that removes it the same words as its Mechanism: a Repair
for a real finding on a model holds such a fault for a claim a ruled surprise
is on (the models contract §model-repair).

## Then ask what it strands

A mechanism that refuses more makes every safety claim easier to hold, so
only liveness claims and journeys show what it strands. Check those of
everything it touches, with the misbehaviours that bear on it unstruck: the
holder's crash for a lock, fail forever for a retry. Where none looks, say so
in the report, so the developer can write one. Put the slots right in the
same answer: the claim's fault now removes the new mechanism.

## Detecting is not preventing

A compensation, a reconciliation job, a dead letter and a sweep find the
forbidden state afterwards, so a claim that it never happens stays broken.
What can hold is a recovery claim: unbounded, a liveness claim on the
repairer's fairness; with a deadline, a bounded safety claim on a stated
end-to-end time, modelled with a clock. Only the developer revises a claim,
so never add a detecting mechanism and rewrite the claim to fit.

- **Explaining.** Say under Mechanism that the mechanisms that fit detect.
  Offer a weaker form only as an encoding over the model as it is: it adds
  no variable, constant or module (the evidence contract §explain), and a safety
  claim's encoding holds no `Fairness` (the engines contract §slot-forms), so no
  weaker form of one can say "repaired in the end" under the repairer's
  fairness; any more is a proposed change. Recommend `property wrong` only
  when the developer's own words already mean recovery.
- **Repairing.** When the ruling directs a detecting mechanism and the claim
  says "always", add it and report that the claim will still be broken. A
  recovery claim changes Kind or premises, so it comes by a Restate repair
  after `property wrong`, never by redirecting the sentence alone.
- **Restating.** A brief that names a detecting mechanism and a rule that
  must always hold poses a choice: at every instant, or following.

## Sources

- Stripe, Idempotent requests: https://docs.stripe.com/api/idempotent_requests
- Stripe, Receive Stripe events in your webhook endpoint:
  https://docs.stripe.com/webhooks
- PostgreSQL, Constraints:
  https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL, Explicit Locking:
  https://www.postgresql.org/docs/current/explicit-locking.html
- PostgreSQL, Row Security Policies:
  https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- MySQL 8.4, Transaction Isolation Levels:
  https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html
- Amazon Builders' Library, Timeouts, retries, and backoff with jitter:
  https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Amazon SQS, Using dead-letter queues:
  https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- Amazon DynamoDB, Read consistency:
  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html
- Nishtala et al., Scaling Memcache at Facebook:
  https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf
