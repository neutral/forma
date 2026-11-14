# Coil & Clip: stock to cash

| Part | Purpose | Cites |
| --- | --- | --- |
| stock | Record identified finished cartons and current batch quality while retaining their history. | design/brief/overview.md#coil--clip-from-factory-stock-to-a-paid-invoice, design/brief/overview.md#the-business-we-examine, design/brief/stock.md#finished-cartons-and-quality, design/brief/stock.md#recording-a-batch, design/brief/stock.md#holds-after-release |
| orders | Reserve stock and credit for orders, prepare fixed shipments, and settle collection or cancellation at the handoff. | design/brief/orders.md#orders-and-dispatch, design/brief/orders.md#confirming-an-order, design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/orders.md#authorising-collection, design/brief/orders.md#cancelling-the-remainder |
| accounts | Keep customer exposure correct as collected shipments become invoices and bank receipts settle them. | design/brief/accounts.md#customer-credit-invoices-and-receipts, design/brief/accounts.md#exposure-before-and-after-collection, design/brief/accounts.md#issuing-invoices, design/brief/accounts.md#recording-payment, design/brief/stories.md#a-week-at-coil--clip |

1. [Stock and quality](parts/stock/)
2. [Orders and dispatch](parts/orders/)
3. [Customer accounts](parts/accounts/)
4. [Stock meets dispatch](spans/stock-and-orders/)
5. [Dispatch meets credit](spans/orders-and-accounts/)
6. [The connected stock-to-cash story](spans/stock-to-cash/)
