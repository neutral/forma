Property ==
  /\ [](/\ \A c \in Customers: db.exposure[c] = Exposure(c)
       /\ \A o \in Orders:
            db.commitment[o] = (IF db.orderPhase[o] = "open" THEN Cardinality(Remaining(o)) ELSE 0)
       /\ \A s \in Shipments:
            /\ db.pending[s] =
                 (IF db.shipmentPhase[s] = "collected" /\ s \notin db.issued
                  THEN Cardinality(db.shipmentCartons[s]) ELSE 0)
            /\ db.balance[s] =
                 (IF s \in db.issued THEN Cardinality(db.shipmentCartons[s]) - Paid(s) ELSE 0)
            /\ db.balance[s] >= 0)
  /\ [][\A c \in Customers:
       db'.exposure[c] = db.exposure[c]
         + SumOn({o \in db'.confirmed \ db.confirmed: db'.orderCustomer[o] = c}, db'.orderQty)
         - SumOn({o \in Orders: db.orderCustomer[o] = c /\ db.orderPhase[o] # "cancelled" /\
                     db'.orderPhase[o] = "cancelled"}, db.commitment)
         - SumOn({p \in Receipts: db.receiptShipment[p] = 0 /\
                    (IF db'.receiptShipment[p] = 0 THEN FALSE
                     ELSE db'.invoiceCustomer[db'.receiptShipment[p]] = c)}, db'.receiptAmount)
     ]_vars
