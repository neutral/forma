# Boundary and shared records

## Boundary

| Row | Names | Kind | Side | Seam | Isolation | Reads | Writes | Origin | Cites |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| finance | Finance staff issuing invoices and truthfully matching and applying bank receipts | actor | world | person | - | - | - | stated | design/brief/accounts.md#customer-credit-invoices-and-receipts, design/brief/accounts.md#issuing-invoices, design/brief/accounts.md#recording-payment |
| customer-account | A customer account with its fixed finance-set credit limit and exposure across commitments, uninvoiced collections and unpaid invoices | entity | machine | - | - | finance, orders/sales, orders/customer, orders/carrier | finance, orders/sales, orders/customer, orders/carrier | stated | design/brief/accounts.md#customer-credit-invoices-and-receipts, design/brief/accounts.md#exposure-before-and-after-collection |
| obligation | The durable duty to invoice one collected shipment, retained until its invoice exists | entity | machine | - | - | finance, orders/customer, orders/carrier | finance, orders/carrier | stated | design/brief/accounts.md#issuing-invoices, design/brief/orders.md#authorising-collection, design/brief/orders.md#cancelling-the-remainder |
| invoice | One shipment-identified invoice with its customer, original amount and remaining balance | entity | machine | - | - | finance, orders/sales, orders/customer | finance | stated | design/brief/accounts.md#issuing-invoices, design/brief/accounts.md#recording-payment |
| receipt | A bank receipt whose successful unique reference fixes one invoice and one positive amount | entity | machine | - | - | finance | finance | stated | design/brief/accounts.md#recording-payment, design/brief/overview.md#the-boundary-of-the-result |

## Surface

| Direction | Name | Cites |
| --- | --- | --- |
| reads | stock/records | design/brief/overview.md#the-boundary-of-the-result |
| writes | stock/records | design/brief/overview.md#the-boundary-of-the-result |
| reads | stock/batch | design/brief/stories.md#northline-buys-then-pays |
| reads | stock/carton | design/brief/stories.md#northline-buys-then-pays |
| reads | orders/order | design/brief/accounts.md#issuing-invoices |
| reads | orders/shipment | design/brief/accounts.md#issuing-invoices |
| reads | customer-account | design/brief/accounts.md#exposure-before-and-after-collection |
| writes | customer-account | design/brief/accounts.md#recording-payment |
| reads | obligation | design/brief/accounts.md#issuing-invoices |
| writes | obligation | design/brief/accounts.md#issuing-invoices |
| reads | invoice | design/brief/accounts.md#recording-payment |
| writes | invoice | design/brief/accounts.md#issuing-invoices |
| reads | receipt | design/brief/accounts.md#recording-payment |
| writes | receipt | design/brief/accounts.md#recording-payment |
| calls | finance | design/brief/accounts.md#recording-payment |
