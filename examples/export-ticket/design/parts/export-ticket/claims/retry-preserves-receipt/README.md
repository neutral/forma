# A retry preserves and returns the original receipt

| Field | Value |
| --- | --- |
| Sentence | Once a request key has a durable receipt, a retry of that key before or after expiry preserves that original receipt, creates no additional receipt and confers no additional claim, and any delivered retry reply returns that original receipt rather than a replacement. |
| Kind | safety |
| Stake | The recipient could receive a different grant after an uncertain reply, and the export owner could confer another claim for a ticket already claimed. |
| Rests on | atomic-completion, stable-identities, authorized-recipient, only-service-writes, records, ticket, pending-checks, receipts, store:records, choice:fetch-after-expiry |
| Parts | export-ticket |
| Origin | stated |
| Cites | design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply, design/brief/overview.md#purpose, design/brief/overview.md#required-behavior |
