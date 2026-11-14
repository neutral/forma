# What this slice leaves out

| Passage | Reason |
| --- | --- |
| design/brief/overview.md#the-business-we-examine | Wire purchasing, line scheduling, work in progress, card capture, refunds, tax, credit notes, bad debt, accounting export, customer login and delivery tracking are explicitly outside this slice; the single warehouse, one product and fixed £10 price remain in the restatement. |
| design/brief/overview.md#the-boundary-of-the-result | Database guarantee implementation and recovery from storage failure are carried as the serial-commits premise, while eventual action by staff, customers or carrier is not claimed; no liveness claim is made. |
| design/brief/stock.md#recording-a-batch | Count corrections, scrapping, transfers and product substitutions are explicitly excluded; receipt, quality and availability are restated. |
| design/brief/stock.md#holds-after-release | The completeness of retained customer and shipment links is examined; contacting customers, retrieving goods and the quality of the physical inspection are not. |
