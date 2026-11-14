Property ==
  /\ [](
       /\ \A o \in Orders:
            db.orderPhase[o] = "open" /\ o \in db.confirmed =>
              \A c \in Remaining(o): c \in db.onHand /\ db.reserved[c] = o
       /\ \A c \in Cartons:
            /\ (db.reserved[c] # 0 =>
                 /\ c \in db.onHand /\ db.reserved[c] \in db.confirmed
                 /\ db.orderPhase[db.reserved[c]] = "open"
                 /\ c \in Remaining(db.reserved[c]))
            /\ (db.picked[c] # 0 =>
                 LET s == db.picked[c]
                 IN /\ c \in db.onHand /\ db.shipmentPhase[s] = "prepared"
                    /\ c \in db.shipmentCartons[s] /\ db.reserved[c] = db.shipmentOrder[s])
       /\ Available = {c \in Cartons: c \in db.onHand /\ db.reserved[c] = 0 /\ Released(c)})
  /\ [][\A c \in Cartons:
       /\ (db'.reserved[c] # 0 /\ db'.reserved[c] # db.reserved[c] =>
            /\ db.reserved[c] = 0 /\ c \in db.onHand /\ Released(c))
       /\ (db'.picked[c] # 0 /\ db'.picked[c] # db.picked[c] =>
            /\ db.picked[c] = 0 /\ c \in db.onHand /\ Released(c)
            /\ db.reserved[c] = db'.shipmentOrder[db'.picked[c]])
     ]_vars
