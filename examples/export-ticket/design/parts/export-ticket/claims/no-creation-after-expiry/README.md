# No new receipt after expiry

| Field | Value |
| --- | --- |
| Sentence | Once a ticket's expiry event has occurred, no new receipt may be created for it, including from a previously passing check or an overlapping request key. |
| Kind | safety |
| Stake | The export owner could grant new durable access after the ticket's cutoff. |
| Rests on | atomic-completion, stable-identities, authorized-recipient, only-service-writes, records, ticket, pending-checks, receipts, store:records |
| Parts | export-ticket |
| Origin | stated |
| Cites | design/brief/overview.md#required-behavior, design/brief/overview.md#scale, design/brief/overview.md#purpose, design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply |
