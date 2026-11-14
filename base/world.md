# The world: what its parties really do

The world's parties are the rows of side `world` in a restatement's Boundary:
people, other teams' and providers' services, queues and clocks. This page
says what each kind of seam does, what an unstruck misbehaviour must do, and
what a strike asserts. Stores are in [stores.md](stores.md).

Look a row up by its seam, not its kind. An actor is a person, or another
team's program with the seam it calls through. A service is a request and
response when the machine calls it and a webhook when it calls the machine;
a party that does both fails differently on each.

## The menu at an exchange

Every world row of kind actor, service, queue or clock gets the whole menu
(the forms contract §boundary, the forms contract §menu). The seam changes which
items happen most often and where they land, never the menu. Each section
below names the most frequent first; none of those lists is a default, since
a shorter menu misses the lost reply of every request and response. An
exchange is three steps, the request leaving, the party acting and the reply
arriving, and each item falls at one or more of them:

| Item | What the party or the channel does |
| --- | --- |
| drop | a request, a delivery, a reply or a tick never arrives; a reply lost after the party acted leaves the effect done and the caller not knowing |
| duplicate | the same request, delivery or tick arrives twice: a retry, a redelivery, a second run |
| delay | it arrives after other steps, with no limit on how many |
| reorder | two arrive in the other order from the one they were sent in |
| fail forever | every attempt is refused or errors |
| fail then succeed | attempts fail, then a later one succeeds |
| crash | the party stops, loses what it had not stored, and may come back |
| go silent mid-step | the party starts and neither finishes nor answers: work half done, the caller waiting |

Make each operator mean its item, and the misbehaviour slot's `Target` hold
only once the item has happened. The question checks only that `Target` is
reached, so read the trace to see that the step taken is the item.

## Request and response

Most often: duplicate, delay, and a drop of the reply after the party acted.

- HTTP lets a client repeat an idempotent method (`PUT`, `DELETE`, the safe
  methods) after a lost connection, and no other unless it knows the request
  is idempotent or was never applied. A retry that repeats a `POST` is the
  client's own doing, and is the menu's duplicate.
- A slow party is a delayed one: the caller's timeout fires, the caller
  retries or gives up, and the party may still act on the first request.
- Stripe's API versions differ, so name the one the design relies on. v1
  keys every `POST`: a retry returns the saved first response, a `500`
  included; a key may be removed after 24 hours, and reusing it then is a new
  request. v2 keys `POST` and `DELETE`: a repeat within 30 days skips a
  request that succeeded, reruns one that failed or partly failed, and errors
  when a replay can no longer succeed.

## Email

Delivery is a party of its own. SMTP senders wait generally at least 30
minutes before a retry and keep trying generally four to five days: a delay
of days. A slow answer to the end of a message makes the sender send it
again. An accepted message may still fail, with a notice mailed later.

## Webhook

Most often: drop, duplicate and reorder.

| | Stripe | GitHub |
| --- | --- | --- |
| delivery | the same event can arrive more than once; in some cases one change makes two event objects with different identifiers | a redelivery carries the first delivery's `X-GitHub-Delivery` identifier |
| order | not guaranteed; `created` is in seconds and two events can share it | not documented |
| retries | in live mode, automatic for up to three days with exponential back-off; in a sandbox, three times over a few hours; manual resend for 15 days in the dashboard, 30 from the command line; none to a disabled or deleted endpoint | none by itself; a redelivery is requested by hand, or by the deployment's own code through the REST API |
| a slow receiver | must return `2xx` before slow work; a timeout is a failed delivery, retried | must reply within 10 seconds, or the delivery fails |
| signatures | over a timestamp and the body; the libraries reject a timestamp older than a tolerance, five minutes by default and changeable; each retry is signed afresh | a webhook secret validates that a delivery came from GitHub unchanged |

A signature deduplicates nothing; an identifier does, and Stripe's can
differ for one change. Stripe's age check, the receiver's clock less the
signed timestamp, measures delay plus clock offset, and in stripe-node a
timestamp from the receiver's future passes. A receiver that acted and timed
out gets a duplicate after its effect. A redelivery our own code requests is
an action of the machine.

## Queue

Most often: duplicate, reorder and go silent. Amazon SQS documents:

- **Standard queues.** At least once, and out of order on a best effort.
- **Visibility timeout.** A received message is hidden for the timeout (30
  seconds by default, 12 hours at most). Not deleted in time, it goes to
  another consumer while the first may still work on it; even within it a
  second delivery is not ruled out.
- **FIFO queues.** A send retried within five minutes with a deduplication
  identifier adds no duplicate. A message group is received in strict order,
  up to ten at once, none more until those are deleted or time out; whether
  a batch is handled in order or all at once is the consumer's. A message
  not deleted in time is still delivered again.
- **Retention.** Four days by default, 60 seconds to 14 days, then removed: a
  drop. A dead-letter queue takes messages that failed several receives.

A consumer can stop before it finishes or deletes a message, which then comes
again after the timeout: a delay and a duplicate. A consumer of side `world`
has its own row and menu. One that is our own service is of side `machine`:
its stop is in the grain of its own actions ([shapes.md](shapes.md)), and no
strike at the queue removes it.

## Clock: schedulers

Most often: delay; a late tick is a delay, a skipped one a drop, a second run
a duplicate. An overlap is the next tick arriving before the last run's
steps are done, which shows when a run is more than one step.

- **Kubernetes CronJob** creates a job approximately once per scheduled
  time, sometimes two or none. Runs overlap by default (`concurrencyPolicy:
  Allow`); `Forbid` skips a run while the last is unfinished, `Replace`
  replaces it. A run that cannot start within `startingDeadlineSeconds` of
  its time is skipped. With no time zone set, the controller's local time
  rules.
- **Google Cloud Scheduler** is at least once, and retries a failed run with
  exponential back-off.
- **Cronie's cron**, one Linux cron among several: for jobs at a fixed time
  or less often than hourly, a time change under three hours is treated as
  daylight saving. Forward, the skipped jobs run at once; back, none runs
  twice. A larger change applies at once. Missed and overlapping runs are
  not documented.

## Clock: time itself

Two readings can come out in the other order from the events they stamp,
and a deadline passed on one machine not on another: a delay or a reorder.

- NTP's reference discipline slews an offset under 125 ms, steps a larger
  one only if it persists past 900 s (at start-up, at once), and above
  1000 s should stop; an implementation's configuration changes these. A
  step can move time backward.
- On Linux, `CLOCK_REALTIME` jumps when set and is slewed; `CLOCK_MONOTONIC`
  does not jump, is slewed, and stops while the system is suspended.
- A check of one party's timestamp by another's clock measures delay and
  offset together, rejecting fresh deliveries or accepting stale ones.

## Person

Most often: duplicate and go silent mid-step.

- **Submits twice**: a second click or a reload is the race of two people.
- **Goes back**: history can show an expired page, and a form sent from it
  carries what was true then: a delay, or a duplicate of a form already sent.
- **Leaves halfway**: a payment taken and no order made, a hold placed and
  never released. Stripe expires an uncompleted Checkout Session 24 hours
  after creation by default, no sooner than 30 minutes, and sends
  `checkout.session.expired`.
- **Uses an old page**: an actor deciding on a copy of unbounded age.

## What an unstruck item must do in a model

Each unstruck item does, with effect, what the documents above say, at its
worst: a webhook duplicate after later events under a new identifier, two
handlings of one queue message overlapping, a delay past any deadline. A
dropped reply leaves the effect done; a drop of the request alone is not
enough. A crash loses what was held in memory, and the party may come back.

## Striking an item

A strike is the developer's decision ([developer.md](developer.md)): a carry
of the premise `strike:<part>/<row>/<item>`, of class world, falsified by "an
observed <item> at <the row's names>". It asserts this party never does this
item at this seam. Every question then leaves the item out, every result on a
model of the row's part rests on the strike, and no question asks for the
item to happen (the forms contract §menu).

Only a source justifies a strike: the party's document saying it does not do
this item at this seam, or the brief's own statement of what the party is.
Read the source for the exact item and the exact seam: "the provider is
reliable" strikes nothing, FIFO's deduplication of sends strikes no
duplicate at the consumer, and nothing above strikes duplicate, delay or
reorder at a webhook. A mechanism of the design never justifies a strike: a
receiver that ignores repeated identifiers must be shown holding against the
duplicate, and a strike would take away the very thing it withstands.

When nothing is known, keep the item: kept and never happening, it costs a
ruling; struck and happening, it costs a flaw nobody sees.

## Sources

- RFC 9110, "HTTP Semantics", §9.2.2,
  https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2
- RFC 9111, "HTTP Caching", §6, https://www.rfc-editor.org/rfc/rfc9111#section-6
- RFC 5321, "Simple Mail Transfer Protocol",
  https://www.rfc-editor.org/rfc/rfc5321
- RFC 5905, "Network Time Protocol Version 4",
  https://www.rfc-editor.org/rfc/rfc5905
- Linux manual, "clock_getres(2)",
  https://man7.org/linux/man-pages/man2/clock_gettime.2.html
- Linux manual, "cron(8)" (cronie),
  https://man7.org/linux/man-pages/man8/cron.8.html
- Stripe, "Idempotent requests", https://docs.stripe.com/api/idempotent_requests
- Stripe, "API v2 overview", https://docs.stripe.com/api-v2-overview#idempotency
- Stripe, "Receive Stripe events in your webhook endpoint",
  https://docs.stripe.com/webhooks
- Stripe, "Recover abandoned carts",
  https://docs.stripe.com/payments/checkout/abandoned-carts
- stripe-node, `src/Webhooks.ts`,
  https://github.com/stripe/stripe-node/blob/master/src/Webhooks.ts
- GitHub, "Handling failed webhook deliveries",
  https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries
- GitHub, "Best practices for using webhooks",
  https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks
- Amazon SQS, "Standard queues",
  https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues.html
- Amazon SQS, "Visibility timeout",
  https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
- Amazon SQS, "Exactly-once processing",
  https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-exactly-once-processing.html
- Amazon SQS, "FIFO queue delivery logic",
  https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-understanding-logic.html
- Amazon SQS, "Message quotas",
  https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html
- Kubernetes, "CronJob",
  https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/
- Google Cloud, "Cloud Scheduler overview",
  https://docs.cloud.google.com/scheduler/docs/overview
