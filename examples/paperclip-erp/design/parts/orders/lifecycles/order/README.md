# Order commitment and remainder

| Field | Value |
| --- | --- |
| Entity | order |
| Initial | unrecorded |
| Ends | complete, cancelled |
| Unaffected | none |
| Origin | stated |
| Cites | design/brief/orders.md#orders-and-dispatch, design/brief/orders.md#confirming-an-order, design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/orders.md#authorising-collection, design/brief/orders.md#cancelling-the-remainder, design/brief/overview.md#the-boundary-of-the-result |

| Phase | record-order | confirm-order | prepare-shipment | collect-shipment | cancel-remainder |
| --- | --- | --- | --- | --- | --- |
| unrecorded | draft | new: None.<br>replay: None. | new: None.<br>replay: None. | partial: None.<br>complete: None.<br>replay: None. | new: None.<br>replay: None. |
| draft | draft | new: open<br>replay: None. | new: None.<br>replay: None. | partial: None.<br>complete: None.<br>replay: None. | new: None.<br>replay: None. |
| open | open | new: None.<br>replay: open | new: open<br>replay: open | partial: open<br>complete: complete<br>replay: open | new: cancelled<br>replay: None. |
| complete | complete | new: None.<br>replay: complete | new: None.<br>replay: complete | partial: None.<br>complete: None.<br>replay: complete | new: None.<br>replay: None. |
| cancelled | cancelled | new: None.<br>replay: cancelled | new: None.<br>replay: cancelled | partial: None.<br>complete: None.<br>replay: cancelled | new: None.<br>replay: cancelled |
