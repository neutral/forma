Property ==
  /\ [](
       /\ \A c \in Cartons:
            /\ db.collectionCount[c] <= 1
            /\ db.collectionCount[c] = (IF db.collectedBy[c] = 0 THEN 0 ELSE 1)
            /\ (db.collectedBy[c] # 0 =>
                 LET s == db.collectedBy[c]
                 IN /\ db.shipmentPhase[s] = "collected" /\ c \in db.shipmentCartons[s]
                    /\ c \notin db.onHand /\ db.reserved[c] = 0 /\ db.picked[c] = 0))
  /\ [][
       /\ \A c \in Cartons:
            IF db.collectedBy[c] # 0
            THEN /\ db'.collectedBy[c] = db.collectedBy[c]
                 /\ db'.collectionCount[c] = db.collectionCount[c]
            ELSE db'.collectedBy[c] # 0 =>
                   LET s == db'.collectedBy[c] o == db.shipmentOrder[s]
                   IN /\ db.shipmentPhase[s] = "prepared" /\ db.orderPhase[o] = "open"
                      /\ c \in db.shipmentCartons[s] /\ db'.shipmentPhase[s] = "collected"
                      /\ db'.shipmentOrder[s] = o /\ db'.shipmentCartons[s] = db.shipmentCartons[s]
                      /\ \A x \in db.shipmentCartons[s]:
                           /\ x \in db.onHand /\ db.reserved[x] = o /\ Released(x)
                           /\ db'.collectedBy[x] = s /\ db'.collectionCount[x] = db.collectionCount[x] + 1
       /\ \A s \in Shipments:
            db.shipmentPhase[s] = "collected" => db'.shipmentPhase[s] = "collected"
     ]_vars
