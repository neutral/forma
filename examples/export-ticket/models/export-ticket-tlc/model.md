# Export ticket and recipient exchange

| Field | Value |
| --- | --- |
| Engine | tlc |
| Parts | export-ticket |
| Entry | ExportTicket.tla |
| Type invariant | TypeOK |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| constant Tickets | {"t"} | One initially active unclaimed ticket and its already-prepared export; the scalar ticket state represents this one ticket. Cross-ticket interactions, export bytes, authorization, cryptography, storage failures and service restart are outside this examination. Expiry is one irreversible event, without wall-clock timing or tolerance. Store internals are represented by the stated action effects, including atomic Complete and the gap after Check; additional isolation anomalies inside a single action are not examined. |
| constant Keys | {"a", "b"} | Two distinct stable request keys, with both original requests already issued and available from the start. Each key can pass Check once and send and execute one retry, including before its original completion. Normal and retry first completion share the accepted atomic active-ticket and unclaimed-ticket checks. Both record the durable result under the request key; a retry of a completed key replays that result even after expiry. Expiry strands checked but unfinished creation, and a different key that loses the single-claim race cannot create. The stored key-to-receipt result is retained for the whole retry lifetime; no eviction or reuse of a key is examined. A retry request becomes available in its send step; loss or indefinite delay of that request is represented by leaving it unprocessed, with no eventual processing or reply guarantee. Additional keys and retries are not examined. |
| constant ReceiptIds | {"r-a", "r-b", "r-a-retry"} | Three distinct receipt identities leave room to distinguish the original result from forbidden replacement creations, including in planted faults. Every unused identity is available to either key for first creation; names do not reserve identities for particular requests. A completed-key retry must select its original stored identity. Normal and retry reply attempts remain distinct even when they carry that same identity. Receipt contents, more than three distinct identities and larger populations are not examined. |
| constant CopyClass | 2 | Recipient request and reply multiplicities distinguish one from two or more copies. Counts saturate at two without disabling further duplication. Each key has separate normal and retry reply channels, each holding one reply and one later transport copy, so either reply may be lost or delayed and copies and replies may overtake one another. Larger concurrent copy populations and exact counts above two are not examined. The recipient tracks replies actually observed per key separately from fetches and service completion. Recipient crash loses its volatile receipt view and has no restart, while service records persist. |

## Actions

| Action | Operator | Parameters |
| --- | --- | --- |
| export-ticket/check | Check | t \in Tickets, k \in Keys |
| export-ticket/complete | Complete | t \in Tickets, k \in Keys, r \in ReceiptIds |
| export-ticket/return-receipt | ReturnReceipt | t \in Tickets, k \in Keys, lose \in BOOLEAN |
| export-ticket/fetch-receipt | FetchReceipt | t \in Tickets, r \in ReceiptIds |
| export-ticket/expire | Expire | t \in Tickets |
| export-ticket/request-retry | RequestRetry | t \in Tickets, k \in Keys |
| export-ticket/retry-claim | RetryClaim | t \in Tickets, k \in Keys, r \in ReceiptIds |
| export-ticket/return-retry-receipt | ReturnRetryReceipt | t \in Tickets, k \in Keys |

## Misbehaviours

| Row | Item | Operator | Parameters |
| --- | --- | --- | --- |
| export-ticket/recipient | drop | DropReply | k \in Keys |
| export-ticket/recipient | duplicate | Duplicate | k \in Keys, kind \in {"request", "reply"} |
| export-ticket/recipient | delay | DelayReply | k \in Keys |
| export-ticket/recipient | reorder | ReorderReplies | earlier \in Keys, later \in Keys |
| export-ticket/recipient | fail-forever | FailForever | none |
| export-ticket/recipient | fail-then-succeed | FailThenSucceed | none |
| export-ticket/recipient | crash | CrashRecipient | none |
| export-ticket/recipient | go-silent | GoSilent | none |

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
| export-ticket/ticket-state | t \in Tickets | TicketPhase(t) |
