Property ==
  /\ [](
       /\ \A o \in Orders:
            db.orderPhase[o] = "cancelled" =>
              /\ db.commitment[o] = 0
              /\ \A c \in Cartons:
                   /\ db.reserved[c] # o
                   /\ (db.picked[c] # 0 => db.shipmentOrder[db.picked[c]] # o)
              /\ \A s \in Shipments:
                   db.shipmentOrder[s] = o => db.shipmentPhase[s] \in {"void","collected"}
       /\ \A c \in Cartons: ~Released(c) => c \notin Available)
  /\ [][\A o \in Orders:
       /\ (db.orderPhase[o] = "cancelled" =>
            /\ db'.orderPhase[o] = "cancelled"
            /\ \A s \in Shipments:
                 /\ (db.shipmentOrder[s] = o =>
                      /\ db'.shipmentPhase[s] = db.shipmentPhase[s]
                      /\ db'.shipmentOrder[s] = o /\ db'.shipmentCartons[s] = db.shipmentCartons[s])
                 /\ (db.shipmentOrder[s] # o => db'.shipmentOrder[s] # o))
       /\ (db.orderPhase[o] # "cancelled" /\ db'.orderPhase[o] = "cancelled" =>
            /\ db.orderPhase[o] = "open" /\ o \in db.confirmed /\ Remaining(o) # {}
            /\ db'.commitment[o] = 0
            /\ db'.exposure[db.orderCustomer[o]] = db.exposure[db.orderCustomer[o]] - Cardinality(Remaining(o))
            /\ \A c \in Remaining(o): db'.reserved[c] = 0 /\ db'.picked[c] = 0
            /\ \A s \in Shipments:
                 /\ (db.shipmentOrder[s] = o /\ db.shipmentPhase[s] = "prepared" => db'.shipmentPhase[s] = "void")
                 /\ (db.shipmentPhase[s] = "collected" =>
                      /\ db'.shipmentPhase[s] = "collected"
                      /\ db'.shipmentOrder[s] = db.shipmentOrder[s]
                      /\ db'.shipmentCartons[s] = db.shipmentCartons[s])
            /\ db'.pending = db.pending /\ db'.issued = db.issued
            /\ db'.invoiceCount = db.invoiceCount /\ db'.invoiceCustomer = db.invoiceCustomer
            /\ db'.invoiceOriginal = db.invoiceOriginal /\ db'.balance = db.balance
            /\ db'.receiptShipment = db.receiptShipment /\ db'.receiptAmount = db.receiptAmount
            /\ db'.collectedBy = db.collectedBy /\ db'.collectionCount = db.collectionCount
            /\ db'.batchPhase = db.batchPhase /\ db'.revision = db.revision
            /\ db'.onHand = db.onHand)
     ]_vars
