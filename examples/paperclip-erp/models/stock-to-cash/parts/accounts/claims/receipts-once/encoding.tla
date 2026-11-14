Property ==
  /\ [](/\ \A p \in Receipts:
            IF db.receiptShipment[p] = 0 THEN db.receiptAmount[p] = 0
            ELSE /\ db.receiptShipment[p] \in db.issued
                 /\ db.receiptAmount[p] > 0
       /\ \A s \in Shipments:
            /\ db.balance[s] >= 0
            /\ IF s \in db.issued
               THEN db.balance[s] = db.invoiceOriginal[s] - Paid(s)
               ELSE db.balance[s] = 0)
  /\ [][
       /\ \A p \in Receipts:
            IF db.receiptShipment[p] # 0
            THEN /\ db'.receiptShipment[p] = db.receiptShipment[p]
                 /\ db'.receiptAmount[p] = db.receiptAmount[p]
            ELSE IF db'.receiptShipment[p] # 0
                 THEN LET s == db'.receiptShipment[p]
                          a == db'.receiptAmount[p]
                      IN /\ s \in db.issued
                         /\ a > 0 /\ a <= db.balance[s]
                         /\ db'.balance[s] = db.balance[s] - a
                         /\ db'.exposure[db.invoiceCustomer[s]] = db.exposure[db.invoiceCustomer[s]] - a
                 ELSE TRUE
       /\ \A s \in db.issued:
            db'.balance[s] = db.balance[s] -
              SumOn({p \in Receipts: db.receiptShipment[p] = 0 /\ db'.receiptShipment[p] = s}, db'.receiptAmount)
       /\ (db'.confirmed = db.confirmed /\ db'.orderPhase = db.orderPhase /\ db'.issued = db.issued)
          => (\A c \in Customers:
               db'.exposure[c] = db.exposure[c] -
                 SumOn({p \in Receipts: db.receiptShipment[p] = 0 /\
                   (IF db'.receiptShipment[p] = 0 THEN FALSE
                    ELSE db'.invoiceCustomer[db'.receiptShipment[p]] = c)}, db'.receiptAmount))
     ]_vars
