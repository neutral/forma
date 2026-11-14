# At most one receipt for a ticket

| Field | Value |
| --- | --- |
| Sentence | At most one distinct receipt may ever be created for a ticket across all request keys, including overlapping checks and failed or lost replies; returning or fetching the original receipt is not another creation. |
| Kind | safety |
| Stake | The export owner could grant multiple durable receipts for a ticket intended for one successful claim. |
| Rests on | atomic-completion, stable-identities, authorized-recipient, only-service-writes, records, ticket, pending-checks, receipts, store:records |
| Parts | export-ticket |
| Origin | stated |
| Cites | design/brief/overview.md#purpose, design/brief/overview.md#required-behavior, design/brief/overview.md#scale, design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply |
