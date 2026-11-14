Property ==
  /\ [](
       /\ \A c \in Cartons:
            db.collectionCount[c] > 0 => db.collectedBy[c] \in Shipments
       /\ \A s \in Shipments:
            db.shipmentPhase[s] = "collected" =>
              \A c \in db.shipmentCartons[s]:
                db.collectedBy[c] = s /\ db.collectionCount[c] > 0
       /\ \A c \in Cartons:
            db.collectedBy[c] # 0 =>
              LET s == db.collectedBy[c] b == db.cartonBatch[c] o == db.shipmentOrder[s]
              IN /\ b \in Batches /\ c \in db.batchCartons[b]
                 /\ c \notin db.onHand /\ db.reserved[c] = 0 /\ db.picked[c] = 0
                 /\ db.shipmentPhase[s] = "collected" /\ c \in db.shipmentCartons[s]
                 /\ o \in db.confirmed /\ db.orderCustomer[o] \in Customers
       /\ \A s \in Shipments:
            db.shipmentPhase[s] # "unprepared" =>
              /\ db.shipmentOrder[s] \in db.confirmed
              /\ db.orderCustomer[db.shipmentOrder[s]] \in Customers
       /\ \A s \in db.issued:
            /\ db.shipmentPhase[s] = "collected" /\ db.invoiceCount[s] = 1
            /\ db.invoiceCustomer[s] = db.orderCustomer[db.shipmentOrder[s]]
            /\ db.balance[s] = db.invoiceOriginal[s] - Paid(s) /\ db.balance[s] >= 0)
  /\ [][
       /\ \A c \in Cartons:
            db.collectedBy[c] # 0 =>
              /\ db'.collectedBy[c] = db.collectedBy[c]
              /\ db'.cartonBatch[c] = db.cartonBatch[c]
              /\ db'.collectionCount[c] = db.collectionCount[c]
       /\ \A s \in Shipments:
            db.shipmentPhase[s] # "unprepared" =>
              /\ db'.shipmentOrder[s] = db.shipmentOrder[s]
              /\ db'.shipmentCartons[s] = db.shipmentCartons[s]
              /\ db'.orderCustomer[db.shipmentOrder[s]] = db.orderCustomer[db.shipmentOrder[s]]
              /\ (db.shipmentPhase[s] \in {"collected","void"} => db'.shipmentPhase[s] = db.shipmentPhase[s])
       /\ db.issued \subseteq db'.issued
       /\ \A s \in db.issued:
            /\ db'.invoiceCustomer[s] = db.invoiceCustomer[s]
            /\ db'.invoiceOriginal[s] = db.invoiceOriginal[s]
            /\ db'.invoiceCount[s] = db.invoiceCount[s]
            /\ db'.balance[s] <= db.balance[s]
       /\ \A p \in Receipts:
            db.receiptShipment[p] # 0 =>
              /\ db'.receiptShipment[p] = db.receiptShipment[p]
              /\ db'.receiptAmount[p] = db.receiptAmount[p]
       /\ \A o \in Orders:
            db.orderPhase[o] = "cancelled" => db'.orderPhase[o] = "cancelled"
       /\ (\E k \in Decisions: db.qaKind[k] = 0 /\ db'.qaKind[k] = 2) =>
            /\ db'.collectedBy = db.collectedBy /\ db'.collectionCount = db.collectionCount
            /\ db'.shipmentPhase = db.shipmentPhase /\ db'.shipmentOrder = db.shipmentOrder
            /\ db'.orderPhase = db.orderPhase /\ db'.issued = db.issued
            /\ db'.pending = db.pending /\ db'.balance = db.balance
            /\ db'.receiptShipment = db.receiptShipment /\ db'.receiptAmount = db.receiptAmount
     ]_vars
