| Entity | Value |
| --- | --- |
| batch | 1 |
| order | 1 |
| shipment | 1 |

| Step | Bindings |
| --- | --- |
| 1 | request = IF profile = 2 /\ <<1, {1,2}, 2>> \in BatchRequests THEN <<1, {1,2}, 2>> ELSE <<1, {}, 1>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 2>> |
| 4 | request = <<1, 1, 2, {1,2}>> |
| 5 | request = <<1, 1, {1,2}>> |
| 6 | request = <<2, 1, 1>> |
| 7 | request = <<1, 1, 0, TRUE>> |
| 8 | request = <<3, 1, 1, TRUE>> |
