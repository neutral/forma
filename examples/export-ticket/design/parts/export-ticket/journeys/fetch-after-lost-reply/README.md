# The original receipt remains retrievable after reply loss and expiry

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | After expiry and a lost original reply, the recipient reads the same durable receipt r-a; exactly one receipt and claim remain. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply, design/brief/overview.md#purpose, design/brief/overview.md#required-behavior |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create the original fresh receipt r-a through the normal repaired first-completion path. | - | - |
| 3 | The export-ticket service | return-receipt | Ticket t and completed request key a; attempt to return r-a, but the reply is lost and the recipient observes no reply; r-a stays stored and the ticket stays claimed. | - | - |
| 4 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
| 5 | The export-ticket service | fetch-receipt | Ticket t; retrieve the original stored receipt r-a under the existing fetch-after-expiry pick, without a new completion, receipt or claim. | - | - |
