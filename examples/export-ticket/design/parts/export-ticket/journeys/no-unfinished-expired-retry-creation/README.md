# An unfinished key must not acquire its first receipt by retry after expiry

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 4 |
| Origin | added |
| Cites | design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
| 3 | The authorized recipient | request-retry | Ticket t and the same request key a; no reply to the original claim has been received; send the one retry allowed for a in this examination. | - | - |
| 4 | The export-ticket service | retry-claim | Ticket t and the received retry of key a, whose passing check is remembered but whose original request never completed; attempt to create its first fresh receipt after expiry. | - | - |
