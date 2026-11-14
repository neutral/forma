---
format: forma/1
---
# Export ticket

## Purpose

A small service lets the recipient of a prepared export claim a durable receipt.
The receipt unlocks that export. A ticket is intended for one successful claim,
not one network packet. Fetching an already-created receipt is a read; it does
not create another receipt. Examine the design, not an implementation.

## Claim design

The service owns tickets, pending checks and receipts. A ticket begins active,
unclaimed and without any pending check or receipt. Expiry status (active or expired) and whether the ticket has been claimed are
separate state: claiming does not prevent later expiry. Two distinct request
keys may be in flight for the same ticket.

A Check operation is permitted while the ticket is active and has no receipt.
It remembers that this request key passed. Check neither claims the ticket nor
creates a receipt. Each request key may be checked and completed once in this
version.

A Complete operation is permitted when its request key has a remembered passing
check. It creates a fresh receipt and marks the ticket claimed in one atomic
store action. Complete consults the remembered check; it does not recheck the
ticket's current phase. Returning the created receipt to the recipient is a
later operation and may lose its reply. A failed reply does not undo the stored
receipt. This version does not retry a request key.

Expiry is an independent operation. It changes an active ticket to expired,
including while checks are pending. It does not delete remembered checks,
receipts or the export. Once expired, the ticket cannot become active again.

## Required behavior

No new receipt may be created after the ticket expires. At most one receipt
may ever be created for a ticket, even when two request keys overlap. A claim
completed before expiry must remain possible; refusing every claim is not an
acceptable design. Expiry and concurrent request keys must remain possible.

Whether a recipient may fetch an already-created receipt after expiry is not
yet decided. Put that question to the developer; do not treat creating a new
receipt and reading the original receipt as the same action.

## Given conditions

Expiry is represented by an explicit event; this first design does not claim a
wall-clock implementation or tolerance. The store action that creates a receipt
and marks the ticket claimed is atomic. Request keys and receipt ids are stable
identities, and a fresh receipt has a different id. The recipient is already
authorized for this export. No other service or unknown actor changes these
records.

## Scope

Start with one ticket, two request keys, at most two receipt creations, and one
expiry event. Explain these limits. Larger populations, delivery of bytes,
cryptographic security, storage failures and eventual completion are outside
this examination. Use the smallest supported engine that answers the stated
design questions without deleting permitted behavior.

## Scale

1. Do not create access after expiry.
2. Do not claim the same ticket more than once.
3. Preserve an ordinary successful claim and distinguish receipt retrieval.
