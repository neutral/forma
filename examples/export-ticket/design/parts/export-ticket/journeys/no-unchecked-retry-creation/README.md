# A retry without a remembered passing check cannot create a receipt

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 2 |
| Origin | added |
| Cites | design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The authorized recipient | request-retry | Ticket t and the same request key a; no reply to the original claim has been received; send the one retry allowed for a in this examination. | - | - |
| 2 | The export-ticket service | retry-claim | Ticket t and the received retry of key a, whose original request was issued but never passed Check; attempt to create a fresh receipt without a remembered passing check. | - | - |
