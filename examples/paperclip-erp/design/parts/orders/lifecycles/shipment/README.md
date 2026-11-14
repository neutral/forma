# Fixed shipment membership and collection

| Field | Value |
| --- | --- |
| Entity | shipment |
| Initial | unprepared |
| Ends | collected, void |
| Unaffected | record-order, confirm-order |
| Origin | stated |
| Cites | design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/orders.md#authorising-collection, design/brief/orders.md#cancelling-the-remainder, design/brief/overview.md#the-boundary-of-the-result |

| Phase | prepare-shipment | collect-shipment | cancel-remainder |
| --- | --- | --- | --- |
| unprepared | new: prepared<br>replay: None. | partial: None.<br>complete: None.<br>replay: None. | new: unprepared<br>replay: unprepared |
| prepared | new: None.<br>replay: prepared | partial: collected<br>complete: collected<br>replay: None. | new: void<br>replay: None. |
| collected | new: None.<br>replay: collected | partial: None.<br>complete: None.<br>replay: collected | new: collected<br>replay: collected |
| void | new: None.<br>replay: void | partial: None.<br>complete: None.<br>replay: None. | new: None.<br>replay: void |
