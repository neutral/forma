# Ticket expiry and claim state

| Field | Value |
| --- | --- |
| Entity | ticket |
| Initial | active-unclaimed |
| Ends | none |
| Unaffected | request-retry |
| Origin | stated |
| Cites | design/brief/overview.md#claim-design, design/brief/overview.md#required-behavior, design/brief/changes/v2.md#change-retry-a-claim-after-an-uncertain-reply |

| Phase | check | complete | return-receipt | fetch-receipt | expire | retry-claim | return-retry-receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| active-unclaimed | active-unclaimed | active-claimed | None. | None. | expired-unclaimed | active-claimed | None. |
| active-claimed | None. | active-claimed | active-claimed | active-claimed | expired-claimed | active-claimed | active-claimed |
| expired-unclaimed | None. | expired-claimed | None. | None. | None. | expired-claimed | None. |
| expired-claimed | None. | expired-claimed | expired-claimed | choice:fetch-after-expiry | None. | expired-claimed | expired-claimed |
