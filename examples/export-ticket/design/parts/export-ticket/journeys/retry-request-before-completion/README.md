# No reply permits a retry while the original completion is still pending

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | Ticket t is still active and unclaimed with no receipt, a passing check for a is remembered, and a retry of a is available without pretending the original request completed. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The authorized recipient | request-retry | Ticket t and the same request key a; no reply to the original claim has been received; send the one retry allowed for a in this examination. | - | - |
