--------------------------- MODULE ExportTicket ---------------------------
EXTENDS Naturals, FiniteSets
CONSTANTS Tickets, Keys, ReceiptIds, CopyClass
VARIABLES ticket, requests, receipts, exportPresent, channel, recipient, audit
vars == <<ticket, requests, receipts, exportPresent, channel, recipient, audit>>

NoReceipt == "none"
Routes == {"direct", "held", "dropped"}
Modes == {"up", "transient", "permanent", "crashed", "silent"}
ReplyKinds == {"original", "retry"}
Events == {"init", "check", "complete", "return", "fetch", "expire",
           "request-retry", "retry-claim", "return-retry",
           "drop", "duplicate-request", "duplicate-reply", "delay", "reorder",
           "fail-forever", "fail-then-succeed", "crash", "go-silent"}
Checked == {k \in Keys : requests[k].checked}
Completed == {k \in Keys : requests[k].completed}
Attempted == {k \in Keys : requests[k].replied}
RetryAttempted == {k \in Keys : requests[k].retryReplied}
AllAttempted == {<<k, "original">> : k \in Attempted}
                \cup {<<k, "retry">> : k \in RetryAttempted}
PendingChecks == Checked \ Completed
CapNext(n) == IF n < CopyClass THEN n + 1 ELSE n
Delivered(rcpt, r) == [rcpt EXCEPT !.seen = @ \cup {r},
  !.deliveries[r] = CapNext(@),
  !.replies = [k \in Keys |->
    IF r = requests[k].receipt \/ r = requests[k].retryReceipt
    THEN rcpt.replies[k] \cup {r} ELSE rcpt.replies[k]]]

\* Keep the old normal-reply fields and all seven variables: existing slots
\* retain their names and frames. Retry replies have a separate channel.
ReplyChannelType == [route : [Keys -> Routes], pending : SUBSET Keys,
  before : SUBSET (Keys \X Keys), extra : SUBSET Keys,
  copyFirst : SUBSET Keys, reordered : SUBSET Keys]
EmptyReplyChannel == [route |-> [k \in Keys |-> "direct"], pending |-> {},
  before |-> {}, extra |-> {}, copyFirst |-> {}, reordered |-> {}]
ChannelFrom(ch, s) ==
  IF s = "retry" THEN ch.retry
  ELSE [route |-> ch.route, pending |-> ch.pending, before |-> ch.before,
        extra |-> ch.extra, copyFirst |-> ch.copyFirst, reordered |-> ch.reordered]
ChannelFor(s) == ChannelFrom(channel, s)
WithChannel(ch, s, c) ==
  IF s = "retry" THEN [ch EXCEPT !.retry = c]
  ELSE [ch EXCEPT !.route = c.route, !.pending = c.pending, !.before = c.before,
                  !.extra = c.extra, !.copyFirst = c.copyFirst, !.reordered = c.reordered]
SetRoute(ch, s, k, route) ==
  LET c == ChannelFrom(ch, s)
  IN WithChannel(ch, s, [c EXCEPT !.route[k] = route])
ReplyReceipt(k, s) ==
  IF s = "original" THEN requests[k].receipt ELSE requests[k].retryReceipt
ReplyAttempted(s) == IF s = "original" THEN Attempted ELSE RetryAttempted
MarkReply(a, s, failed, lost, transient, label) ==
  IF s = "original"
  THEN [a EXCEPT !.failed = @ \cup failed, !.lost = @ \cup lost,
                 !.transientFailed = @ \cup transient, !.event = label]
  ELSE [a EXCEPT !.retryFailed = @ \cup failed, !.retryLost = @ \cup lost,
                 !.retryTransientFailed = @ \cup transient, !.event = label]

\* Values only: none of the claims, nor atomicity, is in TypeOK.
TypeOK ==
  /\ ticket \in [expired : BOOLEAN, claimed : BOOLEAN]
  /\ requests \in [Keys -> [checked : BOOLEAN, completed : BOOLEAN,
                            receipt : ReceiptIds \cup {NoReceipt}, replied : BOOLEAN,
                            retryAvailable : BOOLEAN, retryCompleted : BOOLEAN,
                            retryReceipt : ReceiptIds \cup {NoReceipt}, retryReplied : BOOLEAN]]
  /\ receipts \subseteq ReceiptIds /\ exportPresent \in BOOLEAN
  /\ channel \in [route : [Keys -> Routes], pending : SUBSET Keys,
                    before : SUBSET (Keys \X Keys), extra : SUBSET Keys,
                    copyFirst : SUBSET Keys, reordered : SUBSET Keys,
                    retry : ReplyChannelType,
                    replyBefore : SUBSET ((Keys \X ReplyKinds) \X (Keys \X ReplyKinds))]
  /\ recipient \in [mode : Modes, copies : [Keys -> 1..CopyClass],
                      seen : SUBSET ReceiptIds, deliveries : [ReceiptIds -> 0..CopyClass],
                      replies : [Keys -> SUBSET ReceiptIds], retrySent : SUBSET Keys]
  /\ audit \in [created : SUBSET ReceiptIds, expiryReceipts : SUBSET ReceiptIds,
                  expiryPending : SUBSET Keys, expiryRetryPending : SUBSET Keys,
                  failed : SUBSET Keys, lost : SUBSET Keys, transientFailed : SUBSET Keys,
                  retryFailed : SUBSET Keys, retryLost : SUBSET Keys,
                  retryTransientFailed : SUBSET Keys,
                  fetched : SUBSET ReceiptIds, fetchResult : ReceiptIds \cup {NoReceipt},
                  event : Events]

Init ==
  /\ ticket = [expired |-> FALSE, claimed |-> FALSE]
  /\ requests = [k \in Keys |-> [checked |-> FALSE, completed |-> FALSE,
                                receipt |-> NoReceipt, replied |-> FALSE,
                                retryAvailable |-> FALSE, retryCompleted |-> FALSE,
                                retryReceipt |-> NoReceipt, retryReplied |-> FALSE]]
  /\ receipts = {} /\ exportPresent = TRUE
  /\ channel = [route |-> [k \in Keys |-> "direct"], pending |-> {}, before |-> {},
                  extra |-> {}, copyFirst |-> {}, reordered |-> {},
                  retry |-> EmptyReplyChannel, replyBefore |-> {}]
  /\ recipient = [mode |-> "up", copies |-> [k \in Keys |-> 1],
                    seen |-> {}, deliveries |-> [r \in ReceiptIds |-> 0],
                    replies |-> [k \in Keys |-> {}], retrySent |-> {}]
  /\ audit = [created |-> {}, expiryReceipts |-> {}, expiryPending |-> {},
                expiryRetryPending |-> {},
                failed |-> {}, lost |-> {},
                transientFailed |-> {}, retryFailed |-> {}, retryLost |-> {},
                retryTransientFailed |-> {}, fetched |-> {}, fetchResult |-> NoReceipt,
                event |-> "init"]

TicketPhase(t) ==
  IF ticket.expired
  THEN IF ticket.claimed THEN "expired-claimed" ELSE "expired-unclaimed"
  ELSE IF ticket.claimed THEN "active-claimed" ELSE "active-unclaimed"

\* Each key is already a supplied request. Check reads current eligibility;
\* Complete is the separate, explicitly atomic write on that remembered check.
\* No store isolation stronger than the stated action grain is inferred.
Check(t, k) ==
  /\ ~ticket.expired /\ ~ticket.claimed /\ receipts = {}
  /\ ~requests[k].checked /\ ~requests[k].completed
  /\ requests' = [requests EXCEPT ![k].checked = TRUE]
  /\ audit' = [audit EXCEPT !.event = "check"]
  /\ UNCHANGED <<ticket, receipts, exportPresent, channel, recipient>>

\* The expiry decision and creation share this atomic store action, so a
\* passing Check cannot authorize a creation after the ticket expires.
\* The same atomic action also tests the current claim flag, arbitrating
\* every checked key on this ticket. A losing key keeps its remembered check
\* but cannot create; it may still fetch the winning key's stored receipt.
Complete(t, k, r) ==
  /\ ~ticket.expired
  /\ ~ticket.claimed
  /\ requests[k].checked /\ ~requests[k].completed
  /\ r \notin audit.created
  /\ ticket' = [ticket EXCEPT !.claimed = TRUE]
  /\ requests' = [requests EXCEPT ![k].completed = TRUE, ![k].receipt = r]
  /\ receipts' = receipts \cup {r}
  /\ audit' = [audit EXCEPT !.created = @ \cup {r}, !.event = "complete"]
  /\ UNCHANGED <<exportPresent, channel, recipient>>

\* The ruled ordinary return action includes both delivery and immediate loss.
\* Its lose parameter records the permitted outcome of this attempt, not a
\* service decision to discard a reply. Both values are searched in the row;
\* schedules bind the outcome their journey states. Loss consumes the attempt,
\* records no delivery and leaves every durable service result unchanged.
\* World rows can also hold/drop the channel or disable its receiver. A held
\* reply may arrive later, with no expiry or step deadline.
SendReply(k, s, label, lose) ==
  /\ LET r == ReplyReceipt(k, s)
         c == ChannelFor(s)
         succeeds == ~lose /\ recipient.mode = "up" /\ c.route[k] = "direct"
         waits == ~lose /\ c.route[k] # "dropped"
                   /\ (recipient.mode = "silent"
                       \/ (recipient.mode = "up" /\ c.route[k] = "held"))
         sent == WithChannel(channel, s,
                   [c EXCEPT !.before = @ \cup (ReplyAttempted(s) \X {k}),
                             !.pending = IF waits THEN @ \cup {k} ELSE @])
     IN /\ requests' = IF s = "original"
                       THEN [requests EXCEPT ![k].replied = TRUE]
                       ELSE [requests EXCEPT ![k].retryReplied = TRUE]
        /\ channel' = [sent EXCEPT !.replyBefore = @ \cup (AllAttempted \X {<<k, s>>})]
        /\ recipient' = IF succeeds THEN Delivered(recipient, r) ELSE recipient
        /\ audit' = MarkReply(audit, s,
             IF ~succeeds /\ ~waits THEN {k} ELSE {},
             IF lose \/ c.route[k] = "dropped" \/ recipient.mode = "crashed" THEN {k} ELSE {},
             IF recipient.mode = "transient" THEN {k} ELSE {}, label)
  /\ UNCHANGED <<ticket, receipts, exportPresent>>

ReturnReceipt(t, k, lose) ==
  /\ requests[k].completed /\ ~requests[k].replied /\ ticket.claimed
  /\ requests[k].receipt \in receipts
  /\ SendReply(k, "original", "return", lose)

\* The recipient knows only that it issued the key and has observed no reply.
\* It need not know whether the service checked, completed, or lost a reply.
\* Both original requests were issued in Init. This explicit send is distinct
\* from a transport duplicate and does not create a receipt.
RequestRetry(t, k) ==
  /\ recipient.mode = "up" /\ recipient.replies[k] = {}
  /\ k \notin recipient.retrySent
  /\ recipient' = [recipient EXCEPT !.retrySent = @ \cup {k}]
  /\ requests' = [requests EXCEPT ![k].retryAvailable = TRUE]
  /\ audit' = [audit EXCEPT !.event = "request-retry"]
  /\ UNCHANGED <<ticket, receipts, exportPresent, channel>>

\* A retry replays its key's durable result, including after expiry. The r
\* parameter is the returned identity: a fresh replacement for a completed
\* key is refused, rather than silently ignored. An unfinished key may create
\* only under the same atomic active/unclaimed gate as normal Complete.
\* Both entry points store the canonical completion and result together, so
\* a later original completion cannot repeat a creation won by the retry.
RetryClaim(t, k, r) ==
  /\ requests[k].retryAvailable /\ requests[k].checked
  /\ ~requests[k].retryCompleted
  /\ IF requests[k].completed
     THEN /\ r = requests[k].receipt /\ r \in receipts
          /\ requests' = [requests EXCEPT ![k].retryAvailable = FALSE,
                           ![k].retryCompleted = TRUE, ![k].retryReceipt = r]
          /\ audit' = [audit EXCEPT !.event = "retry-claim"]
          /\ UNCHANGED <<ticket, receipts>>
     ELSE /\ ~ticket.expired /\ ~ticket.claimed
          /\ r \notin audit.created
          /\ ticket' = [ticket EXCEPT !.claimed = TRUE]
          /\ requests' = [requests EXCEPT ![k].completed = TRUE, ![k].receipt = r,
                           ![k].retryAvailable = FALSE,
                           ![k].retryCompleted = TRUE, ![k].retryReceipt = r]
          /\ receipts' = receipts \cup {r}
          /\ audit' = [audit EXCEPT !.created = @ \cup {r}, !.event = "retry-claim"]
  /\ UNCHANGED <<exportPresent, channel, recipient>>

ReturnRetryReceipt(t, k) ==
  /\ requests[k].retryCompleted /\ ~requests[k].retryReplied /\ ticket.claimed
  /\ requests[k].retryReceipt \in receipts
  /\ SendReply(k, "retry", "return-retry", FALSE)

\* Pick a permits reading a stored receipt after expiry as well as before it.
\* fetchResult records the store read; a stopped recipient may not see it.
FetchReceipt(t, r) ==
  /\ r \in receipts /\ ticket.claimed
  /\ audit' = [audit EXCEPT !.fetched = @ \cup {r}, !.fetchResult = r, !.event = "fetch"]
  /\ recipient' = IF recipient.mode = "up"
                   THEN [recipient EXCEPT !.seen = @ \cup {r}] ELSE recipient
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent, channel>>

Expire(t) ==
  /\ ~ticket.expired
  /\ ticket' = [ticket EXCEPT !.expired = TRUE]
  /\ audit' = [audit EXCEPT !.expiryReceipts = audit.created,
                !.expiryPending = channel.pending,
                !.expiryRetryPending = channel.retry.pending, !.event = "expire"]
  /\ UNCHANGED <<requests, receipts, exportPresent, channel, recipient>>

\* The remaining rows are the recipient seam, never store writers. Both reply
\* streams can be lost, delayed, copied and reordered independently. Observation
\* records are never read by service guards.
DropReplyIn(k, s) ==
  /\ LET c == ChannelFor(s)
     IN \/ /\ k \notin ReplyAttempted(s) /\ c.route[k] # "dropped"
           /\ channel' = SetRoute(channel, s, k, "dropped")
           /\ audit' = [audit EXCEPT !.event = "drop"]
        \/ \E original \in BOOLEAN, copy \in BOOLEAN :
             /\ (original /\ k \in c.pending) \/ (copy /\ k \in c.extra)
             /\ channel' = WithChannel(channel, s,
                  [c EXCEPT !.route[k] = "dropped",
                    !.pending = IF original THEN @ \ {k} ELSE @,
                    !.extra = IF copy THEN @ \ {k} ELSE @])
             /\ audit' = MarkReply(audit, s, {k}, {k}, {}, "drop")
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent, recipient>>

DropReply(k) == \E s \in ReplyKinds : DropReplyIn(k, s)

\* Duplicate transport requests retain their key; only the explicit retry action
\* sends the one retry permitted by this examination. Both reply streams retain
\* a later copy independently of their pending first copy.
DuplicateReplyIn(k, s) ==
  /\ recipient.mode = "up"
  /\ k \in ReplyAttempted(s) /\ ReplyReceipt(k, s) \in receipts
  /\ LET c == ChannelFor(s)
     IN \/ /\ k \in c.pending
           /\ channel' = WithChannel(channel, s, [c EXCEPT !.extra = @ \cup {k}])
           /\ UNCHANGED recipient
        \/ /\ k \notin c.pending /\ recipient.deliveries[ReplyReceipt(k, s)] > 0
           /\ recipient' = Delivered(recipient, ReplyReceipt(k, s))
           /\ UNCHANGED channel
  /\ audit' = [audit EXCEPT !.event = "duplicate-reply"]
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent>>

Duplicate(k, kind) ==
  /\ recipient.mode = "up"
  /\ IF kind = "request"
     THEN /\ recipient' = [recipient EXCEPT !.copies[k] = CapNext(@)]
          /\ audit' = [audit EXCEPT !.event = "duplicate-request"]
          /\ UNCHANGED <<ticket, requests, receipts, exportPresent, channel>>
     ELSE \E s \in ReplyKinds : DuplicateReplyIn(k, s)

ReleaseReplyIn(k, s, label) ==
  /\ recipient.mode = "up" /\ k \in ChannelFor(s).pending
  /\ ReplyReceipt(k, s) \in receipts
  /\ LET c == ChannelFor(s)
     IN channel' = WithChannel(channel, s,
          [c EXCEPT !.pending = @ \ {k},
            !.reordered = IF k \in c.copyFirst THEN @ \cup {k} ELSE @])
  /\ recipient' = Delivered(recipient, ReplyReceipt(k, s))
  /\ audit' = [audit EXCEPT !.event = label]
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent>>

ReleaseExtraIn(k, s) ==
  /\ recipient.mode = "up"
  /\ k \in ChannelFor(s).extra /\ k \notin ChannelFor(s).pending
  /\ ReplyReceipt(k, s) \in receipts
  /\ LET c == ChannelFor(s)
     IN channel' = WithChannel(channel, s, [c EXCEPT !.extra = @ \ {k}])
  /\ recipient' = Delivered(recipient, ReplyReceipt(k, s))
  /\ audit' = [audit EXCEPT !.event = "delay"]
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent>>

\* Preserve the old helper interface for slots about normal replies.
ReleaseReply(k, label) == ReleaseReplyIn(k, "original", label)
ReleaseExtra(k) == ReleaseExtraIn(k, "original")

DelayReplyIn(k, s) ==
  \/ /\ k \notin ReplyAttempted(s) /\ ChannelFor(s).route[k] = "direct"
     /\ channel' = SetRoute(channel, s, k, "held")
     /\ audit' = [audit EXCEPT !.event = "delay"]
     /\ UNCHANGED <<ticket, requests, receipts, exportPresent, recipient>>
  \/ ReleaseReplyIn(k, s, "delay")
  \/ ReleaseExtraIn(k, s)

DelayReply(k) == \E s \in ReplyKinds : DelayReplyIn(k, s)

\* replyBefore orders actual service attempts across both streams and keys.
\* For one attempt, copyFirst/reordered retain the accepted transport-copy
\* repair: a later copy overtakes its pending original, then the original arrives.
ReorderRepliesIn(earlier, es, later, ls) ==
  \/ /\ <<earlier, es>> # <<later, ls>>
     /\ \/ /\ earlier \notin ReplyAttempted(es) /\ later \notin ReplyAttempted(ls)
            /\ ChannelFor(es).route[earlier] = "direct"
            /\ ChannelFor(ls).route[later] = "direct"
            /\ channel' = SetRoute(SetRoute(channel, es, earlier, "held"), ls, later, "held")
            /\ audit' = [audit EXCEPT !.event = "reorder"]
            /\ UNCHANGED <<ticket, requests, receipts, exportPresent, recipient>>
        \/ /\ <<<<earlier, es>>, <<later, ls>>>> \in channel.replyBefore
            /\ earlier \in ChannelFor(es).pending /\ later \in ChannelFor(ls).pending
            /\ ReleaseReplyIn(later, ls, "reorder")
        \/ /\ <<<<earlier, es>>, <<later, ls>>>> \in channel.replyBefore
            /\ earlier \in ChannelFor(es).pending /\ later \notin ChannelFor(ls).pending
            /\ recipient.deliveries[ReplyReceipt(later, ls)] > 0
            /\ ReleaseReplyIn(earlier, es, "reorder")
  \/ /\ <<earlier, es>> = <<later, ls>>
     /\ earlier \in ChannelFor(es).pending /\ earlier \in ChannelFor(es).extra
     /\ recipient.mode = "up" /\ ReplyReceipt(earlier, es) \in receipts
     /\ LET c == ChannelFor(es)
        IN channel' = WithChannel(channel, es,
             [c EXCEPT !.extra = @ \ {earlier}, !.copyFirst = @ \cup {earlier}])
     /\ recipient' = Delivered(recipient, ReplyReceipt(earlier, es))
     /\ audit' = [audit EXCEPT !.event = "reorder"]
     /\ UNCHANGED <<ticket, requests, receipts, exportPresent>>
  \/ /\ <<earlier, es>> = <<later, ls>> /\ earlier \in ChannelFor(es).copyFirst
     /\ ReleaseReplyIn(earlier, es, "reorder")

ReorderReplies(earlier, later) ==
  \E es \in ReplyKinds, ls \in ReplyKinds : ReorderRepliesIn(earlier, es, later, ls)

ClearReplies ==
  [channel EXCEPT !.pending = {}, !.extra = {}, !.retry.pending = {}, !.retry.extra = {}]
FailWaiting(label, lost, transient) ==
  MarkReply(MarkReply(audit, "original", channel.pending \cup channel.extra,
    IF lost THEN channel.pending \cup channel.extra ELSE {},
    IF transient THEN channel.pending \cup channel.extra ELSE {}, label),
    "retry", channel.retry.pending \cup channel.retry.extra,
    IF lost THEN channel.retry.pending \cup channel.retry.extra ELSE {},
    IF transient THEN channel.retry.pending \cup channel.retry.extra ELSE {}, label)

FailForever ==
  /\ recipient.mode \in {"up", "transient"}
  /\ recipient' = [recipient EXCEPT !.mode = "permanent"]
  /\ channel' = ClearReplies
  /\ audit' = FailWaiting("fail-forever", FALSE, FALSE)
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent>>

\* Recovery is a recipient recovery, never a hidden service retry. A queued
\* explicit retry, a later reply, or a fetch can succeed afterwards.
FailThenSucceed ==
  /\ \/ /\ recipient.mode = "up"
         /\ recipient' = [recipient EXCEPT !.mode = "transient"]
         /\ channel' = ClearReplies
         /\ audit' = FailWaiting("fail-then-succeed", FALSE, TRUE)
     \/ /\ recipient.mode = "transient"
         /\ (audit.transientFailed # {} \/ audit.retryTransientFailed # {})
         /\ recipient' = [recipient EXCEPT !.mode = "up"]
         /\ channel' = channel
         /\ audit' = [audit EXCEPT !.event = "fail-then-succeed"]
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent>>

CrashRecipient ==
  /\ recipient.mode # "crashed"
  /\ recipient' = [recipient EXCEPT !.mode = "crashed", !.seen = {},
                    !.replies = [k \in Keys |-> {}], !.retrySent = {}]
  /\ channel' = ClearReplies
  /\ audit' = FailWaiting("crash", TRUE, FALSE)
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent>>

\* The recipient has initiated a request, then abandons the exchange partway.
\* Its memory is retained, unlike crash. Replies wait without forced recovery.
GoSilent ==
  /\ recipient.mode \in {"up", "transient"} /\ Checked # {}
  /\ recipient' = [recipient EXCEPT !.mode = "silent"]
  /\ audit' = [audit EXCEPT !.event = "go-silent"]
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent, channel>>
=============================================================================
