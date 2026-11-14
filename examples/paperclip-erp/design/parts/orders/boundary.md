# Boundary and shared records

## Boundary

| Row | Names | Kind | Side | Seam | Isolation | Reads | Writes | Origin | Cites |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | Sales representatives recording and confirming customer orders through the application | actor | world | person | - | - | - | stated | design/brief/orders.md#orders-and-dispatch, design/brief/orders.md#confirming-an-order |
| picker | Warehouse staff recording finished batches and preparing scanned shipments through the application | actor | world | person | - | - | - | stated | design/brief/stock.md#recording-a-batch, design/brief/orders.md#picking-and-preparing-a-shipment |
| customer | Customers requesting cancellation of their confirmed open remainder | actor | world | person | - | - | - | stated | design/brief/orders.md#cancelling-the-remainder |
| carrier | The carrier and warehouse staff at the authorised physical handoff | actor | world | person | - | - | - | stated | design/brief/orders.md#authorising-collection, design/brief/overview.md#the-boundary-of-the-result |
| order | An identified order with one customer, a positive carton quantity and its confirmed, collected or cancelled remainder | entity | machine | - | - | sales, picker, customer, carrier, accounts/finance | sales, customer, carrier | stated | design/brief/orders.md#orders-and-dispatch, design/brief/overview.md#the-business-we-examine, design/brief/orders.md#confirming-an-order, design/brief/orders.md#authorising-collection, design/brief/orders.md#cancelling-the-remainder |
| shipment | An identified prepared, collected or void shipment with one order and fixed non-empty carton membership | entity | machine | - | - | picker, customer, carrier, stock/qa, accounts/finance | picker, customer, carrier | stated | design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/orders.md#authorising-collection, design/brief/orders.md#cancelling-the-remainder, design/brief/stock.md#holds-after-release |

## Surface

| Direction | Name | Cites |
| --- | --- | --- |
| reads | stock/records | design/brief/overview.md#the-boundary-of-the-result |
| writes | stock/records | design/brief/overview.md#the-boundary-of-the-result |
| reads | stock/batch | design/brief/orders.md#authorising-collection |
| reads | stock/carton | design/brief/orders.md#confirming-an-order |
| writes | stock/carton | design/brief/orders.md#authorising-collection |
| reads | order | design/brief/orders.md#orders-and-dispatch |
| writes | order | design/brief/orders.md#cancelling-the-remainder |
| reads | shipment | design/brief/orders.md#picking-and-preparing-a-shipment |
| writes | shipment | design/brief/orders.md#authorising-collection |
| reads | accounts/customer-account | design/brief/orders.md#confirming-an-order |
| writes | accounts/customer-account | design/brief/accounts.md#exposure-before-and-after-collection |
| reads | accounts/obligation | design/brief/orders.md#cancelling-the-remainder |
| writes | accounts/obligation | design/brief/orders.md#authorising-collection |
| reads | accounts/invoice | design/brief/orders.md#cancelling-the-remainder |
| calls | sales | design/brief/orders.md#orders-and-dispatch |
| calls | picker | design/brief/orders.md#picking-and-preparing-a-shipment |
| calls | customer | design/brief/orders.md#cancelling-the-remainder |
| calls | carrier | design/brief/orders.md#authorising-collection |
