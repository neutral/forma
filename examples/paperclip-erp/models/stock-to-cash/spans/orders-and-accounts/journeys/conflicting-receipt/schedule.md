| Entity | Value |
| --- | --- |
| batch | 1 |
| invoice | 1 |
| order | 1 |
| shipment | 1 |

| Step | Bindings |
| --- | --- |
| 1 | request = IF profile = 3 /\ <<1, {1,2,3,4}, 4>> \in BatchRequests THEN <<1, {1,2,3,4}, 4>> ELSE <<1, {}, 1>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 4>> |
| 4 | request = <<1, 1, 4, {1,2,3,4}>> |
| 5 | request = <<1, 1, {1,2,3,4}>> |
| 6 | s = 1 |
| 7 | s = 1 |
| 8 | request = <<1, 1, 1>> |
| 9 | request = <<1, 1, 2>> |
