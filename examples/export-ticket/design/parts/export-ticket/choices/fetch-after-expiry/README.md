# May the original receipt be fetched after expiry?

| Field | Value |
| --- | --- |
| Question | After a receipt was created before expiry, may the authorized recipient fetch that same stored receipt after the ticket expires, or must that read be refused even though the receipt remains stored? |
| Recommendation | a: the brief calls the receipt durable and distinguishes reading it from a new claim, so allowing retrieval preserves a completed claim without creating a receipt after expiry; the brief explicitly leaves this policy to the developer. |
| Cites | design/brief/overview.md#required-behavior, design/brief/overview.md#purpose, design/brief/overview.md#claim-design |

## a

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | The recipient reads the same receipt r-a after expiry, with no new receipt or claim. |
| Refused step | - |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create fresh receipt r-a. | - | - |
| 3 | The export-ticket service | return-receipt | Ticket t and completed request key a; deliver the already-stored receipt r-a in the ordinary successful reply. | - | - |
| 4 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
| 5 | The export-ticket service | fetch-receipt | Ticket t; retrieve the original stored receipt r-a without a new completion or creation. | - | - |

| Lifecycle | Phase | Action | Outcome |
| --- | --- | --- | --- |
| ticket-state | expired-claimed | fetch-receipt | expired-claimed |

## b

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 5 |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create fresh receipt r-a. | - | - |
| 3 | The export-ticket service | return-receipt | Ticket t and completed request key a; deliver the already-stored receipt r-a in the ordinary successful reply. | - | - |
| 4 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
| 5 | The export-ticket service | fetch-receipt | Ticket t; retrieve the original stored receipt r-a without a new completion or creation. | - | - |

| Lifecycle | Phase | Action | Outcome |
| --- | --- | --- | --- |
| ticket-state | expired-claimed | fetch-receipt | None. |
