# A retry before expiry returns the original receipt after a lost reply

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | The recipient has received the original durable receipt r-a from step 2 in a successful reply to the one retry of key a while ticket t remains active. The same r-a remains stored and is the only receipt ever created for t; the retry creates no additional receipt and confers no additional claim. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create the original fresh receipt r-a through the normal repaired first-completion path. | - | - |
| 3 | The export-ticket service | return-receipt | Ticket t and completed request key a; attempt to return r-a, but the reply is lost and the recipient observes no reply; r-a stays stored and the ticket stays claimed. | - | - |
| 4 | The authorized recipient | request-retry | Ticket t and the same request key a; no reply to the original claim has been received; send the one retry allowed for a in this examination. | - | - |
| 5 | The export-ticket service | retry-claim | Active ticket t and the received retry of key a, with a's remembered passing check and the original durable receipt r-a already stored; handle this one retry. | - | - |
| 6 | The export-ticket service | return-retry-receipt | Active ticket t and the handled retry of key a; successfully deliver the retry reply containing the same original stored receipt r-a from step 2, so the recipient observes r-a. A replacement receipt does not satisfy this step. | - | - |
