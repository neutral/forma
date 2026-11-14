# A retry after expiry must not create a replacement receipt

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 6 |
| Origin | added |
| Cites | design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create the original fresh receipt r-a through the normal repaired first-completion path. | - | - |
| 3 | The export-ticket service | return-receipt | Ticket t and completed request key a; attempt to return r-a, but the reply is lost and the recipient observes no reply; r-a stays stored and the ticket stays claimed. | - | - |
| 4 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
| 5 | The authorized recipient | request-retry | Ticket t and the same request key a; no reply to the original claim has been received; send the one retry allowed for a in this examination. | - | - |
| 6 | The export-ticket service | retry-claim | Ticket t and the received retry of key a; use a's remembered passing check to create a fresh receipt r-a-retry distinct from the original stored r-a, bypassing the normal first-completion gate. | - | - |
