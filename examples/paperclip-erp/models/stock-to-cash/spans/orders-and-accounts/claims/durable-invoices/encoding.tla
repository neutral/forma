Property ==
  /\ [](/\ \A s \in Shipments:
            /\ (s \in db.issued => db.shipmentPhase[s] = "collected")
            /\ db.invoiceCount[s] = (IF s \in db.issued THEN 1 ELSE 0)
            /\ db.pending[s] =
                 (IF db.shipmentPhase[s] = "collected" /\ s \notin db.issued
                  THEN Cardinality(db.shipmentCartons[s]) ELSE 0)
            /\ (db.shipmentPhase[s] = "collected" => Cardinality(db.shipmentCartons[s]) > 0)
            /\ (s \in db.issued =>
                 /\ db.invoiceCustomer[s] = db.orderCustomer[db.shipmentOrder[s]]
                 /\ db.invoiceOriginal[s] = Cardinality(db.shipmentCartons[s])
                 /\ db.balance[s] = db.invoiceOriginal[s] - Paid(s)
                 /\ db.balance[s] >= 0))
  /\ [][
       /\ db.issued \subseteq db'.issued
       /\ \A s \in Shipments:
            /\ (db.shipmentPhase[s] = "collected" =>
                 /\ db'.shipmentPhase[s] = "collected"
                 /\ db'.shipmentOrder[s] = db.shipmentOrder[s]
                 /\ db'.shipmentCartons[s] = db.shipmentCartons[s])
            /\ (s \in db.issued =>
                 /\ db'.invoiceCustomer[s] = db.invoiceCustomer[s]
                 /\ db'.invoiceOriginal[s] = db.invoiceOriginal[s]
                 /\ db'.balance[s] <= db.balance[s])
     ]_vars
