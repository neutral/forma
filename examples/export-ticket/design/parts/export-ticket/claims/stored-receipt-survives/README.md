# A completed claim survives expiry and reply loss

| Field | Value |
| --- | --- |
| Sentence | After Complete creates a receipt and marks its ticket claimed, expiry and a failed or lost reply preserve that stored receipt's identity and the claim and do not delete the prepared export, independently of whether a later fetch is permitted. |
| Kind | safety |
| Stake | The recipient could lose the durable receipt or export from a completed claim because the reply failed or the ticket later expired. |
| Rests on | atomic-completion, stable-identities, authorized-recipient, only-service-writes, records, ticket, pending-checks, receipts, store:records, export |
| Parts | export-ticket |
| Origin | stated |
| Cites | design/brief/overview.md#purpose, design/brief/overview.md#claim-design |
