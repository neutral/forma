# Boundary and shared records

## Boundary

| Row | Names | Kind | Side | Seam | Isolation | Reads | Writes | Origin | Cites |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| qa | Quality assurance staff making revision-checked hold and release decisions | actor | world | person | - | - | - | stated | design/brief/stock.md#holds-after-release, design/brief/stock.md#recording-a-batch |
| records | The one authoritative ERP store used by every named business operation | store | machine | - | serializable | qa, orders/sales, orders/picker, orders/customer, orders/carrier, accounts/finance | qa, orders/sales, orders/picker, orders/customer, orders/carrier, accounts/finance | stated | design/brief/overview.md#the-boundary-of-the-result |
| batch | A completed production batch with immutable carton membership, current quality and a quality revision | entity | machine | - | - | qa, orders/sales, orders/picker, orders/carrier, accounts/finance | qa, orders/picker | stated | design/brief/stock.md#recording-a-batch, design/brief/stock.md#holds-after-release |
| carton | An individually identified carton with its permanent batch link and its on-hand, reservation, picking and collection records | entity | machine | - | - | qa, orders/sales, orders/picker, orders/customer, orders/carrier, accounts/finance | orders/sales, orders/picker, orders/customer, orders/carrier | stated | design/brief/stock.md#finished-cartons-and-quality, design/brief/overview.md#the-business-we-examine, design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/orders.md#authorising-collection, design/brief/orders.md#cancelling-the-remainder |

## Surface

| Direction | Name | Cites |
| --- | --- | --- |
| reads | records | design/brief/overview.md#the-boundary-of-the-result |
| writes | records | design/brief/overview.md#the-boundary-of-the-result |
| reads | batch | design/brief/stock.md#holds-after-release |
| writes | batch | design/brief/stock.md#holds-after-release |
| reads | carton | design/brief/stock.md#recording-a-batch |
| writes | carton | design/brief/stock.md#recording-a-batch |
| reads | orders/shipment | design/brief/stock.md#holds-after-release |
| reads | orders/order | design/brief/stock.md#holds-after-release |
| calls | qa | design/brief/stock.md#holds-after-release |
| calls | orders/picker | design/brief/stock.md#recording-a-batch |
