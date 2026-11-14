Property ==
  /\ [](/\ \A o \in Orders:
            /\ (db.orderPhase[o] \in {"unrecorded","draft"} =>
                 /\ o \notin db.confirmed /\ db.orderCartons[o] = {}
                 /\ Reserved(o) = {} /\ db.commitment[o] = 0)
            /\ (o \in db.confirmed => Cardinality(db.orderCartons[o]) = db.orderQty[o]))
  /\ [][
       /\ db.confirmed \subseteq db'.confirmed
       /\ IF observation'.failed = {} THEN TRUE
          ELSE LET n == observation'.raw
                   o == CmdId(n) customer == CmdA(n) q == CmdB(n) cs == CmdCartons(n)
                   noConfirmationEffect ==
                     /\ db'.confirmed = db.confirmed
                     /\ db'.orderPhase = db.orderPhase
                     /\ db'.orderCustomer = db.orderCustomer
                     /\ db'.orderQty = db.orderQty
                     /\ db'.orderCartons = db.orderCartons
                     /\ db'.reserved = db.reserved
                     /\ db'.commitment = db.commitment
                     /\ db'.exposure = db.exposure
               IN CASE CmdKind(n) = 4 -> db'.exposure = db.exposure
                    [] CmdKind(n) = 5 ->
                         IF o \notin Orders \/ customer \notin Customers
                         THEN noConfirmationEffect
                         ELSE IF o \notin db.confirmed /\ o \in db'.confirmed
                              THEN /\ db.orderPhase[o] = "draft"
                                   /\ db.orderCustomer[o] = customer /\ db.orderQty[o] = q
                                   /\ Cardinality(cs) = q /\ cs \subseteq Available
                                   /\ db'.orderCartons[o] = cs
                                   /\ db'.confirmed = db.confirmed \cup {o}
                                   /\ \A x \in Cartons:
                                        db'.reserved[x] = IF x \in cs THEN o ELSE db.reserved[x]
                                   /\ \A other \in Orders:
                                        db'.commitment[other] = IF other = o THEN q ELSE db.commitment[other]
                                   /\ \A c \in Customers:
                                        db'.exposure[c] = db.exposure[c] + (IF c = customer THEN q ELSE 0)
                              ELSE noConfirmationEffect
                    [] OTHER -> TRUE
       /\ \A o \in Orders:
            /\ (o \in db.confirmed =>
                 /\ db'.orderCartons[o] = db.orderCartons[o]
                 /\ db'.orderCustomer[o] = db.orderCustomer[o]
                 /\ db'.orderQty[o] = db.orderQty[o])
            /\ (o \notin db.confirmed /\ o \in db'.confirmed =>
                 /\ db.orderPhase[o] = "draft" /\ db'.orderPhase[o] = "open"
                 /\ db'.orderCustomer[o] = db.orderCustomer[o]
                 /\ db'.orderQty[o] = db.orderQty[o]
                 /\ Cardinality(db'.orderCartons[o]) = db.orderQty[o]
                 /\ db'.orderCartons[o] \subseteq Available
                 /\ {x \in Cartons: db'.reserved[x] = o} = db'.orderCartons[o]
                 /\ db'.commitment[o] = db.orderQty[o]
                 /\ db'.exposure[db.orderCustomer[o]] = db.exposure[db.orderCustomer[o]] + db.orderQty[o])
            /\ (db.orderPhase[o] = "draft" /\ o \notin db'.confirmed =>
                 /\ db'.orderPhase[o] = "draft"
                 /\ db'.orderCustomer[o] = db.orderCustomer[o]
                 /\ db'.orderQty[o] = db.orderQty[o])
     ]_vars
