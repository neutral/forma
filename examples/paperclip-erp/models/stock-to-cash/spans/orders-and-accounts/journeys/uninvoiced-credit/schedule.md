| Entity | Value |
| --- | --- |
| batch | 1 |
| first-order | 1 |
| first-shipment | 1 |
| second-order | 2 |

| Start |
| --- |
| Init /\ profile = 1 |

| Step | Bindings |
| --- | --- |
| 1 | request = <<1, {1,2,3,4}, 4>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 2>> |
| 4 | request = <<2, 1, 2>> |
| 5 | request = <<1, 1, 2, {1,2}>> |
| 6 | request = <<1, 1, {1,2}>> |
| 7 | s = 1 |
| 8 | request = <<2, 1, 2, {3,4}>> |
