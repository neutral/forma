| Entity | Value |
| --- | --- |
| batch | 1 |
| order-o | 1 |
| shipment-one | 1 |
| shipment-two | 2 |

| Start |
| --- |
| Init /\ profile = 3 |

| Step | Bindings |
| --- | --- |
| 1 | request = <<1, {1,2,3,4}, 4>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 4>> |
| 4 | request = <<1, 1, 4, {1,2,3,4}>> |
| 5 | request = <<1, 1, {1,2}>> |
| 6 | s = 1 |
| 7 | request = <<2, 1, {3,4}>> |
| 8 | o = 1 |
| 9 | s = 2 |
